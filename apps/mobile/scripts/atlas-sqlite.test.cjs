/* Synthetic compatibility tests. Never opens an owner database or native app. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../src');
const importSource = fs.readFileSync(path.join(sourceRoot, 'import-record/repository.ts'), 'utf8');
const canonicalManualSchema = importSource.match(/const manualJourneyTableSchema = `([\s\S]*?)`;/)?.[1];
const migrationDefinitions = [...importSource.matchAll(/const migrationV(\d+) = `([\s\S]*?)`;/g)]
  .map(([, version, sql]) => ({ version: Number(version), sql: sql.replace('${manualJourneyTableSchema}', () => {
    assert.equal(typeof canonicalManualSchema, 'string', 'The v33 canonical table DDL must exist.');
    return canonicalManualSchema;
  }) }));
const schemaVersion = Number(importSource.match(/const CURRENT_SCHEMA_VERSION = (\d+);/)[1]);
assert.equal(migrationDefinitions.length, schemaVersion, 'Every schema version needs an executable fixture migration.');

// Reuse the benchmark's installed TypeScript compiler; no new runtime packages.
require.extensions['.ts'] = (compiledModule, filename) => {
  compiledModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText, filename);
};
let activeDatabase;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, ...arguments_) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : request, ...arguments_);
};
const originalLoad = Module._load;
Module._load = function loadNativeBoundary(request, ...arguments_) {
  if (request === 'expo-sqlite') return {
    openDatabaseAsync: async (name) => {
      assert.equal(name, 'travel-life-import-v1.db');
      assert.ok(activeDatabase, 'A synthetic database must be selected before opening a repository.');
      return activeDatabase;
    },
  };
  return originalLoad.call(this, request, ...arguments_);
};

const { createNativeImportRepository, ensureNativeImportSchema } = require(path.join(sourceRoot, 'import-record/repository.ts'));
const { createNativeReconstructionRepository } = require(path.join(sourceRoot, 'reconstruction/repository.ts'));
const { classifyAppDiagnosticError } = require(path.join(sourceRoot, 'diagnostics/app-diagnostics.ts'));

function syntheticDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const statements = [];
  const calls = [];
  const failures = [];
  let injectedFailure = null;
  let beforeStatement = null;
  function execute(sql, action) {
    statements.push(sql);
    if (beforeStatement && beforeStatement.pattern.test(sql)) {
      const hook = beforeStatement.action;
      beforeStatement = null;
      hook();
    }
    if (injectedFailure && injectedFailure.pattern.test(sql)) {
      const failure = injectedFailure.error;
      injectedFailure = null;
      throw failure;
    }
    try { return action(); }
    catch (error) { failures.push(error); throw error; }
  }
  const adapter = {
    execAsync: async (sql) => execute(sql, () => sqlite.exec(sql)),
    runAsync: async (sql, ...parameters) => execute(sql, () => sqlite.prepare(sql).run(...parameters)),
    getFirstAsync: async (sql, ...parameters) => execute(sql, () => sqlite.prepare(sql).get(...parameters) ?? null),
    getAllAsync: async (sql, ...parameters) => execute(sql, () => sqlite.prepare(sql).all(...parameters)),
  };
  for (const method of Object.keys(adapter)) {
    const original = adapter[method];
    adapter[method] = (...args) => { calls.push([method, ...args]); return original(...args); };
  }
  return { sqlite, adapter, statements, calls, failures,
    beforeNext: (pattern, action) => { beforeStatement = { pattern, action }; },
    failOnce: (pattern, error = new Error('Synthetic SQLite operation failure.')) => { injectedFailure = { pattern, error }; } };
}

function retainHistoricalSchema(database, version) {
  database.sqlite.exec('CREATE TABLE import_schema_version (version INTEGER NOT NULL)');
  for (const migration of migrationDefinitions.filter((entry) => entry.version <= version)) database.sqlite.exec(migration.sql);
  database.sqlite.prepare('INSERT INTO import_schema_version (version) VALUES (?)').run(version);
}

async function withDatabase(run) {
  const database = syntheticDatabase();
  activeDatabase = database.adapter;
  try { await run(database); }
  finally { activeDatabase = undefined; database.sqlite.close(); }
}

function syntheticCandidates() {
  return [0, 1, 2].map((offset) => ({
    assetId: `synthetic-source-${offset}`, mediaType: 'image',
    capturedAtMillis: Date.UTC(2025, 0, 2 + offset), capturedDay: `2025-01-0${2 + offset}`,
    hasPreciseOffset: true, modifiedAtMillis: null, locationAvailable: true,
    latitude: 10, longitude: 100, reportedAccuracyMeters: 10, availability: 'available',
  }));
}

async function importSyntheticEvidence(repository) {
  await repository.commitPage({ scope: 'full', nextOffset: 3, scanned: 3, geotagged: 3, unavailable: 0, status: 'complete' }, syntheticCandidates());
}

test('reviewed privacy hides manual records durably, restores, and delete-all clears policies', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.connectPrivateRecord();
  const repository = createNativeReconstructionRepository();
  const created = await repository.createManualJourney(manualJourney());
  const displayId = typeof created === 'string' ? created : created.displayId;
  assert.equal(typeof repository.reviewJourneyPrivacy, 'function', 'Reviewed privacy commands must exist');
  const review = await repository.reviewJourneyPrivacy(displayId, 0);
  assert.equal(review.ownerEntered, true);
  await assert.rejects(repository.saveJourneyPrivacy(review.reviewId, 'exclude', 'manual-exclude'));
  await repository.saveJourneyPrivacy(review.reviewId, 'hide', 'manual-hide');
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  await assert.rejects(repository.loadJourneyDetail(displayId));
  const restarted = createNativeReconstructionRepository();
  const policies = await restarted.loadJourneyPrivacyPolicies();
  assert.equal(policies.length, 1);
  await restarted.restoreJourneyPrivacy(policies[0].policyId, policies[0].revision, 'manual-restore');
  assert.equal((await restarted.loadDurableReveal()).journeys.length, 1);
  await importer.deleteLocalHistory();
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM journey_privacy_revision').get().count, 0);
}));

test('reviewed privacy filters all inferred reads, visible statistics and stale selections through rescan', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const eligible = await repository.loadJourneyEligibility(displayId, review.snapshotToken, 'share');
  assert.equal(eligible.eligible, true);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  assert.equal(scope.supportingPhotoCount, 3);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'inferred-hide');
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'inferred-hide');
  const hidden = await repository.loadDurableReveal();
  assert.equal(hidden.journeys.length, 0);
  assert.equal(hidden.statistics.journeyCount, 0);
  assert.equal(hidden.statistics.placeCount, 0);
  assert.equal(hidden.statistics.supportedCountryCount, 0);
  await assert.rejects(repository.loadJourneyDetail(displayId));
  await assert.rejects(repository.loadJourneyMediaPage(displayId, review.snapshotToken, 0));
  await assert.rejects(repository.loadUncertainMemories(displayId, review.snapshotToken));
  assert.equal((await repository.loadJourneyEligibility(displayId, review.snapshotToken, 'share', eligible.privacyRevision)).eligible, false);
  await importSyntheticEvidence(createNativeImportRepository());
  await repository.rebuild(3500);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  database.sqlite.exec("INSERT OR REPLACE INTO maintenance_change_queue (asset_id, change_kind, source_revision) VALUES ('synthetic-source-0', 'modified', 99)");
  await repository.reconcileQueued(3550);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  const policies = await repository.loadJourneyPrivacyPolicies();
  await repository.restoreJourneyPrivacy(policies[0].policyId, policies[0].revision, 'inferred-restore');
  assert.equal((await repository.loadDurableReveal()).journeys.length, 1);
}));

test('Replay manifest input follows the completed policy-visible Journey List and withholds hidden media', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const current = database.sqlite.prepare("SELECT journey_id, run_id FROM reconstruction_journey WHERE run_id = (SELECT MAX(run_id) FROM reconstruction_run WHERE status = 'complete') LIMIT 1").get();
  database.sqlite.exec(`INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES ('replay-journey', ${current.run_id}, 'inferred');
    INSERT INTO reconstruction_trip_qualification (run_id, journey_id, classification, score, reasons_json) VALUES (${current.run_id}, 'replay-journey', 'USER_CONFIRMED', 0, '[]');
    INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json) VALUES ('replay-place', ${current.run_id}, 'synthetic-source-0', '[]');
    INSERT INTO reconstruction_visit (visit_id, run_id, place_id, ordering) VALUES ('replay-visit', ${current.run_id}, 'replay-place', 'chronological');
    INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (${current.run_id}, 'journey-visit', 'replay-journey', 'replay-visit'), (${current.run_id}, 'visit-support', 'replay-visit', 'synthetic-source-0'), (${current.run_id}, 'membership:primary', 'replay-journey', 'synthetic-source-0');`);
  const before = await repository.loadReplayManifestInput();
  assert.equal(before.snapshotToken, review.snapshotToken);
  assert.equal(before.groups.length, 2);
  assert.ok(before.groups.every((group) => typeof group.key === 'string' && !group.key.includes('replay-journey')));
  const orderedDraft = [before.memories[1].key, before.memories[0].key];
  await assert.rejects(repository.saveReplayDraft(orderedDraft, before.snapshotToken + 1, before.privacyRevision), /Replay draft is stale/);
  await repository.saveReplayDraft(orderedDraft, before.snapshotToken, before.privacyRevision, 'newest-first');
  const afterDraft = await repository.loadReplayManifestInput();
  assert.equal(afterDraft.memories.filter((memory) => memory.intent === 'keep').length, 2);
  assert.deepEqual(afterDraft.memories.filter((memory) => memory.intent === 'keep').sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((memory) => memory.key), orderedDraft);
  assert.equal(afterDraft.direction, 'newest-first');
  assert.ok(afterDraft.memories.every((memory) => !memory.key.includes('synthetic-source')));
  await repository.resetReplayDraft(afterDraft.snapshotToken, afterDraft.privacyRevision);
  const resetDraft = await repository.loadReplayManifestInput();
  assert.ok(resetDraft.memories.every((memory) => memory.intent === undefined && memory.order === undefined));
  assert.equal(resetDraft.direction, 'oldest-first');
  // Gallery access can still resolve an asset whose import-time availability is
  // unknown and whose original capture date is absent. Replay must retain that
  // effective attachment for the provider's local access check instead of
  // misreporting an empty memory set.
  database.sqlite.exec("UPDATE canonical_evidence SET availability = 'unknown', captured_day = NULL WHERE evidence_id = 'synthetic-source-0'");
  const unresolved = await repository.loadReplayManifestInput();
  assert.equal(unresolved.memories.length, 4);
  assert.ok(unresolved.memories.some((memory) => memory.available === false && memory.capture === undefined));
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'replay-hidden');
  const hidden = await repository.loadReplayManifestInput();
  // The policy scope propagates across shared supporting evidence, so neither
  // synthetic journey remains visible after this hide.
  assert.equal(hidden.groups.length, 0);
  // Both synthetic journeys deliberately share the same supporting item. Hiding
  // its first journey suppresses that item from the surviving trip as well.
  assert.equal(hidden.memories.length, 0);
}));

test('reviewed privacy excludes inputs and membership and preserves failed-write atomicity', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  database.failOnce(/INSERT INTO journey_privacy_revision/);
  await assert.rejects(repository.saveJourneyPrivacy(scope.reviewId, 'exclude', 'exclude-failure'));
  assert.equal((await repository.loadJourneyPrivacyPolicies()).length, 0);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 1);
  await repository.saveJourneyPrivacy(scope.reviewId, 'exclude', 'inferred-exclude');
  const graph = await repository.rebuild(3600);
  assert.equal(graph.journeys.length, 0);
  assert.equal(graph.memberships.length, 0);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM canonical_evidence').get().count, 3);
  assert.ok(database.sqlite.prepare('SELECT COUNT(*) AS count FROM journey_correction_revision').get().count > 0);
  const policy = (await repository.loadJourneyPrivacyPolicies())[0];
  await repository.restoreJourneyPrivacy(policy.policyId, policy.revision, 'restore-exclusion');
  await repository.rebuild(3700);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 1);
}));

test('reviewed privacy rejects stale scopes and validates retained policy layout', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.rebuild(3800);
  await assert.rejects(repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'stale-hide'));
  assert.equal((await repository.loadJourneyPrivacyPolicies()).length, 0);
  database.sqlite.exec('DROP TABLE journey_privacy_revision; UPDATE import_schema_version SET version = 99');
  await ensureNativeImportSchema(database.adapter);
  assert.equal(database.sqlite.prepare('SELECT version FROM import_schema_version').get().version, 99);
  database.sqlite.exec('DROP TABLE journey_privacy_revision; CREATE TABLE journey_privacy_revision (revision INTEGER)');
  await assert.rejects(ensureNativeImportSchema(database.adapter), (error) => error.name === 'LocalAtlasSchemaRecoveryError');
}));

test('reviewed privacy protects ambiguous successor split and merged scope without assigning by journey id', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'hide-lineage');
  const prior = database.sqlite.prepare('SELECT journey_id, run_id FROM reconstruction_journey LIMIT 1').get();
  for (const successor of ['synthetic-split-a', 'synthetic-split-b']) {
    database.sqlite.prepare("INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES (?, ?, 'inferred')").run(successor, prior.run_id);
    database.sqlite.prepare("INSERT INTO reconstruction_trip_qualification (run_id, journey_id, classification, score, reasons_json) VALUES (?, ?, 'USER_CONFIRMED', 0, '[]')").run(prior.run_id, successor);
    database.sqlite.prepare("INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) SELECT run_id, link_kind, ?, child_id FROM reconstruction_link WHERE run_id = ? AND parent_id = ? AND link_kind = 'journey-visit'").run(successor, prior.run_id, prior.journey_id);
  }
  database.sqlite.prepare('DELETE FROM reconstruction_journey WHERE journey_id = ?').run(prior.journey_id);
  database.sqlite.prepare('DELETE FROM reconstruction_trip_qualification WHERE journey_id = ?').run(prior.journey_id);
  database.sqlite.prepare("DELETE FROM reconstruction_link WHERE parent_id = ? AND link_kind = 'journey-visit'").run(prior.journey_id);
  assert.equal((await createNativeReconstructionRepository().loadDurableReveal()).journeys.length, 0);
  const policies = await repository.loadJourneyPrivacyPolicies();
  assert.equal(policies.length, 1);
  assert.equal(policies[0].status, 'protected');
  database.sqlite.exec("UPDATE reconstruction_journey SET journey_id = 'synthetic-merged' WHERE journey_id = 'synthetic-split-a'; UPDATE reconstruction_trip_qualification SET journey_id = 'synthetic-merged' WHERE journey_id = 'synthetic-split-a'; UPDATE reconstruction_link SET parent_id = 'synthetic-merged' WHERE parent_id = 'synthetic-split-a'");
  assert.equal((await createNativeReconstructionRepository().loadDurableReveal()).journeys.length, 0);
  await repository.restoreJourneyPrivacy(policies[0].policyId, policies[0].revision, 'restore-lineage');
  assert.equal((await repository.loadDurableReveal()).journeys.length, 2);
}));

test('reviewed privacy freezes reviewed duplicate input scope and withholds later family additions', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository, () => {
    database.sqlite.exec("UPDATE canonical_evidence SET platform_duplicate_family_id = 'synthetic-family', duplicate_tuple_version = 1, duplicate_tuple_fingerprint = 'synthetic-tuple' WHERE evidence_id IN ('synthetic-source-0', 'synthetic-source-1')");
  });
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  assert.equal(scope.duplicateFamilyCount, 1);
  assert.ok(scope.duplicatePhotoCount > 0);
  await repository.saveJourneyPrivacy(scope.reviewId, 'exclude', 'exclude-family');
  const stored = database.sqlite.prepare("SELECT reviewed_evidence_json FROM journey_privacy_revision WHERE policy_id = 'exclude-family'").get().reviewed_evidence_json;
  const source = database.sqlite.prepare("SELECT * FROM canonical_evidence WHERE evidence_id = 'synthetic-source-0'").get();
  insertCompatible(database, 'canonical_evidence', { ...source, evidence_id: 'synthetic-family-new', source_ref: 'synthetic-family-new' });
  await repository.rebuild(3900);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  assert.equal(database.sqlite.prepare("SELECT reviewed_evidence_json FROM journey_privacy_revision WHERE policy_id = 'exclude-family'").get().reviewed_evidence_json, stored);
  assert.ok(!JSON.parse(stored).includes('synthetic-family-new'));
  assert.equal((await repository.loadJourneyPrivacyPolicies()).length, 1);
}));

test('reviewed privacy rolls back a lifecycle race and failed durable read-back', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository(); await importer.connectPrivateRecord();
  const repository = createNativeReconstructionRepository();
  const displayId = await repository.createManualJourney(manualJourney());
  const scope = await repository.reviewJourneyPrivacy(displayId, 0);
  database.beforeNext(/INSERT INTO journey_privacy_revision/, () => database.sqlite.exec("UPDATE private_record_lifecycle SET state = 'disconnected'"));
  await assert.rejects(repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'lifecycle-hide'));
  assert.equal((await repository.loadJourneyPrivacyPolicies()).length, 0);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 1);
  database.beforeNext(/INSERT INTO journey_privacy_revision/, () => database.failOnce(/SELECT \* FROM journey_privacy_revision WHERE command_key/));
  await assert.rejects(repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'readback-hide'));
  assert.equal((await repository.loadJourneyPrivacyPolicies()).length, 0);
}));

test('reviewed privacy binds an idempotent command to its original reviewed target', async () => withDatabase(async () => {
  const importer = createNativeImportRepository(); await importer.connectPrivateRecord();
  const repository = createNativeReconstructionRepository();
  const first = await repository.createManualJourney(manualJourney());
  const firstReview = await repository.reviewJourneyPrivacy(first, 0);
  await repository.saveJourneyPrivacy(firstReview.reviewId, 'hide', 'bound-hide-command');
  await repository.saveJourneyPrivacy(firstReview.reviewId, 'hide', 'bound-hide-command');
  const second = await repository.createManualJourney({ ...manualJourney(), commandKey: 'synthetic-second-manual', date: { kind: 'exact', day: '2021-01-01' } });
  const secondReview = await repository.reviewJourneyPrivacy(second, 0);
  await assert.rejects(repository.saveJourneyPrivacy(secondReview.reviewId, 'hide', 'bound-hide-command'));
  assert.equal((await repository.loadDurableReveal()).journeys[0].displayId, second);
}));

function addPrivacySibling(database, sibling, { overlap = false } = {}) {
  const original = database.sqlite.prepare('SELECT * FROM reconstruction_journey LIMIT 1').get();
  const visit = database.sqlite.prepare('SELECT * FROM reconstruction_visit LIMIT 1').get();
  const place = database.sqlite.prepare('SELECT * FROM reconstruction_place LIMIT 1').get();
  const source = database.sqlite.prepare('SELECT * FROM canonical_evidence LIMIT 1').get();
  const evidenceId = overlap ? source.evidence_id : `${sibling}-source`;
  if (!overlap) insertCompatible(database, 'canonical_evidence', { ...source, evidence_id: evidenceId, source_ref: evidenceId });
  insertCompatible(database, 'reconstruction_place', { ...place, place_id: `${sibling}-place`, representative_evidence_id: evidenceId });
  insertCompatible(database, 'reconstruction_visit', { ...visit, visit_id: `${sibling}-visit`, place_id: `${sibling}-place` });
  insertCompatible(database, 'reconstruction_journey', { ...original, journey_id: sibling });
  database.sqlite.prepare("INSERT INTO reconstruction_trip_qualification (run_id, journey_id, classification, score, reasons_json) VALUES (?, ?, 'USER_CONFIRMED', 0, '[]')").run(original.run_id, sibling);
  database.sqlite.prepare("INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, 'journey-visit', ?, ?), (?, 'visit-support', ?, ?)").run(original.run_id, sibling, `${sibling}-visit`, original.run_id, `${sibling}-visit`, evidenceId);
}

test('reviewed privacy fallback scopes stay independent after hide A hide B restore A', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  addPrivacySibling(database, 'fallback-sibling');
  const otherId = await repository.createManualJourney({ ...manualJourney(), commandKey: 'other-fallback', date: { kind: 'exact', day: '2021-01-01' } });
  const beforeOverlap = await repository.loadDurableReveal();
  const siblingId = beforeOverlap.journeys.find((journey) => journey.displayId !== displayId && journey.displayId !== otherId).displayId;
  addPrivacySibling(database, 'fallback-overlapping', { overlap: true });
  const prior = await repository.loadDurableReveal();
  const scopeA = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  assert.equal(scopeA.affectedJourneyCount, 2);
  await repository.saveJourneyPrivacy(scopeA.reviewId, 'hide', 'fallback-A');
  const protectedPrior = await repository.applyJourneyPrivacyToRecord(prior);
  assert.equal(protectedPrior.journeys.length, 2);
  assert.ok(protectedPrior.journeys.some((journey) => journey.displayId === otherId));
  const scopeB = await repository.reviewJourneyPrivacy(siblingId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scopeB.reviewId, 'hide', 'fallback-B');
  const policyA = (await repository.loadJourneyPrivacyPolicies()).find((row) => row.policyId === 'fallback-A');
  await repository.restoreJourneyPrivacy(policyA.policyId, policyA.revision, 'restore-fallback-A');
  const filtered = await repository.applyJourneyPrivacyToRecord(prior);
  assert.ok(filtered.journeys.some((journey) => journey.displayId === displayId));
  assert.ok(filtered.journeys.some((journey) => journey.displayId === otherId));
  assert.ok(!filtered.journeys.some((journey) => journey.displayId === siblingId));
  assert.equal(filtered.statistics, null);
}));

test('reviewed privacy rejects cached home and memory selections before writing revisions', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const visit = database.sqlite.prepare("SELECT child_id FROM reconstruction_link WHERE link_kind = 'journey-visit' LIMIT 1").get().child_id;
  const memoryId = review.detail.memories[0].id;
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'hide-cached-target');
  const start = database.calls.length;
  await assert.rejects(repository.saveConfiguredHomeAreaFromJourney(displayId, 'stale-home', visit, 'Synthetic home', null, null));
  await assert.rejects(repository.saveJourneyMemoryCorrection(displayId, memoryId, 'assign', review.snapshotToken, 'stale-memory'));
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM configured_home_area').get().count, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM journey_memory_correction_revision').get().count, 0);
  assert.ok(!database.calls.slice(start).some(([, sql]) => /INSERT INTO (configured_home_area|journey_memory_correction_revision)/.test(sql)));
}));

for (const action of ['assign', 'move', 'reject', 'unassign']) test(`reviewed privacy exclusion suspends dependent ${action} memory activation and restores it`, async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  let { displayId, review } = await prepareConfirmedJourney(database, repository);
  await repository.saveJourneyMemoryCorrection(displayId, review.detail.memories[0].id, action, review.snapshotToken, `memory-${action}`);
  const revealed = await repository.loadDurableReveal();
  displayId = revealed.journeys[0].displayId;
  review = await repository.loadJourneyDetail(displayId);
  const revisions = database.sqlite.prepare('SELECT * FROM journey_memory_correction_revision').all();
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'exclude', `exclude-with-${action}`);
  const graph = await repository.rebuild(4100);
  assert.equal(graph.journeys.length, 0);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_memory_correction_revision').all(), revisions);
  const policy = (await repository.loadJourneyPrivacyPolicies())[0];
  await repository.restoreJourneyPrivacy(policy.policyId, policy.revision, `restore-with-${action}`);
  await repository.rebuild(4200);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 1);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_memory_correction_revision').all(), revisions);
  const latest = database.sqlite.prepare("SELECT MAX(run_id) AS run_id FROM reconstruction_run WHERE status = 'complete'").get().run_id;
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM journey_memory_correction_application WHERE run_id = ?').get(latest).count, 1);
}));

test('reviewed privacy exclusion suspends memory activation by reviewed support while its source stays included', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  let { displayId, review } = await prepareConfirmedJourney(database, repository);
  const source = database.sqlite.prepare('SELECT * FROM canonical_evidence LIMIT 1').get();
  insertCompatible(database, 'canonical_evidence', { ...source, evidence_id: 'support-dependent-memory', source_ref: 'support-dependent-memory', latitude: null, longitude: null });
  const candidates = await repository.loadUncertainMemories(displayId, review.snapshotToken);
  await repository.saveJourneyMemoryCorrection(displayId, candidates.memories[0].id, 'assign', review.snapshotToken, 'support-dependent-correction');
  displayId = (await repository.loadDurableReveal()).journeys[0].displayId;
  review = await repository.loadJourneyDetail(displayId);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'exclude', 'exclude-support-dependent');
  const storedScope = JSON.parse(database.sqlite.prepare("SELECT reviewed_evidence_json FROM journey_privacy_revision WHERE policy_id = 'exclude-support-dependent'").get().reviewed_evidence_json);
  assert.ok(!storedScope.includes('support-dependent-memory'));
  await repository.rebuild(4300);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM journey_memory_correction_revision WHERE command_key = 'support-dependent-correction' AND state = 'effective'").get().count, 1);
  const policy = (await repository.loadJourneyPrivacyPolicies())[0];
  await repository.restoreJourneyPrivacy(policy.policyId, policy.revision, 'restore-support-dependent');
  await repository.rebuild(4400);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 1);
}));

test('reviewed privacy exclusion preserves a persisted split and restores its activation', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  const initial = database.sqlite.prepare('SELECT journey_id, run_id FROM reconstruction_journey LIMIT 1').get();
  // A valid persisted boundary fixture, matching the existing graph-reuse case.
  // This does not establish native split entry/acceptance.
  insertCompatible(database, 'journey_correction_revision', {
    revision_id: 'privacy-effective-split', action: 'split', source_run_id: initial.run_id,
    journey_id: initial.journey_id, reviewed_support_json: JSON.stringify(['E:synthetic-source-0']),
    reviewed_visits_json: JSON.stringify([['E:synthetic-source-0']]),
    structural_boundary_json: JSON.stringify(['E:synthetic-source-0']), state: 'effective',
    created_at_millis: 1, command_key: 'privacy-effective-split',
  });
  const splitGraph = await repository.rebuild(4500);
  assert.ok(splitGraph.journeys.length > 0);
  database.sqlite.exec("UPDATE reconstruction_trip_qualification SET classification = 'USER_CONFIRMED'");
  const afterSplit = await repository.loadDurableReveal();
  const details = await Promise.all(afterSplit.journeys.map((journey) => repository.loadJourneyDetail(journey.displayId)));
  const detail = details.find((loaded) => loaded.detail.visits.some((visit) => visit.label === '2025-01-02'));
  const scope = await repository.reviewJourneyPrivacy(detail.detail.id, detail.snapshotToken);
  const revisions = database.sqlite.prepare('SELECT * FROM journey_correction_revision').all();
  await repository.saveJourneyPrivacy(scope.reviewId, 'exclude', 'exclude-owner-split');
  await repository.rebuild(4600);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_correction_revision').all(), revisions);
  const policy = (await repository.loadJourneyPrivacyPolicies())[0];
  await repository.restoreJourneyPrivacy(policy.policyId, policy.revision, 'restore-owner-split');
  const restored = await repository.rebuild(4700);
  assert.equal(restored.journeys.length, splitGraph.journeys.length);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_correction_revision').all(), revisions);
}));

test('reviewed privacy rejects malformed stored policy rows across reads and restore', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'malformed-policy');
  database.sqlite.exec("PRAGMA ignore_check_constraints = ON; UPDATE journey_privacy_revision SET action = 'synthetic-invalid-action'");
  await assert.rejects(repository.loadDurableReveal());
  await assert.rejects(repository.loadJourneyPrivacyPolicies());
  await assert.rejects(repository.restoreJourneyPrivacy('malformed-policy', 1, 'restore-malformed'));
}));

test('reviewed privacy rejects a cached memory protected by a different hidden journey', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  addPrivacySibling(database, 'memory-sibling');
  const source = database.sqlite.prepare('SELECT * FROM canonical_evidence LIMIT 1').get();
  insertCompatible(database, 'canonical_evidence', { ...source, evidence_id: 'synthetic-uncertain-private', source_ref: 'synthetic-uncertain-private', latitude: null, longitude: null });
  const rawA = database.sqlite.prepare("SELECT journey_id FROM reconstruction_journey WHERE journey_id <> 'memory-sibling'").get().journey_id;
  database.sqlite.prepare("INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, 'membership:inferred:ordered-24-hour-bracket', ?, 'synthetic-uncertain-private')").run(review.snapshotToken, rawA);
  const prior = await repository.loadDurableReveal();
  const siblingId = prior.journeys.find((journey) => journey.displayId !== displayId).displayId;
  const memoryPage = await repository.loadUncertainMemories(siblingId, review.snapshotToken);
  assert.equal(memoryPage.memories.length, 1);
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'hide-other-memory');
  assert.equal((await repository.loadJourneyDetail(siblingId)).detail.id, siblingId);
  const start = database.calls.length;
  await assert.rejects(repository.saveJourneyMemoryCorrection(siblingId, memoryPage.memories[0].id, 'assign', review.snapshotToken, 'cached-other-memory'));
  assert.ok(!database.calls.slice(start).some(([, sql]) => sql.includes('INSERT INTO journey_memory_correction_revision')));
}));

test('reviewed privacy overlap discovery and create use the exact visible reviewed set', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  addPrivacySibling(database, 'visible-overlap');
  const input = { ...manualJourney(), date: { kind: 'exact', day: '2025-01-02' }, commandKey: 'hidden-overlap-manual' };
  const existing = await repository.findManualJourneyOverlaps(input);
  assert.equal(existing.length, 2);
  const manualId = await repository.createManualJourney({ ...input, reviewedOverlapIds: existing.map((row) => row.id) });
  let scope = await repository.reviewJourneyPrivacy(manualId, 0);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'hide-overlap-manual');
  scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'hide-overlap-inferred');
  const visible = await repository.findManualJourneyOverlaps(input);
  assert.equal(visible.length, 1);
  assert.notEqual(visible[0].id, displayId);
  await repository.createManualJourney({ ...input, commandKey: 'new-visible-overlap', reviewedOverlapIds: visible.map((row) => row.id) });
  for (const policy of await repository.loadJourneyPrivacyPolicies()) await repository.restoreJourneyPrivacy(policy.policyId, policy.revision, `restore-${policy.revision}`);
  const restored = await repository.findManualJourneyOverlaps(input);
  assert.ok(restored.some((row) => row.id === displayId));
  assert.ok(restored.some((row) => row.id === manualId));
}));

for (const action of ['hide', 'exclude']) test(`reviewed privacy blocks cached home selection after ${action} before any insert`, async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, repository);
  const visit = database.sqlite.prepare("SELECT child_id FROM reconstruction_link WHERE link_kind = 'journey-visit' LIMIT 1").get().child_id;
  const scope = await repository.reviewJourneyPrivacy(displayId, review.snapshotToken);
  await repository.saveJourneyPrivacy(scope.reviewId, action, `cached-home-${action}`);
  const start = database.calls.length;
  await assert.rejects(repository.saveConfiguredHomeAreaFromJourney(displayId, 'privacy-home', visit, 'Synthetic home', null, null));
  assert.ok(!database.calls.slice(start).some(([, sql]) => sql.includes('INSERT INTO configured_home_area')));
}));

test('reviewed privacy rejects same-column policy schema missing constraints without rewriting rows', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository(); await importer.connectPrivateRecord();
  const repository = createNativeReconstructionRepository();
  const displayId = await repository.createManualJourney(manualJourney());
  const scope = await repository.reviewJourneyPrivacy(displayId, 0);
  await repository.saveJourneyPrivacy(scope.reviewId, 'hide', 'retained-unconstrained');
  database.sqlite.exec('CREATE TABLE synthetic_unconstrained AS SELECT * FROM journey_privacy_revision; DROP TABLE journey_privacy_revision; ALTER TABLE synthetic_unconstrained RENAME TO journey_privacy_revision');
  const before = database.sqlite.prepare('SELECT * FROM journey_privacy_revision').all();
  const ddl = database.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'journey_privacy_revision'").get().sql;
  await assert.rejects(ensureNativeImportSchema(database.adapter), (error) => error.name === 'LocalAtlasSchemaRecoveryError');
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_privacy_revision').all(), before);
  assert.equal(database.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'journey_privacy_revision'").get().sql, ddl);
}));

function manualJourney() {
  return {
    commandKey: 'synthetic-manual-command', label: 'Synthetic journey', context: 'Synthetic context',
    anchor: { latitude: 1, longitude: 2 }, date: { kind: 'exact', day: '2020-01-01' }, reviewedOverlapIds: [],
  };
}

function insertCompatible(database, table, values) {
  const columns = new Set(database.sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
  const entries = Object.entries(values).filter(([column]) => columns.has(column));
  database.sqlite.prepare(`INSERT INTO ${table} (${entries.map(([column]) => column).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`).run(...entries.map(([, value]) => value));
}

function seedRetainedProjection(database, version) {
  insertCompatible(database, 'import_source_index', {
    asset_id: 'synthetic-retained-source', media_type: 'image', availability: 'available', captured_at_millis: Date.UTC(2025, 0, 2),
    modified_at_millis: null, location_available: 1, captured_day: '2025-01-02', has_precise_offset: 1, latitude: 10, longitude: 100, reported_accuracy_meters: 10,
  });
  if (version < 7) return;
  insertCompatible(database, 'canonical_evidence', {
    evidence_id: 'synthetic-retained-source', source_ref: 'synthetic-retained-source', media_type: 'image', availability: 'available',
    captured_at_millis: Date.UTC(2025, 0, 2), modified_at_millis: null, location_available: 1,
    captured_day: '2025-01-02', has_precise_offset: 1, latitude: 10, longitude: 100, reported_accuracy_meters: 10,
  });
  database.sqlite.exec(`INSERT INTO reconstruction_run (run_id, rule_version, evidence_revision, status, completed_at_millis) VALUES (1, 'reconstruction-v1', 0, 'complete', 1);
    INSERT INTO reconstruction_place (place_id, run_id, representative_evidence_id, uncertainty_json) VALUES ('synthetic-retained-place', 1, 'synthetic-retained-source', '[]');
    INSERT INTO reconstruction_visit (visit_id, run_id, place_id, ordering) VALUES ('synthetic-retained-visit', 1, 'synthetic-retained-place', 'chronological');
    INSERT INTO reconstruction_journey (journey_id, run_id, journey_state) VALUES ('synthetic-retained-journey', 1, 'inferred');
    INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (1, 'journey-visit', 'synthetic-retained-journey', 'synthetic-retained-visit'), (1, 'visit-support', 'synthetic-retained-visit', 'synthetic-retained-source');
    INSERT INTO reconstruction_disposition (run_id, evidence_id, disposition_state, reasons_json) VALUES (1, 'synthetic-retained-source', 'supported', '[]');`);
  if (version >= 29) database.sqlite.exec("INSERT INTO reconstruction_trip_qualification (run_id, journey_id, classification, score, reasons_json) VALUES (1, 'synthetic-retained-journey', 'USER_CONFIRMED', 0, '[]')");
  if (version >= 3) database.sqlite.exec("INSERT INTO maintenance_change_queue (asset_id, change_kind, source_revision) VALUES ('synthetic-retained-source', 'modified', 1)");
}

async function prepareConfirmedJourney(database, reconstruction, prepare = () => {}) {
  await importSyntheticEvidence(createNativeImportRepository());
  prepare();
  await reconstruction.rebuild(3400);
  // An existing owner-confirmed projection is fixture state; the actual
  // confirmation API then creates the durable correction used by later runs.
  database.sqlite.exec("UPDATE reconstruction_trip_qualification SET classification = 'USER_CONFIRMED'");
  const existing = await reconstruction.loadDurableReveal();
  const selected = await reconstruction.loadJourneyDetail(existing.journeys[0].displayId);
  await reconstruction.saveJourneyCorrection(existing.journeys[0].displayId, 'confirm', selected.snapshotToken, selected.detail, 'synthetic-confirm-command', 3450);
  const confirmed = await reconstruction.loadDurableReveal();
  assert.ok(confirmed.journeys.length > 0);
  return { displayId: confirmed.journeys[0].displayId, review: await reconstruction.loadJourneyDetail(confirmed.journeys[0].displayId) };
}

function seedPendingRemap(database) {
  const journey = database.sqlite.prepare('SELECT journey_id, run_id FROM reconstruction_journey LIMIT 1').get();
  database.sqlite.prepare(`INSERT INTO journey_correction_revision (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis)
    VALUES ('synthetic-pending-revision', 'confirm', ?, ?, ?, 'pending_remap', 1)`).run(journey.run_id, journey.journey_id, JSON.stringify(['E:synthetic-source-0']));
  database.sqlite.prepare(`INSERT INTO journey_correction_candidate (candidate_id, revision_id, base_run_id, state, reason, created_at_millis)
    VALUES ('synthetic-pending-candidate', 'synthetic-pending-revision', ?, 'pending_remap', 'Synthetic review required.', 1)`).run(journey.run_id);
}

function graphReuseRepository(reference) {
  const filename = path.join(sourceRoot, 'reconstruction/repository.ts');
  let source = fs.readFileSync(filename, 'utf8');
  const branch = /const confirmedGraph = groupingConstraints\.length\s*\? reconstructV1\(evidenceWithStructuralBoundaries, \{ journeyGroupingConstraints: groupingConstraints \}\)\s*: baselineGraph;/g;
  assert.equal([...source.matchAll(branch)].length, 1, 'Reference must replace exactly the empty-constraint reuse branch.');
  if (reference) source = source.replace(branch,
    'const confirmedGraph = reconstructV1(evidenceWithStructuralBoundaries, { journeyGroupingConstraints: groupingConstraints });');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const engine = require(path.join(sourceRoot, 'reconstruction/engine.ts'));
  let reconstructions = 0;
  const inheritedRequire = loaded.require.bind(loaded);
  loaded.require = (request) => request === './engine'
    ? { ...engine, reconstructV1: (...args) => { reconstructions += 1; return engine.reconstructV1(...args); } }
    : inheritedRequire(request);
  loaded._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText, filename);
  return { create: loaded.exports.createNativeReconstructionRepository, count: () => reconstructions };
}

for (const scenario of ['none', 'confirm', 'place', 'claim', 'memory-assign', 'reject', 'remove-visit', 'split', 'merge', 'malformed-reject', 'memory-write-failure']) {
  test(`empty-constraint graph reuse preserves real SQLite behavior for ${scenario}`, async () => {
    const results = [];
    for (const reference of [true, false]) {
      const loaded = graphReuseRepository(reference);
      await withDatabase(async (database) => {
        await importSyntheticEvidence(createNativeImportRepository());
        if (scenario === 'merge') database.sqlite.exec(`UPDATE canonical_evidence SET
          captured_at_millis = captured_at_millis + CASE evidence_id WHEN 'synthetic-source-1' THEN 259200000 WHEN 'synthetic-source-2' THEN 518400000 ELSE 0 END,
          captured_day = CASE evidence_id WHEN 'synthetic-source-1' THEN '2025-01-06' WHEN 'synthetic-source-2' THEN '2025-01-10' ELSE captured_day END`);
        const repository = loaded.create();
        const initial = await repository.rebuild(1000);
        const keys = ['E:synthetic-source-0', 'E:synthetic-source-1', 'E:synthetic-source-2'];
        if (!['none', 'memory-assign', 'memory-write-failure'].includes(scenario)) {
          const action = scenario === 'malformed-reject' ? 'reject' : scenario;
          const reviewed = scenario === 'split' ? [keys[0]] : scenario === 'merge' ? keys.slice(0, 2) : keys;
          const visits = scenario === 'split' ? [[keys[0]]] : scenario === 'merge' ? [[keys[0]], [keys[1]]] : [keys];
          const structural = scenario === 'split' ? [keys[0]] : scenario === 'merge' ? { left: [keys[0]], right: [keys[1]] } : null;
          insertCompatible(database, 'journey_correction_revision', {
            revision_id: 'synthetic-reuse-correction', action, source_run_id: 1,
            journey_id: initial.journeys[0].id, reviewed_support_json: JSON.stringify(reviewed),
            reviewed_visits_json: JSON.stringify(visits), structural_boundary_json: structural ? JSON.stringify(structural) : null,
            state: 'effective', created_at_millis: 1, command_key: 'synthetic-reuse-command',
            owner_title: scenario === 'claim' ? 'Synthetic claimed journey' : null,
            owner_place_id: scenario === 'place' ? 'synthetic-place' : null,
            owner_place_name: scenario === 'place' ? 'Synthetic owner place' : null,
            owner_place_context: scenario === 'place' ? 'Synthetic context' : null,
            owner_latitude: scenario === 'place' ? 1 : null, owner_longitude: scenario === 'place' ? 2 : null,
          });
          if (scenario === 'malformed-reject') database.sqlite.exec("UPDATE journey_correction_revision SET reviewed_support_json = 'not-json'");
        }
        if (scenario === 'memory-assign' || scenario === 'memory-write-failure') {
          insertCompatible(database, 'journey_memory_correction_revision', {
            revision_id: 'synthetic-reuse-memory', action: 'assign', source_run_id: 1,
            source_evidence_id: 'synthetic-source-0', journey_id: initial.journeys[0].id,
            reviewed_support_json: JSON.stringify(keys), state: 'effective', created_at_millis: 1,
            command_key: 'synthetic-reuse-memory-command',
          });
        }
        const failure = new Error('synthetic-memory-write-failure');
        if (scenario === 'memory-write-failure') database.failOnce(/^UPDATE journey_memory_correction_candidate SET state = 'resolved'/, failure);
        const callStart = database.calls.length;
        const countStart = loaded.count();
        let graph = null;
        let error = null;
        try { graph = await repository.rebuild(2000); }
        catch (caught) { error = { name: caught.name, message: caught.message, revisionId: caught.revisionId, identity: caught === failure }; }
        const calls = database.calls.slice(callStart);
        const rebuildCalls = loaded.count() - countStart;
        if (scenario === 'malformed-reject') {
          assert.equal(error?.revisionId, 'synthetic-reuse-correction');
          assert.equal(rebuildCalls, 1, 'Malformed reviewed support must fail before constrained reconstruction.');
        } else {
          assert.equal(rebuildCalls, reference || scenario === 'reject' ? 2 : 1,
            'Only an empty rejection-constraint set can skip the second engine pass.');
          if (scenario === 'memory-write-failure') assert.equal(error?.identity, true);
          // This separated-visit merge fixture is not protected from canonical
          // continuity. Both implementations must fail closed when its reviewed
          // support no longer maps to one final journey, preserving stored data.
          else if (scenario === 'merge') assert.equal(error?.revisionId, 'synthetic-reuse-correction');
          else assert.equal(error, null, `Synthetic ${scenario} must complete successfully.`);
        }
        if (error) assert.equal(calls.at(-1)[1], 'ROLLBACK');
        const durableCallStart = database.calls.length;
        const reveal = await repository.loadDurableReveal();
        const durableCalls = database.calls.slice(durableCallStart);
        const snapshots = Object.fromEntries(['reconstruction_run', 'reconstruction_place', 'reconstruction_visit', 'reconstruction_journey',
          'reconstruction_link', 'reconstruction_disposition', 'reconstruction_trip_qualification',
          'journey_correction_application', 'journey_memory_correction_application'].map((table) => [table,
          database.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
        results.push({ graph, error, calls, durableCalls, reveal, snapshots });
      });
    }
    assert.deepEqual(results[1], results[0]);
  });
}

test('phase profiling preserves real SQLite calls, graphs, early returns and error identity', async () => {
  const originalDev = global.__DEV__;
  const originalFlag = process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
  const originalInfo = console.info;
  const events = [];
  const results = [];
  try {
    global.__DEV__ = true;
    console.info = (label, event) => { assert.equal(label, '[Travel Life diagnostic]'); events.push(event); };
    for (const enabled of [false, true]) {
      process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE = enabled ? '1' : '0';
      await withDatabase(async (database) => {
        await importSyntheticEvidence(createNativeImportRepository());
        const repository = createNativeReconstructionRepository();
        const early = await repository.loadDurableReveal();
        const graph = await repository.rebuild(1000);
        const reveal = await repository.loadDurableReveal();
        const failure = new Error('private-sentinel SQLite failure');
        database.failOnce(/^INSERT INTO reconstruction_run/, failure);
        await assert.rejects(repository.rebuild(2000), (error) => error === failure);
        const queued = await repository.rebuild(3000, true);
        assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM maintenance_change_queue').get().count, 0);
        await database.adapter.execAsync('BEGIN IMMEDIATE TRANSACTION');
        const ownedStart = database.calls.length;
        const callerOwned = await repository.rebuild(4000, false, async () => true, true);
        assert.ok(database.calls.slice(ownedStart).every(([method, sql]) => method !== 'execAsync' || !/BEGIN|COMMIT|ROLLBACK/.test(sql)));
        await database.adapter.execAsync('ROLLBACK');
        await assert.rejects(repository.rebuild(5000, true, async () => false), /Photo access is not permitted/);
        const readFailure = new Error('private-sentinel native read');
        database.failOnce(/^SELECT MAX\(run_id\).*reconstruction_run/, readFailure);
        await assert.rejects(repository.loadDurableReveal(), (error) => error.stage === 'DURABLE_RUN_READ' && error.originalError === readFailure);
        const manualFailure = new Error('no such column: date_start; private-sentinel');
        database.failOnce(/^SELECT manual_id.*ORDER BY/, manualFailure);
        await assert.rejects(repository.loadDurableReveal(), (error) => error.stage === 'DURABLE_MANUAL_EMPTY_LAYOUT' && error.originalError === manualFailure);
        results.push({ early, graph, reveal, queued, callerOwned, calls: database.calls });
        if (!enabled) assert.equal(events.length, 0);
      });
    }
    assert.deepEqual(results[1], results[0]);
    assert.ok(events.some((event) => event.stage === 'DURABLE_PROJECTION' && event.reasonCode === 'COMPLETE'));
    const destinationQueryEnd = events.findIndex((event) => event.stage === 'DURABLE_DESTINATION_QUERY' && event.reasonCode === 'COMPLETE');
    const destinationComputationStart = events.findIndex((event) => event.stage === 'DURABLE_DESTINATION_COMPUTATION' && event.reasonCode === 'START');
    assert.ok(destinationQueryEnd >= 0, 'The destination-support query must have a fixed completion boundary.');
    assert.equal(destinationComputationStart, destinationQueryEnd + 1, 'Destination computation must begin immediately after the support query.');
    assert.ok(events.some((event) => event.stage === 'DURABLE_DESTINATION_COMPUTATION' && event.reasonCode === 'COMPLETE'));
    const processingStages = ['REBUILD_PROCESSING', 'REBUILD_BASELINE_GRAPH', 'REBUILD_BASELINE_MAPPING',
      'REBUILD_CONSTRAINED_GRAPH', 'REBUILD_CONFIRMED_MAPPING', 'REBUILD_MEMORY_OVERLAY',
      'REBUILD_OWNER_MERGE', 'REBUILD_CONTINUITY', 'REBUILD_MEMBERSHIP', 'REBUILD_FINAL_MAPPING'];
    const successfulRebuild = events.find((event) => event.stage === 'REBUILD_COMMIT' && event.reasonCode === 'COMPLETE');
    assert.ok(successfulRebuild);
    const completedStages = events.filter((event) => event.correlationId === successfulRebuild.correlationId
      && event.reasonCode === 'COMPLETE').map((event) => event.stage);
    const processingStart = completedStages.indexOf('REBUILD_PROCESSING');
    assert.deepEqual(completedStages.slice(processingStart, processingStart + processingStages.length), processingStages,
      'Rebuild processing must separate graph passes and correction/continuity phases in execution order.');
    const detailedEvents = events.filter((event) => event.correlationId === successfulRebuild.correlationId);
    const detailedStart = detailedEvents.findIndex((event) => event.stage === 'REBUILD_PROCESSING');
    assert.deepEqual(detailedEvents.slice(detailedStart, detailedStart + processingStages.length * 2 + 1)
      .map((event) => [event.stage, event.reasonCode]), [
      ...processingStages.flatMap((stage) => [[stage, 'START'], [stage, 'COMPLETE']]),
      ['REBUILD_PERSISTENCE', 'START'],
    ]);
    assert.ok(events.some((event) => event.stage === 'REBUILD_PERSISTENCE' && event.reasonCode === 'UNKNOWN'));
    assert.ok(events.every((event) => event.durableOutcome === 'unchanged'));
    assert.ok(!JSON.stringify(events).includes('private-sentinel'));
    const correlations = Map.groupBy(events, (event) => event.correlationId);
    assert.equal(correlations.size, 9);
    for (const phases of correlations.values()) {
      assert.equal(phases[0].reasonCode, 'START');
      assert.ok(['COMPLETE', 'UNKNOWN'].includes(phases.at(-1).reasonCode));
    }
  } finally {
    if (originalDev === undefined) delete global.__DEV__; else global.__DEV__ = originalDev;
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
    else process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE = originalFlag;
    console.info = originalInfo;
  }
});

test('processing interruption preserves rollback and error identity within a populated memory overlay', async () => {
  const originalDev = global.__DEV__;
  const originalFlag = process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
  const originalInfo = console.info;
  const events = [];
  const results = [];
  try {
    global.__DEV__ = true;
    console.info = (_label, event) => events.push(event);
    for (const enabled of [false, true]) {
      process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE = enabled ? '1' : '0';
      await withDatabase(async (database) => {
        await importSyntheticEvidence(createNativeImportRepository());
        const repository = createNativeReconstructionRepository();
        await repository.rebuild(1000);
        database.sqlite.prepare(`INSERT INTO journey_memory_correction_revision
          (revision_id, action, source_run_id, source_evidence_id, journey_id, reviewed_support_json, state, created_at_millis, command_key)
          VALUES (?, 'assign', 1, ?, ?, ?, 'effective', 1, ?)`).run(
          'synthetic-memory', 'synthetic-source-0', 'synthetic-target',
          JSON.stringify(['E:synthetic-source-0', 'E:synthetic-source-1', 'E:synthetic-source-2']), 'synthetic-command',
        );
        const failure = new Error('private-sentinel memory write');
        database.failOnce(/^UPDATE journey_memory_correction_candidate SET state = 'resolved'/, failure);
        events.length = 0;
        const callStart = database.calls.length;
        await assert.rejects(repository.rebuild(2000), (error) => error === failure);
        const calls = database.calls.slice(callStart);
        assert.equal(calls.at(-1)[1], 'ROLLBACK');
        assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM reconstruction_run').get().count, 1);
        assert.equal(database.sqlite.prepare('SELECT state FROM journey_memory_correction_revision').get().state, 'effective');
        results.push(calls);
        if (!enabled) assert.equal(events.length, 0);
        else {
          assert.equal(events.at(-1).stage, 'REBUILD_MEMORY_OVERLAY');
          assert.equal(events.at(-1).reasonCode, 'UNKNOWN');
          assert.ok(!events.some((event) => event.stage === 'REBUILD_OWNER_MERGE' || event.stage === 'REBUILD_PERSISTENCE'));
          assert.ok(!JSON.stringify(events).includes('private-sentinel'));
        }
      });
    }
    assert.deepEqual(results[1], results[0]);
  } finally {
    if (originalDev === undefined) delete global.__DEV__; else global.__DEV__ = originalDev;
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
    else process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE = originalFlag;
    console.info = originalInfo;
  }
});

test('fresh import, reconstruction, and durable Atlas read execute real SQLite', async () => withDatabase(async ({ sqlite }) => {
  const importer = createNativeImportRepository();
  await importSyntheticEvidence(importer);
  const reconstruction = createNativeReconstructionRepository();
  const graph = await reconstruction.rebuild(1000);
  assert.ok(graph.journeys.length > 0, 'Synthetic evidence must exercise nonempty graph writes.');
  const revealed = await reconstruction.loadDurableReveal();
  assert.ok(Array.isArray(revealed.journeys));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM canonical_evidence').get().count, 3);
  assert.equal(sqlite.prepare('SELECT version FROM import_schema_version').get().version, schemaVersion);
}));

for (const version of [1, 12, 17, 28, 32, 33]) {
  for (const entry of ['loadDurableReveal', 'rebuild', 'reconcileQueued']) {
  test(`retained v${version} enters ${entry} directly without a preparatory migration`, async () => withDatabase(async (database) => {
    retainHistoricalSchema(database, version);
    seedRetainedProjection(database, version);
    const reconstruction = createNativeReconstructionRepository();
    await reconstruction[entry](2000);
    assert.equal(database.sqlite.prepare('SELECT version FROM import_schema_version').get().version, schemaVersion);
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM canonical_evidence').get().count, 1);
    if (entry === 'loadDurableReveal' && version >= 7) {
      assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM reconstruction_journey WHERE journey_id = 'synthetic-retained-journey'").get().count, 1);
      const retainedRead = await reconstruction.loadDurableReveal();
      if (version >= 29) assert.equal(retainedRead.journeys.length, 1);
    }
    await reconstruction.rebuild(2000);
    await reconstruction.loadDurableReveal();
  }));
  }
}

test('retained correction revision and manual journey survive upgrade and rebuild', async () => withDatabase(async (database) => {
  retainHistoricalSchema(database, 28);
  database.sqlite.exec(`INSERT INTO journey_correction_revision
    (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, owner_title)
    VALUES ('synthetic-revision', 'claim', 1, 'synthetic-prior-journey', '[]', 'superseded', 10, 'Synthetic retained title')`);
  const before = database.sqlite.prepare('SELECT * FROM journey_correction_revision').get();
  await ensureNativeImportSchema(database.adapter);
  const importer = createNativeImportRepository();
  await importSyntheticEvidence(importer);
  const reconstruction = createNativeReconstructionRepository();
  await reconstruction.createManualJourney(manualJourney());
  const storedManual = database.sqlite.prepare('SELECT * FROM manual_journey').get();
  await reconstruction.rebuild(3000);
  const reveal = await reconstruction.loadDurableReveal();
  const after = database.sqlite.prepare('SELECT * FROM journey_correction_revision').get();
  for (const key of Object.keys(before)) assert.equal(after[key], before[key], `Retained revision field ${key} changed.`);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM manual_journey').get(), storedManual);
  assert.ok(reveal.journeys.some((journey) => journey.displayId.startsWith('manual:')));
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM canonical_evidence').get().count, 3);
}));

test('a committed owner place correction survives queued reconstruction and durable read', async () => withDatabase(async (database) => {
  const reconstruction = createNativeReconstructionRepository();
  const { displayId, review } = await prepareConfirmedJourney(database, reconstruction);
  const place = { id: 'synthetic-owner-place', name: 'Synthetic owner place', context: 'Synthetic context', anchor: { latitude: 1, longitude: 2 } };
  const saved = await reconstruction.saveJourneyCorrection(displayId, 'place', review.snapshotToken, review.detail, 'synthetic-place-command', place, 3600);
  assert.equal(saved.state, 'claimed');
  const stored = database.sqlite.prepare('SELECT * FROM journey_correction_revision WHERE revision_id = ?').get(saved.revisionId);
  assert.equal(stored.owner_place_name, place.name);
  assert.ok((await reconstruction.loadDurableReveal()).journeys.some((journey) => journey.label.includes(place.name)));
  database.sqlite.exec("INSERT INTO maintenance_change_queue (asset_id, change_kind, source_revision) VALUES ('synthetic-source-0', 'modified', 2)");
  await reconstruction.reconcileQueued(3700);
  const rebuilt = await reconstruction.loadDurableReveal();
  assert.ok(rebuilt.journeys.some((journey) => journey.label === `${place.name}, ${place.context}` && journey.anchor.latitude === 1 && journey.anchor.longitude === 2));
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM journey_correction_application WHERE revision_id = ? AND run_id = (SELECT MAX(run_id) FROM reconstruction_run) AND application_state = 'effective'").get(saved.revisionId).count, 1);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_correction_revision WHERE revision_id = ?').get(saved.revisionId), stored);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM maintenance_change_queue').get().count, 0);
}));

test('a fresh repository reads retained v33 manual history and effective correction before replacement', async () => withDatabase(async (database) => {
  const original = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, original);
  await original.createManualJourney(manualJourney());
  const prior = await original.loadDurableReveal();
  const revisions = database.sqlite.prepare('SELECT * FROM journey_correction_revision ORDER BY revision_id').all();
  assert.ok(revisions.some((revision) => revision.state === 'effective'));
  const manual = database.sqlite.prepare('SELECT * FROM manual_journey').all();
  const statementStart = database.statements.length;
  const retained = await createNativeReconstructionRepository().loadDurableReveal();
  assert.deepEqual(retained, prior);
  assert.ok(retained.journeys.some((journey) => journey.displayId.startsWith('manual:')));
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_correction_revision ORDER BY revision_id').all(), revisions);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM manual_journey').all(), manual);
  assert.ok(database.statements.slice(statementStart).every((sql) => !/^\s*(BEGIN|INSERT|UPDATE|DELETE)/i.test(sql)));
}));

test('pending remap candidates execute real family and support reads and mark the visible journey', async () => withDatabase(async (database) => {
  const reconstruction = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, reconstruction);
  seedPendingRemap(database);
  const statementStart = database.statements.length;
  const reveal = await reconstruction.loadDurableReveal();
  assert.ok(reveal.journeys.some((journey) => journey.needsReview === true));
  const executed = database.statements.slice(statementStart).join('\n');
  assert.match(executed, /SELECT evidence_id, captured_at_millis, captured_day/);
  assert.match(executed, /SELECT DISTINCT journey.parent_id AS journey_id, support.child_id AS evidence_id/);
}));

for (const [stage, pattern, pending] of [
  ['DURABLE_SCHEMA', /^SELECT version FROM import_schema_version/, false],
  ['DURABLE_JOURNEY_READ', /^\s*WITH journey_anchor AS/, false],
  ['DURABLE_DESTINATION_READ', /^\s*SELECT DISTINCT journey.parent_id AS journey_id, visit.place_id,/, false],
  ['DURABLE_FAMILY_READ', /^SELECT evidence_id, captured_at_millis, captured_day/, true],
  ['DURABLE_SUPPORT_READ', /^\s*SELECT DISTINCT journey.parent_id AS journey_id, support.child_id AS evidence_id/, true],
]) {
  test(`a ${stage} failure reports only its fixed boundary and preserves stored history`, async () => withDatabase(async (database) => {
    const reconstruction = createNativeReconstructionRepository();
    await prepareConfirmedJourney(database, reconstruction);
    if (pending) seedPendingRemap(database);
    const stored = database.sqlite.prepare('SELECT * FROM reconstruction_journey ORDER BY journey_id').all();
    const sentinel = 'synthetic-private-schema-sentinel';
    const nativeError = new Error(`no such column: ${sentinel}`);
    database.failOnce(pattern, nativeError);
    await assert.rejects(() => reconstruction.loadDurableReveal(), (error) => {
      assert.equal(error.stage, stage);
      assert.equal(error.message, 'Local Atlas read did not finish.');
      assert.equal(error.originalError, nativeError);
      assert.ok(!error.message.includes(sentinel));
      return true;
    });
    assert.deepEqual(database.sqlite.prepare('SELECT * FROM reconstruction_journey ORDER BY journey_id').all(), stored);
    await reconstruction.loadDurableReveal();
  }));
}

test('a failed projection write rolls back committed Atlas, corrections, and queued changes', async () => withDatabase(async (database) => {
  const reconstruction = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, reconstruction);
  await reconstruction.createManualJourney(manualJourney());
  await reconstruction.rebuild(4000);
  database.sqlite.exec("INSERT INTO maintenance_change_queue (asset_id, change_kind, source_revision) VALUES ('synthetic-source-0', 'modified', 2)");
  const before = {
    journeys: database.sqlite.prepare('SELECT * FROM reconstruction_journey ORDER BY journey_id').all(),
    runs: database.sqlite.prepare('SELECT * FROM reconstruction_run ORDER BY run_id').all(),
    queue: database.sqlite.prepare('SELECT * FROM maintenance_change_queue ORDER BY asset_id').all(),
    manual: database.sqlite.prepare('SELECT * FROM manual_journey').all(),
    corrections: database.sqlite.prepare('SELECT * FROM journey_correction_revision ORDER BY revision_id').all(),
    applications: database.sqlite.prepare('SELECT * FROM journey_correction_application ORDER BY revision_id, run_id').all(),
  };
  database.failOnce(/^INSERT INTO reconstruction_visit/);
  await assert.rejects(() => reconstruction.rebuild(5000, true), /Synthetic SQLite operation failure/);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM reconstruction_journey ORDER BY journey_id').all(), before.journeys);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM reconstruction_run ORDER BY run_id').all(), before.runs);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM maintenance_change_queue ORDER BY asset_id').all(), before.queue);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM manual_journey').all(), before.manual);
  assert.ok(before.corrections.length > 0 && before.applications.length > 0);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_correction_revision ORDER BY revision_id').all(), before.corrections);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM journey_correction_application ORDER BY revision_id, run_id').all(), before.applications);
  await reconstruction.loadDurableReveal();
}));

test('failed retained migration rolls back and supports a successful retry', async () => withDatabase(async (database) => {
  retainHistoricalSchema(database, 32);
  database.failOnce(/CREATE TABLE IF NOT EXISTS manual_journey/);
  await assert.rejects(() => ensureNativeImportSchema(database.adapter), /Synthetic SQLite operation failure/);
  assert.equal(database.sqlite.prepare('SELECT version FROM import_schema_version').get().version, 32);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'manual_journey'").get().count, 0);
  await ensureNativeImportSchema(database.adapter);
  assert.equal(database.sqlite.prepare('SELECT version FROM import_schema_version').get().version, schemaVersion);
  await createNativeReconstructionRepository().loadDurableReveal();
}));

test('missing owner display column distinguishes durable read from a completed rebuild', async () => withDatabase(async (database) => {
  await importSyntheticEvidence(createNativeImportRepository());
  const reconstruction = createNativeReconstructionRepository();
  await reconstruction.rebuild(6000);
  database.sqlite.exec('ALTER TABLE journey_correction_revision RENAME COLUMN owner_place_name TO synthetic_missing_name');
  await assert.rejects(() => reconstruction.loadDurableReveal(), (error) => {
    assert.equal(error.name, 'DurableRevealStageError');
    assert.equal(error.stage, 'DURABLE_OWNER_PLACE_READ');
    assert.equal(error.message, 'Local Atlas read did not finish.');
    assert.match(error.originalError.message, /no such column/);
    return true;
  });
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM reconstruction_run').get().count, 1);
}));

const retainedManualTable = 'manual_journey_retained_schema';
function manualSchemaSnapshot(database) {
  return database.sqlite.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name LIKE 'manual_journey%' ORDER BY name").all();
}
function preservedRecordSnapshot(database) {
  const tables = ['canonical_evidence', 'import_source_index', 'reconstruction_run', 'reconstruction_journey', 'reconstruction_place', 'reconstruction_visit', 'reconstruction_link', 'reconstruction_disposition', 'reconstruction_trip_qualification', 'journey_correction_revision', 'journey_correction_application', 'private_history_record', 'import_schema_version'];
  return tables.map((table) => ({ table, rows: database.sqlite.prepare(`SELECT * FROM ${table}`).all() }));
}
function seedLegacyManualRow(database) {
  insertCompatible(database, 'manual_journey', {
    manual_id: 'synthetic-legacy-manual', command_key: 'synthetic-legacy-command', owner_label: 'Synthetic retained owner label', owner_context: 'Synthetic context',
    latitude: 1, longitude: 2, date_kind: 'exact', synthetic_legacy_start: '2020-01-01', date_end: '2020-01-01', created_at_millis: 1,
  });
}
for (const marker of [33, 34]) {
  for (const entry of ['loadDurableReveal', 'rebuild', 'reconcileQueued']) {
    test(`empty incompatible v${marker} manual layout recovers at direct ${entry} without losing private record data`, async () => withDatabase(async (database) => {
      const original = createNativeReconstructionRepository();
      await prepareConfirmedJourney(database, original);
      database.sqlite.exec(`UPDATE import_schema_version SET version = ${marker}; UPDATE private_history_record SET schema_version = ${marker};
        ALTER TABLE manual_journey RENAME COLUMN date_start TO synthetic_legacy_start`);
      const before = preservedRecordSnapshot(database);
      // v34 legitimately advances retained v33 markers while preserving owner rows.
      before.find((record) => record.table === 'private_history_record').rows[0].schema_version = Math.max(marker, schemaVersion);
      before.find((record) => record.table === 'import_schema_version').rows[0].version = Math.max(marker, schemaVersion);
      const oldIndex = database.sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'manual_journey_dates'").get();
      const reconstruction = createNativeReconstructionRepository();
      await reconstruction[entry](7000);
      assert.equal(database.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${retainedManualTable}`).get().count, 0);
      assert.ok(database.sqlite.prepare(`PRAGMA table_info(${retainedManualTable})`).all().some((column) => column.name === 'synthetic_legacy_start'));
      const archivedIndex = database.sqlite.prepare("SELECT name, tbl_name FROM sqlite_master WHERE name = 'manual_journey_dates'").get();
      assert.equal(archivedIndex.name, oldIndex.name);
      assert.equal(archivedIndex.tbl_name, retainedManualTable);
      const dateIndexes = database.sqlite.prepare("PRAGMA index_list('manual_journey')").all();
      assert.ok(dateIndexes.some((index) => {
        const columns = database.sqlite.prepare(`PRAGMA index_info('${index.name}')`).all().map((column) => column.name);
        return columns.join(',') === 'date_start,date_end';
      }));
      if (entry === 'loadDurableReveal' || entry === 'reconcileQueued') assert.deepEqual(preservedRecordSnapshot(database), before);
      else {
        for (const table of ['canonical_evidence', 'import_source_index', 'journey_correction_revision', 'private_history_record', 'import_schema_version']) {
          assert.deepEqual(preservedRecordSnapshot(database).find((record) => record.table === table), before.find((record) => record.table === table));
        }
      }
      await reconstruction.createManualJourney(manualJourney());
      assert.ok((await reconstruction.loadDurableReveal()).journeys.some((journey) => journey.displayId.startsWith('manual:')));
    }));
  }
}

test('healthy manual layout with actual owner data does not acquire a schema writer', async () => withDatabase(async (database) => {
  const reconstruction = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, reconstruction);
  await reconstruction.createManualJourney(manualJourney());
  const before = preservedRecordSnapshot(database);
  const manualBefore = database.sqlite.prepare('SELECT * FROM manual_journey').all();
  const statementStart = database.statements.length;
  await ensureNativeImportSchema(database.adapter);
  assert.ok(database.statements.slice(statementStart).every((sql) => !/^\s*(BEGIN|COMMIT|INSERT|UPDATE|DELETE|ALTER|CREATE)/i.test(sql)));
  assert.deepEqual(preservedRecordSnapshot(database), before);
  assert.deepEqual(database.sqlite.prepare('SELECT * FROM manual_journey').all(), manualBefore);
}));

test('a forward marker repairs an empty manual layout before local-history deletion and clears abandoned continuity data', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  database.sqlite.exec(`UPDATE import_schema_version SET version = 35;
    ALTER TABLE manual_journey RENAME COLUMN date_start TO synthetic_legacy_start;
    CREATE TABLE legacy_atlas_continuity (legacy_id TEXT NOT NULL);
    INSERT INTO legacy_atlas_continuity (legacy_id) VALUES ('synthetic-only');`);

  await createNativeImportRepository().deleteLocalHistory();

  assert.ok(database.sqlite.prepare('PRAGMA table_info(manual_journey)').all().some((column) => column.name === 'date_start'));
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM legacy_atlas_continuity').get().count, 0);
}));

for (const hasCompletedRun of [false, true]) {
  test(`absent manual table recovers with completed run ${hasCompletedRun}`, async () => withDatabase(async (database) => {
    await ensureNativeImportSchema(database.adapter);
    if (hasCompletedRun) await createNativeReconstructionRepository().rebuild(7500);
    database.sqlite.exec('DROP TABLE manual_journey');
    const before = preservedRecordSnapshot(database);
    await createNativeReconstructionRepository().loadDurableReveal();
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM manual_journey').get().count, 0);
    assert.deepEqual(preservedRecordSnapshot(database), before);
  }));
}

for (const reason of ['populated', 'archive-conflict', 'count-unavailable']) {
  test(`incompatible manual layout refuses ${reason} without modifying any schema or record`, async () => withDatabase(async (database) => {
    await prepareConfirmedJourney(database, createNativeReconstructionRepository());
    database.sqlite.exec('ALTER TABLE manual_journey RENAME COLUMN date_start TO synthetic_legacy_start');
    if (reason === 'populated') seedLegacyManualRow(database);
    if (reason === 'archive-conflict') database.sqlite.exec(`CREATE TABLE ${retainedManualTable} (synthetic_sentinel TEXT)`);
    const schemaBefore = manualSchemaSnapshot(database);
    const manualBefore = database.sqlite.prepare('SELECT * FROM manual_journey').all();
    const before = preservedRecordSnapshot(database);
    if (reason === 'count-unavailable') database.failOnce(/^\s*SELECT COUNT\(\*\).*FROM manual_journey/i);
    await assert.rejects(() => createNativeReconstructionRepository().loadDurableReveal(), (error) => {
      assert.equal(error.stage, 'DURABLE_SCHEMA');
      assert.equal(error.originalError.name, reason === 'count-unavailable' ? 'Error' : 'LocalAtlasSchemaRecoveryError');
      assert.equal(error.originalError.message, reason === 'count-unavailable' ? 'Synthetic SQLite operation failure.' : 'Local Atlas schema recovery could not finish.');
      assert.equal(classifyAppDiagnosticError(error), reason === 'count-unavailable' ? 'UNKNOWN' : 'SCHEMA');
      return true;
    });
    assert.deepEqual(manualSchemaSnapshot(database), schemaBefore);
    assert.deepEqual(database.sqlite.prepare('SELECT * FROM manual_journey').all(), manualBefore);
    assert.deepEqual(preservedRecordSnapshot(database), before);
  }));
}

test('manual recovery rechecks for retained data after acquiring its serialized writer', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  database.sqlite.exec('ALTER TABLE manual_journey RENAME COLUMN date_start TO synthetic_legacy_start');
  const schemaBefore = manualSchemaSnapshot(database);
  database.beforeNext(/^BEGIN IMMEDIATE TRANSACTION$/, () => seedLegacyManualRow(database));
  await assert.rejects(() => ensureNativeImportSchema(database.adapter), (error) => error.name === 'LocalAtlasSchemaRecoveryError');
  assert.deepEqual(manualSchemaSnapshot(database), schemaBefore);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM manual_journey').get().count, 1);
}));

test('failed canonical recreation rolls back the retained table rename and permits a later retry', async () => withDatabase(async (database) => {
  await prepareConfirmedJourney(database, createNativeReconstructionRepository());
  database.sqlite.exec('ALTER TABLE manual_journey RENAME COLUMN date_start TO synthetic_legacy_start');
  const schemaBefore = manualSchemaSnapshot(database);
  const before = preservedRecordSnapshot(database);
  const primaryFailure = new Error('Synthetic canonical table creation failure.');
  database.failOnce(/CREATE TABLE IF NOT EXISTS manual_journey/, primaryFailure);
  await assert.rejects(() => ensureNativeImportSchema(database.adapter), (error) => error === primaryFailure);
  assert.deepEqual(manualSchemaSnapshot(database), schemaBefore);
  assert.deepEqual(preservedRecordSnapshot(database), before);
  await ensureNativeImportSchema(database.adapter);
  assert.ok(database.sqlite.prepare('PRAGMA table_info(manual_journey)').all().some((column) => column.name === 'date_start'));
  assert.equal(database.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${retainedManualTable}`).get().count, 0);
}));

for (const [reasonCode, nativeMessage] of [['DATABASE_BUSY', 'SQLITE_BUSY: synthetic native read contention'], ['NATIVE_HANDLE', 'released native handle: synthetic native failure']]) {
  for (const [boundary, query] of [['layout', /^SELECT manual_id.*FROM manual_journey LIMIT 0/], ['row-count', /^SELECT COUNT\(\*\) AS count FROM manual_journey/]]) {
    test(`manual recovery preserves ${reasonCode} classification at its ${boundary} read`, async () => withDatabase(async (database) => {
      await prepareConfirmedJourney(database, createNativeReconstructionRepository());
      database.sqlite.exec('ALTER TABLE manual_journey RENAME COLUMN date_start TO synthetic_legacy_start');
      const schemaBefore = manualSchemaSnapshot(database);
      const before = preservedRecordSnapshot(database);
      const nativeError = new Error(nativeMessage);
      database.failOnce(query, nativeError);
      await assert.rejects(() => createNativeReconstructionRepository().loadDurableReveal(), (error) => {
        assert.equal(error.stage, 'DURABLE_SCHEMA');
        assert.equal(error.originalError, nativeError);
        assert.equal(classifyAppDiagnosticError(error), reasonCode);
        assert.equal(error.message, 'Local Atlas read did not finish.');
        return true;
      });
      assert.deepEqual(manualSchemaSnapshot(database), schemaBefore);
      assert.deepEqual(preservedRecordSnapshot(database), before);
    }));
  }
}
