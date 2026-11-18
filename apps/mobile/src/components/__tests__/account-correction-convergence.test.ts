import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import type { CorrectionJob } from '@/account/correction-sync';
const mockOwner='18000000-0000-4000-8000-000000000001';const mockOld='78000000-0000-4000-8000-000000000001';const mockNew='78000000-0000-4000-8000-000000000002';
const manual=(label:string)=>({kind:'manual',key:'manual',value:{manual_id:'manual',command_key:'command',owner_label:label,owner_context:'Synthetic place',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',latitude:0,longitude:0,created_at_millis:1}});
const mockCurrent=[manual('Updated owner trip')];const mockBefore=[manual('Original owner trip')];
let mockExportRows=mockCurrent;
let mockPending=false;let mockMerged=false;let mockDigest:string|null=null;let mockPointer={database_name:'travel-life-account-old.db',snapshot_id:mockOld};
let mockJob:CorrectionJob|null=null;
const mockSaveReplica=jest.fn(async(_owner:string,name:string,id:string)=>{mockPointer={database_name:name,snapshot_id:id};mockJob=null;});
const mockSave=jest.fn();const mockBlock=jest.fn();const mockClear=jest.fn();const mockMerge=jest.fn();const mockSend=jest.fn();const mockAccepted=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=>mockOwner,getVerifiedSession:async()=>null})}));
jest.mock('@/account/history-transfer',()=>({...jest.requireActual('@/account/history-transfer'),createHistoryTransport:()=>mockSend,createMergeTransport:()=>mockMerge}));
jest.mock('@/account/history-sync-native',()=>({accountSyncEnabled:true,runNativeHistorySync:async()=> 'source-unavailable'}));
jest.mock('@/account/history-native',()=>({stageAccountReplica:async()=> 'travel-life-account-new.db',exportLocalHistory:async()=>mockExportRows}));
jest.mock('@/reconstruction/repository',()=>({createNativeReconstructionRepository:()=>({rebuild:async()=>{},loadDurableReveal:async()=>{}})}));
jest.mock('@/account/record-context',()=>({recordContext:{local:jest.fn(),suspend:jest.fn(),selectionIntent:()=>null,rebind:async()=>false,mutationStamp:()=>({version:0,pending:0}),mutationUnchanged:()=>true}}));
jest.mock('@/account/history-store',()=>({replicaScope:async()=> '[1]',loadReplica:async()=>mockPointer,loadReplicaDigest:async()=>mockDigest,loadCorrectionJob:async()=>mockJob,loadOwnerBaseline:async()=>({snapshotId:mockOld,revision:0,rows:mockBefore}),saveCorrectionJob:mockSave,acceptCorrectionJob:mockAccepted,blockReplica:mockBlock,clearReplica:mockClear,saveReplica:mockSaveReplica,mergeOperation:async()=>mockNew,clearMergeOperation:async()=>{},clearReplicaIfMatching:async()=>{},retireReplicaFile:async()=>{}}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '88000000-0000-4000-8000-000000000001',CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_algorithm:unknown,value:string)=>`digest:${value}`}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),createDiagnosticCorrelationId:()=> 'local_test',recordAppDiagnostic:jest.fn()}));
it('accepts offline correction, hides old authority, merges and pulls into the same explicitly restored account intent',async()=>{
 process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED='true';process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED='true';
 mockAccepted.mockImplementation(async(_job,revision,digest)=>{expect(revision).toBe(1);mockDigest=digest;});
 mockMerge.mockImplementation(async()=>{mockMerged=true;mockPending=false;});
 mockSend.mockImplementation(async request=>{
  if(request.action==='correction-propose'){expect(mockSave).toHaveBeenCalledTimes(1);mockPending=true;return {status:'accepted',ownerRevision:1};}
  if(request.action==='pull')return {aggregateId:mockNew,snapshotId:mockNew,page:0,pages:1,schemaVersion:37,records:mockCurrent};
  return {status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,activeAggregate:mockPending?null:mockMerged?mockNew:mockOld,aggregateRevision:mockMerged?2:1,aggregatePages:mockPending?null:1,pendingMerge:mockPending,ownerPending:mockPending,ownerRevision:mockPending||mockMerged?1:0,sources:[]};
 });
 try{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {historyService}=require('@/account/history-service') as typeof import('@/account/history-service');
  await historyService.catchUp();expect(mockAccepted).toHaveBeenCalledTimes(1);expect(mockBlock).toHaveBeenCalled();expect(mockClear).not.toHaveBeenCalled();expect(mockMerge).toHaveBeenCalledTimes(1);expect(mockPointer.snapshot_id).toBe(mockNew);
  expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toMatch(/Updated owner trip|Original owner trip/);
 }finally{delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED;delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED;}
});
it('retains an accepted legacy checkpoint through guarded automatic pull and clears it only at pointer activation',async()=>{
 jest.clearAllMocks();mockMerged=false;mockPending=true;mockPointer={database_name:'travel-life-account-old.db',snapshot_id:mockOld};
 mockJob={owner:mockOwner,mutationId:'accepted-legacy',generation:1,baseAggregate:mockOld,expectedOwnerRevision:0,changes:{rows:mockCurrent,deleted:[]},currentRows:mockCurrent,conflict:false,acceptedRevision:1,legacy:{buildId:'build',baselineDigest:'a'.repeat(64),editedDigest:'b'.repeat(64)}};
 const checkpoint=mockJob;mockDigest='old-baseline';
 process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED='true';process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED='true';
 mockMerge.mockImplementation(async()=>{expect(mockJob).toBe(checkpoint);mockMerged=true;mockPending=false;});
 mockSend.mockImplementation(async request=>{
  if(request.action==='pull'){expect(mockJob).toBe(checkpoint);return {aggregateId:mockNew,snapshotId:mockNew,page:0,pages:1,schemaVersion:37,records:mockCurrent};}
  return {status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,activeAggregate:mockMerged?mockNew:null,aggregateRevision:mockMerged?2:1,aggregatePages:mockMerged?1:null,pendingMerge:!mockMerged,ownerPending:!mockMerged,ownerRevision:1,sources:[]};
 });
 mockSaveReplica.mockImplementation(async(_owner,name,id)=>{expect(mockJob).toBe(checkpoint);mockPointer={database_name:name,snapshot_id:id};mockJob=null;});
 try{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {historyService}=require('@/account/history-service') as typeof import('@/account/history-service');
  await expect(historyService.restore()).resolves.toBe(false);expect(mockJob).toBe(checkpoint);expect(mockSaveReplica).not.toHaveBeenCalled();
  mockExportRows=[manual('Later unsent edit')];await expect(historyService.catchUp()).resolves.toBe(false);expect(mockJob).toBe(checkpoint);expect(mockSaveReplica).not.toHaveBeenCalled();mockExportRows=mockCurrent;
  await expect(historyService.catchUp()).resolves.toBe(true);expect(mockSaveReplica).toHaveBeenCalledTimes(1);expect(mockPointer.snapshot_id).toBe(mockNew);expect(mockJob).toBeNull();expect(mockAccepted).not.toHaveBeenCalled();expect(mockClear).not.toHaveBeenCalled();
 }finally{mockJob=null;mockExportRows=mockCurrent;delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED;delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED;}
});
