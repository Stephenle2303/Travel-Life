import { recordContext } from '@/account/record-context';
import { loadAtlasAccountPreference, loadReplica, replicaBlocked, saveAtlasAccountPreference } from '@/account/history-store';
import { createNativeAccountMedia } from '@/account/media-native';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

let mockOwner:string|null='owner-a';
const mockDispose=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=>mockOwner})}));
jest.mock('@/account/history-store',()=>({loadAtlasAccountPreference:jest.fn(),loadReplica:jest.fn(),replicaBlocked:jest.fn(),saveAtlasAccountPreference:jest.fn(async()=>undefined)}));
jest.mock('@/account/media-native',()=>({createNativeAccountMedia:jest.fn(()=>({adapter:{},dispose:mockDispose}))}));
jest.mock('@/import-record/repository',()=>({createNativeImportRepository:jest.fn(()=>({}))}));
jest.mock('@/reconstruction/repository',()=>({createNativeReconstructionRepository:jest.fn(()=>({}))}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),createDiagnosticCorrelationId:()=> 'runtime-open-1',recordAppDiagnostic:jest.fn()}));

const replica={database_name:'travel-life-account-synthetic.db',snapshot_id:'synthetic-aggregate'};
beforeEach(()=>{
 recordContext.local();jest.clearAllMocks();mockOwner='owner-a';
 jest.mocked(loadReplica).mockResolvedValue(replica);jest.mocked(replicaBlocked).mockResolvedValue(false);
 jest.mocked(loadAtlasAccountPreference).mockResolvedValue(null);
});
afterEach(()=>recordContext.local());

it('restores a saved account selection only for the current owner',async()=>{
 jest.mocked(loadAtlasAccountPreference).mockResolvedValue('owner-b');
 await recordContext.restoreSelection();
 expect(loadReplica).not.toHaveBeenCalled();
 jest.mocked(loadAtlasAccountPreference).mockResolvedValue('owner-a');
 await recordContext.restoreSelection();
 expect(recordContext.isAccount()).toBe(true);
 expect(saveAtlasAccountPreference).toHaveBeenCalledWith('owner-a',expect.any(Function));
 recordContext.local();
 expect(saveAtlasAccountPreference).toHaveBeenLastCalledWith(null,expect.any(Function));
});

it('publishes one stable atomic binding snapshot before notifying subscribers',async()=>{
 const local=recordContext.getSnapshot();expect(recordContext.getSnapshot()).toBe(local);
 const observed:ReturnType<typeof recordContext.getSnapshot>[]=[];
 const unsubscribe=recordContext.subscribe(()=>observed.push(recordContext.getSnapshot()));
 try{
  await recordContext.openAccount();
  const account=recordContext.getSnapshot();
  expect(account).not.toBe(local);expect(recordContext.getSnapshot()).toBe(account);
  expect(account).toMatchObject({account:true,repositories:recordContext.getRepositories(),correlationId:'runtime-open-1'});
  expect(observed).toEqual([account]);
  recordContext.local();const next=recordContext.getSnapshot();
  expect(next).toMatchObject({account:false,repositories:null});expect(next.revision).toBeGreaterThan(account.revision);
  expect(observed).toEqual([account,next]);
 }finally{unsubscribe();}
});

it.each([
 ['auth','HISTORY_OPEN_AUTH','ACCOUNT_SESSION',false,'blocked'],
 ['replica','HISTORY_OPEN_REPLICA','DATABASE_BUSY',true,'failed'],
 ['scope','HISTORY_OPEN_SCOPE','HISTORY_STALE',false,'skipped'],
 ['bind','HISTORY_OPEN_BIND','UNKNOWN',false,'failed'],
])('classifies and redacts open %s boundary failures',async(boundary,stage,reasonCode,retryable,durableOutcome)=>{
 if(boundary==='auth')mockOwner=null;
 if(boundary==='replica')jest.mocked(loadReplica).mockRejectedValueOnce(new Error('SQLITE_BUSY PRIVATE_SENTINEL'));
 if(boundary==='scope')jest.mocked(replicaBlocked).mockResolvedValueOnce(true);
 if(boundary==='bind')jest.mocked(createNativeAccountMedia).mockImplementationOnce(()=>{throw new Error('PRIVATE_SENTINEL');});
 await expect(recordContext.openAccount()).rejects.toThrow();
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith({operation:'HISTORY_TRANSFER',stage,reasonCode,retryable,durableOutcome,correlationId:'runtime-open-1'});
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('PRIVATE_SENTINEL');
 expect(recordContext.isAccount()).toBe(false);
});

