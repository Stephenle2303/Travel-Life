import { exportLocalHistory } from '@/account/history-native';
import { historyLayouts } from '@/account/history-contract';
const mockSchema=jest.fn(async()=>{});
const mockClose=jest.fn(async()=>{});
const mockRead=jest.fn(async(_query:string):Promise<Record<string,unknown>[]>=>[]);
const mockLifecycle=jest.fn(async()=>({state:'connected'}));
const mockExec=jest.fn(async(_query:string)=>{});
const mockTransaction=jest.fn(async(db:unknown,_options:unknown,work:(db:unknown)=>Promise<unknown>)=>work(db));
const mockDb={getAllAsync:mockRead,getFirstAsync:mockLifecycle,closeAsync:mockClose,execAsync:mockExec};
const mockOpen=jest.fn(async()=>mockDb);
jest.mock('expo-sqlite',()=>({openDatabaseAsync:()=>mockOpen()}));
jest.mock('@/import-record/repository',()=>({ensureNativeImportSchema:()=>mockSchema()}));
jest.mock('@/database/native-transaction',()=>({serializeNativeTransactions:(db:unknown)=>db,runOwnedTransaction:(...args:Parameters<typeof mockTransaction>)=>mockTransaction(...args)}));
jest.mock('@/account/history-store',()=>({}));
jest.mock('@/account/replica-connections',()=>({assertReplicaOpen:()=>{},trackReplicaConnection:(_name:string,db:unknown)=>db}));
beforeEach(()=>{jest.clearAllMocks();mockTransaction.mockImplementation(async(db,_options,work)=>work(db));mockExec.mockResolvedValue();mockOpen.mockResolvedValue(mockDb);mockSchema.mockResolvedValue();mockRead.mockResolvedValue([]);mockLifecycle.mockResolvedValue({state:'connected'});mockClose.mockResolvedValue();});
it.each([
 ['begin','HISTORY_EXPORT_BEGIN','DATABASE_BUSY'],
 ['commit','HISTORY_EXPORT_COMMIT','NATIVE_HANDLE'],
 ['rollback','HISTORY_EXPORT_ROLLBACK','DATABASE_BUSY'],
])('classifies read transaction %s fault at the driver boundary without private details',async(fault,boundary,reason)=>{
 let owned:typeof mockTransaction; jest.isolateModules(()=>{owned=jest.requireActual('@/database/native-transaction').runOwnedTransaction;});mockTransaction.mockImplementation(owned!);
 mockExec.mockImplementation(async query=>{
  if(fault==='begin'&&query==='BEGIN DEFERRED TRANSACTION'||fault==='rollback'&&query==='ROLLBACK')throw new Error('database is locked PRIVATE_SENTINEL');
  if(fault!=='begin'&&query==='COMMIT')throw new Error('released native handle PRIVATE_SENTINEL');
 });
 const error=await exportLocalHistory().catch(error=>error);
 expect(error).toMatchObject({boundary,reason});expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');expect(mockClose).toHaveBeenCalledTimes(1);
 if(fault==='begin')expect(mockRead).not.toHaveBeenCalled();
});
it('records closed starts for each export boundary without any local identifiers',async()=>{
 const stage=jest.fn();await expect(exportLocalHistory('PRIVATE_DATABASE',{stage})).resolves.toEqual([]);
 expect(stage.mock.calls[0]).toEqual(['HISTORY_EXPORT_OPEN']);expect(stage.mock.calls.at(-1)).toEqual(['HISTORY_EXPORT_CLOSE']);expect(JSON.stringify(stage.mock.calls)).not.toContain('PRIVATE_');
});
it.each([['open','HISTORY_EXPORT_OPEN'],['schema','HISTORY_EXPORT_SCHEMA'],['lifecycle','HISTORY_EXPORT_LIFECYCLE'],['close','HISTORY_EXPORT_CLOSE']])('classifies %s storage fault at its exact boundary',async(name,boundary)=>{
 const fail=new Error('PRIVATE_NATIVE_SENTINEL');({open:mockOpen,schema:mockSchema,lifecycle:mockLifecycle,close:mockClose}[name]!).mockRejectedValueOnce(fail);
 const error=await exportLocalHistory().catch(error=>error);expect(error).toMatchObject({reason:'HISTORY_STORAGE',boundary});expect(JSON.stringify(error)).not.toContain('PRIVATE_NATIVE_SENTINEL');
});
it.each(Object.entries(historyLayouts))('classifies %s schema/read failure without table/SQL/content serialization',async(kind,layout)=>{
 mockRead.mockImplementation(async query=>{if(query.includes(`from ${layout.table} `))throw new Error('no such column: PRIVATE_COLUMN_SENTINEL');return [];});
 const error=await exportLocalHistory().catch(error=>error);expect(error).toMatchObject({reason:'HISTORY_SCHEMA',boundary:`HISTORY_EXPORT_${kind.toUpperCase().replaceAll('-','_')}_READ`});expect(JSON.stringify(error)).not.toMatch(/PRIVATE_COLUMN|select |from /);
});
it.each([['database is locked','DATABASE_BUSY'],['released native handle','NATIVE_HANDLE'],['cannot start a transaction within a transaction','TRANSACTION'],['constraint failed','CONSTRAINT'],['bridge limit','ROW_LIMIT']])('retains fixed native classification %s',async(message,reason)=>{
 mockRead.mockRejectedValueOnce(new Error(`${message} PRIVATE_SQL_SENTINEL`));await expect(exportLocalHistory()).rejects.toMatchObject({reason,boundary:'HISTORY_EXPORT_EVIDENCE_READ'});
});
it('identifies invalid semantic rows and does not mask the cause with a later close error',async()=>{
 mockRead.mockResolvedValueOnce([{evidence_id:'PRIVATE_ROW_SENTINEL'}]);mockClose.mockRejectedValueOnce(new Error('PRIVATE_CLOSE_SENTINEL'));
 const error=await exportLocalHistory().catch(error=>error);expect(error).toMatchObject({reason:'HISTORY_SCHEMA',boundary:'HISTORY_EXPORT_EVIDENCE_VALIDATE'});expect(JSON.stringify(error)).not.toContain('PRIVATE_');
});
it('classifies disconnected lifecycle as fenced without reading semantic rows',async()=>{
 mockLifecycle.mockResolvedValueOnce({state:'disconnected'});await expect(exportLocalHistory()).rejects.toMatchObject({reason:'HISTORY_FENCED',boundary:'HISTORY_EXPORT_LIFECYCLE'});expect(mockRead).not.toHaveBeenCalled();
});
it('classifies a failed candidate compatibility read without collecting semantic rows or private data',async()=>{
 mockLifecycle.mockResolvedValueOnce({state:'connected'}).mockRejectedValueOnce(new Error('database is locked PRIVATE_REVIEW_SENTINEL'));
 const error=await exportLocalHistory().catch(error=>error);
 expect(error).toMatchObject({reason:'DATABASE_BUSY',boundary:'HISTORY_EXPORT_CANDIDATE_COMPATIBILITY'});
 expect(JSON.stringify(error)).not.toContain('PRIVATE_REVIEW_SENTINEL');expect(mockRead).not.toHaveBeenCalled();
});
it('keeps map-selected homes local until peers can negotiate the new origin', async () => {
 const row = {area_id:'PRIVATE_HOME_SENTINEL', origin:'manual-pin', latitude:10, longitude:20,
   radius_meters:20_000, effective_start_day:null, effective_end_day:null, owner_label:'Synthetic Home'};
 mockRead.mockImplementation(async query => query.includes('from configured_home_area ') ? [row] : []);
 const error = await exportLocalHistory().catch(error => error);
 expect(error).toMatchObject({reason:'HISTORY_VERSION_UNSUPPORTED', boundary:'HISTORY_EXPORT_HOME_VALIDATE'});
 expect(JSON.stringify(error)).not.toContain('PRIVATE_HOME_SENTINEL');
 expect(mockClose).toHaveBeenCalledTimes(1);
 await expect(exportLocalHistory(undefined,{purpose:'replica-readback'})).resolves.toEqual([
   {kind:'home', key:row.area_id, value:row},
 ]);
});
it.each([
 ['{','JSON'],
 [JSON.stringify({PRIVATE_UNKNOWN_FIELD:'PRIVATE_VALUE'}),'FIELDS'],
 [JSON.stringify({keptMemoryRefs:['PRIVATE_REF','PRIVATE_REF']}),'ARRAY_DUPLICATE'],
 [JSON.stringify({keptMemoryRefs:{PRIVATE_VALUE:1}}),'ARRAY_TYPE'],
 [JSON.stringify({keptMemoryRefs:new Array(100001).fill('x')}),'ARRAY_COUNT'],
 [JSON.stringify({keptMemoryRefs:[1]}),'ARRAY_ITEM_TYPE'],
 [JSON.stringify({direction:'PRIVATE_DIRECTION'}),'DIRECTION'],
 [JSON.stringify({soundtrack:{kind:'bundled',revision:'PRIVATE_AUDIO_REVISION'}}),'AUDIO'],
])('classifies content-free Replay %s failure category %s',async(json,category)=>{
 mockRead.mockImplementation(async query=>query.includes('from replay_draft ')?[{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:json}]:[]);
 const error=await exportLocalHistory().catch(error=>error);expect(error).toMatchObject({reason:'HISTORY_SCHEMA',boundary:`HISTORY_EXPORT_REPLAY_${category}`});expect(JSON.stringify(error)).not.toContain('PRIVATE_');
});
it('exports the actual committed writer shape preserving selections, order, auto scope and soundtrack',async()=>{
 const committed={keptMemoryRefs:['["journey-2","evidence-2"]','["journey-1","evidence-1"]'],excludedMemoryRefs:['["journey-3","evidence-3"]'],excludedGroupJourneyIds:['journey-4'],autoGroupJourneyIds:[],orderedMemoryRefs:['["journey-2","evidence-2"]','["journey-1","evidence-1"]'],direction:'newest-first',directionPreferenceVersion:1,soundtrack:{kind:'custom',revision:'synthetic-score',localUri:'file:///PRIVATE_AUDIO'},preparedArtifact:{identity:'PRIVATE_CACHE',fileKey:'PRIVATE_CACHE',durationSeconds:1,renderedMemoryCount:2}};
 mockRead.mockImplementation(async query=>query.includes('from replay_draft ')?[{record_id:1,revision:2,updated_at_millis:1,committed_overrides_json:JSON.stringify(committed)}]:[]);
 const rows=await exportLocalHistory();const parsed=JSON.parse(String(rows[0].value.committed_overrides_json));expect(parsed).toEqual({...committed,soundtrack:{...committed.soundtrack,localUri:''},preparedArtifact:undefined});expect(JSON.stringify(rows)).not.toContain('PRIVATE_');
});
