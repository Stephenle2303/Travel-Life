import { historyService } from '@/account/history-service';
import { recordContext } from '@/account/record-context';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { getAccountService } from '@/account/service';
import { HistoryTransferError } from '@/account/history-transfer';
import { stageAccountReplica, exportLocalHistory } from '@/account/history-native';
import { saveReplica, replicaScope, clearReplica, loadReplica, loadReplicaDigest, loadCorrectionJob } from '@/account/history-store';
import { createNativeReconstructionRepository } from '@/reconstruction/repository';

const mockTransport=jest.fn();

jest.mock('@/account/service',()=>({getAccountService:jest.fn()}));
jest.mock('@/account/history-transfer',()=>({...jest.requireActual('@/account/history-transfer'),createHistoryTransport:()=>mockTransport}));
jest.mock('@/account/history-native',()=>({exportLocalHistory:jest.fn(),stageAccountReplica:jest.fn()}));
jest.mock('@/account/history-store',()=>({loadReplica:jest.fn(async()=>null),loadReplicaDigest:jest.fn(async()=>null),loadCorrectionJob:jest.fn(async()=>null),retireReplicaFile:jest.fn(async()=>{}),replicaScope:jest.fn(async()=>null),saveReplica:jest.fn(async()=>{}),clearReplica:jest.fn(async()=>{}),clearReplicaIfMatching:jest.fn(async()=>{})}));
jest.mock('@/account/record-context',()=>({recordContext:{local:jest.fn(),selectionIntent:()=>null,rebind:jest.fn(async()=>false),mutationStamp:()=>({version:0,pending:0}),mutationUnchanged:()=>true}}));
jest.mock('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_algorithm:unknown,value:string)=>value}));
jest.mock('@/reconstruction/repository',()=>({createNativeReconstructionRepository:jest.fn()}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),createDiagnosticCorrelationId:()=> 'local-action',recordAppDiagnostic:jest.fn()}));

beforeEach(()=>{jest.clearAllMocks();jest.mocked(replicaScope).mockResolvedValue(null);historyService.lock();mockTransport.mockReset().mockRejectedValue(new HistoryTransferError('ACCOUNT_SESSION'));});

it('locks an observed privacy-stale aggregate replica while keeping append-only pending history readable',async()=>{
 (getAccountService as jest.Mock).mockReturnValue({getLocalOwner:()=> 'owner-a',invalidateSession:jest.fn()});
 jest.mocked(replicaScope).mockResolvedValue('[1]');
 const value={status:'active',generation:1,revision:2,historyConsent:true,mediaConsent:false,activeSnapshot:null,activeAggregate:'71000000-0000-4000-8000-000000000001',aggregateRevision:1,aggregatePages:1,pendingMerge:true,sources:[]};
 mockTransport.mockResolvedValue(value);await historyService.refresh();expect(recordContext.local).not.toHaveBeenCalled();expect(clearReplica).not.toHaveBeenCalled();
 mockTransport.mockResolvedValue({...value,activeAggregate:null,aggregatePages:null});await historyService.refresh();
 expect(recordContext.local).toHaveBeenCalledTimes(1);expect(clearReplica).toHaveBeenCalledWith('owner-a');
});

it('locks account history and protected credentials after confirmed API session denial',async()=>{
  const invalidateSession=jest.fn(async()=>{});
  (getAccountService as jest.Mock).mockReturnValue({getLocalOwner:()=> 'owner-a',invalidateSession});
  await historyService.refresh();
  expect(invalidateSession).toHaveBeenCalledTimes(1);expect(recordContext.local).toHaveBeenCalled();
  expect(historyService.getSnapshot()).toMatchObject({busy:false,hasSnapshot:false,sourceCount:0});
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({operation:'HISTORY_TRANSFER',stage:'HISTORY_AUTH',reasonCode:'ACCOUNT_SESSION',durableOutcome:'blocked',correlationId:'local-action'}));
});