it('rebinds a suspended account intent to the new authority while preserving a deliberate local choice',async()=>{
 await recordContext.openAccount();const request=recordContext.selectionIntent('owner-a');
 const previous=jest.mocked(createNativeAccountMedia).mock.calls[0][2];
 recordContext.suspend('owner-a');expect(previous()).toBe(false);expect(recordContext.selectionIntent('owner-a')).toBe(request);
 jest.mocked(loadReplica).mockResolvedValue({...replica,snapshot_id:'next-aggregate'});
 await expect(recordContext.rebind('owner-a',request)).resolves.toBe(true);
 expect(jest.mocked(createNativeAccountMedia).mock.calls[1][1]).toBe('next-aggregate');
 recordContext.suspend('owner-a');const next=recordContext.selectionIntent('owner-a');recordContext.local();
 await expect(recordContext.rebind('owner-a',next)).resolves.toBe(false);expect(recordContext.isAccount()).toBe(false);
});

it('keeps the later local choice when an account pointer arrives late',async()=>{
 let release!:(value:typeof replica)=>void;
 jest.mocked(loadReplica).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const opening=recordContext.openAccount();recordContext.local();release(replica);
 await expect(opening).rejects.toMatchObject({reason:'HISTORY_FENCED'});
 expect(recordContext.isAccount()).toBe(false);expect(recordContext.getRepositories()).toBeNull();
 expect(createNativeAccountMedia).not.toHaveBeenCalled();
});

it('refuses an observed blocked replica and an owner change during its scope read',async()=>{
 jest.mocked(replicaBlocked).mockResolvedValueOnce(true);
 await expect(recordContext.openAccount()).rejects.toMatchObject({reason:'HISTORY_STALE'});
 expect(createNativeAccountMedia).not.toHaveBeenCalled();
 let release!:(value:boolean)=>void;
 jest.mocked(replicaBlocked).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const opening=recordContext.openAccount();await Promise.resolve();mockOwner='owner-b';release(false);
 await expect(opening).rejects.toMatchObject({reason:'HISTORY_FENCED'});
 expect(recordContext.isAccount()).toBe(false);expect(createNativeAccountMedia).not.toHaveBeenCalled();
});

it('fences already returned media callbacks and disposes the account context on signout',async()=>{
 await recordContext.openAccount();expect(recordContext.isAccount()).toBe(true);
 const current=jest.mocked(createNativeAccountMedia).mock.calls[0][2];expect(current()).toBe(true);
 mockOwner=null;recordContext.checkOwner();
 expect(current()).toBe(false);expect(mockDispose).toHaveBeenCalledTimes(1);
 expect(recordContext.getRepositories()).toBeNull();expect(recordContext.isAccount()).toBe(false);
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'HISTORY_CONTEXT_OWNER_CHANGE',reasonCode:'SKIPPED',durableOutcome:'skipped'}));
});

it.each(['HISTORY_CONTEXT_USER_LOCAL','HISTORY_CONTEXT_AUTH_LOST','HISTORY_CONTEXT_SCOPE_CHANGED','HISTORY_CONTEXT_AUTHORITY_LOST','HISTORY_CONTEXT_UPLOADS_STOPPED','HISTORY_CONTEXT_DELETED'] as const)('identifies the %s context transition without private scope data',async stage=>{
 await recordContext.openAccount();jest.mocked(recordAppDiagnostic).mockClear();
 recordContext.local(stage,'runtime-action-1');
 expect(recordAppDiagnostic).toHaveBeenCalledTimes(1);
 expect(recordAppDiagnostic).toHaveBeenCalledWith({operation:'HISTORY_TRANSFER',stage,reasonCode:'SKIPPED',retryable:false,durableOutcome:'skipped',correlationId:'runtime-action-1'});
 expect(recordContext.getRepositories()).toBeNull();expect(recordContext.isAccount()).toBe(false);
 const serialized=JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls);
 for(const value of ['owner-a',replica.snapshot_id,replica.database_name])expect(serialized).not.toContain(value);
 recordContext.local(stage);expect(recordAppDiagnostic).toHaveBeenCalledTimes(1);
});

it('identifies suspended account authority separately from deliberate local choice',async()=>{
 await recordContext.openAccount();jest.mocked(recordAppDiagnostic).mockClear();
 recordContext.suspend('owner-a');
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'HISTORY_CONTEXT_SUSPEND',reasonCode:'SKIPPED'}));
 expect(recordContext.selectionIntent('owner-a')).not.toBeNull();
});
