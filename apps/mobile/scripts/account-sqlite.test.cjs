/* Synthetic SQLite only; never opens a device/user database. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const databases = new Map();
const removedDatabases = [];
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args); };
function database(name) {
  if (databases.has(name)) return databases.get(name);
  const sql = new DatabaseSync(':memory:');
  const db = {
    sql,
    closeAsync: async () => {},
    execAsync: async query => sql.exec(query),
    runAsync: async (query, ...args) => sql.prepare(query).run(...args),
    getFirstAsync: async (query, ...args) => sql.prepare(query).get(...args) ?? null,
    getAllAsync: async (query, ...args) => sql.prepare(query).all(...args),
  };
  databases.set(name, db); return db;
}
test('semantic export reads a committed snapshot while an independent SQLite writer is reserved',async()=>{
 const privateRoot=path.resolve(__dirname,'../../../.local');fs.mkdirSync(privateRoot,{recursive:true});
 const directory=fs.mkdtempSync(path.join(privateRoot,'account-export-read-'));const file=path.join(directory,'synthetic.db');
 const name=`travel-life-account-${crypto.randomUUID()}.db`;const writer=new DatabaseSync(file),reader=new DatabaseSync(file);
 const adapt=sql=>({execAsync:async query=>sql.exec(query),runAsync:async(query,...args)=>sql.prepare(query).run(...args),getFirstAsync:async(query,...args)=>sql.prepare(query).get(...args)??null,getAllAsync:async(query,...args)=>sql.prepare(query).all(...args),closeAsync:async()=>{}});
 try{
  await ensureNativeImportSchema(adapt(writer));
  writer.exec("insert into manual_journey(manual_id,command_key,owner_label,owner_context,date_kind,date_start,date_end,latitude,longitude,created_at_millis) values('synthetic-trip','synthetic-command','Committed','Fixture','exact','2020-01-01','2020-01-02',10,20,1)");
  databases.set(name,adapt(reader));writer.exec('BEGIN IMMEDIATE TRANSACTION');writer.exec("update manual_journey set owner_label='Uncommitted' where manual_id='synthetic-trip'");
  const first=await exportLocalHistory(name);assert.equal(first.find(row=>row.kind==='manual').value.owner_label,'Committed');
  writer.exec('COMMIT');const next=await exportLocalHistory(name);assert.equal(next.find(row=>row.kind==='manual').value.owner_label,'Uncommitted');
 }finally{if(writer.isTransaction)writer.exec('ROLLBACK');databases.delete(name);reader.close();writer.close();fs.unlinkSync(file);fs.rmdirSync(directory);}
});
const load = Module._load;
Module._load = function(request, ...args) {
  if (request === 'expo-sqlite') return { defaultDatabaseDirectory:'/synthetic/sqlite',openDatabaseAsync: async name => database(name),deleteDatabaseAsync:async name=>{if(!databases.has(name))throw new Error('synthetic missing database');removedDatabases.push(name);databases.get(name).sql.close();databases.delete(name);} };
  if (request === 'expo-file-system') return {File:class{constructor(_directory,name){this.exists=databases.has(name);}}};
  if (request === 'expo-crypto') return { randomUUID: crypto.randomUUID };
  return load.call(this, request, ...args);
};
const { createNativeImportRepository, ensureNativeImportSchema } = require(path.join(root, 'import-record/repository.ts'));
const { exportLocalHistory, stageAccountReplica } = require(path.join(root, 'account/history-native.ts'));
const { createNativeReconstructionRepository } = require(path.join(root, 'reconstruction/repository.ts'));
const { historyLayouts } = require(path.join(root, 'account/history-contract.ts'));
const { loadHistorySyncConfig, claimHistorySync, renewHistorySync, releaseHistorySync, checkpointHistorySync, finishHistorySync, suspendLocalHistorySync, loadPrivateMediaJob, savePrivateMediaJob, clearPrivateMediaJob, loadHistoryControl, saveHistoryControl, clearHistoryControl, mergeOperation, clearMergeOperation, clearReplica, clearReplicaIfMatching, clearAccountJobs, saveReplica, loadReplica, replicaScope } = require(path.join(root, 'account/history-store.ts'));
const { createTransferJob } = require(path.join(root, 'account/history-transfer.ts'));

test('Local candidate rejection receipts fence incompatible export and delete with the record', async () => {
  const name = `travel-life-account-${crypto.randomUUID()}.db`;
  const db = database(name);
  await ensureNativeImportSchema(db);
  await db.runAsync('INSERT INTO recognizable_candidate_rejection(command_key, policy_version, support_signature) VALUES (?, ?, ?)',
    'synthetic-choice', 'synthetic-policy', '["PRIVATE_SUPPORT_SENTINEL"]');
  await assert.rejects(exportLocalHistory(name), (error) => {
    assert.equal(error.reason, 'HISTORY_VERSION_UNSUPPORTED');
    assert.equal(error.boundary, 'HISTORY_EXPORT_CANDIDATE_COMPATIBILITY');
    assert.doesNotMatch(JSON.stringify(error), /PRIVATE_SUPPORT_SENTINEL/);
    return true;
  });
  assert.deepEqual(await exportLocalHistory(name, { purpose: 'replica-readback' }), []);
  const importer = createNativeImportRepository({ databaseName: name });
  await importer.deleteLocalHistory();
  assert.equal(await db.getFirstAsync('SELECT 1 FROM recognizable_candidate_rejection'), null);
  await importer.connectPrivateRecord();
  assert.deepEqual(await exportLocalHistory(name), []);
});

test('confirmed visual albums fence incompatible account export while a dismissal stays local', async () => {
  const name = `travel-life-account-${crypto.randomUUID()}.db`;
  const db = database(name);
  await ensureNativeImportSchema(db);
  await db.runAsync("INSERT INTO visual_place_review (cluster_key, decision) VALUES ('synthetic-dismissed', 'dismissed')");
  assert.deepEqual(await exportLocalHistory(name), []);
  await db.runAsync("INSERT INTO visual_place_review (cluster_key, manual_id, place_id, decision) VALUES ('synthetic-confirmed', 'synthetic-local', 'synthetic-place', 'confirmed')");
  await assert.rejects(exportLocalHistory(name), (error) => {
    assert.equal(error.reason, 'HISTORY_VERSION_UNSUPPORTED');
    assert.equal(error.boundary, 'HISTORY_EXPORT_CANDIDATE_COMPATIBILITY');
    return true;
  });
});

test('foreground/background history leases fence late checkpoints and finish atomically',async()=>{
 let now=1000;
 const config={ownerId:'sync-owner',accountGeneration:1,sourceId:'80000000-0000-4000-8000-000000000011',sourceGeneration:1,enabled:true,lastDigest:null,attempts:0,nextAttemptAt:0,lastSuccessAt:null};
 const first={config,leaseId:'lease-first',now:()=>now,current:()=>true};const next={...first,leaseId:'lease-next'};
 assert.equal(await claimHistorySync(first),true);assert.equal(await claimHistorySync(next),false);
 const independent={...first,config:{...config,ownerId:'other-sync-owner'}};assert.equal(await claimHistorySync(independent),true);
 const job={...createTransferJob({ownerId:config.ownerId,generation:1,sourceId:config.sourceId,sourceGeneration:1,sourceSnapshotRevision:0,rows:[],uuid:crypto.randomUUID}),contentDigest:'a'.repeat(64)};
 await checkpointHistorySync(first,job);now+=120001;assert.equal(await claimHistorySync(next),true);
 await assert.rejects(checkpointHistorySync(first,{...job,next:1}),{reason:'HISTORY_FENCED'});assert.equal(await renewHistorySync(first),false);
 await releaseHistorySync(first);assert.equal(await renewHistorySync(next),true);
 await checkpointHistorySync(next,{...job,next:job.requests.length});
 await finishHistorySync(next,{...config,lastDigest:job.contentDigest,lastSuccessAt:now},job);
 assert.equal((await loadHistorySyncConfig(config.ownerId)).lastDigest,job.contentDigest);
 assert.equal((await database('travel-life-account-control-v1.db').getFirstAsync('select job_json from transfer_job where owner_id=?',config.ownerId)),null);
 await suspendLocalHistorySync();assert.equal((await loadHistorySyncConfig(config.ownerId)).enabled,false);assert.equal(await renewHistorySync(next),false);
 await clearAccountJobs(config.ownerId);assert.equal(await loadHistorySyncConfig(config.ownerId),null);
});

test('private derivative checkpoints are immutable, owner isolated and transaction fenced',async()=>{
 const job={owner:'media-owner-a',accountGeneration:1,sourceId:'80000000-0000-4000-8000-000000000001',sourceGeneration:1,target:{kind:'evidence',id:'80000000-0000-4000-8000-000000000002'},expectedRevision:0,stageMutationId:'80000000-0000-4000-8000-000000000003',activateMutationId:'80000000-0000-4000-8000-000000000004',uri:'file:///synthetic-prepared',manifest:{contractVersion:'travel-life-private-media-v1',kind:'photo',mimeType:'image/jpeg',byteLength:2,sha256:'a'.repeat(64),width:1,height:1,durationMillis:null},artifactId:null,active:false};
 await savePrivateMediaJob(job,()=>true);assert.deepEqual(await loadPrivateMediaJob(job.owner),job);assert.equal(await loadPrivateMediaJob('media-owner-b'),null);
 await assert.rejects(savePrivateMediaJob({...job,uri:'file:///changed-private'},()=>true),{reason:'MEDIA_CONFLICT'});
 let checks=0;await assert.rejects(savePrivateMediaJob({...job,artifactId:'80000000-0000-4000-8000-000000000005'},()=>++checks===1),{reason:'MEDIA_ACCESS'});
 assert.equal((await loadPrivateMediaJob(job.owner)).artifactId,null);
 const staged={...job,artifactId:'80000000-0000-4000-8000-000000000005'};
 const active={...staged,active:true};
 await savePrivateMediaJob(staged,()=>true);await savePrivateMediaJob(active,()=>true);
 await assert.rejects(savePrivateMediaJob({...active,artifactId:'80000000-0000-4000-8000-000000000006'},()=>true),{reason:'MEDIA_CONFLICT'});
 await assert.rejects(savePrivateMediaJob(staged,()=>true),{reason:'MEDIA_CONFLICT'});
 assert.deepEqual(await loadPrivateMediaJob(job.owner),active);
 await clearPrivateMediaJob(job.owner,'wrong-mutation',()=>true);assert.notEqual(await loadPrivateMediaJob(job.owner),null);
 await clearPrivateMediaJob(job.owner,job.stageMutationId,()=>true);assert.equal(await loadPrivateMediaJob(job.owner),null);
});

test('source-control checkpoint is owner scoped and only matching acknowledgement clears it',async()=>{
  const request={action:'source-control',input:{mutationId:'control-one',sourceId:'synthetic-source',mode:'removed'}};
  await saveHistoryControl('control-owner-a',request);
  await saveHistoryControl('control-owner-b',{...request,input:{...request.input,mutationId:'control-two'}});
  await clearHistoryControl('control-owner-a','wrong');assert.deepEqual(await loadHistoryControl('control-owner-a'),request);
  await clearHistoryControl('control-owner-a','control-one');assert.equal(await loadHistoryControl('control-owner-a'),null);
  assert.equal((await loadHistoryControl('control-owner-b')).input.mutationId,'control-two');
  await clearAccountJobs('control-owner-b');assert.equal(await loadHistoryControl('control-owner-b'),null);
});

test('replica pointer and scope commit together and stale cleanup cannot erase newer state', async () => {
  const owner='replica-owner';
  const first='travel-life-account-00000000-0000-4000-8000-000000000001.db';
  const next='travel-life-account-00000000-0000-4000-8000-000000000002.db';
  await saveReplica(owner,first,'snapshot-1','scope-1',()=>true);
  const db=database('travel-life-account-control-v1.db');const original=db.runAsync;
  db.runAsync=async (sql,...args)=>{if(sql.startsWith('insert into account_replica_scope'))throw new Error('synthetic scope write failure');return original(sql,...args);};
  try {await assert.rejects(saveReplica(owner,next,'snapshot-2','scope-2',()=>true),{reason:'HISTORY_STORAGE',message:'Private history transfer did not finish.'});} finally {db.runAsync=original;}
  assert.equal((await loadReplica(owner)).database_name,first);assert.equal(await replicaScope(owner),'scope-1');
  let checks=0;
  await assert.rejects(saveReplica(owner,next,'snapshot-2','scope-2',()=>++checks===1),{reason:'HISTORY_FENCED'});
  assert.equal((await loadReplica(owner)).database_name,first);assert.equal(await replicaScope(owner),'scope-1');
  await saveReplica(owner,next,'snapshot-2','scope-2',()=>true);
  await clearReplicaIfMatching(owner,first);
  assert.equal((await loadReplica(owner)).database_name,next);assert.equal(await replicaScope(owner),'scope-2');
  await clearReplicaIfMatching(owner,next);
  assert.equal(await loadReplica(owner),null);assert.equal(await replicaScope(owner),null);
  db.sql.prepare('insert into account_replica(owner_id,database_name,snapshot_id) values(?,?,?)').run(owner,first,'legacy-snapshot');
  assert.equal(await loadReplica(owner),null);
  assert.equal(db.sql.prepare('select count(*) as n from account_replica where owner_id=?').get(owner).n,1);
});

test('Atlas preference survives replica replacement and is cleared for the matching deleted owner', async () => {
  const {loadAtlasAccountPreference,saveAtlasAccountPreference}=require(path.join(root,'account/history-store.ts'));
  const owner='atlas-preference-owner';
  await saveAtlasAccountPreference(owner,()=>true);
  await saveAtlasAccountPreference('different-owner',()=>false);
  await saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000079.db','replacement','scope',()=>true);
  assert.equal(await loadAtlasAccountPreference(),owner);
  await clearAccountJobs('different-owner');
  assert.equal(await loadAtlasAccountPreference(),owner);
  await clearAccountJobs(owner);
  assert.equal(await loadAtlasAccountPreference(),null);
  await clearReplica(owner);
});

test('merge checkpoint survives retry, isolates owners and clears only its matching receipt', async () => {
  const first = await mergeOperation('owner-a', () => 'operation-a');
  assert.equal(await mergeOperation('owner-a', () => 'unexpected'), first);
  assert.equal(await mergeOperation('owner-b', () => 'operation-b'), 'operation-b');
  await clearMergeOperation('owner-a', 'wrong');
  assert.equal(await mergeOperation('owner-a', () => 'unexpected'), first);
  await clearMergeOperation('owner-a', first);
  assert.equal(await mergeOperation('owner-a', () => 'operation-new'), 'operation-new');
  assert.equal(await mergeOperation('owner-b', () => 'unexpected'), 'operation-b');
  await clearReplica('owner-a');
  assert.equal(await mergeOperation('owner-a', () => 'unexpected'), 'operation-new');
  await clearAccountJobs('owner-a');
  assert.equal(await mergeOperation('owner-a', () => 'after-delete'), 'after-delete');
  assert.equal(await mergeOperation('owner-b', () => 'unexpected'), 'operation-b');
});

test('consented semantic export restores a separate real SQLite replica and preserves the local source', async () => {
  const local = database('travel-life-import-v1.db');
  await ensureNativeImportSchema(local);
  local.sql.exec(`insert into manual_journey(manual_id,command_key,owner_label,owner_context,latitude,longitude,date_kind,date_start,date_end,created_at_millis)
    values('manual-1','command-1','Synthetic island','Fixture',10,20,'exact','2020-01-01','2020-01-03',1);
    insert into configured_home_area(area_id,latitude,longitude,radius_meters,origin,owner_label) values('home-1',10,20,1000,'observed-area','Synthetic home');
    insert into replay_draft(record_id,revision,committed_overrides_json,updated_at_millis)
    values(1,1,'{"keptMemoryRefs":[],"excludedGroupJourneyIds":[],"soundtrack":{"kind":"custom","revision":"track-1","localUri":"file:///PRIVATE_AUDIO"},"preparedArtifact":{"fileKey":"PRIVATE_FILE"}}',1);`);
  const rows = await exportLocalHistory();
  assert.equal(rows.filter(row => row.kind === 'manual').length, 1);
  assert.ok(!JSON.stringify(rows).includes('PRIVATE_AUDIO'));
  const name = await stageAccountReplica(rows);
  assert.notEqual(name, 'travel-life-import-v1.db');
  const replica = database(name);
  assert.deepEqual([...replica.sql.prepare('select * from manual_journey').all()], [...local.sql.prepare('select * from manual_journey').all()]);
  assert.deepEqual([...replica.sql.prepare('select * from configured_home_area').all()], [...local.sql.prepare('select * from configured_home_area').all()]);
  const repository = createNativeReconstructionRepository({ databaseName: name });
  await repository.rebuild();
  const reveal = await repository.loadDurableReveal();
  assert.equal(reveal.journeys[0].label, 'Synthetic island · Fixture');
  assert.equal(local.sql.prepare('select count(*) as n from manual_journey').get().n, 1);
  await assert.rejects(stageAccountReplica([...rows, rows[0]]));
  assert.equal(local.sql.prepare('select count(*) as n from manual_journey').get().n, 1);
  for (const layout of Object.values(historyLayouts)) {
    const actual = local.sql.prepare(`pragma table_info(${layout.table})`).all().map(column => column.name);
    assert.ok(Object.keys(layout.fields).every(column => actual.includes(column)), `${layout.table} DTO columns must exist in actual migrated schema`);
  }
  const migration = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261028033704_m6_private_history_account.sql'), 'utf8');
  assert.ok(!/as \$(?!\$)|end \$(?!\$);/.test(migration), 'Function delimiters must survive generation literally');
  const serverLayouts = JSON.parse(migration.match(/declare layouts jsonb := '([^']+)'::jsonb;/)[1]);
  const nativeLayouts = Object.fromEntries(Object.entries(historyLayouts).map(([kind, layout]) => [kind, { key: layout.key, fields: layout.fields }]));
  assert.deepEqual(serverLayouts, nativeLayouts, 'Server and native v1 transfer schema must match');
});

test('actual SQLite export and replica preserve long engine Replay order and custom soundtrack',async()=>{
 const {projectCanonicalHistory}=require(path.join(root,'reconstruction/canonical-projection.ts'));
 const {decodeHistoryRows}=require(path.join(root,'account/history-wire.ts'));
 const name='synthetic-long-replay.db',local=database(name);await ensureNativeImportSchema(local);
 const fields=Object.keys(historyLayouts.evidence.fields),insert=local.sql.prepare(`insert into canonical_evidence (${fields.join(',')}) values (${fields.map(()=>'?').join(',')})`);
 const rows=Array.from({length:500},(_,index)=>{
  const value=Object.fromEntries(Object.entries(historyLayouts.evidence.fields).map(([key,type])=>[key,type.endsWith('?')?null:type==='number'?0:'']));
  Object.assign(value,{evidence_id:`synthetic-evidence-${String(index).padStart(20,'0')}`,source_ref:`fixture-${index}`,media_type:'image',availability:'available',has_precise_offset:1,captured_at_millis:Date.parse('2024-01-01T00:00:00Z')+index*300000,captured_day:index<288?'2024-01-01':'2024-01-02',latitude:13.7,longitude:100.5,reported_accuracy_meters:10});insert.run(...fields.map(field=>value[field]));return value;
 });
 const graph=await projectCanonicalHistory({rows,excluded:new Set(),privateFilter:{excluded:new Set()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]});const journey=graph.graph.journeys[0].id;assert.ok(journey.length>10000);
 const refs=[2,0,1].map(index=>JSON.stringify([journey,rows[index].evidence_id]));
 const composition={keptMemoryRefs:refs,orderedMemoryRefs:refs,excludedMemoryRefs:[JSON.stringify([journey,rows[3].evidence_id])],excludedGroupJourneyIds:[],autoGroupJourneyIds:[],direction:'newest-first',directionPreferenceVersion:1,soundtrack:{kind:'custom',revision:'synthetic-score',localUri:'file:///PRIVATE_AUDIO'}};
 local.sql.prepare('insert into replay_draft(record_id,revision,committed_overrides_json,updated_at_millis) values(1,7,?,1)').run(JSON.stringify(composition));
 const exported=await exportLocalHistory(name);const replay=exported.find(row=>row.kind==='replay');assert.ok(replay.value.committed_overrides_json.length>100000);
 const job=createTransferJob({ownerId:'synthetic',generation:1,sourceId:'synthetic',sourceGeneration:1,rows:exported,uuid:crypto.randomUUID});
 const restored=decodeHistoryRows(job.requests.filter(request=>request.action==='page').flatMap(request=>request.input.records));assert.deepEqual(restored,exported);
 const replica=await stageAccountReplica(restored),repository=createNativeReconstructionRepository({databaseName:replica});await repository.rebuild();const input=await repository.loadReplayManifestInput();
 assert.equal(input.direction,'newest-first');assert.deepEqual(input.soundtrack,{kind:'custom',revision:'synthetic-score',localUri:''});assert.deepEqual(input.autoGroupKeys,[]);
 // Eligibility is a separate reconstruction policy; this single-place fixture
 // tests durable semantic preservation, not qualification as a replayable trip.
 const persisted=JSON.parse(database(replica).sql.prepare('select committed_overrides_json from replay_draft where record_id=1').get().committed_overrides_json);
 assert.deepEqual(persisted.keptMemoryRefs,refs);assert.deepEqual(persisted.orderedMemoryRefs,refs);assert.deepEqual(persisted.excludedMemoryRefs,composition.excludedMemoryRefs);
 assert.deepEqual((await exportLocalHistory(replica)).find(row=>row.kind==='replay'),replay);
});

test('resolved correction stays unacknowledged until a new authoritative replica commits atomically',async()=>{
 const {saveCorrectionJob,resolveCorrectionJob,loadCorrectionJob,loadOwnerBaseline}=require(path.join(root,'account/history-store.ts'));
 const owner='resolution-owner';const row={kind:'manual',key:'manual',value:{manual_id:'manual',command_key:'command',owner_label:'Proposed synthetic trip',owner_context:'Synthetic',latitude:10,longitude:20,date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',created_at_millis:1}};
 const original={...row,value:{...row.value,owner_label:'Accepted synthetic trip'}};
 await saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000031.db','aggregate-old','scope',()=>true,'baseline',{rows:[original],revision:0});
 const job={owner,mutationId:'proposal',generation:1,baseAggregate:'aggregate-old',expectedOwnerRevision:0,changes:{rows:[row],deleted:[]},currentRows:[row],conflict:true};
 await saveCorrectionJob(job,()=>true);await resolveCorrectionJob(job,2,'accepted',()=>true);
 assert.equal((await loadCorrectionJob(owner)).resolved,'accepted');
 assert.equal((await loadOwnerBaseline(owner)).rows[0].value.owner_label,'Accepted synthetic trip');
 await assert.rejects(resolveCorrectionJob(job,2,'proposed',()=>true),{reason:'HISTORY_CONFLICT'});
 let checks=0;
 await assert.rejects(saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000032.db','aggregate-new','scope',()=>++checks<2,'new',{rows:[original],revision:2,canonical:true}),{reason:'HISTORY_FENCED'});
 assert.equal((await loadCorrectionJob(owner)).resolved,'accepted');assert.equal((await loadReplica(owner)).snapshot_id,'aggregate-old');
 await saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000032.db','aggregate-new','scope',()=>true,'new',{rows:[original],revision:2,canonical:true});
 assert.equal(await loadCorrectionJob(owner),null);assert.equal((await loadOwnerBaseline(owner)).revision,2);
 await saveCorrectionJob({...job,mutationId:'another'},()=>true);await clearAccountJobs(owner);assert.equal(await loadCorrectionJob(owner),null);
});

test('accepted legacy migration keeps exact branch and baseline until its canonical revision is pulled',async()=>{
 const {saveCorrectionJob,acceptCorrectionJob,loadCorrectionJob,loadOwnerBaseline}=require(path.join(root,'account/history-store.ts'));
 const owner='legacy-owner',row={kind:'manual',key:'manual',value:{manual_id:'manual',command_key:'command',owner_label:'Synthetic legacy',owner_context:'Synthetic',latitude:0,longitude:0,date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',created_at_millis:1}};
 const before={...row,value:{...row.value,owner_label:'Original'}};
 await saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000041.db','legacy-source','scope',()=>true,'baseline',{rows:[before],revision:0,canonical:false});
 const job={owner,mutationId:'legacy-mutation',generation:1,baseAggregate:'legacy-source',expectedOwnerRevision:0,changes:{rows:[row],deleted:[]},currentRows:[row],conflict:false,legacy:{buildId:'build',baselineDigest:'a'.repeat(64),editedDigest:'b'.repeat(64)}};
 await saveCorrectionJob(job,()=>true);await acceptCorrectionJob(job,2,'edited',()=>true);
 assert.equal((await loadCorrectionJob(owner)).acceptedRevision,2);assert.equal((await loadOwnerBaseline(owner)).rows[0].value.owner_label,'Original');
 await assert.rejects(saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000042.db','canonical-new','scope',()=>true,'new',{rows:[row],revision:1,canonical:true}),{reason:'HISTORY_STALE'});
 assert.equal((await loadReplica(owner)).snapshot_id,'legacy-source');assert.equal((await loadCorrectionJob(owner)).currentRows[0].value.owner_label,'Synthetic legacy');
 await saveReplica(owner,'travel-life-account-00000000-0000-4000-8000-000000000042.db','canonical-new','scope',()=>true,'new',{rows:[row],revision:2,canonical:true});
 assert.equal(await loadCorrectionJob(owner),null);
});

test('replica staging is bounded, reclamation preserves active owners, and deletion releases only its owner files',async()=>{
 const {reserveReplicaFile,retireReplicaFile,reclaimReplicaFiles}=require(path.join(root,'account/history-store.ts'));
 const db=database('travel-life-account-control-v1.db');const names=[];
 while(db.sql.prepare('select count(*) as n from account_replica_file').get().n<8){
  const name=`travel-life-account-${crypto.randomUUID()}.db`;await reserveReplicaFile(name,'bounded-owner',()=>true);database(name);names.push(name);
 }
 await assert.rejects(reserveReplicaFile(`travel-life-account-${crypto.randomUUID()}.db`,'bounded-owner',()=>true),{reason:'HISTORY_QUOTA'});
 await assert.rejects(reserveReplicaFile('travel-life-import-v1.db','bounded-owner',()=>true),{reason:'HISTORY_SCHEMA'});
 for(const name of names)await retireReplicaFile(name);await reclaimReplicaFiles();
 for(const name of names)assert.ok(removedDatabases.includes(name));
 const nameA=`travel-life-account-${crypto.randomUUID()}.db`;const nameB=`travel-life-account-${crypto.randomUUID()}.db`;
 await reserveReplicaFile(nameA,'purged-owner',()=>true);await reserveReplicaFile(nameB,'retained-owner',()=>true);
 database(nameA);database(nameB);
 await saveReplica('purged-owner',nameA,'authority-a','scope',()=>true);await saveReplica('retained-owner',nameB,'authority-b','scope',()=>true);
 await clearReplica('purged-owner');await clearAccountJobs('purged-owner');
 assert.ok(removedDatabases.includes(nameA));assert.ok(!removedDatabases.includes(nameB));
 assert.equal((await loadReplica('retained-owner')).database_name,nameB);
 assert.ok(!removedDatabases.includes('travel-life-import-v1.db'));
 const missing=`travel-life-account-${crypto.randomUUID()}.db`;await reserveReplicaFile(missing,'crashed-before-open',()=>true);await retireReplicaFile(missing);await reclaimReplicaFiles();
 assert.equal(db.sql.prepare('select count(*) as n from account_replica_file where database_name=?').get(missing).n,0);assert.ok(!removedDatabases.includes(missing));
});

test('resumed source generation atomically retires old jobs and rolls back a late owner fence',async()=>{
 const {reconcileHistorySource,saveTransferJob,loadTransferJob}=require(path.join(root,'account/history-store.ts'));
 const db=database('travel-life-account-control-v1.db');
 const cfg={ownerId:'resume-owner',accountGeneration:1,sourceId:'48000000-0000-4000-8000-000000000071',sourceGeneration:1,enabled:true,lastDigest:null,attempts:0,nextAttemptAt:0,lastSuccessAt:null};
 await db.runAsync('insert into history_sync_config(owner_id,config_json) values(?,?)',cfg.ownerId,JSON.stringify(cfg));
 const job=createTransferJob({ownerId:cfg.ownerId,generation:1,sourceId:cfg.sourceId,sourceGeneration:1,sourceSnapshotRevision:0,rows:[],uuid:crypto.randomUUID});await saveTransferJob(job);
 const ack={accountGeneration:1,sourceId:cfg.sourceId,sourceGeneration:3};let checks=0;
 await assert.rejects(reconcileHistorySource(cfg,ack,()=>++checks===1),{reason:'HISTORY_FENCED'});
 assert.equal((await loadHistorySyncConfig(cfg.ownerId)).sourceGeneration,1);assert.equal((await loadTransferJob(cfg.ownerId)).snapshotId,job.snapshotId);
 await reconcileHistorySource(cfg,ack,()=>true);assert.equal((await loadHistorySyncConfig(cfg.ownerId)).sourceGeneration,3);assert.equal(await loadTransferJob(cfg.ownerId),null);
 await assert.rejects(reconcileHistorySource(cfg,ack,()=>true),{reason:'HISTORY_FENCED'});
});