it('propagates one closed history failure to the simple flow with the initiating correlation',async()=>{
 (getAccountService as jest.Mock).mockReturnValue({getLocalOwner:()=> 'owner-a',invalidateSession:jest.fn()});
 mockTransport.mockRejectedValue(Object.assign(new HistoryTransferError('HISTORY_NETWORK'),{nativeDetails:'SYNTHETIC_PRIVATE_SENTINEL'}));
 let failure:unknown;try{await historyService.refresh({correlationId:'runtime-simple-propagation',propagateErrors:true});}catch(error){failure=error;}
 expect(failure).toMatchObject({reason:'HISTORY_NETWORK',boundary:'HISTORY_AUTH',diagnosticRecorded:true});
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);
 expect(events.filter(event=>event.reasonCode!=='START')).toEqual([expect.objectContaining({reasonCode:'HISTORY_NETWORK',stage:'HISTORY_AUTH',correlationId:'runtime-simple-propagation'})]);
 expect(JSON.stringify([failure,events])).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
});

describe('restore boundary diagnostics and lifecycle',()=>{
 const id='71000000-0000-4000-8000-000000000001';
 const status={status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:id,sources:[]};
 let rebuild:jest.Mock;let read:jest.Mock;
 beforeEach(()=>{
  (getAccountService as jest.Mock).mockReturnValue({getLocalOwner:()=> 'owner-a',invalidateSession:jest.fn(async()=>{})});
  mockTransport.mockImplementation(async request=>request.action==='pull'?{snapshotId:id,page:0,pages:1,schemaVersion:37,records:[]}:status);
  (stageAccountReplica as jest.Mock).mockReset().mockResolvedValue('travel-life-account-synthetic.db');
  (saveReplica as jest.Mock).mockReset().mockResolvedValue(undefined);
  jest.mocked(loadReplica).mockResolvedValue(null);jest.mocked(loadCorrectionJob).mockResolvedValue(null);jest.mocked(exportLocalHistory).mockResolvedValue([]);
  rebuild=jest.fn(async()=>({}));read=jest.fn(async()=>({}));
  (createNativeReconstructionRepository as jest.Mock).mockReturnValue({rebuild,loadDurableReveal:read});
 });
 it('keeps aggregate read timeout retryable and redacted without activating a partial replica',async()=>{
  mockTransport.mockImplementation(async request=>{if(request.action==='pull')throw new HistoryTransferError('HISTORY_READ_TIMEOUT');return {...status,activeSnapshot:null,activeAggregate:id,aggregateRevision:1,aggregatePages:1};});
  await expect(historyService.restore()).resolves.toBe(false);
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith({operation:'HISTORY_TRANSFER',stage:'HISTORY_PULL',reasonCode:'HISTORY_READ_TIMEOUT',retryable:true,durableOutcome:'unknown',correlationId:'local-action'});
  expect(stageAccountReplica).not.toHaveBeenCalled();expect(saveReplica).not.toHaveBeenCalled();
  expect(historyService.getSnapshot().message).toBe('Your saved history is taking longer to load. Try Sync again.');
 });
 it.each([
  ['pull','HISTORY_PULL','HISTORY_NETWORK'],
  ['stage','HISTORY_REPLICA_STAGE','DATABASE_BUSY'],
  ['rebuild','HISTORY_REBUILD','SCHEMA'],
  ['read','HISTORY_READ','UNKNOWN'],
  ['pointer','HISTORY_POINTER','HISTORY_STORAGE'],
 ])('classifies %s failure and withholds partial activation',async(boundary,stage,reasonCode)=>{
  if(boundary==='pull')mockTransport.mockImplementation(async request=>{if(request.action==='pull')throw new HistoryTransferError('HISTORY_NETWORK');return status;});
  if(boundary==='stage')(stageAccountReplica as jest.Mock).mockRejectedValue(new Error('SQLITE_BUSY PRIVATE_SQL'));
  if(boundary==='rebuild')rebuild.mockRejectedValue(new Error('no such table PRIVATE_SQL'));
  if(boundary==='read')read.mockRejectedValue(new Error('PRIVATE_UNKNOWN'));
  if(boundary==='pointer')(saveReplica as jest.Mock).mockRejectedValue(new HistoryTransferError('HISTORY_STORAGE'));
  await historyService.restore();
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({operation:'HISTORY_TRANSFER',stage,reasonCode,correlationId:'local-action'}));
  if(boundary!=='pointer')expect(saveReplica).not.toHaveBeenCalled();
  if(reasonCode==='DATABASE_BUSY')expect(historyService.getSnapshot().message).toContain('updating local history');
  expect(JSON.stringify((recordAppDiagnostic as jest.Mock).mock.calls)).not.toMatch(/PRIVATE_SQL|PRIVATE_UNKNOWN/);
 });
 it('does not start canonical rebuild after sign-out during replica staging',async()=>{
  (stageAccountReplica as jest.Mock).mockImplementation(async()=>{historyService.lock();return 'travel-life-account-synthetic.db';});
  await historyService.restore();
  expect(rebuild).not.toHaveBeenCalled();expect(saveReplica).not.toHaveBeenCalled();
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'HISTORY_REPLICA_STAGE',reasonCode:'HISTORY_FENCED',durableOutcome:'skipped'}));
 });
 it('emits each awaited boundary entry with one correlation and exactly one unknown terminal',async()=>{
  read.mockRejectedValue(new Error('PRIVATE_UNKNOWN'));
  await historyService.restore();
  const events=(recordAppDiagnostic as jest.Mock).mock.calls.map(call=>call[0]);
  expect(events.filter(event=>event.reasonCode==='START').map(event=>event.stage)).toEqual(['HISTORY_AUTH','HISTORY_READ','HISTORY_PULL','HISTORY_REPLICA_STAGE','HISTORY_REBUILD','HISTORY_READ']);
  expect(new Set(events.map(event=>event.correlationId))).toEqual(new Set(['local-action']));
  expect(events.filter(event=>event.reasonCode!=='START')).toEqual([expect.objectContaining({stage:'HISTORY_READ',reasonCode:'UNKNOWN'})]);
 });
 it('refuses explicit restore over a dirty or pending account replica before staging',async()=>{
  jest.mocked(loadReplica).mockResolvedValue({database_name:'old.db',snapshot_id:id});jest.mocked(loadReplicaDigest).mockResolvedValue('accepted');
  jest.mocked(exportLocalHistory).mockResolvedValue([]);
  await expect(historyService.restore()).resolves.toBe(false);expect(stageAccountReplica).not.toHaveBeenCalled();expect(saveReplica).not.toHaveBeenCalled();
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'HISTORY_READ',reasonCode:'HISTORY_REVIEW'}));
 });
 it('retains the previous pointer when owner edits arrive during staging',async()=>{
  jest.mocked(loadReplica).mockResolvedValue({database_name:'old.db',snapshot_id:id});jest.mocked(loadReplicaDigest).mockResolvedValue('[]');
  let changed=false;jest.mocked(exportLocalHistory).mockImplementation(async name=>name==='old.db'&&changed?[{kind:'replay',key:'1',value:{record_id:1,revision:2,updated_at_millis:2,committed_overrides_json:'{}'}}]:[]);
  jest.mocked(stageAccountReplica).mockImplementation(async()=>{changed=true;return 'new.db';});
  await expect(historyService.restore()).resolves.toBe(false);expect(saveReplica).not.toHaveBeenCalled();
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'HISTORY_READ',reasonCode:'HISTORY_REVIEW'}));
 });
});

it('reports a durable denial-fence failure without provider/native data',async()=>{
  (getAccountService as jest.Mock).mockReturnValue({getLocalOwner:()=> 'owner-a',invalidateSession:jest.fn(async()=>{throw new Error('PRIVATE_NATIVE');})});
  await historyService.refresh();
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'ACCOUNT_SECURE_DELETE',reasonCode:'ACCOUNT_STORAGE',durableOutcome:'blocked'}));
  expect(JSON.stringify((recordAppDiagnostic as jest.Mock).mock.calls)).not.toContain('PRIVATE_NATIVE');
});
