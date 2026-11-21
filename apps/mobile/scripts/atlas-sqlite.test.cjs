/* Synthetic compatibility tests. Never opens an owner database or native app. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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
  if (request === 'expo-crypto') return { randomUUID: require('node:crypto').randomUUID };
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
const { associateVisualAlbum, qualifyVisualTrip } = require(path.join(sourceRoot, 'visual-place/trip-recovery.ts'));
const { ReplayDraftStaleError } = require(path.join(sourceRoot, 'replay/draft-error.ts'));
const { classifyAppDiagnosticError } = require(path.join(sourceRoot, 'diagnostics/app-diagnostics.ts'));
const { exportLocalHistory } = require(path.join(sourceRoot, 'account/history-native.ts'));

function syntheticDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
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

test('repairs a partial version 39 Home layout and retains its saved receipt', async () => withDatabase(async (database) => {
  retainHistoricalSchema(database, 38);
  database.sqlite.exec(`
    UPDATE import_schema_version SET version = 39;
    CREATE TABLE home_setup_receipt (record_id INTEGER PRIMARY KEY, command_key TEXT NOT NULL, payload TEXT NOT NULL, disposition TEXT NOT NULL);
    INSERT INTO home_setup_receipt VALUES (1, 'synthetic-home-command', '[]', 'skipped');
    INSERT INTO reconstruction_run (rule_version, evidence_revision, status, completed_at_millis)
      VALUES ('synthetic', 0, 'complete', 1);
  `);
  await ensureNativeImportSchema(database.adapter);
  assert.equal(database.sqlite.prepare('SELECT version FROM import_schema_version').get().version, schemaVersion);
  assert.equal(database.sqlite.prepare('SELECT home_revision FROM reconstruction_run').get().home_revision, 0);
  assert.equal(database.sqlite.prepare('SELECT command_key FROM home_setup_receipt').get().command_key, 'synthetic-home-command');
  assert.equal(database.sqlite.prepare('SELECT revision FROM home_projection_context').get().revision, 0);
}));

test('onboarding intent survives SQLite reopen, preserves exact selected handles, and deletion fences late intent writes', async () => {
  await withDatabase(async (database) => {
    retainHistoricalSchema(database, 37);
    const repository = createNativeImportRepository();
    const intent = { version: 1, id: 'synthetic-onboarding-run', scope: 'selected', selectedIds: ['synthetic-a', 'synthetic-b'], missingIds: 0, phase: 'paused' };
    await repository.savePreparationIntent(intent);
    assert.equal(database.sqlite.prepare('SELECT version FROM import_schema_version').get().version, schemaVersion);
    assert.deepEqual(await createNativeImportRepository().loadPreparationIntent(), intent);
    await repository.disconnectPrivateRecord();
    await assert.rejects(repository.savePreparationIntent({ ...intent, phase: 'queued' }));
    assert.deepEqual(await repository.loadPreparationIntent(), intent);
    await repository.deleteLocalHistory();
    assert.equal(await repository.loadPreparationIntent(), null);
    await assert.rejects(repository.savePreparationIntent(intent));
  });
});

test('first reveal receipt survives reopen and fences duplicate offers and stale writes', async () => withDatabase(async (database) => {
  retainHistoricalSchema(database, 40);
  const repository = createNativeImportRepository();
  const offer = { offerKey: 'synthetic-question', scope: 'synthetic-scope', command: 'offer', decision: 'offer', expectedRevision: 0 };
  assert.equal(await repository.loadFirstRevealReceipt(), null);
  const saved = await repository.saveFirstRevealReceipt(offer, () => true);
  assert.equal(saved.status, 'saved');
  const restarted = createNativeImportRepository();
  assert.deepEqual(await restarted.loadFirstRevealReceipt(), saved.receipt);
  assert.deepEqual(await restarted.saveFirstRevealReceipt(offer, () => true), saved);
  assert.deepEqual(await restarted.saveFirstRevealReceipt({ ...offer, offerKey: 'other' }, () => true), { status: 'conflict' });
  const answer = { ...offer, decision: 'yes', command: 'answer', expectedRevision: 1 };
  let checks = 0;
  await assert.rejects(restarted.saveFirstRevealReceipt(answer, () => ++checks === 1));
  assert.deepEqual(await restarted.loadFirstRevealReceipt(), saved.receipt);
  assert.equal((await restarted.saveFirstRevealReceipt(answer, () => true)).status, 'saved');
  const undo = { ...answer, decision: 'undo', command: 'undo', expectedRevision: 2 };
  assert.deepEqual(await restarted.saveFirstRevealReceipt({ ...undo, command: offer.command }, () => true), { status: 'conflict' });
  assert.equal((await restarted.saveFirstRevealReceipt(undo, () => true)).status, 'saved');
  assert.equal((await restarted.saveFirstRevealReceipt(offer, () => true)).status, 'conflict');
  await restarted.deleteLocalHistory();
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM first_reveal_receipt').get().n, 0);
}));

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

test('committed SQLite history can be compared without publishing and invalidates stale preview authority', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  const home = { id: 'synthetic-shadow-home', label: 'Synthetic home', origin: 'manual-pin', latitude: 10, longitude: 100,
    radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null };
  await importer.saveConfiguredHomeArea(home);
  const photos = [9, 16].map((hour, index) => ({ ...syntheticCandidates()[0], assetId: `synthetic-shadow-photo-${index}`,
    latitude: 10.2, capturedAtMillis: Date.UTC(2025, 0, 2, hour) }));
  await importer.commitPage({ scope: 'full', nextOffset: 2, scanned: 2, geotagged: 2, unavailable: 0, status: 'complete' }, photos);
  const repository = createNativeReconstructionRepository();
  const events = [];
  const originalLog = console.info;
  console.info = (_, event) => events.push(event);
  try {
    assert.equal((await repository.loadCandidateShadowSnapshot({ canUseSource: () => true })).status, 'unavailable');
    const cancelled = new AbortController();
    cancelled.abort();
    assert.equal((await repository.loadCandidateShadowSnapshot({ canUseSource: () => true, signal: cancelled.signal })).status, 'stale');
    await repository.rebuild();
    insertScaleEvidence(database, 24_001);
    assert.equal((await repository.loadCandidateShadowSnapshot({ canUseSource: () => true })).status, 'too-large');
    database.sqlite.exec("DELETE FROM canonical_evidence WHERE evidence_id LIKE 'scale-row-%'");
    const outcomes = events.filter((event) => event.stage === 'CANDIDATE_INPUT_READ' && event.durableOutcome === 'skipped');
    assert.deepEqual(outcomes.map((event) => event.reasonCode), ['HISTORY_INCOMPLETE', 'SKIPPED', 'ROW_LIMIT']);
    assert.doesNotMatch(JSON.stringify(events), /SYNTHETIC_PRIVATE_SENTINEL/);
  } finally { console.info = originalLog; }
  const count = () => database.sqlite.prepare('SELECT COUNT(*) AS n FROM reconstruction_run').get().n;
  const before = count();
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  assert.equal((await repository.loadCandidateShadowSnapshot({ canUseSource: () => false })).status, 'blocked');
  const result = await repository.loadCandidateShadowSnapshot({ canUseSource: () => true });
  assert.equal(result.status, 'complete');
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].state, 'reliable');
  assert.ok(result.cards[0].id.startsWith('shadow-'));
  assert.equal(result.cards[0].coverRefs.length, 2);
  assert.equal(count(), before);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  assert.equal(await repository.verifyCandidateShadowSnapshot(result.token, () => true), true);
  assert.equal(await repository.verifyCandidateShadowSnapshot(result.token, () => false), false);
  assert.equal(await createNativeReconstructionRepository().verifyCandidateShadowSnapshot(result.token, () => true), false);
  await importer.saveConfiguredHomeArea({ ...home, radiusMeters: 6_000 });
  assert.equal(await repository.verifyCandidateShadowSnapshot(result.token, () => true), false);
  assert.equal((await repository.loadCandidateShadowSnapshot({ canUseSource: () => true })).status, 'stale');
}));

function insertScaleEvidence(database, count) {
  database.sqlite.prepare(`WITH RECURSIVE numbered(i) AS (
    SELECT 1 UNION ALL SELECT i + 1 FROM numbered WHERE i < ?
  ) INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, captured_at_millis, captured_day,
    has_precise_offset, location_available, availability, latitude, longitude, reported_accuracy_meters)
  SELECT printf('scale-row-%05d', i), printf('SYNTHETIC_PRIVATE_SENTINEL-%05d', i), 'image',
    1719792000000 + i * 60000, date(1719792000 + i * 60, 'unixepoch'), 1, i % 4 = 0, 'available',
    CASE WHEN i % 4 = 0 THEN 10 END, CASE WHEN i % 4 = 0 THEN 100 END, CASE WHEN i % 4 = 0 THEN 10 END
  FROM numbered`).run(count);
}

test('comparison presents exact changed grouping as safe labels and withholds a hidden pair', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'synthetic-pair-home', label: 'Synthetic home', origin: 'manual-pin', latitude: 10, longitude: 100,
    radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
  const photos = [2, 4].flatMap((day, group) => [9, 16].map((hour) => ({ ...syntheticCandidates()[0],
    assetId: `SYNTHETIC_PRIVATE_PAIR_${day}_${hour}`, capturedDay: `2025-01-0${day}`, capturedAtMillis: Date.UTC(2025, 0, day, hour),
    latitude: group ? 25.04 : 10.82, longitude: group ? 121.56 : 106.63 })));
  await importer.commitPage({ scope: 'full', nextOffset: 4, scanned: 4, geotagged: 4, unavailable: 0, status: 'complete' }, photos);
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  const read = await repository.loadCandidateShadowSnapshot({ canUseSource: () => true });
  assert.equal(read.status, 'complete');
  assert.equal(read.separatePairs.length, 1);
  const [pair] = read.separatePairs;
  assert.equal(pair.left.observedPeriod, 'January 2, 2025');
  assert.equal(pair.right.observedPeriod, 'January 4, 2025');
  assert.notEqual(pair.left.title, pair.right.title);
  assert.equal(pair.baselineGrouping, 'joined');
  assert.deepEqual(Object.keys(pair).sort(), ['baselineGrouping', 'id', 'left', 'right']);
  for (const side of [pair.left, pair.right]) assert.deepEqual(Object.keys(side).sort(), ['observedPeriod', 'title']);
  assert.doesNotMatch(JSON.stringify(pair), /SYNTHETIC_PRIVATE_PAIR/);

  const { evidence_id } = database.sqlite.prepare('SELECT evidence_id FROM canonical_evidence WHERE captured_day = ? ORDER BY evidence_id LIMIT 1').get('2025-01-04');
  const { run_id } = database.sqlite.prepare('SELECT MAX(run_id) AS run_id FROM reconstruction_run').get();
  database.sqlite.prepare(`INSERT INTO journey_privacy_revision (policy_id, command_key, action, target_kind, source_run_id,
    reviewed_evidence_json, reviewed_family_json, reviewed_label, created_at_millis) VALUES
    ('synthetic-pair-policy', 'synthetic-pair-command', 'hide', 'inferred', ?, ?, '[]', 'Synthetic hidden trip', 1)`).run(run_id, JSON.stringify([evidence_id]));
  const hidden = await repository.loadCandidateShadowSnapshot({ canUseSource: () => true });
  assert.equal(hidden.status, 'complete');
  assert.deepEqual(hidden.separatePairs, []);
  assert.equal(await repository.verifyCandidateShadowSnapshot(read.token, () => true), false);
}));

async function prepareLocalRecoveryOutings() {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'synthetic-local-recovery-home', label: 'Synthetic Home', origin: 'observed-area',
    latitude: 10.82, longitude: 106.63, radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
  const photos = [2, 9].flatMap((firstDay, visit) => [9, 12, 16, 32, 40].map((hour) => {
    const day = firstDay + Math.floor(hour / 24);
    return { ...syntheticCandidates()[0], assetId: `synthetic-local-recovery-${firstDay}-${hour}`,
      capturedDay: `2025-01-${String(day).padStart(2, '0')}`, capturedAtMillis: Date.UTC(2025, 0, day, hour % 24),
      latitude: visit ? 13.75 : 25.04, longitude: visit ? 100.50 : 121.56, sourceOrigin: 'capture-like', supportEligible: true };
  }));
  await importer.commitPage({ scope: 'full', nextOffset: photos.length, scanned: photos.length, geotagged: photos.length,
    unavailable: 0, status: 'complete' }, photos);
  const baseline = createNativeReconstructionRepository();
  await baseline.rebuild();
  assert.equal((await baseline.loadDurableReveal()).journeys.length, 1);
  return baseline;
}

test('opt-in Local recovery persists an eligible pair, fences Account export and confirms the exact merge', async () => withDatabase(async (database) => {
  await prepareLocalRecoveryOutings();
  const optedIn = createNativeReconstructionRepository({ databaseName: 'travel-life-import-v1.db', enableLocalRecovery: true });
  await optedIn.rebuild();
  const before = await optedIn.loadDurableReveal();
  assert.equal(before.journeys.length, 2);
  assert.equal(before.mergePairs?.length, 1);
  const [pair] = before.mergePairs;
  const rule = database.sqlite.prepare("SELECT rule_version FROM reconstruction_run WHERE status = 'complete' ORDER BY run_id DESC LIMIT 1");
  assert.equal(rule.get().rule_version, 'atlas-recovery-local-v1');
  assert.equal((await optedIn.loadReplayManifestInput()).groups.length, 2);
  await assert.rejects(exportLocalHistory(), { reason: 'HISTORY_VERSION_UNSUPPORTED', boundary: 'HISTORY_EXPORT_CANDIDATE_COMPATIBILITY' });
  const { detail } = await optedIn.loadJourneyDetail(pair.leftId);
  const payload = { withJourneyId: pair.rightId, suggested: true, expectedPrivacyRevision: pair.privacyRevision, canUseSource: async () => true };
  await optedIn.saveJourneyCorrection(pair.leftId, 'merge', pair.generation, detail, 'synthetic-local-recovery-merge', payload);
  assert.equal(await optedIn.verifySuggestedMergeReceipt(pair, 'synthetic-local-recovery-merge'), true);
  const after = await optedIn.loadDurableReveal();
  assert.equal(after.journeys.length, 1);
  assert.equal(after.mergePairs, undefined);
  assert.equal((await optedIn.loadReplayManifestInput()).groups.length, 1);
}));

test('opt-in Local recovery preserves the baseline grouping with an existing saved Replay choice', async () => withDatabase(async () => {
  const baseline = await prepareLocalRecoveryOutings();
  const before = await baseline.loadReplayManifestInput();
  assert.equal(before.groups.length, 1);
  await baseline.saveReplayDraft([before.memories[0].key], before.snapshotToken, before.privacyRevision, 'newest-first', undefined, undefined, [before.groups[0].key], []);
  const saved = await baseline.loadReplayManifestInput();
  const optedIn = createNativeReconstructionRepository({ databaseName: 'travel-life-import-v1.db', enableLocalRecovery: true });
  await optedIn.rebuild();
  const reveal = await optedIn.loadDurableReveal();
  assert.equal(reveal.journeys.length, 1);
  assert.equal(reveal.mergePairs, undefined);
  const after = await optedIn.loadReplayManifestInput();
  assert.deepEqual(after.groups, saved.groups);
  assert.deepEqual(after.memories, saved.memories);
  assert.deepEqual(after.includedGroupKeys, saved.includedGroupKeys);
  assert.deepEqual(after.autoGroupKeys, saved.autoGroupKeys);
  assert.equal(after.direction, saved.direction);
}));

test('opt-in Local recovery rolls back if full access is withdrawn before acknowledgement', async () => withDatabase(async (database) => {
  const baseline = await prepareLocalRecoveryOutings();
  const before = await baseline.loadDurableReveal();
  let checks = 0;
  const optedIn = createNativeReconstructionRepository({
    databaseName: 'travel-life-import-v1.db',
    enableLocalRecovery: true,
    canUseRecoverySource: async () => ++checks < 3,
  });
  await assert.rejects(optedIn.rebuild(), (error) =>
    error.stage === 'CANDIDATE_READBACK' && classifyAppDiagnosticError(error) === 'ACCESS');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM reconstruction_run').get().count, 1);
  assert.deepEqual(await optedIn.loadDurableReveal(), before);
}));

test('full comparison reads 20,000+ SQLite rows in bounded pages without writes and discards interrupted results', async (t) => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'synthetic-scale-home', label: 'Synthetic home', origin: 'manual-pin', latitude: 10, longitude: 100,
    radiusMeters: 5_000, effectiveStartDay: '2024-01-01', effectiveEndDay: '2026-01-01' });
  const photos = [9, 16].map((hour, index) => ({ ...syntheticCandidates()[0], assetId: `synthetic-scale-photo-${index}`,
    latitude: 10.2, capturedAtMillis: Date.UTC(2025, 0, 2, hour) }));
  await importer.commitPage({ scope: 'full', nextOffset: 2, scanned: 2, geotagged: 2, unavailable: 0, status: 'complete' }, photos);
  database.sqlite.exec("UPDATE canonical_evidence SET evidence_id = 'a-scale-trip' WHERE source_ref LIKE '%synthetic-scale-photo-0'");
  database.sqlite.exec("UPDATE canonical_evidence SET evidence_id = 'z-scale-trip' WHERE source_ref LIKE '%synthetic-scale-photo-1'");
  insertScaleEvidence(database, 20_000);
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  const firstCall = database.calls.length;
  const read = await repository.loadCandidateShadowSnapshot({ canUseSource: () => true });
  assert.equal(read.status, 'complete');
  assert.equal(read.comparison.evidenceRows, 20_002);
  assert.equal(read.comparison.baselineRuleVersion, 'reconstruction-v1');
  assert.equal(read.comparison.baselineTripDetectorVersion, 'trip-detector-v1.1');
  assert.equal(read.policyVersion, 'atlas-recovery-shadow-v1');
  assert.equal(read.cards.length, 1);
  assert.equal(read.cards[0].state, 'reliable');
  assert.equal(read.cards[0].coverRefs.length, 2);
  const calls = database.calls.slice(firstCall);
  const pages = calls.filter(([, sql]) => /FROM canonical_evidence(?: WHERE evidence_id > \?)? ORDER BY evidence_id LIMIT/.test(sql));
  assert.equal(pages.length, Math.ceil(20_002 / 512) + 1);
  assert.ok(pages.every((page) => page.at(-1) === 512));
  assert.ok(calls.every(([, sql]) => !/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)));
  t.diagnostic(`Synthetic host comparison completed in ${read.comparison.elapsedMillis} ms. Peak device resource use is unmeasured.`);

  const getAll = database.adapter.getAllAsync;
  database.adapter.getAllAsync = (sql, ...parameters) => /FROM canonical_evidence(?: WHERE evidence_id > \?)? ORDER BY evidence_id LIMIT/.test(sql)
    ? getAll(sql, ...parameters.slice(0, -1), Math.min(127, parameters.at(-1))) : getAll(sql, ...parameters);
  try {
    const smallerPages = await repository.loadCandidateShadowSnapshot({ canUseSource: () => true });
    assert.equal(smallerPages.status, 'complete');
    assert.equal(smallerPages.comparison.evidenceRows, read.comparison.evidenceRows);
    assert.equal(smallerPages.policyVersion, read.policyVersion);
    assert.deepEqual(smallerPages.cards, read.cards);
  } finally { database.adapter.getAllAsync = getAll; }

  const events = [];
  const originalLog = console.info;
  console.info = (_, event) => events.push(event);
  try {
    const abort = new AbortController();
    database.beforeNext(/WHERE evidence_id > \? ORDER BY evidence_id LIMIT/, () => abort.abort());
    assert.deepEqual(await repository.loadCandidateShadowSnapshot({ canUseSource: () => true, signal: abort.signal, correlationId: 'synthetic-scale-cancel' }), { status: 'stale' });
    let accessChecks = 0;
    const changed = await repository.loadCandidateShadowSnapshot({ correlationId: 'synthetic-scale-stale', canUseSource: () => {
      if (++accessChecks === 3) database.sqlite.exec('UPDATE home_projection_context SET revision = revision + 1 WHERE record_id = 1');
      return true;
    } });
    assert.deepEqual(changed, { status: 'stale' });
    assert.equal(await repository.verifyCandidateShadowSnapshot(read.token, () => true), false);
    assert.deepEqual(events.filter(({ reasonCode }) => reasonCode !== 'START').map(({ stage, reasonCode, durableOutcome, correlationId }) =>
      ({ stage, reasonCode, durableOutcome, correlationId })), [
      { stage: 'CANDIDATE_INPUT_READ', reasonCode: 'SKIPPED', durableOutcome: 'skipped', correlationId: 'synthetic-scale-cancel' },
      { stage: 'CANDIDATE_READBACK', reasonCode: 'HISTORY_STALE', durableOutcome: 'skipped', correlationId: 'synthetic-scale-stale' },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /SYNTHETIC_PRIVATE_SENTINEL/);
  } finally { console.info = originalLog; }
}));

test('comparison retains one correlated terminal diagnostic and redacts failures at input, classification, presentation and readback', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'synthetic-fault-home', label: 'Synthetic Home', origin: 'manual-pin',
    latitude: 10.15, longitude: 100, radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
  await importSyntheticEvidence(importer);
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  const events = [];
  const originalLog = console.info;
  console.info = (_, event) => events.push(event);
  const projection = require(path.join(sourceRoot, 'reconstruction/candidate-projection.ts'));
  const project = projection.projectCanonicalCandidateHistory;
  const labels = require(path.join(sourceRoot, 'reconstruction/destination-label.ts'));
  const destinationLabel = labels.destinationLabel;
  const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL';
  try {
    database.failOnce(/FROM canonical_evidence ORDER BY evidence_id LIMIT/, new Error(`database is locked: ${sentinel}`));
    assert.deepEqual(await repository.loadCandidateShadowSnapshot({ canUseSource: () => true, correlationId: 'synthetic-input' }), { status: 'failed' });
    projection.projectCanonicalCandidateHistory = async () => { throw new Error(sentinel); };
    assert.deepEqual(await repository.loadCandidateShadowSnapshot({ canUseSource: () => true, correlationId: 'synthetic-classify' }), { status: 'failed' });
    projection.projectCanonicalCandidateHistory = project;
    labels.destinationLabel = async () => { throw new Error(sentinel); };
    assert.deepEqual(await repository.loadCandidateShadowSnapshot({ canUseSource: () => true, correlationId: 'synthetic-presentation' }), { status: 'failed' });
    labels.destinationLabel = destinationLabel;
    let checks = 0;
    const readback = await repository.loadCandidateShadowSnapshot({ correlationId: 'synthetic-readback', canUseSource: () => {
      if (++checks === 2) database.failOnce(/AS run_evidence/, new Error(`no such table: ${sentinel}`));
      return true;
    } });
    assert.deepEqual(readback, { status: 'failed' });
    assert.deepEqual(events.filter(({ reasonCode }) => reasonCode !== 'START'), [
      { operation: 'ATLAS_REBUILD', stage: 'CANDIDATE_INPUT_READ', reasonCode: 'DATABASE_BUSY', retryable: true, durableOutcome: 'unchanged', correlationId: 'synthetic-input' },
      { operation: 'ATLAS_REBUILD', stage: 'CANDIDATE_CLASSIFY', reasonCode: 'UNKNOWN', retryable: false, durableOutcome: 'unchanged', correlationId: 'synthetic-classify' },
      { operation: 'ATLAS_REBUILD', stage: 'CANDIDATE_PRESENTATION', reasonCode: 'UNKNOWN', retryable: false, durableOutcome: 'unchanged', correlationId: 'synthetic-presentation' },
      { operation: 'ATLAS_REBUILD', stage: 'CANDIDATE_READBACK', reasonCode: 'SCHEMA', retryable: false, durableOutcome: 'unchanged', correlationId: 'synthetic-readback' },
    ]);
    assert.deepEqual(events.filter(({ reasonCode }) => reasonCode === 'START').map(({ correlationId }) => correlationId),
      ['synthetic-input', 'synthetic-classify', 'synthetic-classify', 'synthetic-presentation', 'synthetic-presentation', 'synthetic-presentation',
        'synthetic-readback', 'synthetic-readback', 'synthetic-readback', 'synthetic-readback']);
    assert.doesNotMatch(JSON.stringify(events), new RegExp(sentinel));
  } finally {
    projection.projectCanonicalCandidateHistory = project;
    labels.destinationLabel = destinationLabel;
    console.info = originalLog;
  }
}));

for (const decision of ['keep', 'reject']) {
  test(`D2 verifies an exact ${decision} and fences rollback, reuse and stale authority`, async () => withDatabase(async (database) => {
    const importer = createNativeImportRepository();
    await importer.saveConfiguredHomeArea({ id: 'synthetic-home', label: 'Synthetic home', origin: 'manual-pin', latitude: 10, longitude: 100,
      radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
    const photo = { ...syntheticCandidates()[0], assetId: 'synthetic-private-photo', latitude: 10.2034 };
    const other = { ...photo, assetId: 'synthetic-unrelated-photo', capturedDay: '2025-02-08', capturedAtMillis: Date.UTC(2025, 1, 8) };
    await importer.commitPage({ scope: 'full', nextOffset: 2, scanned: 2, geotagged: 2, unavailable: 0, status: 'complete' }, [photo, other]);
    const repository = createNativeReconstructionRepository();
    await repository.rebuild();
    const canUseSource = () => true;
    const snapshot = await repository.loadCandidateShadowSnapshot({ canUseSource, purpose: 'reveal' });
    assert.equal(snapshot.status, 'complete');
    assert.deepEqual(snapshot.observed, [{ latitude: 10.2, longitude: 100 }]);
    const card = snapshot.cards.find((entry) => entry.coverRefs.includes(photo.assetId));
    const unrelated = snapshot.cards.find((entry) => entry.coverRefs.includes(other.assetId));
    assert.equal(card.state, 'possible');
    assert.equal(card.canReview, true);
    assert.equal(card.canReject, true);
    assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
    const correlationId = 'synthetic_d2_decision';
    const write = (action = decision, source = canUseSource, id = card.id, signal) => repository.saveCandidateShadowDecision(snapshot.token, id, action, 'synthetic-command', { canUseSource: source, correlationId, signal });
    const table = decision === 'keep' ? 'journey_correction_revision' : 'recognizable_candidate_rejection';
    const count = () => database.sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
    const sentinel = 'synthetic-private-sql-sentinel';
    const originalLog = console.info;
    const events = [];
    console.info = (_, event) => events.push(event);
    try {
      database.failOnce(new RegExp(`^INSERT INTO ${table}`), new Error(`database is locked ${sentinel}`));
      assert.equal(await write(), 'retry');
      assert.equal(count(), 0);
      let inspected = 0;
      assert.equal(await write(decision, () => ++inspected < 3), 'stale', JSON.stringify(events));
      assert.equal(count(), 0);
      if (decision === 'keep') {
        database.beforeNext(/^COMMIT$/, () => {
          database.sqlite.exec('COMMIT');
          throw new Error(`lost acknowledgement ${sentinel}`);
        });
        assert.equal(await write(), 'unknown');
        assert.equal(count(), 1);
        assert.ok(events.some((event) => event.stage === 'POSSIBLE_TRIP_ACK' && event.reasonCode === 'UNKNOWN' && event.durableOutcome === 'unknown'));
      } else {
        const originalExec = database.adapter.execAsync;
        let enterCommit;
        let settleCommit;
        const committing = new Promise((resolve) => { enterCommit = resolve; });
        const settle = new Promise((resolve) => { settleCommit = resolve; });
        database.adapter.execAsync = async (sql) => {
          if (sql === 'COMMIT') { database.adapter.execAsync = originalExec; enterCommit(); await settle; }
          return originalExec(sql);
        };
        const request = new AbortController();
        const first = write(decision, canUseSource, card.id, request.signal);
        await committing;
        let duplicateDone = false;
        const duplicate = write().then((result) => { duplicateDone = true; return result; });
        try {
          await new Promise((resolve) => setImmediate(resolve));
          assert.equal(duplicateDone, false, 'Concurrent retry cannot see an uncommitted receipt.');
        } finally { request.abort(); settleCommit(); }
        assert.deepEqual(await Promise.all([first, duplicate]), ['stale', 'applied']);
        assert.ok(events.some((event) => event.stage === 'POSSIBLE_TRIP_READBACK' && event.reasonCode === 'SKIPPED' && event.durableOutcome === 'complete'));
      }
      assert.equal(await write(), 'applied');
      assert.equal(await write(decision === 'keep' ? 'reject' : 'keep'), 'stale');
      assert.equal(await write(decision, canUseSource, unrelated.id), 'stale');
      assert.equal(count(), 1);
      assert.equal((await repository.loadDurableReveal()).journeys.length, decision === 'keep' ? 1 : 0);
      const replay = await repository.loadReplayManifestInput();
      assert.equal(replay.memories.length, decision === 'keep' ? 1 : 0);
      const reopened = createNativeReconstructionRepository();
      await reopened.rebuild();
      const rebuilt = await reopened.loadCandidateShadowSnapshot({ canUseSource, purpose: 'reveal' });
      assert.equal(rebuilt.status, 'complete');
      assert.ok(rebuilt.cards.some((entry) => entry.coverRefs.includes(other.assetId) && entry.state === 'possible'));
      assert.equal(rebuilt.cards.some((entry) => entry.coverRefs.includes(photo.assetId)), decision === 'keep');
      assert.ok(events.some((event) => event.operation === 'POSSIBLE_TRIP_REVIEW' && event.stage === 'POSSIBLE_TRIP_SAVE'
        && event.reasonCode === 'DATABASE_BUSY' && event.durableOutcome === 'unchanged' && event.correlationId === correlationId));
      assert.ok(events.some((event) => event.operation === 'POSSIBLE_TRIP_REVIEW' && event.stage === 'POSSIBLE_TRIP_READBACK'
        && event.reasonCode === 'COMPLETE' && event.correlationId === correlationId));
      assert.doesNotMatch(JSON.stringify(events), /synthetic-private|synthetic-command/);
    } finally { console.info = originalLog; }
  }));
}

test('initial Home receipt is exact and the first projection excludes matched media', async () => withDatabase(async (database) => {
  retainHistoricalSchema(database, 38);
  const importer = createNativeImportRepository();
  const area = { id: 'synthetic-home', label: 'Synthetic Home', origin: 'manual-pin', latitude: 10, longitude: 100,
    radiusMeters: 20_000, effectiveStartDay: '2025-01-01', effectiveEndDay: null };
  assert.equal(await importer.loadHomeSetup(), null);
  await importer.saveHomeSetup('synthetic-command', [area]);
  await importer.saveHomeSetup('synthetic-command', [area]);
  await assert.rejects(importer.saveHomeSetup('synthetic-command', []));
  assert.equal(await createNativeImportRepository().loadHomeSetup(), 'saved');
  assert.deepEqual(await importer.loadConfiguredHomeAreas(), [area]);
  await importSyntheticEvidence(importer);
  const repository = createNativeReconstructionRepository();
  const graph = await repository.rebuild();
  assert.equal(graph.journeys.length, 0);
  assert.equal(graph.memberships.length, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM canonical_evidence').get().n, 3);
  assert.equal(await repository.hasPendingHomeProjection(), false);
  await importer.deleteConfiguredHomeArea(area.id);
  assert.equal(await repository.hasPendingHomeProjection(), true);
  assert.equal((await repository.loadDurableReveal()).journeys.length, 0);
  await repository.rebuild();
  assert.equal(await repository.hasPendingHomeProjection(), false);
}));

test('a stored clue can take a journey off the Atlas on rebuild, with no producer involved (decision 0022, M11.1)', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'clue-wiring-home', label: 'Home', origin: 'manual-pin', latitude: 10, longitude: 100,
    radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
  const away = [2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4].map((day, index) => ({
    assetId: `synthetic-clue-wiring-${index}`, mediaType: 'image',
    capturedAtMillis: Date.UTC(2025, 0, day, 9 + (index % 6)), capturedDay: `2025-01-0${day}`,
    hasPreciseOffset: true, modifiedAtMillis: null, locationAvailable: true,
    latitude: 21.03, longitude: 105.85, reportedAccuracyMeters: 10, availability: 'available',
  }));
  await importer.commitPage({ scope: 'full', nextOffset: away.length, scanned: away.length, geotagged: away.length, unavailable: 0, status: 'complete' }, away);
  const repository = createNativeReconstructionRepository();
  const classification = () => database.sqlite.prepare(
    'SELECT q.classification FROM reconstruction_trip_qualification q JOIN reconstruction_run r ON r.run_id = q.run_id ORDER BY r.run_id DESC LIMIT 1',
  ).get().classification;

  const bare = await repository.rebuild();
  assert.equal(bare.journeys.length, 1);
  assert.equal(classification(), 'AUTO_CONFIRMED');

  const now = Date.now();
  const insertClue = database.sqlite.prepare(`INSERT INTO travel_clue
    (clue_id, kind, subject_json, value_json, strength, independence_key, producer_id, producer_version, evidence_revision, home_revision, correction_revision, state, created_at_millis)
    VALUES (?, 'photo-source', ?, '{"source":"screenshot"}', 'strong', ?, 'test-producer', 'v1', 0, 0, 0, 'active', ?)`);
  for (let index = 0; index < 8; index++) {
    insertClue.run(`clue-${index}`, JSON.stringify({ evidenceKeys: [`E:synthetic-clue-wiring-${index}`] }), `producer-${index}`, now);
  }

  await repository.rebuild();
  assert.notEqual(classification(), 'AUTO_CONFIRMED');

  // Deleting the private record deletes clues (clue-contract.md).
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM travel_clue').get().n, 8);
  await importer.deleteLocalHistory();
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM travel_clue').get().n, 0);
}));

test('a correction keeps protecting its reviewed evidence through family drift (clue-contract.md gap closed 2026-11-20)', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'drift-home', label: 'Home', origin: 'manual-pin', latitude: 10, longitude: 100,
    radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
  const away = [2, 2, 2, 4, 4].map((day, index) => ({
    assetId: `drift-away-${index}`, mediaType: 'image',
    capturedAtMillis: Date.UTC(2025, 0, day, 9 + index), capturedDay: `2025-01-0${day}`,
    hasPreciseOffset: true, modifiedAtMillis: null, locationAvailable: true,
    latitude: 21.03, longitude: 105.85, reportedAccuracyMeters: 10, availability: 'available',
  }));
  // A decoy far enough in time from the January episode to never join it
  // (so it cannot change this journey's own classification on its own),
  // used only to give 'drift-away-0' a same-family partner at review time.
  const decoy = { assetId: 'drift-decoy', mediaType: 'image',
    capturedAtMillis: Date.UTC(2025, 5, 1, 9), capturedDay: '2025-06-01',
    hasPreciseOffset: true, modifiedAtMillis: null, locationAvailable: true,
    latitude: 21.03, longitude: 105.85, reportedAccuracyMeters: 10, availability: 'available' };
  const units = [...away, decoy];
  await importer.commitPage({ scope: 'full', nextOffset: units.length, scanned: units.length, geotagged: units.length, unavailable: 0, status: 'complete' }, units);

  // At the moment the owner reviews this journey, their away photo and the
  // decoy are the same verified duplicate family (e.g. the same photo
  // synced from two sources).
  database.sqlite.exec(`UPDATE canonical_evidence SET platform_duplicate_family_id = 'drift-family', duplicate_tuple_version = 1, duplicate_tuple_fingerprint = 'drift-fingerprint'
    WHERE evidence_id IN ('drift-away-0', 'drift-decoy')`);

  const repository = createNativeReconstructionRepository();
  const classification = () => database.sqlite.prepare(
    'SELECT q.classification FROM reconstruction_trip_qualification q JOIN reconstruction_run r ON r.run_id = q.run_id ORDER BY r.run_id DESC LIMIT 1',
  ).get().classification;

  const bare = await repository.rebuild();
  assert.equal(bare.journeys.length, 1);
  assert.equal(classification(), 'AUTO_CONFIRMED');
  const runId = database.sqlite.prepare("SELECT run_id FROM reconstruction_run WHERE status = 'complete' ORDER BY run_id DESC LIMIT 1").get().run_id;
  const journeyRows = database.sqlite.prepare('SELECT journey_id FROM reconstruction_journey WHERE run_id = ?').all(runId);
  assert.equal(journeyRows.length, 1);
  const journeyId = journeyRows[0].journey_id;

  // The owner reviews the journey (a 'place' correction has no other side
  // effect on grouping) while 'drift-away-0' is still part of 'drift-family';
  // the saved snapshot records that.
  database.sqlite.prepare(`INSERT INTO journey_correction_revision
    (revision_id, action, source_run_id, journey_id, reviewed_support_json, state, created_at_millis, reviewed_family_snapshot_json)
    VALUES ('drift-correction', 'place', ?, ?, ?, 'effective', ?, ?)`).run(
    runId, journeyId, JSON.stringify(['F:drift-family']), Date.now(),
    JSON.stringify({ 'F:drift-family': { memberIds: ['drift-away-0', 'drift-decoy'], tupleVersion: 1, tupleFingerprint: 'drift-fingerprint' } }),
  );

  // The family dissolves afterward: only the decoy still carries it, so
  // 'drift-away-0's own current support key reverts to its bare evidence
  // id, no longer the 'F:drift-family' string the correction named.
  database.sqlite.exec("UPDATE canonical_evidence SET platform_duplicate_family_id = NULL, duplicate_tuple_version = 0, duplicate_tuple_fingerprint = NULL WHERE evidence_id = 'drift-away-0'");

  database.sqlite.prepare(`INSERT INTO travel_clue
    (clue_id, kind, subject_json, value_json, strength, independence_key, producer_id, producer_version, evidence_revision, home_revision, correction_revision, state, created_at_millis)
    VALUES ('drift-clue', 'photo-source', ?, '{"source":"screenshot"}', 'strong', 'drift-producer', 'test-producer', 'v1', 0, 0, 0, 'active', ?)`)
    .run(JSON.stringify({ evidenceKeys: ['E:drift-away-0'] }), Date.now());

  // Without resolving the correction's family snapshot down to its member
  // evidence ids, `correctedKeys` would still only hold the stale
  // 'F:drift-family' string, the clue's current 'E:drift-away-0' key would
  // not match it, and the clue would wrongly drop the journey below the
  // 5-independent-unit Atlas threshold despite the owner's own correction.
  await repository.rebuild();
  assert.equal(classification(), 'AUTO_CONFIRMED');
}));

test('a confirmed journey never writes a later-configured Home photo into visit-support (H-3 graph-level half, closed 2026-11-20)', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.connectPrivateRecord();
  // One photo at what will become the owner's Home, clustered by raw
  // coordinates into the SAME place/visit as three nearby away photos —
  // reconstructV1 has no concept of Home, so it groups them together.
  const units = [
    { assetId: 'h3-inhome', mediaType: 'image', capturedAtMillis: Date.UTC(2025, 0, 2, 9), capturedDay: '2025-01-02',
      hasPreciseOffset: true, modifiedAtMillis: null, locationAvailable: true, latitude: 21.03, longitude: 105.85, reportedAccuracyMeters: 10, availability: 'available' },
    ...[1, 2, 3].map((i) => ({ assetId: `h3-away-${i}`, mediaType: 'image', capturedAtMillis: Date.UTC(2025, 0, 2, 9 + i), capturedDay: '2025-01-02',
      hasPreciseOffset: true, modifiedAtMillis: null, locationAvailable: true, latitude: 21.04, longitude: 105.85, reportedAccuracyMeters: 10, availability: 'available' })),
  ];
  await importer.commitPage({ scope: 'full', nextOffset: units.length, scanned: units.length, geotagged: units.length, unavailable: 0, status: 'complete' }, units);
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  // The owner reviews and confirms this journey (fixture state for the
  // qualification, same pattern as prepareConfirmedJourney) while it still
  // has no configured Home at all, so 'h3-inhome' is ordinary support.
  database.sqlite.exec("UPDATE reconstruction_trip_qualification SET classification = 'USER_CONFIRMED'");
  const existing = await repository.loadDurableReveal();
  const selected = await repository.loadJourneyDetail(existing.journeys[0].displayId);
  await repository.saveJourneyCorrection(existing.journeys[0].displayId, 'confirm', selected.snapshotToken, selected.detail, 'h3-confirm-command', Date.now());
  // Only now does the owner configure a Home covering exactly that one
  // photo. A protected (confirmed) journey's visit comes verbatim from the
  // graph built before this, per `retainProtectedJourneys` — so without
  // the H-3 write-site filter, 'h3-inhome' would stay in visit-support
  // forever, even though `qualifyTripOutcomeV12` now correctly excludes it
  // from classification.
  await importer.saveConfiguredHomeArea({ id: 'h3-home', label: 'Home', origin: 'manual-pin', latitude: 21.03, longitude: 105.85,
    radiusMeters: 50, effectiveStartDay: null, effectiveEndDay: null });
  await repository.rebuild();
  const runId = database.sqlite.prepare("SELECT run_id FROM reconstruction_run WHERE status = 'complete' ORDER BY run_id DESC LIMIT 1").get().run_id;
  const support = database.sqlite.prepare("SELECT child_id FROM reconstruction_link WHERE run_id = ? AND link_kind = 'visit-support' ORDER BY child_id").all(runId).map((row) => row.child_id);
  assert.deepEqual(support, ['h3-away-1', 'h3-away-2', 'h3-away-3']);
  // The visit's own identity is still the graph `retainProtectedJourneys`
  // preserved verbatim (it includes 'h3-inhome' in its id), confirming this
  // exercises the protected-journey path, not a fresh, already-Home-aware one.
  const visit = database.sqlite.prepare('SELECT visit_id FROM reconstruction_visit WHERE run_id = ?').get(runId);
  assert.ok(visit.visit_id.includes('h3-inhome'));
}));

test('loadPossibleTrips lists a SUGGESTED journey with its priority reason and located count (CAP-3)', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.connectPrivateRecord();
  await importer.saveConfiguredHomeArea({ id: 'cap3-home', label: 'Home', origin: 'manual-pin', latitude: 21.03, longitude: 105.85,
    radiusMeters: 20000, effectiveStartDay: null, effectiveEndDay: null });
  // Two day-only (no precise offset) units on different days and far enough
  // from Home (~93 km) to be away evidence, but below MIN_PHOTOS_FOR_AUTO (5)
  // reliable photos — qualifies SUGGESTED with reasons = ['few-photos'] only
  // (farEnough, corroborated via two distinct day sessions, no Home/time
  // conflict, not frequent).
  const units = [1, 2].map((day) => ({ assetId: `cap3-away-${day}`, mediaType: 'image', capturedAtMillis: Date.UTC(2025, 0, day, 9),
    capturedDay: `2025-01-0${day}`, hasPreciseOffset: false, modifiedAtMillis: null, locationAvailable: true,
    latitude: 21.03, longitude: 106.85, reportedAccuracyMeters: 10, availability: 'available' }));
  await importer.commitPage({ scope: 'full', nextOffset: units.length, scanned: units.length, geotagged: units.length, unavailable: 0, status: 'complete' }, units);
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  const runId = database.sqlite.prepare("SELECT run_id FROM reconstruction_run WHERE status = 'complete' ORDER BY run_id DESC LIMIT 1").get().run_id;
  const stored = database.sqlite.prepare('SELECT classification, reasons_json FROM reconstruction_trip_qualification WHERE run_id = ?').get(runId);
  assert.equal(stored.classification, 'SUGGESTED');
  assert.deepEqual(JSON.parse(stored.reasons_json), ['few-photos']);
  const trips = await repository.loadPossibleTrips();
  assert.equal(trips.length, 1);
  assert.equal(trips[0].reasonCode, 'few-photos');
  assert.equal(trips[0].locatedCount, 2);
  assert.equal(trips[0].periodLabel.includes('2025'), true);
  // The returned displayId must be usable by the existing journey-detail/
  // correction path (the "Review outing" action reuses it verbatim).
  const detail = await repository.loadJourneyDetail(trips[0].displayId);
  assert.equal(detail.detail.visits.length > 0, true);
}));

test('loadPossibleTrips reports only its closed diagnostic shape on failure, never the raw error content (CAP-3)', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.connectPrivateRecord();
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  const events = [];
  const originalInfo = console.info;
  console.info = (_, event) => events.push(event);
  const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL';
  try {
    database.failOnce(/WITH journey_metadata AS/, new Error(`database is locked: ${sentinel}`));
    await assert.rejects(repository.loadPossibleTrips());
    const terminal = events.filter(({ reasonCode }) => reasonCode !== 'START');
    assert.equal(terminal.length, 1);
    assert.equal(JSON.stringify(terminal[0]).includes(sentinel), false);
    assert.equal(terminal[0].stage, 'POSSIBLE_TRIPS_LIST_READ');
    assert.equal(terminal[0].reasonCode, 'DATABASE_BUSY');
    assert.equal(terminal[0].durableOutcome, 'failed');
    assert.equal(terminal[0].retryable, true);
  } finally { console.info = originalInfo; }
}));

test('loadPossibleTrips excludes a privacy-hidden Possible trip (CAP-3)', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.connectPrivateRecord();
  await importer.saveConfiguredHomeArea({ id: 'cap3-home', label: 'Home', origin: 'manual-pin', latitude: 21.03, longitude: 105.85,
    radiusMeters: 20000, effectiveStartDay: null, effectiveEndDay: null });
  const units = [1, 2].map((day) => ({ assetId: `cap3-hide-${day}`, mediaType: 'image', capturedAtMillis: Date.UTC(2025, 0, day, 9),
    capturedDay: `2025-01-0${day}`, hasPreciseOffset: false, modifiedAtMillis: null, locationAvailable: true,
    latitude: 21.03, longitude: 106.85, reportedAccuracyMeters: 10, availability: 'available' }));
  await importer.commitPage({ scope: 'full', nextOffset: units.length, scanned: units.length, geotagged: units.length, unavailable: 0, status: 'complete' }, units);
  const repository = createNativeReconstructionRepository();
  await repository.rebuild();
  const before = await repository.loadPossibleTrips();
  assert.equal(before.length, 1);
  const detail = await repository.loadJourneyDetail(before[0].displayId);
  const review = await repository.reviewJourneyPrivacy(before[0].displayId, detail.snapshotToken);
  await repository.saveJourneyPrivacy(review.reviewId, 'hide', 'cap3-hide-command');
  const after = await repository.loadPossibleTrips();
  assert.equal(after.length, 0);
}));

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
  const firstPreviewPage = await repository.loadReplayEditorPreviewPage([before.memories[0].key], before.snapshotToken, before.privacyRevision);
  assert.deepEqual(firstPreviewPage.keys, [before.memories[0].key]);
  assert.equal(firstPreviewPage.previewSourceRefs.length, 1);
  const orderedDraft = [before.memories[1].key, before.memories[0].key];
  await assert.rejects(repository.saveReplayDraft(orderedDraft, before.snapshotToken + 1, before.privacyRevision), /Replay draft is stale/);
  database.sqlite.exec("INSERT INTO replay_draft (record_id, revision, committed_overrides_json, updated_at_millis) VALUES (1, 1, '{\"direction\":\"newest-first\"}', 0)");
  assert.equal((await repository.loadReplayManifestInput()).direction, 'oldest-first');
  // Working intent survives a reopen, including an intentional empty selection,
  // without replacing the committed draft.
  await repository.stageReplayWorkingDraft([], before.snapshotToken, before.privacyRevision, 'oldest-first');
  const emptyWorking = await repository.loadReplayManifestInput();
  assert.deepEqual(emptyWorking.workingDraft?.memoryKeys, []);
  assert.equal(emptyWorking.workingDraft?.baseRevision, 1);
  assert.equal(emptyWorking.direction, 'oldest-first');
  await repository.resetReplayDraft(emptyWorking.snapshotToken, emptyWorking.privacyRevision);
  assert.equal((await repository.loadReplayManifestInput()).workingDraft, undefined);
  await repository.stageReplayWorkingDraft(orderedDraft, before.snapshotToken, before.privacyRevision, 'newest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, 1, [before.groups[0].key]);
  const staged = await repository.loadReplayManifestInput();
  assert.deepEqual(staged.workingDraft?.memoryKeys, orderedDraft);
  assert.deepEqual(staged.workingDraft?.includedGroupKeys, [before.groups[0].key]);
  await assert.rejects(repository.saveReplayDraft(orderedDraft, before.snapshotToken, before.privacyRevision, 'newest-first', undefined, 1), /Replay draft conflict/);
  await repository.saveReplayDraft(orderedDraft, before.snapshotToken, before.privacyRevision, 'newest-first', undefined, staged.workingDraft?.revision, [before.groups[0].key]);
  const afterDraft = await repository.loadReplayManifestInput();
  assert.equal(afterDraft.memories.filter((memory) => memory.intent === 'keep').length, 2);
  assert.deepEqual(afterDraft.memories.filter((memory) => memory.intent === 'keep').sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((memory) => memory.key), orderedDraft);
  assert.equal(afterDraft.direction, 'newest-first');
  assert.deepEqual(afterDraft.includedGroupKeys, [before.groups[0].key]);
  assert.equal(afterDraft.groups.find((group) => group.key === before.groups[1].key)?.eligible, false);
  assert.ok(afterDraft.memories.every((memory) => !memory.key.includes('synthetic-source')));
  assert.equal(afterDraft.workingDraft, undefined);
  // A missing legacy field retains its automatic default, but an explicitly
  // persisted empty list means every included trip is manual after reopening.
  await repository.saveReplayDraft(orderedDraft, afterDraft.snapshotToken, afterDraft.privacyRevision, 'newest-first', undefined, undefined, [before.groups[0].key], []);
  const committedManual = await repository.loadReplayManifestInput();
  assert.deepEqual(committedManual.autoGroupKeys, []);
  await repository.stageReplayWorkingDraft(orderedDraft, committedManual.snapshotToken, committedManual.privacyRevision, 'newest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, [before.groups[0].key], []);
  const workingManual = await repository.loadReplayManifestInput();
  assert.deepEqual(workingManual.workingDraft?.autoGroupKeys, []);
  await repository.resetReplayDraft(afterDraft.snapshotToken, afterDraft.privacyRevision);
  const resetDraft = await repository.loadReplayManifestInput();
  assert.deepEqual(resetDraft.memories.filter((memory) => memory.intent === 'keep').sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((memory) => memory.key), orderedDraft);
  assert.equal(resetDraft.direction, 'newest-first');
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

test('Replay scene-only owner journeys retain exact inclusion, music and consecutive media edits across restart', async () => withDatabase(async (database) => {
  let repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  await repository.createManualJourney(manualJourney());
  const initial = await repository.loadReplayManifestInput();
  const scene = initial.groups.find((group) => group.state === 'owner-entered');
  assert.ok(scene, 'The canonical Journey List includes the owner-entered scene');
  assert.equal(initial.memories.some((memory) => memory.groupKey === scene.key), false);
  const music = { kind: 'custom', revision: 'synthetic-local-audio-revision', localUri: 'file:///synthetic-private-audio.m4a' };
  const allGroups = initial.groups.map((group) => group.key);
  // Choosing music includes a scene-only trip: this previously failed before SQL.
  let revision = await repository.stageReplayWorkingDraft([], initial.snapshotToken, initial.privacyRevision, 'newest-first', music, undefined, allGroups, allGroups);
  let readback = await repository.loadReplayManifestInput();
  assert.deepEqual(readback.workingDraft.includedGroupKeys, allGroups);
  assert.deepEqual(readback.workingDraft.soundtrack, music);
  const included = allGroups.filter((key) => key !== scene.key);
  revision = await repository.stageReplayWorkingDraft([], initial.snapshotToken, initial.privacyRevision, 'newest-first', music, revision, included, []);
  repository = createNativeReconstructionRepository();
  readback = await repository.loadReplayManifestInput();
  assert.deepEqual(readback.workingDraft.includedGroupKeys, included);
  const selected = [readback.memories[0].key];
  revision = await repository.stageReplayWorkingDraft(selected, initial.snapshotToken, initial.privacyRevision, 'newest-first', music, revision, included, []);
  await repository.saveReplayDraft(selected, initial.snapshotToken, initial.privacyRevision, 'newest-first', music, revision, included, []);
  repository = createNativeReconstructionRepository();
  readback = await repository.loadReplayManifestInput();
  assert.deepEqual(readback.includedGroupKeys, included);
  assert.equal(readback.groups.find((group) => group.key === scene.key).eligible, false);
  assert.deepEqual(readback.autoGroupKeys, []);
  assert.deepEqual(readback.soundtrack, music);
  assert.deepEqual(readback.memories.filter((memory) => memory.intent === 'keep').map((memory) => memory.key), selected);
  // Scene-only inclusion remains independently editable and commit-safe.
  revision = await repository.stageReplayWorkingDraft([], initial.snapshotToken, initial.privacyRevision, 'oldest-first', music, undefined, [scene.key], [scene.key]);
  await repository.saveReplayDraft([], initial.snapshotToken, initial.privacyRevision, 'oldest-first', music, revision, [scene.key], [scene.key]);
  readback = await createNativeReconstructionRepository().loadReplayManifestInput();
  assert.deepEqual(readback.includedGroupKeys, [scene.key]);
  assert.deepEqual(readback.autoGroupKeys, [scene.key]);
  assert.deepEqual(readback.soundtrack, music);
}));

test('Replay mutation receipts reject identity reuse and bound settled session history', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  await repository.createManualJourney(manualJourney());
  const input = await repository.loadReplayManifestInput();
  const groups = input.groups.map((group) => group.key);
  const music = { kind: 'custom', revision: 'synthetic-receipt-music', localUri: 'file:///synthetic-receipt.m4a' };
  const mutation = { operationId: 'synthetic-stage-1', sessionId: 'synthetic-session', editVersion: 1 };
  const stage = (identity = mutation, direction = 'oldest-first', expected) => repository.stageReplayWorkingDraft([], input.snapshotToken, input.privacyRevision, direction, music, expected, groups, groups, identity);
  const revision = await stage();
  const durable = () => ({ draft: database.sqlite.prepare('SELECT * FROM replay_draft').all(), receipts: database.sqlite.prepare('SELECT * FROM replay_mutation_receipt ORDER BY operation_id').all() });
  const before = durable();
  assert.equal(await stage(), revision);
  assert.deepEqual(durable(), before);
  for (const [identity, direction] of [[mutation, 'newest-first'], [{ ...mutation, sessionId: 'competing-session' }, 'oldest-first'], [{ ...mutation, editVersion: 2 }, 'oldest-first']]) {
    await assert.rejects(stage(identity, direction), (error) => error.guard === 'receipt');
    assert.deepEqual(durable(), before);
  }
  // Exercise commit receipts independently, including scene-only inclusion.
  const commit = { operationId: 'synthetic-commit', sessionId: mutation.sessionId, editVersion: 2 };
  const save = (identity = commit, direction = 'oldest-first') => repository.saveReplayDraft([], input.snapshotToken, input.privacyRevision, direction, music, revision, groups, groups, identity);
  await save();
  const committed = durable();
  await save();
  assert.deepEqual(durable(), committed);
  for (const [identity, direction] of [[commit, 'newest-first'], [{ ...commit, sessionId: 'competing-session' }, 'oldest-first'], [{ ...commit, editVersion: 3 }, 'oldest-first']]) {
    await assert.rejects(save(identity, direction), (error) => error.guard === 'receipt');
    assert.deepEqual(durable(), committed);
  }
  let latest;
  let latestRevision = revision;
  for (let index = 3; index <= 100; index += 1) {
    latest = { operationId: `synthetic-stage-${index}`, sessionId: mutation.sessionId, editVersion: index };
    latestRevision = await stage(latest, 'oldest-first', latestRevision);
    assert.ok(database.sqlite.prepare('SELECT COUNT(*) AS count FROM replay_mutation_receipt').get().count <= 32);
  }
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM replay_mutation_receipt').get().count, 32);
  assert.deepEqual(await repository.reconcileReplayMutation(latest, input.snapshotToken, input.privacyRevision), { kind: 'acknowledged', revision: latestRevision });
  assert.ok(database.sqlite.prepare('SELECT operation_id FROM replay_mutation_receipt WHERE operation_id = ?').get(latest.operationId));
}));

test('Replay receipt reconciliation cannot read an uncommitted receipt before writer settlement', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  const input = await repository.loadReplayManifestInput();
  const mutation = { operationId: 'held-commit-stage', sessionId: 'held-session', editVersion: 1 };
  let release;
  let entered;
  const hold = new Promise((resolve) => { release = resolve; });
  const committing = new Promise((resolve) => { entered = resolve; });
  const originalExec = database.adapter.execAsync;
  let held = false;
  database.adapter.execAsync = async (sql) => {
    if (!held && sql === 'COMMIT') { held = true; entered(); await hold; }
    return originalExec(sql);
  };
  const saving = repository.stageReplayWorkingDraft([], input.snapshotToken, input.privacyRevision, 'oldest-first', { kind: 'bundled', revision: 'happy-moments-1.4' }, undefined, undefined, undefined, mutation);
  await committing;
  const receiptReads = () => database.calls.filter(([, sql]) => sql.startsWith('SELECT * FROM replay_mutation_receipt')).length;
  const before = receiptReads();
  let settled = false;
  const checking = repository.reconcileReplayMutation(mutation, input.snapshotToken, input.privacyRevision).then((result) => { settled = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(receiptReads(), before, 'Reconciliation must wait outside the active transaction');
  assert.equal(settled, false);
  release();
  const revision = await saving;
  assert.deepEqual(await checking, { kind: 'acknowledged', revision });
  assert.equal(receiptReads(), before + 1);
}));

for (const invalidate of [false, true]) test(`Replay artifact foreground write waits for a file-backed writer and rechecks scope (invalidate ${invalidate})`, async () => {
  const { runOwnedTransaction } = require(path.join(sourceRoot, 'database/native-transaction.ts'));
  const root = path.resolve(__dirname, '../../../.local'); fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'replay-artifact-writer-'));
  const filename = path.join(directory, 'synthetic.db');
  const database = syntheticDatabase(filename); activeDatabase = database.adapter;
  const writer = new DatabaseSync(filename);
  let release; let entered;
  const hold = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  let writing;
  try {
    const repository = createNativeReconstructionRepository();
    await prepareConfirmedJourney(database, repository);
    const input = await repository.loadReplayManifestInput();
    await repository.saveReplayDraft([], input.snapshotToken, input.privacyRevision);
    database.sqlite.exec('PRAGMA busy_timeout = 0');
    writing = runOwnedTransaction({ execAsync: async sql => writer.exec(sql) }, { kind: 'background' }, async () => {
      writer.exec("UPDATE replay_draft SET committed_overrides_json = '{\"direction\":\"newest-first\"}' WHERE record_id = 1");
      if (invalidate) writer.exec("UPDATE private_record_lifecycle SET state = 'disconnected' WHERE record_id = 1");
      entered(); await hold;
    });
    await Promise.race([started, writing]);
    let outcome = null;
    const artifact = { identity: 'synthetic-composition', cacheVersion: 2, fileKey: 'replay-abc-def.mp4', durationSeconds: 45, renderedMemoryCount: 0 };
    const saving = repository.saveReplayPreparedArtifact(artifact, input.snapshotToken, input.privacyRevision).then(() => { outcome = { ok: true }; }, error => { outcome = { error }; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(outcome, null, 'Artifact must wait outside the active native writer instead of issuing an uncoordinated SQLite write');
    release(); await writing; await saving;
    const row = database.sqlite.prepare('SELECT committed_overrides_json FROM replay_draft WHERE record_id = 1').get();
    const overrides = JSON.parse(row.committed_overrides_json);
    assert.equal(overrides.direction, 'newest-first');
    if (invalidate) {
      assert.equal(outcome.error.diagnosticStage, 'REPLAY_OUTPUT_LIFECYCLE');
      assert.equal(overrides.preparedArtifact, undefined);
    } else {
      assert.equal(outcome.ok, true); assert.deepEqual(overrides.preparedArtifact, artifact);
    }
  } finally {
    release(); if (writing) await writing;
    activeDatabase = undefined; writer.close(); database.sqlite.close(); fs.unlinkSync(filename); fs.rmdirSync(directory);
  }
});

test('Replay artifact metadata preserves working composition revision and genuine conflicts', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  const before = await repository.loadReplayManifestInput();
  const selected = [before.memories[0].key];
  const music = { kind: 'bundled', revision: 'happy-moments-1.4' };
  const workingRevision = await repository.stageReplayWorkingDraft(selected, before.snapshotToken, before.privacyRevision, 'oldest-first', music);
  const staged = await repository.loadReplayManifestInput();
  const artifact = { identity: 'synthetic-composition', cacheVersion: 2, fileKey: 'synthetic-preview.mp4', durationSeconds: 45, renderedMemoryCount: 1 };
  await repository.saveReplayPreparedArtifact(artifact, before.snapshotToken, before.privacyRevision);
  const afterArtifact = await repository.loadReplayManifestInput();
  assert.deepEqual(afterArtifact.preparedArtifact, artifact);
  assert.deepEqual(afterArtifact.workingDraft, staged.workingDraft);
  const nextWorkingRevision = await repository.stageReplayWorkingDraft([], before.snapshotToken, before.privacyRevision, 'oldest-first', music, workingRevision);
  await repository.saveReplayDraft([], before.snapshotToken, before.privacyRevision, 'oldest-first', music, nextWorkingRevision);
  const committed = await repository.loadReplayManifestInput();
  assert.equal(committed.workingDraft, undefined);
  const staleRevision = await repository.stageReplayWorkingDraft(selected, before.snapshotToken, before.privacyRevision, 'oldest-first', music);
  // A genuine composition change must still invalidate an older working branch;
  // cache persistence cannot silently rebase or discard that owner's intent.
  database.sqlite.exec('UPDATE replay_draft SET revision = revision + 1 WHERE record_id = 1');
  await repository.saveReplayPreparedArtifact(artifact, before.snapshotToken, before.privacyRevision);
  assert.equal((await repository.loadReplayManifestInput()).workingDraft, undefined);
  await assert.rejects(repository.stageReplayWorkingDraft(selected, before.snapshotToken, before.privacyRevision, 'oldest-first', music, staleRevision), /Replay draft conflict/);
}));

for (const existingDraft of [false, true]) test(`Replay artifact CAS rejects an interleaved mutation and rolls back its owned transaction (existing draft ${existingDraft})`, async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  const before = await repository.loadReplayManifestInput();
  if (existingDraft) await repository.saveReplayDraft([], before.snapshotToken, before.privacyRevision);
  const beforeRow = database.sqlite.prepare('SELECT revision, committed_overrides_json FROM replay_draft WHERE record_id = 1').get();
  const newerOverrides = JSON.stringify({ direction: 'newest-first', directionPreferenceVersion: 1, keptMemoryRefs: [], excludedGroupJourneyIds: [], autoGroupJourneyIds: [] });
  database.beforeNext(/(?:INSERT INTO|UPDATE) replay_draft/, () => {
    // Interleave a newer committed composition after the cache method reads its
    // metadata source, immediately before its eventual SQLite write executes.
    database.sqlite.prepare('INSERT INTO replay_draft (record_id, revision, committed_overrides_json, updated_at_millis) VALUES (1, 50, ?, 1) ON CONFLICT(record_id) DO UPDATE SET revision = 50, committed_overrides_json = excluded.committed_overrides_json').run(newerOverrides);
  });
  const artifact = { identity: 'synthetic-old-composition', cacheVersion: 2, fileKey: 'synthetic-old-preview.mp4', durationSeconds: 45, renderedMemoryCount: 1 };
  await assert.rejects(repository.saveReplayPreparedArtifact(artifact, before.snapshotToken, before.privacyRevision), (error) => {
    assert.match(error.message, /Replay artifact is stale/);
    assert.equal(error.diagnosticReason, 'REPLAY_RECEIPT_CONFLICT');
    assert.equal(error.diagnosticStage, 'REPLAY_OUTPUT_CAS');
    return true;
  });
  const retained = database.sqlite.prepare('SELECT revision, committed_overrides_json FROM replay_draft WHERE record_id = 1').get();
  assert.deepEqual(retained, beforeRow, 'The synthetic same-transaction interleave rolls back with the rejected cache mutation');
}));

for (const guard of ['lifecycle', 'mapping', 'run', 'privacy']) test(`Replay prepared artifact identifies ${guard} rejection without changing the record`, async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  const before = await repository.loadReplayManifestInput();
  if (guard === 'lifecycle') database.sqlite.exec("UPDATE private_record_lifecycle SET state = 'disconnected' WHERE record_id = 1");
  if (guard === 'run') database.sqlite.exec("UPDATE reconstruction_run SET status = 'pending' WHERE status = 'complete'");
  if (guard === 'privacy') database.sqlite.prepare("INSERT INTO journey_privacy_revision (policy_id, command_key, action, target_kind, source_run_id, reviewed_evidence_json, reviewed_family_json, reviewed_label, created_at_millis) VALUES ('synthetic-policy', 'synthetic-command', 'hide', 'inferred', ?, '[]', '[]', 'synthetic-private-label', 1)").run(before.snapshotToken);
  const artifact = { identity: 'synthetic-composition', cacheVersion: 2, fileKey: 'synthetic-preview.mp4', durationSeconds: 45, renderedMemoryCount: 1 };
  await assert.rejects(repository.saveReplayPreparedArtifact(artifact, before.snapshotToken + (guard === 'mapping' ? 1 : 0), before.privacyRevision), (error) => {
    assert.equal(error.message, 'Replay artifact is stale.');
    assert.equal(error.diagnosticReason, guard === 'mapping' ? 'REPLAY_MAPPING_INVALID' : 'REPLAY_SCOPE_INVALID');
    assert.equal(error.diagnosticStage, `REPLAY_OUTPUT_${guard.toUpperCase()}`);
    assert.doesNotMatch(JSON.stringify(error), /synthetic-composition|synthetic-preview|synthetic-private-label/);
    return true;
  });
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM replay_draft').get().count, 0);
}));

test('Replay draft guards distinguish stale intent from native write failures', async () => withDatabase(async (database) => {
  const repository = createNativeReconstructionRepository();
  await prepareConfirmedJourney(database, repository);
  const before = await repository.loadReplayManifestInput();
  for (const method of ['stageReplayWorkingDraft', 'saveReplayDraft']) {
    await assert.rejects(repository[method]([], before.snapshotToken + 1, before.privacyRevision), (error) => error instanceof ReplayDraftStaleError && error.code === 'REPLAY_DRAFT_STALE');
    const nativeFailure = new Error('Synthetic native write failure.');
    database.failOnce(/INSERT INTO replay_draft/, nativeFailure);
    await assert.rejects(repository[method]([], before.snapshotToken, before.privacyRevision), (error) => error === nativeFailure && !(error instanceof ReplayDraftStaleError));
  }
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

test('Timeline sorts qualified same-year journeys by observed dates and distinguishes similar cards', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, 42);
  database.sqlite.exec(`INSERT INTO canonical_evidence (evidence_id,source_ref,media_type,availability,captured_day)
    VALUES ('new-photo','new-photo','image','available','2025-01-17');
    INSERT INTO reconstruction_visit (visit_id,run_id,place_id,ordering) VALUES ('new-visit',1,'synthetic-retained-place','chronological');
    INSERT INTO reconstruction_journey (journey_id,run_id,journey_state) VALUES ('aaa-new-trip',1,'inferred');
    INSERT INTO reconstruction_link (run_id,link_kind,parent_id,child_id) VALUES (1,'journey-visit','aaa-new-trip','new-visit'),(1,'visit-support','new-visit','new-photo');
    INSERT INTO reconstruction_trip_qualification (run_id,journey_id,classification,score,reasons_json) VALUES (1,'aaa-new-trip','USER_CONFIRMED',0,'[]');`);
  const { journeys } = await createNativeReconstructionRepository().loadDurableReveal();
  assert.deepEqual(journeys.map(({ periodLabel, ordering }) => [periodLabel, ordering]), [
    ['January 17, 2025', 'chronological'], ['January 2, 2025', 'chronological'],
  ]);
}));

test('durable Atlas rejects a generation replaced during readback instead of returning an empty list', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const reconstruction = createNativeReconstructionRepository();
  assert.equal((await reconstruction.loadDurableReveal()).journeys.length, 1);
  database.beforeNext(/WITH journey_anchor AS/, () => database.sqlite.exec(`
    DELETE FROM reconstruction_journey WHERE run_id = 1;
    INSERT INTO reconstruction_run (run_id, rule_version, evidence_revision, status, completed_at_millis)
      VALUES (2, 'reconstruction-v1', 1, 'complete', 2);
  `));
  await assert.rejects(reconstruction.loadDurableReveal(), (error) => {
    assert.equal(error.stage, 'DURABLE_PROJECTION');
    assert.equal(classifyAppDiagnosticError(error), 'HISTORY_STALE');
    return true;
  });
  assert.deepEqual((await reconstruction.loadDurableReveal()).journeys, []);
}));

test('the last committed Atlas, album and Replay remain readable on a distinct SQLite connection during rebuild', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-life-atlas-'));
  const filename = path.join(directory, 'synthetic.db');
  const reader = syntheticDatabase(filename);
  const writer = syntheticDatabase(filename);
  let continueRebuild;
  const paused = new Promise((resolve) => { continueRebuild = resolve; });
  let uncommittedWrite;
  const reachedDelete = new Promise((resolve) => { uncommittedWrite = resolve; });
  let running;
  try {
    activeDatabase = reader.adapter;
    await ensureNativeImportSchema(reader.adapter);
    seedRetainedProjection(reader, schemaVersion);
    const reconstruction = createNativeReconstructionRepository();
    const [trip] = (await reconstruction.loadDurableReveal()).journeys;
    const originalRun = writer.adapter.runAsync;
    writer.adapter.runAsync = async (sql, ...parameters) => {
      const result = await originalRun(sql, ...parameters);
      if (sql === 'DELETE FROM reconstruction_journey') {
        uncommittedWrite();
        await paused;
      }
      return result;
    };
    activeDatabase = writer.adapter;
    running = reconstruction.rebuild();
    await Promise.race([reachedDelete, running.then(() => assert.fail('Rebuild finished before its write checkpoint'))]);
    assert.equal((await reconstruction.loadDurableReveal()).journeys[0].displayId, trip.displayId);
    assert.equal((await reconstruction.loadJourneyDetail(trip.displayId)).snapshotToken, 1);
    assert.deepEqual((await reconstruction.loadJourneyMediaPage(trip.displayId, 1, 0)).previewSourceRefs, ['synthetic-retained-source']);
    assert.equal((await reconstruction.loadReplayManifestInput()).snapshotToken, 1);
    continueRebuild();
    await running;
    assert.equal((await reconstruction.loadDurableReveal()).journeys.length, 0);
    await assert.rejects(reconstruction.loadJourneyMediaPage(trip.displayId, 1, 0), /Gallery changed/);
  } finally {
    continueRebuild();
    await running?.catch(() => {});
    activeDatabase = undefined;
    writer.sqlite.close();
    reader.sqlite.close();
    fs.unlinkSync(filename);
    fs.rmdirSync(directory);
  }
});

test('Timeline, detail, album and Replay agree on the retained published generation', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  database.sqlite.exec(`
    INSERT INTO reconstruction_run (run_id, rule_version, evidence_revision, status, completed_at_millis)
      VALUES (2, 'reconstruction-v1', 0, 'complete', 2);
  `);
  const reconstruction = createNativeReconstructionRepository();
  const [journey] = (await reconstruction.loadDurableReveal()).journeys;
  assert.ok(journey);
  const detail = await reconstruction.loadJourneyDetail(journey.displayId);
  assert.equal(detail.snapshotToken, 1);
  const album = await reconstruction.loadJourneyMediaPage(journey.displayId, 1, 0);
  assert.deepEqual(album.previewSourceRefs, ['synthetic-retained-source']);
  assert.equal(await reconstruction.verifyJourneyMediaSnapshot(journey.displayId, 1, album.privacyRevision), true);
  assert.equal((await reconstruction.loadJourneyEligibility(journey.displayId, 1, 'replay')).eligible, true);
  assert.equal((await reconstruction.loadReplayManifestInput()).snapshotToken, 1);
  database.sqlite.exec('UPDATE home_projection_context SET revision = revision + 1 WHERE record_id = 1');
  assert.equal(await reconstruction.verifyJourneyMediaSnapshot(journey.displayId, 1, album.privacyRevision), false);
  await assert.rejects(reconstruction.loadJourneyMediaPage(journey.displayId, 1, 0), /Gallery changed/);
}));

test('Timeline merge reviews one exact qualified pair and verifies the committed receipt on retry', async () => withDatabase(async (database) => {
  const importer = createNativeImportRepository();
  await importer.saveConfiguredHomeArea({ id: 'pair-home', label: 'Synthetic Home', origin: 'manual-pin',
    latitude: 30, longitude: 110, radiusMeters: 5_000, effectiveStartDay: null, effectiveEndDay: null });
  const photos = [2, 13].flatMap((day, visit) => [8, 10, 12, 14, 16].map((hour) => ({
    ...syntheticCandidates()[0], assetId: `pair-${day}-${hour}`, capturedDay: `2025-01-${String(day).padStart(2, '0')}`,
    capturedAtMillis: Date.UTC(2025, 0, day, hour), sourceOrigin: 'capture-like', supportEligible: true,
    latitude: visit === 0 ? 13.75 : 10.77, longitude: visit === 0 ? 100.5 : 106.7,
  })));
  await importer.commitPage({ scope: 'full', nextOffset: photos.length, scanned: photos.length, geotagged: photos.length, unavailable: 0, status: 'complete' }, photos);
  const reconstruction = createNativeReconstructionRepository();
  await reconstruction.rebuild();
  // Independently exercise the persisted proposal contract, regardless of the
  // baseline continuity policy's eligibility window.
  const endpoints = database.sqlite.prepare(`SELECT j.run_id, j.journey_id, MIN(e.captured_at_millis) AS first_at
    FROM reconstruction_journey j JOIN reconstruction_link v ON v.run_id = j.run_id AND v.parent_id = j.journey_id AND v.link_kind = 'journey-visit'
    JOIN reconstruction_link s ON s.run_id = j.run_id AND s.parent_id = v.child_id AND s.link_kind = 'visit-support'
    JOIN canonical_evidence e ON e.evidence_id = s.child_id GROUP BY j.run_id, j.journey_id ORDER BY first_at`).all();
  assert.equal(endpoints.length, 2);
  database.sqlite.exec("UPDATE reconstruction_trip_qualification SET classification = 'AUTO_CONFIRMED'");
  database.sqlite.prepare("INSERT INTO reconstruction_link (run_id, link_kind, parent_id, child_id) VALUES (?, 'possible-merge:adjacent-gap', ?, ?)")
    .run(endpoints[0].run_id, endpoints[0].journey_id, endpoints[1].journey_id);
  const before = await reconstruction.loadDurableReveal();
  assert.equal(before.journeys.length, 2);
  const [pair] = before.mergePairs ?? [];
  assert.ok(pair);
  const { detail } = await reconstruction.loadJourneyDetail(pair.leftId);
  const payload = { withJourneyId: pair.rightId, suggested: true, expectedPrivacyRevision: pair.privacyRevision, canUseSource: async () => true };
  await assert.rejects(reconstruction.saveJourneyCorrection(pair.leftId, 'merge', pair.generation, detail, 'wrong-pair', { ...payload, expectedPrivacyRevision: -1 }), /stale/);
  let access = true;
  await assert.rejects(reconstruction.saveJourneyCorrection(pair.leftId, 'merge', pair.generation, detail, 'revoked-pair',
    { ...payload, canUseSource: async () => access, onStage: (stage) => { if (stage === 'POSSIBLE_TRIP_REBUILD') access = false; } }), /not permitted/);
  assert.equal((await reconstruction.loadDurableReveal()).journeys.length, 2);
  let loseAcknowledgement = false;
  const originalExec = database.adapter.execAsync;
  database.adapter.execAsync = async (sql) => {
    await originalExec(sql);
    if (sql === 'COMMIT' && loseAcknowledgement) {
      loseAcknowledgement = false;
      throw new Error('Synthetic lost commit acknowledgement');
    }
  };
  await assert.rejects(reconstruction.saveJourneyCorrection(pair.leftId, 'merge', pair.generation, detail, 'exact-pair-command',
    { ...payload, onStage: (stage) => { if (stage === 'POSSIBLE_TRIP_ACK') loseAcknowledgement = true; } }), /lost commit acknowledgement/);
  assert.equal(await reconstruction.verifySuggestedMergeReceipt(pair, 'exact-pair-command'), true,
    JSON.stringify(database.sqlite.prepare(`SELECT r.journey_id, r.state, a.run_id, a.application_state, q.journey_id AS qualified_id, q.classification
      FROM journey_correction_revision r LEFT JOIN journey_correction_application a ON a.revision_id = r.revision_id
      LEFT JOIN reconstruction_trip_qualification q ON q.run_id = a.run_id`).all()));
  assert.equal((await reconstruction.loadDurableReveal()).journeys.length, 1);
  const retry = await reconstruction.saveJourneyCorrection(pair.leftId, 'merge', pair.generation, detail, 'exact-pair-command', payload);
  assert.equal(retry.graph, null);
  assert.equal(await reconstruction.verifySuggestedMergeReceipt(pair, 'exact-pair-command'), true);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS n FROM journey_correction_revision WHERE action = 'merge'").get().n, 1);
}));

test('visual review fences GPS-less trip attachments and persists unchanged dismissal and exact confirmation', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const reconstruction = createNativeReconstructionRepository();
  const canUseSource = async () => true;
  const signal = new AbortController().signal;
  for (const index of [1, 2, 3]) {
    await database.adapter.runAsync(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
      VALUES (?, ?, 'image', 'available', '2025-01-03', ?, 'capture-like')`, `gpsless-${index}`, `photo-ref-${index}`, Date.UTC(2025, 0, 3, index));
  }
  await database.adapter.runAsync(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
    VALUES ('visual-screenshot', 'visual-screenshot', 'image', 'available', '2025-01-03', ?, 'screenshot')`, Date.UTC(2025, 0, 3, 1, 30));
  const initial = await reconstruction.loadVisualPlaceOffer(canUseSource);
  assert.equal(initial.references.length, 3);
  const dismissed = await reconstruction.reviewVisualPlaceOffer(initial.token, { kind: 'dismiss' }, canUseSource, signal);
  assert.equal(await dismissed.verify(), true);
  assert.equal(await createNativeReconstructionRepository().loadVisualPlaceOffer(canUseSource), null);
  await database.adapter.runAsync(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis)
    VALUES ('gpsless-4', 'photo-ref-4', 'image', 'available', '2025-01-03', ?)`, Date.UTC(2025, 0, 3, 4));
  const first = await reconstruction.loadVisualPlaceOffer(canUseSource);
  assert.equal(first.references.length, 4);
  const only = first.references[0];
  const command = { kind: 'confirm', selectedIds: [only.id], placeId: 'ewha-womans-university' };
  database.failOnce(/INSERT INTO visual_place_album/);
  await assert.rejects(reconstruction.reviewVisualPlaceOffer(first.token, command, canUseSource, signal));
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM manual_journey').get().count, 0);
  const saved = await reconstruction.reviewVisualPlaceOffer(first.token, command, canUseSource, signal);
  assert.equal(await saved.verify(), true);
  assert.equal((await reconstruction.reviewVisualPlaceOffer(first.token, command, canUseSource, signal)).manualId, saved.manualId);
  await assert.rejects(reconstruction.reviewVisualPlaceOffer(first.token, { ...command, selectedIds: [first.references[1].id] }, canUseSource, signal));
  const restarted = createNativeReconstructionRepository();
  const detail = await restarted.loadJourneyDetail(`manual:${saved.manualId}`);
  assert.deepEqual(detail.previewSourceRefs, [only.sourceRef]);
  assert.deepEqual(detail.detail.visits, []);
  const gallery = await restarted.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
  assert.deepEqual(gallery.previewSourceRefs, [only.sourceRef]);
  assert.equal(await restarted.verifyJourneyMediaSnapshot(detail.detail.id, detail.snapshotToken, gallery.privacyRevision), true);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM canonical_evidence WHERE evidence_id LIKE 'gpsless-%' AND latitude IS NOT NULL").get().count, 0);
  assert.equal(await restarted.loadVisualPlaceOffer(canUseSource), null);
  await createNativeImportRepository().deleteLocalHistory();
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM visual_place_album').get().count, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS count FROM visual_place_review').get().count, 0);
}));

test('owner date search pages GPS-less Android photos without a nearby trip and saves only the confirmed selection', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const reconstruction = createNativeReconstructionRepository();
  const allow = async () => true;
  const signal = new AbortController().signal;
  const dates = { start: '2025-06-01', end: '2025-06-06', page: 0 };
  for (let index = 0; index < 15; index++) {
    await database.adapter.runAsync(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
      VALUES (?, ?, 'image', ?, '2025-06-03', ?, ?)`, `date-photo-${index}`, `ref-${index}`,
    index === 13 ? 'unavailable' : 'unknown', Date.UTC(2025, 5, 3, index), index === 14 ? 'screenshot' : 'capture-like');
  }
  assert.equal(await reconstruction.loadVisualPlaceOffer(allow), null);
  await assert.rejects(reconstruction.loadVisualPlaceOffer(allow, { ...dates, end: '2025-06-31' }), { reason: 'HISTORY_CONSENT' });
  await assert.rejects(reconstruction.loadVisualPlaceOffer(async () => false, dates), { reason: 'ACCESS' });
  const first = await reconstruction.loadVisualPlaceOffer(allow, dates);
  assert.equal(first.references.length, 12);
  assert.equal(first.hasMore, true);
  assert.equal(first.references[0].sourceRef, 'ref-12');
  const second = await reconstruction.loadVisualPlaceOffer(allow, { ...dates, page: 1 });
  assert.equal(second.hasMore, false);
  assert.deepEqual(second.references.map(({ sourceRef }) => sourceRef), ['ref-0']);
  const command = { kind: 'confirm', placeId: 'ewha-womans-university', selectedIds: [second.references[0].id] };
  await assert.rejects(reconstruction.reviewVisualPlaceOffer(second.token, { ...command, placeId: null }, allow, signal), { reason: 'HISTORY_CONSENT' });
  await assert.rejects(reconstruction.reviewVisualPlaceOffer(second.token, { ...command, correction: { id: 'wikidata:Q146695', name: 'Phú Quốc' } }, allow, signal), { reason: 'HISTORY_CONSENT' });
  await assert.rejects(reconstruction.reviewVisualPlaceOffer(second.token, { ...command, selectedIds: ['photo-2'] }, allow, signal), { reason: 'HISTORY_CONSENT' });
  await assert.rejects(reconstruction.reviewVisualPlaceOffer(second.token, command, async () => false, signal), { reason: 'HISTORY_STALE' });
  const result = await reconstruction.reviewVisualPlaceOffer(second.token, command, allow, signal);
  assert.equal(await result.verify(), true);
  assert.equal((await reconstruction.reviewVisualPlaceOffer(second.token, command, allow, signal)).manualId, result.manualId);
  assert.deepEqual({ ...database.sqlite.prepare('SELECT date_start, date_end, owner_label FROM manual_journey WHERE manual_id = ?').get(result.manualId) },
    { date_start: dates.start, date_end: dates.end, owner_label: 'Ewha Womans University' });
  const detail = await reconstruction.loadJourneyDetail(`manual:${result.manualId}`);
  assert.deepEqual(detail.previewSourceRefs, ['ref-0']);
  assert.deepEqual(detail.detail.visits, []);
  const gallery = await reconstruction.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
  assert.deepEqual(gallery.previewSourceRefs, ['ref-0']);
  assert.equal(database.sqlite.prepare('SELECT latitude FROM canonical_evidence WHERE evidence_id = ?').get('date-photo-0').latitude, null);
}));

function qualifiedVisualFixture(candidate, sample = candidate.representatives) {
  const photos = [...sample].sort((a, b) => a.captured_at_millis - b.captured_at_millis
    || a.evidence_id.localeCompare(b.evidence_id));
  const middle = Math.floor(photos.length / 2);
  const stops = ['ewha-womans-university', 'namsan-seoul-tower'].map((placeId, index) => ({
    placeId, supportIds: (index === 0 ? photos.slice(0, middle) : photos.slice(middle)).map((photo) => photo.evidence_id),
  }));
  return {
    photos,
    result: {
      placeId: 'locality-seoul', start: photos[0].captured_day, end: photos.at(-1).captured_day,
      stops,
      membership: stops.flatMap(({ placeId, supportIds }) => supportIds.map((id) => ({ id, placeId, basis: 'signage' }))),
      coverIds: stops.map(({ supportIds }) => supportIds[0]),
    },
  };
}

test('partial visual scope stages and reopens only the clue and preserves exact confirmation and dismissals', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const previousDev = global.__DEV__;
  const previousPreview = process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW;
  const previousPartial = process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW;
  global.__DEV__ = true;
  process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW = 'true';
  process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = 'false';
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis)
    VALUES (?, ?, 'image', 'available', ?, ?)`);
  for (const day of [1, 10]) {
    [0, 2, 240, 242, 510, 512].forEach((minute, i) => insert.run(`partial-${day}-${i}`, `partial-ref-${day}-${i}`,
      `2025-08-${String(day).padStart(2, '0')}`, Date.UTC(2025, 7, day, 9, minute)));
  }
  const fixture = (candidate) => {
    assert.ok(candidate, 'The sample must include independent stops in separate time buckets.');
    const albumPhotos = candidate.representatives.filter(({ evidence_id }) => !/-(?:2|3)$/.test(evidence_id));
    return qualifiedVisualFixture(candidate, albumPhotos);
  };
  const allow = async () => true;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const clueIds = ['nami-island'];
  const discoveryRow = () => database.sqlite.prepare('SELECT scope, proposal FROM visual_discovery_state').get();
  try {
    const repository = createNativeReconstructionRepository();
    await repository.setVisualDiscoveryEnabled(true, () => true);
    const scan = await repository.loadVisualDiscoveryPage(allow);
    const places = ['ewha-womans-university', clueIds[0], 'namsan-seoul-tower'];
    const observations = scan.candidate.representatives.map(({ evidence_id: id }) => ({
      id, placeId: places[Math.floor(Number(id.at(-1)) / 2)], kind: 'signage',
    }));
    const legacy = associateVisualAlbum(qualifyVisualTrip(scan.candidate.representatives, observations));
    assert.deepEqual(legacy.stops.map(({ placeId }) => placeId), places);
    await assert.rejects(repository.checkpointVisualDiscovery(scan.token, { ...legacy, pendingPlaceIds: clueIds }, allow, signal, acknowledge),
      { reason: 'MEDIA_SCHEMA' });
    await repository.checkpointVisualDiscovery(scan.token, legacy, allow, signal, acknowledge);
    const { scope: offScope } = discoveryRow();
    const old = await repository.loadVisualDiscoveryPage(allow);
    assert.equal(old.kind, 'proposal');
    assert.equal(Object.hasOwn(old.proposal, 'pendingPlaceIds'), false);
    assert.deepEqual(await repository.reviewVisualDiscovery(old.token, 'dismiss', allow, signal, acknowledge), { manualId: null });
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM visual_place_disposition').get().n, 1);

    process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = 'true';
    await assert.rejects(repository.verifyVisualDiscovery(old.token, allow), { reason: 'HISTORY_STALE' });
    const restarted = await repository.loadVisualDiscoveryPage(allow);
    assert.equal(restarted.kind, 'scan');
    assert.equal(restarted.candidate.key, old.proposal.key);
    const partial = associateVisualAlbum(qualifyVisualTrip(restarted.candidate.representatives, observations, true));
    assert.deepEqual(partial.pendingPlaceIds, clueIds);
    assert.equal(partial.membership.length, 4);
    assert.deepEqual(await repository.checkpointVisualDiscovery(restarted.token, partial, allow, signal, acknowledge),
      { staged: false, more: true });
    assert.deepEqual(JSON.parse(discoveryRow().scope), [...JSON.parse(offScope), 'visual-partial-preview-v1']);
    const next = await repository.loadVisualDiscoveryPage(allow);
    const { photos, result } = fixture(next.candidate);
    for (const malformed of [null, [], [clueIds[0], clueIds[0]], ['synthetic-private-sentinel'], { label: 'Nami Island' }]) {
      await assert.rejects(repository.checkpointVisualDiscovery(next.token, { ...result, pendingPlaceIds: malformed }, allow, signal, acknowledge),
        { reason: 'MEDIA_SCHEMA' });
    }
    const foreignStops = result.stops.map((stop) => ({ ...stop, placeId: 'taipei-101' }));
    const foreignMembers = result.membership.map((item) => ({ ...item, placeId: 'taipei-101' }));
    await assert.rejects(repository.checkpointVisualDiscovery(next.token,
      { ...result, pendingPlaceIds: clueIds, stops: foreignStops, membership: foreignMembers }, allow, signal, acknowledge), { reason: 'MEDIA_SCHEMA' });
    const overlapStops = result.stops.map((stop, index) => index ? stop : { ...stop, placeId: clueIds[0] });
    const overlapMembers = result.membership.map((item) => overlapStops[0].supportIds.includes(item.id) ? { ...item, placeId: clueIds[0] } : item);
    await assert.rejects(repository.checkpointVisualDiscovery(next.token,
      { ...result, pendingPlaceIds: clueIds, stops: overlapStops, membership: overlapMembers }, allow, signal, acknowledge), { reason: 'MEDIA_SCHEMA' });
    assert.equal((await repository.checkpointVisualDiscovery(next.token, { ...result, pendingPlaceIds: clueIds }, allow, signal, acknowledge)).staged, true);
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
    const row = discoveryRow();
    for (const disable of ['partial-flag', 'parent-flag', 'release']) {
      global.__DEV__ = disable !== 'release';
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW = disable === 'parent-flag' ? 'false' : 'true';
      process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = disable === 'partial-flag' ? 'false' : 'true';
      const off = await createNativeReconstructionRepository().loadVisualDiscoveryPage(allow);
      assert.equal(off.kind, 'scan');
      assert.equal(off.candidate.key, scan.candidate.key);
      await assert.rejects(repository.loadVisualDiscoveryPage(allow, undefined, next.token), { reason: 'HISTORY_STALE' });
    }
    global.__DEV__ = true;
    const overwrite = database.sqlite.prepare('UPDATE visual_discovery_state SET proposal = ?');
    overwrite.run(JSON.stringify({ ...JSON.parse(row.proposal), pendingPlaceIds: ['synthetic-private-sentinel'] }));
    await assert.rejects(repository.loadVisualDiscoveryPage(allow, undefined, next.token), { reason: 'HISTORY_STALE' });
    const reopened = createNativeReconstructionRepository();
    let readingProposal = false;
    await assert.rejects(reopened.loadVisualDiscoveryPage(allow, () => { readingProposal = true; }), { reason: 'MEDIA_SCHEMA' });
    assert.equal(readingProposal, true);
    overwrite.run(row.proposal);
    const sameAction = await repository.loadVisualDiscoveryPage(allow, undefined, next.token);
    assert.equal(sameAction.kind, 'proposal');
    assert.deepEqual(sameAction.proposal, JSON.parse(row.proposal));
    const page = await reopened.loadVisualDiscoveryPage(allow);
    assert.equal(page.kind, 'proposal');
    assert.deepEqual(page.proposal.pendingPlaceIds, clueIds);
    assert.deepEqual(page.proposal.stops, result.stops);
    assert.deepEqual(page.proposal.coverIds, result.coverIds);
    const album = await reopened.loadVisualDiscoveryAlbum(page.token, 0, allow);
    assert.deepEqual(album.photos.map(({ evidence_id }) => evidence_id), photos.map(({ evidence_id }) => evidence_id));
    const { manualId } = await reopened.reviewVisualDiscovery(page.token, 'confirm', allow, signal, acknowledge);
    const written = database.sqlite.prepare('SELECT command, stops, membership FROM visual_place_trip WHERE manual_id = ?').get(manualId);
    assert.deepEqual(JSON.parse(written.stops), result.stops);
    assert.deepEqual(JSON.parse(written.membership), result.membership);
    assert.doesNotMatch(JSON.stringify(written), /nami-island|pendingPlaceIds/);
    assert.deepEqual(database.sqlite.prepare('SELECT evidence_id FROM visual_place_album WHERE manual_id = ? ORDER BY slot').all(manualId)
      .map(({ evidence_id }) => evidence_id), photos.map(({ evidence_id }) => evidence_id));
    const detail = await reopened.loadJourneyDetail(`manual:${manualId}`);
    const timelineAlbum = await reopened.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
    assert.deepEqual(timelineAlbum.previewSourceRefs, photos.map(({ source_ref }) => source_ref));
  } finally {
    if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev;
    if (previousPreview === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW;
    else process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW = previousPreview;
    if (previousPartial === undefined) delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW;
    else process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = previousPartial;
  }
}));

test('automatic regional proposals are release-fenced while their confirmed Hanoi albums survive the preview gate', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const previousDev = global.__DEV__;
  const release = 'a'.repeat(64);
  const flags = {
    EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW: 'true',
    EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_PREVIEW: 'true',
    EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_ORIGIN: 'http://127.0.0.1:8198',
    EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_MANIFEST_SHA256: release,
    EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW: 'false',
  };
  const previousFlags = Object.keys(flags).map((key) => [key, process.env[key]]);
  global.__DEV__ = true;
  Object.assign(process.env, flags);
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence
    (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
    VALUES (?, ?, 'image', 'available', ?, ?, 'capture-like')`);
  const date = '2025-08-01';
  [0, 2, 240, 242].forEach((minute, index) => insert.run(`region-fixture-${index}`, `region-ref-${index}`, date, Date.UTC(2025, 7, 1, 8, minute)));
  const allow = async () => true;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const repository = createNativeReconstructionRepository();
  const stops = ['turtle-tower', 'khue-van-cac'];
  try {
    await repository.setVisualDiscoveryEnabled(true, () => true);
    const scan = await repository.loadVisualDiscoveryPage(allow, undefined, undefined, release);
    assert.equal(scan.kind, 'scan');
    const observations = scan.candidate.representatives.map(({ evidence_id: id }) => ({
      id, placeId: stops[Math.floor(Number(id.at(-1)) / 2)], kind: 'image',
    }));
    const result = associateVisualAlbum(qualifyVisualTrip(scan.candidate.representatives, observations));
    assert.equal(result.placeId, 'locality-hanoi');
    assert.deepEqual(result.stops.map(({ placeId }) => placeId), stops);
    assert.equal((await repository.checkpointVisualDiscovery(scan.token, result, allow, signal, acknowledge)).staged, true);
    assert.deepEqual(JSON.parse(database.sqlite.prepare('SELECT scope FROM visual_discovery_state').get().scope).slice(-2),
      ['visual-regional-preview-v1', release]);
    const reviewed = await repository.loadVisualDiscoveryPage(allow, undefined, scan.token, release);
    assert.equal(reviewed.kind, 'proposal');
    assert.deepEqual(reviewed.proposal.coverIds, ['region-fixture-0', 'region-fixture-2']);
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
    process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_MANIFEST_SHA256 = 'b'.repeat(64);
    await assert.rejects(repository.verifyVisualDiscovery(reviewed.token, allow), { reason: 'HISTORY_STALE' });
    assert.equal((await repository.loadVisualDiscoveryPage(allow, undefined, undefined, 'b'.repeat(64))).kind, 'scan');
    process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_PREVIEW = 'false';
    await assert.rejects(repository.loadVisualDiscoveryAlbum(reviewed.token, 0, allow), { reason: 'HISTORY_STALE' });
    assert.equal((await repository.loadVisualDiscoveryPage(allow)).kind, 'scan');
    Object.assign(process.env, flags);
    const { manualId } = await repository.reviewVisualDiscovery(reviewed.token, 'confirm', allow, signal, acknowledge);
    process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_PREVIEW = 'false';
    const reopened = createNativeReconstructionRepository();
    const detail = await reopened.loadJourneyDetail(`manual:${manualId}`);
    const album = await reopened.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
    assert.deepEqual(album.previewSourceRefs, ['region-ref-0', 'region-ref-1', 'region-ref-2', 'region-ref-3']);
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM visual_place_review').get().n, 1);
  } finally {
    if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev;
    for (const [key, value] of previousFlags) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}));

test('city-level visual discovery confirms the reviewed album and only reports the named stop', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence
    (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
    VALUES (?, ?, 'image', 'available', '2025-08-01', ?, ?)`);
  const samples = [
    ['ewha-a', 0, 'capture-like'],
    ['ewha-b', 2, 'capture-like'],
    ['unmatched', 240, 'capture-like'],
    ['city-a', 480, 'capture-like'],
    ['city-b', 482, 'capture-like'],
    ['screen', 483, 'screenshot'],
  ];
  for (const [id, minute, origin] of samples) insert.run(id, `city-ref-${id}`, Date.UTC(2025, 7, 1, 8, minute), origin);
  const allow = async () => true;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const repository = createNativeReconstructionRepository();
  await repository.setVisualDiscoveryEnabled(true, () => true);
  const scan = await repository.loadVisualDiscoveryPage(allow);
  assert.equal(scan.kind, 'scan');
  assert.ok(scan.candidate);
  const observations = scan.candidate.representatives.map(({ evidence_id: id }) => id.startsWith('ewha')
    ? { id, placeId: 'ewha-womans-university', kind: 'image' }
    : id.startsWith('city') || id === 'screen'
      ? { id, placeId: 'seoul-municipal-signage', kind: 'signage' }
      : { id, placeId: null, kind: null });
  const trip = qualifyVisualTrip(scan.candidate.representatives, observations);
  assert.ok(trip);
  const result = associateVisualAlbum(trip);
  assert.equal(result.placeId, 'locality-seoul');
  const exactIds = ['ewha-a', 'ewha-b', 'city-a', 'city-b'];
  assert.deepEqual(result.membership.map(({ id }) => id), exactIds);
  const namedObservations = observations.map((item) => item.placeId === 'seoul-municipal-signage'
    ? { ...item, placeId: 'namsan-seoul-tower' } : item);
  const multiStop = associateVisualAlbum(qualifyVisualTrip(scan.candidate.representatives, namedObservations));
  assert.equal(multiStop.placeId, 'locality-seoul');
  await assert.rejects(repository.checkpointVisualDiscovery(scan.token, { ...multiStop, placeId: 'locality-hanoi' }, allow, signal, acknowledge),
    { reason: 'MEDIA_SCHEMA' });
  assert.equal((await repository.checkpointVisualDiscovery(scan.token, result, allow, signal, acknowledge)).staged, true);
  const state = database.sqlite.prepare('SELECT proposal FROM visual_discovery_state').get();
  const proposal = JSON.parse(state.proposal);
  const immediate = await repository.loadVisualDiscoveryPage(allow, undefined, scan.token);
  assert.equal(immediate.kind, 'proposal');
  assert.deepEqual(immediate.proposal, proposal);
  await assert.rejects(repository.loadVisualDiscoveryPage(allow, undefined, scan.token), { reason: 'HISTORY_STALE' });
  const reopened = createNativeReconstructionRepository();
  const setProposal = database.sqlite.prepare('UPDATE visual_discovery_state SET proposal = ?');
  const invalidMembership = proposal.membership.map((row) => row.id.startsWith('city') ? { ...row, basis: 'image' } : row);
  setProposal.run(JSON.stringify({ ...proposal, membership: invalidMembership }));
  await assert.rejects(reopened.loadVisualDiscoveryPage(allow), { reason: 'MEDIA_SCHEMA' });
  setProposal.run(state.proposal);
  const reviewed = await reopened.loadVisualDiscoveryPage(allow);
  assert.equal(reviewed.kind, 'proposal');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
  const album = await reopened.loadVisualDiscoveryAlbum(reviewed.token, 0, allow);
  const exactRefs = exactIds.map((id) => `city-ref-${id}`);
  assert.deepEqual(album.photos.map(({ source_ref }) => source_ref), exactRefs);
  await assert.rejects(reopened.reviewVisualDiscovery(reviewed.token, 'confirm', async () => false, signal, acknowledge), { reason: 'ACCESS' });
  const { manualId } = await reopened.reviewVisualDiscovery(reviewed.token, 'confirm', allow, signal, acknowledge);
  assert.equal((await reopened.reviewVisualDiscovery(reviewed.token, 'confirm', allow, signal, acknowledge)).manualId, manualId);
  await reopened.setVisualDiscoveryEnabled(false, () => true);
  await assert.rejects(reopened.loadVisualDiscoveryAlbum(reviewed.token, 0, allow), { reason: 'HISTORY_CONSENT' });
  const restarted = createNativeReconstructionRepository();
  const detail = await restarted.loadJourneyDetail(`manual:${manualId}`);
  assert.equal(detail.detail.title, 'Seoul');
  assert.deepEqual(detail.detail.destinationNames, ['Ewha Womans University']);
  assert.deepEqual(detail.detail.visits, []);
  assert.ok(detail.detail.memories.every(({ association }) => association.includes('Capture location unknown')));
  const committed = await restarted.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
  assert.deepEqual(committed.previewSourceRefs, exactRefs);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM visual_place_review').get().n, 1);
}));

test('city policy rechecks a pre-city checkpoint and retains a Hanoi dismissal across proposal shapes', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence
    (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
    VALUES (?, ?, 'image', 'available', '2025-08-01', ?, 'capture-like')`);
  [0, 2, 240, 242].forEach((minute, index) => insert.run(`hanoi-photo-${index}`, `hanoi-ref-${index}`, Date.UTC(2025, 7, 1, 8, minute)));
  const allow = async () => true;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const repository = createNativeReconstructionRepository();
  await repository.setVisualDiscoveryEnabled(true, () => true);
  const scan = await repository.loadVisualDiscoveryPage(allow);
  assert.equal(scan.kind, 'scan');
  assert.ok(scan.candidate);
  const named = scan.candidate.representatives.map(({ evidence_id: id }) => ({
    id, placeId: Number(id.at(-1)) < 2 ? 'turtle-tower' : 'khue-van-cac', kind: 'image',
  }));
  const namedResult = associateVisualAlbum(qualifyVisualTrip(scan.candidate.representatives, named));
  assert.equal(namedResult.placeId, 'locality-hanoi');
  assert.equal((await repository.checkpointVisualDiscovery(scan.token, namedResult, allow, signal, acknowledge)).staged, true);
  const proposal = await repository.loadVisualDiscoveryPage(allow);
  assert.equal(proposal.kind, 'proposal');
  assert.deepEqual(await repository.reviewVisualDiscovery(proposal.token, 'dismiss', allow, signal, acknowledge), { manualId: null });
  assert.equal((await repository.loadVisualDiscoveryPage(allow)).kind, 'done');
  const { scope } = database.sqlite.prepare('SELECT scope FROM visual_discovery_state').get();
  const previousScope = JSON.parse(scope).filter((value) => value !== 'visual-city-support-v1');
  database.sqlite.prepare('UPDATE visual_discovery_state SET scope = ?').run(JSON.stringify(previousScope));

  const restarted = createNativeReconstructionRepository();
  const rescan = await restarted.loadVisualDiscoveryPage(allow);
  assert.equal(rescan.kind, 'scan');
  assert.equal(rescan.candidate.key, scan.candidate.key);
  const civic = named.map((item) => item.placeId === 'khue-van-cac' ? { ...item, kind: 'signage', placeId: 'locality-hanoi' } : item);
  const cityResult = associateVisualAlbum(qualifyVisualTrip(rescan.candidate.representatives, civic));
  assert.equal(cityResult.placeId, 'locality-hanoi');
  assert.notDeepEqual(cityResult.stops, namedResult.stops);
  assert.equal((await restarted.checkpointVisualDiscovery(rescan.token, cityResult, allow, signal, acknowledge)).staged, false);
  assert.equal((await restarted.loadVisualDiscoveryPage(allow)).kind, 'done');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM visual_place_disposition').get().n, 1);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
}));

test('automatic visual discovery resumes a dense GPS-less episode and confirms its exact private album once', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
    VALUES (?, ?, 'image', 'unknown', ?, ?, 'capture-like')`);
  for (let i = 0; i < 471; i++) {
    const time = Date.UTC(2025, 5, 1 + Math.floor(i / 79), 9, (i % 79) * 6);
    insert.run(`auto-photo-${i}`, `auto-ref-${i}`, new Date(time).toISOString().slice(0, 10), time);
  }
  const allow = async () => true;
  const deny = async () => false;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const first = createNativeReconstructionRepository();
  assert.equal(await first.loadVisualDiscoveryEnabled(), false);
  await assert.rejects(first.loadVisualDiscoveryPage(allow), { reason: 'HISTORY_CONSENT' });
  await first.setVisualDiscoveryEnabled(true, () => true);
  const page1 = await first.loadVisualDiscoveryPage(allow);
  assert.equal(page1.kind, 'scan');
  assert.equal(page1.candidate, null);
  await assert.rejects(first.checkpointVisualDiscovery(page1.token, null, deny, signal, acknowledge), { reason: 'ACCESS' });
  assert.equal(database.sqlite.prepare('SELECT checkpoint FROM visual_discovery_state').get().checkpoint, null);
  assert.deepEqual(await first.checkpointVisualDiscovery(page1.token, null, allow, signal, acknowledge), { staged: false, more: true });

  const second = createNativeReconstructionRepository();
  const { checkpoint } = database.sqlite.prepare('SELECT checkpoint FROM visual_discovery_state').get();
  const putCheckpoint = database.sqlite.prepare('UPDATE visual_discovery_state SET checkpoint = ?');
  putCheckpoint.run(JSON.stringify({ ...JSON.parse(checkpoint), coverage: [{ source_ref: 'synthetic-sentinel' }] }));
  await assert.rejects(second.loadVisualDiscoveryPage(allow), { reason: 'MEDIA_SCHEMA' });
  putCheckpoint.run(checkpoint);
  const page2 = await second.loadVisualDiscoveryPage(allow);
  assert.equal(page2.kind, 'scan');
  assert.equal(page2.candidate.start, '2025-06-01');
  assert.equal(page2.candidate.end, '2025-06-06');
  const { photos, result } = qualifiedVisualFixture(page2.candidate,
    [...page2.candidate.representatives.slice(0, 13), page2.candidate.representatives[65]]);
  await assert.rejects(second.checkpointVisualDiscovery(page2.token, { ...result, placeId: 'unknown-model-place' }, allow, signal, acknowledge), { reason: 'MEDIA_SCHEMA' });
  await assert.rejects(second.checkpointVisualDiscovery(page2.token,
    { ...result, membership: [...result.membership].reverse() }, allow, signal, acknowledge), { reason: 'MEDIA_SCHEMA' });
  assert.equal((await second.checkpointVisualDiscovery(page2.token, result, allow, signal, acknowledge)).staged, true);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM visual_place_album').get().n, 0);

  const reopened = createNativeReconstructionRepository();
  const proposal = await reopened.loadVisualDiscoveryPage(allow);
  assert.equal(proposal.kind, 'proposal');
  assert.deepEqual(proposal.proposal.photos.map(({ evidence_id }) => evidence_id), result.membership.map(({ id }) => id));
  const firstAlbum = await reopened.loadVisualDiscoveryAlbum(proposal.token, 0, allow);
  const secondAlbum = await reopened.loadVisualDiscoveryAlbum(proposal.token, 1, allow);
  assert.equal(firstAlbum.hasMore, true);
  assert.equal(secondAlbum.hasMore, false);
  assert.deepEqual([...firstAlbum.photos, ...secondAlbum.photos].map(({ source_ref }) => source_ref), photos.map(({ source_ref }) => source_ref));
  await assert.rejects(reopened.reviewVisualDiscovery(proposal.token, 'confirm', deny, signal, acknowledge), { reason: 'ACCESS' });
  database.failOnce(/INSERT INTO visual_place_album/);
  await assert.rejects(reopened.reviewVisualDiscovery(proposal.token, 'confirm', allow, signal, acknowledge));
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
  let loseAck = true;
  const originalExec = database.adapter.execAsync;
  database.adapter.execAsync = async (sql) => {
    await originalExec(sql);
    if (sql === 'COMMIT' && loseAck) {
      loseAck = false;
      throw new Error('Synthetic lost automatic review acknowledgement');
    }
  };
  const saved = await reopened.reviewVisualDiscovery(proposal.token, 'confirm', allow, signal, acknowledge);
  assert.equal((await reopened.reviewVisualDiscovery(proposal.token, 'confirm', allow, signal, acknowledge)).manualId, saved.manualId);
  const detail = await reopened.loadJourneyDetail(`manual:${saved.manualId}`);
  assert.deepEqual(detail.detail.visits, []);
  const album = await reopened.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
  const overflowAlbum = album.hasMore ? await reopened.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 1) : null;
  assert.deepEqual([...album.previewSourceRefs, ...(overflowAlbum?.previewSourceRefs ?? [])], photos.map(({ source_ref }) => source_ref));
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS n FROM canonical_evidence WHERE evidence_id LIKE 'auto-photo-%' AND latitude IS NOT NULL").get().n, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM visual_place_review').get().n, 1);
  await reopened.setVisualDiscoveryEnabled(false, () => true);
  await assert.rejects(reopened.loadVisualDiscoveryPage(allow), { reason: 'HISTORY_CONSENT' });
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 1);
}));

test('automatic visual discovery suppresses Home matches and does not offer an unchanged dismissed episode again', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis)
    VALUES (?, ?, 'image', 'available', '2025-08-01', ?)`);
  [0, 1, 180, 181].forEach((minute, index) => insert.run(`routine-${index}`, `routine-ref-${index}`, Date.UTC(2025, 7, 1, 9, minute)));
  database.sqlite.exec(`INSERT INTO configured_home_area (area_id, latitude, longitude, radius_meters) VALUES ('home-control', 37.566, 126.978, 20000);
    UPDATE reconstruction_run SET home_revision = (SELECT revision FROM home_projection_context) WHERE run_id = 1`);
  const allow = async () => true;
  const canChange = () => true;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const repository = createNativeReconstructionRepository();
  await repository.setVisualDiscoveryEnabled(true, canChange);
  const outcome = (candidate) => qualifiedVisualFixture(candidate).result;
  const nearHome = await repository.loadVisualDiscoveryPage(allow);
  assert.equal(nearHome.kind, 'scan');
  assert.equal((await repository.checkpointVisualDiscovery(nearHome.token, outcome(nearHome.candidate), allow, signal, acknowledge)).staged, false);

  database.sqlite.exec(`DELETE FROM configured_home_area WHERE area_id = 'home-control';
    UPDATE reconstruction_run SET home_revision = (SELECT revision FROM home_projection_context) WHERE run_id = 1`);
  const away = await repository.loadVisualDiscoveryPage(allow);
  assert.equal((await repository.checkpointVisualDiscovery(away.token, outcome(away.candidate), allow, signal, acknowledge)).staged, true);
  const proposal = await repository.loadVisualDiscoveryPage(allow);
  await repository.setVisualDiscoveryEnabled(false, canChange);
  await assert.rejects(repository.reviewVisualDiscovery(proposal.token, 'confirm', allow, signal, acknowledge), { reason: 'HISTORY_CONSENT' });
  await repository.setVisualDiscoveryEnabled(true, canChange);
  const reenabled = await repository.loadVisualDiscoveryPage(allow);
  await repository.checkpointVisualDiscovery(reenabled.token, outcome(reenabled.candidate), allow, signal, acknowledge);
  const current = await repository.loadVisualDiscoveryPage(allow);
  assert.deepEqual(await repository.reviewVisualDiscovery(current.token, 'dismiss', allow, signal, acknowledge), { manualId: null });
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 0);
  const reopened = createNativeReconstructionRepository();
  assert.equal((await reopened.loadVisualDiscoveryPage(allow)).kind, 'done');
  await reopened.setVisualDiscoveryEnabled(false, canChange);
  await reopened.setVisualDiscoveryEnabled(true, canChange);
  const skipped = await reopened.loadVisualDiscoveryPage(allow);
  assert.equal(skipped.kind, 'scan');
  assert.ok(skipped.candidate);
  assert.equal((await reopened.checkpointVisualDiscovery(skipped.token, outcome(skipped.candidate), allow, signal, acknowledge)).staged, false);
}));

test('automatic visual discovery corrects a legacy album only after confirmation and invalidates its old media token', async () => withDatabase(async (database) => {
  await ensureNativeImportSchema(database.adapter);
  seedRetainedProjection(database, schemaVersion);
  const insert = database.sqlite.prepare(`INSERT INTO canonical_evidence
    (evidence_id, source_ref, media_type, availability, captured_day, captured_at_millis, source_origin)
    VALUES (?, ?, 'image', 'available', '2025-08-01', ?, 'capture-like')`);
  [0, 1, 180, 181].forEach((minute, index) => insert.run(`legacy-${index}`, `legacy-ref-${index}`, Date.UTC(2025, 7, 1, 9, minute)));
  const allow = async () => true;
  const signal = new AbortController().signal;
  const acknowledge = () => {};
  const repository = createNativeReconstructionRepository();
  await repository.setVisualDiscoveryEnabled(true, () => true);
  const initial = await repository.loadVisualDiscoveryPage(allow);
  database.sqlite.exec(`INSERT INTO manual_journey
    (manual_id, command_key, owner_label, owner_context, latitude, longitude, date_kind, date_start, date_end, created_at_millis)
    VALUES ('visual-legacy-trip', 'legacy-command', 'Legacy visual label', 'Synthetic area', 37.56, 126.94, 'exact', '2025-08-01', '2025-08-01', 1);
    INSERT INTO visual_place_album (manual_id, slot, evidence_id, source_ref) VALUES ('visual-legacy-trip', 1, 'legacy-0', 'legacy-ref-0');`);
  database.sqlite.prepare(`INSERT INTO visual_place_review (cluster_key, manual_id, place_id, decision)
    VALUES (?, 'visual-legacy-trip', 'ewha-campus-visual', 'confirmed')`).run(initial.candidate.key);

  const oldDetail = await repository.loadJourneyDetail('manual:visual-legacy-trip');
  const current = await repository.loadVisualDiscoveryPage(allow);
  const { photos, result } = qualifiedVisualFixture(current.candidate);
  assert.equal((await repository.checkpointVisualDiscovery(current.token, result, allow, signal, acknowledge)).staged, true);
  const proposal = await repository.loadVisualDiscoveryPage(allow);
  assert.equal(proposal.proposal.correctionId, 'visual-legacy-trip');
  assert.equal((await repository.loadJourneyDetail('manual:visual-legacy-trip')).detail.title, 'Legacy visual label');

  const review = await repository.reviewVisualDiscovery(proposal.token, 'confirm', allow, signal, acknowledge);
  assert.equal(review.manualId, 'visual-legacy-trip');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM manual_journey').get().n, 1);
  await assert.rejects(repository.loadJourneyMediaPage(oldDetail.detail.id, oldDetail.snapshotToken, 0), { reason: 'HISTORY_STALE' });
  const reopened = createNativeReconstructionRepository();
  const detail = await reopened.loadJourneyDetail('manual:visual-legacy-trip');
  assert.equal(detail.detail.title, 'Seoul');
  const album = await reopened.loadJourneyMediaPage(detail.detail.id, detail.snapshotToken, 0);
  assert.deepEqual(album.previewSourceRefs, photos.map(({ source_ref }) => source_ref));
}));

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
  const filename = path.join(sourceRoot, 'reconstruction/canonical-projection.ts');
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
  const repositoryFilename = path.join(sourceRoot, 'reconstruction/repository.ts');
  const repository = new Module(repositoryFilename, module);
  repository.filename = repositoryFilename;
  repository.paths = Module._nodeModulePaths(path.dirname(repositoryFilename));
  const repositoryRequire = repository.require.bind(repository);
  repository.require = (request) => request === './canonical-projection' ? loaded.exports : repositoryRequire(request);
  repository._compile(ts.transpileModule(fs.readFileSync(repositoryFilename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: repositoryFilename,
  }).outputText, repositoryFilename);
  return { create: repository.exports.createNativeReconstructionRepository, count: () => reconstructions };
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
          else if (scenario === 'merge') {
            assert.equal(error, null);
            const support = graph.journeys.map((journey) => journey.visitIds
              .flatMap((id) => graph.visits.find((visit) => visit.id === id).evidenceIds).sort());
            assert.ok(support.some((ids) => JSON.stringify(ids) === JSON.stringify(['synthetic-source-0', 'synthetic-source-1'])));
            assert.ok(support.some((ids) => JSON.stringify(ids) === JSON.stringify(['synthetic-source-2'])));
          }
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
  ['DURABLE_DESTINATION_QUERY', /^\s*SELECT journey.parent_id AS journey_id, visit.place_id,/, false],
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
