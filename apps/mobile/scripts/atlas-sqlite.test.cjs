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
  return { sqlite, adapter, statements, failures,
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

async function prepareConfirmedJourney(database, reconstruction) {
  await importSyntheticEvidence(createNativeImportRepository());
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
  database.sqlite.exec(`UPDATE import_schema_version SET version = 34;
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
