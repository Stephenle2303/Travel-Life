import { HistoryTransferError } from '@/account/history-transfer';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { AccountMediaError } from '@/account/media-cache';
import type { PrivateMediaUploadJob } from '@/account/media-upload';
import { AccountSyncStepError } from '@/account/sync-step-error';
import type { createMediaTransport } from '@/account/media-transport';
import { createNativeReconstructionRepository } from '@/reconstruction/repository';
const owner='80000000-0000-4000-8000-000000000001';const source='80000000-0000-4000-8000-000000000002';const aggregate='80000000-0000-4000-8000-000000000003';const evidence='80000000-0000-4000-8000-000000000004';
let mockOwner:string|null=owner;let mockNext=10;let mockJob:unknown=null;
let mockMediaFetcher:typeof fetch|undefined;
const mockClearControl=jest.fn(async()=>{});
const mockHistory=jest.fn();const mockSend=jest.fn();const mockPrepare=jest.fn();const mockRead=jest.fn();
const mockRemove=jest.fn(async()=>{});const mockSave=jest.fn(async(job:unknown)=>{mockJob=job;});
const mockInstallation=jest.fn(async()=> 'installation');const mockLoadJob=jest.fn(async()=>mockJob);const mockCleanup=jest.fn(async()=>{});
const mockInvalidate=jest.fn(async()=>{mockOwner=null;});
const mockStatus={status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:true,activeSnapshot:null,activeAggregate:aggregate,aggregateRevision:1,aggregatePages:1,sources:[{sourceId:source,generation:1,state:'active',lastUpdatedAt:null,sourceSnapshotRevision:1}]};
const mockPage={status:'complete',accountGeneration:1,sourceId:source,sourceGeneration:1,aggregateId:aggregate,sourceSnapshotRevision:1,page:0,pages:1,total:1,items:[{id:evidence,sourceRef:'local-selected-asset',kind:'photo',day:'2024-01-01',expectedRevision:0}],soundtrack:null};
jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=>mockOwner,getVerifiedSession:async()=>null,invalidateSession:mockInvalidate})}));
jest.mock('@/account/history-transfer',()=>({...jest.requireActual('@/account/history-transfer'),createHistoryTransport:()=>mockHistory}));
jest.mock('@/account/media-transport',()=>({createMediaTransport:(options:Parameters<typeof createMediaTransport>[0])=>mockMediaFetcher
 ? jest.requireActual<typeof import('@/account/media-transport')>('@/account/media-transport').createMediaTransport({...options,url:'https://synthetic.invalid',key:'synthetic-key',session:async()=>({ownerId:owner,accessToken:'PRIVATE_SESSION'}),fetcher:mockMediaFetcher})
 : {send:mockSend,upload:async()=>({status:'verified',artifactId:'90000000-0000-4000-8000-000000000001'})}}));
jest.mock('@/account/media-preparation',()=>({preparePrivateMedia:mockPrepare,privatePreparedBytes:mockRead,removePrivatePrepared:mockRemove,cleanupUnownedPrepared:mockCleanup}));
jest.mock('@/account/history-store',()=>({loadReplica:async()=>({snapshot_id:aggregate,database_name:'synthetic-account.db'}),privateMediaJobExists:async()=>mockJob!==null,privateMediaJobUris:async()=>new Set(),installationId:mockInstallation,loadPrivateMediaJob:mockLoadJob,savePrivateMediaJob:mockSave,clearPrivateMediaJob:async()=>{mockJob=null;},loadHistoryControl:async()=>null,saveHistoryControl:async()=>{},clearHistoryControl:mockClearControl}));
jest.mock('@/photo-access/native-adapter',()=>({nativePhotoAccess:{inspect:async()=>({scope:'limited'}),resolveOwnerPreviews:async()=>[{uri:'file:///selected',availability:'available',kind:'photo'}]}}));
jest.mock('@/reconstruction/repository',()=>({createNativeReconstructionRepository:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`90000000-0000-4000-8000-${String(++mockNext).padStart(12,'0')}`,CryptoDigestAlgorithm:{SHA256:'SHA256'},digest:async()=>new Uint8Array(32).fill(170).buffer}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),recordAppDiagnostic:jest.fn()}));
process.env.EXPO_PUBLIC_TRAVEL_LIFE_PRIVATE_MEDIA_ENABLED='true';
// The build gate must be set before loading the singleton under test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {privateMediaService}=require('@/account/private-media-service') as typeof import('@/account/private-media-service');
beforeEach(()=>{
 mockOwner=owner;mockJob=null;mockMediaFetcher=undefined;jest.clearAllMocks();mockClearControl.mockReset().mockResolvedValue(undefined);mockRemove.mockReset().mockResolvedValue(undefined);privateMediaService.lock();
 mockInstallation.mockReset().mockResolvedValue('installation');mockLoadJob.mockReset().mockImplementation(async()=>mockJob);mockCleanup.mockReset().mockResolvedValue(undefined);
 mockHistory.mockReset().mockImplementation(async request=>request.action==='source-media'?mockPage:mockStatus);
 mockSend.mockReset().mockImplementation(async request=>({status:request.action==='stage'?'staged':request.action==='status'?'staged':'active',artifactId:'90000000-0000-4000-8000-000000000001'}));
 mockPrepare.mockReset().mockResolvedValue({uri:'file:///private-cache/private-selected-90000000-0000-4000-8000-000000000001.jpg',manifest:{contractVersion:'travel-life-private-media-v1',kind:'photo',mimeType:'image/jpeg',byteLength:2,sha256:'aa'.repeat(32),width:1,height:1,durationMillis:null}});
 mockRead.mockReset().mockResolvedValue(new Uint8Array([1,2]));
 jest.mocked(createNativeReconstructionRepository).mockReturnValue({loadReplayManifestInput:async()=>({snapshotToken:1,privacyRevision:0,includedGroupKeys:['trip'],autoGroupKeys:[],groups:[{key:'trip',label:'Synthetic trip',eligible:true,inferred:false,orderCertain:true}],memories:[{key:'kept',groupKey:'trip',kind:'photo',eligible:true,available:false,intent:'keep'}],previewSourceRefs:[`account:${evidence}`]})} as unknown as ReturnType<typeof createNativeReconstructionRepository>);
});

it('syncs only committed Replay media without asking for a second gallery selection',async()=>{
 const other='80000000-0000-4000-8000-000000000005';
 mockHistory.mockImplementation(async request=>request.action==='source-media'?{...mockPage,total:2,items:[...mockPage.items,{...mockPage.items[0],id:other,sourceRef:'unselected-private-asset'}]}:mockStatus);
 await expect(privateMediaService.syncReplay({correlationId:'runtime-simple-1',propagateErrors:true})).resolves.toBe(true);
 expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockPrepare).toHaveBeenCalledWith(expect.objectContaining({sourceRef:'local-selected-asset',correlationId:'runtime-simple-1'}));
 expect(createNativeReconstructionRepository).toHaveBeenCalledWith({databaseName:'synthetic-account.db'});
 expect(privateMediaService.getSnapshot()).toMatchObject({done:1,total:1,selected:[]});
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('unselected-private-asset');
});
it('skips acknowledged Replay copies and reconciles the exact saved upload after unknown acknowledgement',async()=>{
 mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_NETWORK'));
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_NETWORK',diagnosticRecorded:true});
 const saved=mockJob as {stageMutationId:string};expect(saved).not.toBeNull();expect(mockPrepare).toHaveBeenCalledTimes(1);
 await expect(privateMediaService.syncReplay({propagateErrors:true})).resolves.toBe(true);
 expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockJob).toBeNull();
 expect(mockSend.mock.calls.filter(([request])=>request.action==='stage').map(([request])=>request.mutationId)).toEqual([saved.stageMutationId,saved.stageMutationId]);
 mockHistory.mockImplementation(async request=>request.action==='source-media'?{...mockPage,items:[{...mockPage.items[0],expectedRevision:1}]}:mockStatus);
 await privateMediaService.syncReplay({propagateErrors:true});expect(mockPrepare).toHaveBeenCalledTimes(1);
});
it('keeps unrelated durable uploads instead of replacing them during simple sync',async()=>{
 const unrelated={owner,accountGeneration:1,sourceId:source,sourceGeneration:1,target:{kind:'evidence',id:'80000000-0000-4000-8000-000000000009'},stageMutationId:'unrelated-operation'};mockJob=unrelated;
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_CONFLICT'});
 expect(mockJob).toBe(unrelated);expect(mockPrepare).not.toHaveBeenCalled();expect(mockRemove).not.toHaveBeenCalled();
});
const artifact='90000000-0000-4000-8000-000000000001';
const serviceUnavailable=()=>new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_HTTP_RETRY');
it.each(['worker-limit','unreadable-success','upload-lease'] as const)('uses real service transport through receipt fault %s',async fault=>{
 const activationRequests:unknown[]=[];
 let putAttempts=0;
 const fetcher=jest.fn(async(_url:unknown,init?:RequestInit)=>{
  expect(init?.headers).toMatchObject({'x-travel-life-correlation':'runtime-real-transport'});
  if(init?.method==='PUT'){
   putAttempts++;expect(fault).toBe('upload-lease');
   return {ok:false,status:409,json:async()=>({error:'MEDIA_BUSY',message:'PRIVATE_BODY'})} as Response;
  }
  const request=JSON.parse(String(init?.body));
  if(request.action==='activate'){
   activationRequests.push(request);
   const saved=mockJob as PrivateMediaUploadJob;
   expect(saved).toMatchObject({artifactId:request.artifactId,activateMutationId:request.mutationId,uri:expect.stringContaining('private-cache'),active:false});
   if(activationRequests.length===1){
    if(fault==='worker-limit')return {ok:false,status:546,json:async()=>({code:'WORKER_LIMIT',message:'PRIVATE_BODY'})} as Response;
    return {ok:true,status:200,json:async()=>{throw new Error('PRIVATE_BODY');}} as unknown as Response;
   }
  }
  return {ok:true,status:200,json:async()=>({status:request.action==='stage'?'staged':request.action==='status'?(fault==='upload-lease'?'staged':'verified'):'complete',artifactId:artifact,revision:1})} as Response;
 });
 mockMediaFetcher=fetcher;
 const action=privateMediaService.syncReplay({correlationId:'runtime-real-transport',propagateErrors:true});
 const reason=fault==='upload-lease'?'ALREADY_RUNNING':'MEDIA_NETWORK';
 const stage=fault==='worker-limit'?'MEDIA_SERVICE_WORKER_LIMIT':fault==='upload-lease'?'MEDIA_SERVICE_UPLOAD_LEASE':'MEDIA_SERVICE_RESPONSE_JSON';
 if(fault==='upload-lease'){
  await expect(action).rejects.toMatchObject({reason,boundary:stage});
  expect(activationRequests).toHaveLength(0);expect(putAttempts).toBe(1);
  expect(mockJob).toMatchObject({artifactId:artifact,active:false});expect(mockRemove).not.toHaveBeenCalled();
 }else{
  await expect(action).resolves.toBe(true);
  expect(activationRequests).toHaveLength(2);expect(activationRequests[0]).toEqual(activationRequests[1]);
  expect(mockJob).toBeNull();expect(mockRemove).toHaveBeenCalledTimes(1);
 }
 expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockRead).toHaveBeenCalledTimes(fault==='upload-lease'?1:0);
 const stages=fetcher.mock.calls.filter(([,init])=>init?.method!=='PUT'&&JSON.parse(String(init?.body)).action==='stage');
 expect(stages).toHaveLength(1);
 const jobs=mockSave.mock.calls.map(([job])=>job as PrivateMediaUploadJob);
 expect(new Set(jobs.map(job=>job.stageMutationId)).size).toBe(1);
 expect(new Set(jobs.map(job=>job.uri)).size).toBe(1);
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(([event])=>event);
 expect(events.filter(event=>event.reasonCode===reason)).toEqual([{operation:'PRIVATE_MEDIA',stage,reasonCode:reason,durableOutcome:fault==='upload-lease'?'skipped':'unknown',retryable:fault!=='upload-lease',correlationId:'runtime-real-transport'}]);
 expect(events.filter(event=>event.stage==='MEDIA_RECONCILE'&&event.reasonCode==='START')).toHaveLength(fault==='upload-lease'?0:1);
 expect(JSON.stringify(events)).not.toMatch(/PRIVATE_BODY|PRIVATE_SESSION|private-cache|90000000/);
});

it('preserves nested permitted-status diagnostics once and keeps manual resume nonthrowing',async()=>{
 let checks=0;
 mockHistory.mockImplementation(async request=>{
  if(request.action==='source-media')return mockPage;
  if(++checks===1)return mockStatus;
  throw new AccountSyncStepError('HISTORY_READ_TIMEOUT','MEDIA_REPLAY_MAPPING_SQL_TIMEOUT');
 });
 await expect(privateMediaService.syncReplay({correlationId:'runtime-permitted',propagateErrors:true})).rejects.toMatchObject({reason:'HISTORY_READ_TIMEOUT',boundary:'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT',diagnosticRecorded:true});
 expect(jest.mocked(recordAppDiagnostic).mock.calls.map(([event])=>event).filter(event=>event.reasonCode==='HISTORY_READ_TIMEOUT')).toEqual([{operation:'PRIVATE_MEDIA',stage:'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT',reasonCode:'HISTORY_READ_TIMEOUT',durableOutcome:'unknown',retryable:true,correlationId:'runtime-permitted'}]);
 await expect(privateMediaService.resume()).resolves.toBe(false);
 expect(mockSend).not.toHaveBeenCalled();expect(mockJob).not.toBeNull();
});

it.each(['MEDIA_UNAVAILABLE','MEDIA_SCHEMA'] as const)('preserves a prepared derivative read failure of %s',async reason=>{
 mockRead.mockRejectedValueOnce(new AccountMediaError(reason));
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason,boundary:'MEDIA_VERIFY'});
 expect(mockSend.mock.calls.map(([request])=>request.action)).toEqual(['stage','status']);
 expect(mockJob).not.toBeNull();expect(mockRemove).not.toHaveBeenCalled();
});

it('retains the job on an array-valued abandon acknowledgement',async()=>{
 mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_NETWORK'));
 await expect(privateMediaService.syncReplay()).resolves.toBe(false);
 const saved=mockJob;
 mockSend.mockResolvedValueOnce({status:['abandoned'],artifactId:null});
 await expect(privateMediaService.abandon()).resolves.toBe(false);
 expect(mockJob).toBe(saved);expect(mockRemove).not.toHaveBeenCalled();
 expect(jest.mocked(recordAppDiagnostic).mock.calls.map(([event])=>event)).toContainEqual(expect.objectContaining({reasonCode:'MEDIA_SCHEMA',stage:'MEDIA_CLEANUP',durableOutcome:'blocked'}));
});
it.each(['stage','activate'])('automatically reconciles a lost %s response using one derivative and the durable receipt',async failedAction=>{
 let lost=false;
 mockSend.mockImplementation(async request=>{
  if(!lost&&request.action===failedAction){lost=true;throw serviceUnavailable();}
  return {status:request.action==='stage'?'staged':request.action==='status'&&lost&&failedAction==='activate'?'active':request.action==='status'?'staged':'active',artifactId:artifact};
 });
 await expect(privateMediaService.syncReplay({correlationId:'runtime-reconcile',propagateErrors:true})).resolves.toBe(true);
 expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockRead).toHaveBeenCalledTimes(1);expect(mockRemove).toHaveBeenCalledTimes(1);expect(mockJob).toBeNull();
 const stageRequests=mockSend.mock.calls.filter(([request])=>request.action==='stage');
 expect(stageRequests).toHaveLength(failedAction==='stage'?2:1);expect(stageRequests[0]).toEqual(stageRequests.at(-1));
 expect(jest.mocked(recordAppDiagnostic).mock.calls.map(([event])=>event)).toEqual(expect.arrayContaining([
  {operation:'PRIVATE_MEDIA',stage:'MEDIA_SERVICE_HTTP_RETRY',reasonCode:'MEDIA_NETWORK',durableOutcome:'unknown',retryable:true,correlationId:'runtime-reconcile'},
  {operation:'PRIVATE_MEDIA',stage:'MEDIA_RECONCILE',reasonCode:'START',durableOutcome:'unchanged',retryable:false,correlationId:'runtime-reconcile'},
 ]));
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toMatch(/private-cache|local-selected-asset|90000000/);
});

it('retains the exact job after two service failures and keeps Details resume single-attempt',async()=>{
 mockSend.mockRejectedValue(serviceUnavailable());
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_NETWORK',boundary:'MEDIA_SERVICE_HTTP_RETRY'});
 expect(mockSend).toHaveBeenCalledTimes(2);expect(mockSend.mock.calls[0]).toEqual(mockSend.mock.calls[1]);
 const saved=mockJob;expect(saved).not.toBeNull();
 await expect(privateMediaService.resume()).resolves.toBe(false);
 expect(mockSend).toHaveBeenCalledTimes(3);expect(mockJob).toEqual(saved);expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockRemove).not.toHaveBeenCalled();
});
it.each(['owner','consent','storage','activation-id','digest','uri'] as const)('checks %s before repeating the durable operation',async fault=>{
 mockSend.mockImplementationOnce(async()=>{
  mockLoadJob.mockImplementationOnce(async()=>{
   const job=mockJob as PrivateMediaUploadJob;
   if(fault==='owner'){mockOwner=null;privateMediaService.lock();}
   if(fault==='storage')throw new AccountMediaError('MEDIA_STORAGE','MEDIA_STAGE');
   if(fault==='activation-id')return {...job,activateMutationId:'90000000-0000-4000-8000-000000000099'};
   if(fault==='digest')return {...job,manifest:{...job.manifest,sha256:'b'.repeat(64)}};
   if(fault==='uri')return {...job,uri:'file:///PRIVATE_REPLACEMENT'};
   return job;
  });
  if(fault==='consent')mockHistory.mockResolvedValue({...mockStatus,mediaConsent:false});
  throw serviceUnavailable();
 });
 const reason=fault==='owner'?'MEDIA_ACCESS':fault==='consent'?'MEDIA_CONSENT':fault==='storage'?'MEDIA_STORAGE':'MEDIA_CONFLICT';
 const stage=fault==='consent'?'MEDIA_AUTH':'MEDIA_RECONCILE';
 const outcome=fault==='owner'?'skipped':fault==='storage'?'unknown':'blocked';
 await expect(privateMediaService.syncReplay({correlationId:'runtime-reconcile-guard',propagateErrors:true})).rejects.toMatchObject({reason,boundary:stage,diagnosticRecorded:true});
 expect(mockSend).toHaveBeenCalledTimes(1);expect(mockJob).not.toBeNull();expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockRemove).not.toHaveBeenCalled();
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(([event])=>event);
 expect(events.filter(event=>event.reasonCode===reason)).toEqual([{operation:'PRIVATE_MEDIA',stage,reasonCode:reason,durableOutcome:outcome,retryable:fault==='storage',correlationId:'runtime-reconcile-guard'}]);
 expect(JSON.stringify(events)).not.toContain('PRIVATE_REPLACEMENT');
});

it.each(['session','malformed-success','semantic-conflict'] as const)('does not reconcile a %s failure',async fault=>{
 if(fault==='session')mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_SESSION'));
 if(fault==='malformed-success')mockSend.mockResolvedValueOnce({status:'staged',artifactId:'PRIVATE_MALFORMED'});
 if(fault==='semantic-conflict')mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_CONFLICT'));
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:fault==='session'?'MEDIA_NETWORK':fault==='malformed-success'?'MEDIA_SCHEMA':'MEDIA_CONFLICT'});
 expect(mockSend).toHaveBeenCalledTimes(1);expect(mockJob).not.toBeNull();expect(mockRemove).not.toHaveBeenCalled();
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toMatch(/MEDIA_RECONCILE|PRIVATE_MALFORMED/);
});
it('rejects mapping scope changes before preparing any selected private media',async()=>{
 mockHistory.mockImplementation(async request=>request.action==='source-media'?{...mockPage,page:1}:mockStatus);
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_SCHEMA'});
 expect(mockPrepare).not.toHaveBeenCalled();
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('local-selected-asset');
});
it.each(['shape','generation','aggregate'] as const)('rejects the first mapping page %s before preparing or sending media',async mismatch=>{
 mockHistory.mockImplementation(async request=>request.action==='source-media'?(mismatch==='shape'?{status:'complete',privateField:'SYNTHETIC_PRIVATE_PAGE'}:{...mockPage,...(mismatch==='generation'?{accountGeneration:2}:{aggregateId:'80000000-0000-4000-8000-000000000099'})}):mockStatus);
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:mismatch==='shape'?'MEDIA_SCHEMA':'MEDIA_SCOPE',boundary:mismatch==='shape'?'MEDIA_REPLAY_MAPPING_RESPONSE_SHAPE':'MEDIA_REPLAY_MAPPING'});
 expect(mockPrepare).not.toHaveBeenCalled();expect(mockSend).not.toHaveBeenCalled();expect(mockInvalidate).not.toHaveBeenCalled();
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('SYNTHETIC_PRIVATE_PAGE');
});
it('retains valid sign-in for source-media permission denial',async()=>{
 mockHistory.mockImplementation(async request=>{if(request.action==='source-media')throw new HistoryTransferError('ACCESS',false,'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN');return mockStatus;});
 await expect(privateMediaService.syncReplay({correlationId:'runtime-forbidden',propagateErrors:true})).rejects.toMatchObject({reason:'ACCESS',boundary:'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN',diagnosticRecorded:true});
 expect(mockInvalidate).not.toHaveBeenCalled();expect(mockOwner).toBe(owner);expect(mockPrepare).not.toHaveBeenCalled();expect(mockSend).not.toHaveBeenCalled();
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith({operation:'PRIVATE_MEDIA',reasonCode:'ACCESS',stage:'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN',durableOutcome:'blocked',retryable:false,correlationId:'runtime-forbidden'});
});
it.each(['installation','pending','cleanup'] as const)('fences late %s work before changing replacement-owner progress',async seam=>{
 let entered!:()=>void;let release!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;});const delayed=new Promise<void>(resolve=>{release=resolve;});
 if(seam==='installation')mockInstallation.mockImplementationOnce(async()=>{entered();await delayed;return 'installation';});
 if(seam==='pending')mockLoadJob.mockImplementationOnce(async()=>{entered();await delayed;return null;});
 if(seam==='cleanup')mockCleanup.mockImplementationOnce(async()=>{entered();await delayed;});
 const pending=privateMediaService.syncReplay({correlationId:'runtime-old-owner',propagateErrors:true}).catch(error=>error);await started;
 mockOwner='80000000-0000-4000-8000-000000000099';privateMediaService.lock();await privateMediaService.choose();privateMediaService.toggle(evidence);
 const replacement=privateMediaService.getSnapshot();release();
 await expect(pending).resolves.toMatchObject({reason:'MEDIA_ACCESS',diagnosticRecorded:true});expect(privateMediaService.getSnapshot()).toEqual(replacement);
 privateMediaService.toggle(evidence);expect(privateMediaService.getSnapshot().selected).toEqual([]);expect(mockPrepare).not.toHaveBeenCalled();expect(mockSend).not.toHaveBeenCalled();expect(mockInvalidate).not.toHaveBeenCalled();
});
it.each(['absent','mismatched','acknowledged'] as const)('handles %s local custom soundtrack against authoritative mapping',async mode=>{
 const manifest={snapshotToken:1,privacyRevision:0,includedGroupKeys:['trip'],autoGroupKeys:[],groups:[{key:'trip',label:'Synthetic trip',eligible:true,inferred:false,orderCertain:true}],memories:[{key:'kept',groupKey:'trip',kind:'photo',eligible:true,available:false,intent:'keep'}],previewSourceRefs:[`account:${evidence}`]};
 jest.mocked(createNativeReconstructionRepository).mockImplementation(options=>({loadReplayManifestInput:async()=>({...manifest,soundtrack:options?.databaseName==='synthetic-account.db'?{kind:'custom',revision:'required-track',localUri:'synthetic-account-track'}:mode==='absent'?undefined:{kind:'custom',revision:'different-track',localUri:'synthetic-local-track'}})} as unknown as ReturnType<typeof createNativeReconstructionRepository>));
 mockHistory.mockImplementation(async request=>request.action==='source-media'?{...mockPage,items:[{...mockPage.items[0],expectedRevision:1}],soundtrack:{revision:'required-track',expectedRevision:mode==='acknowledged'?1:0}}:mockStatus);
 if(mode==='acknowledged'){
  await expect(privateMediaService.syncReplay({propagateErrors:true})).resolves.toBe(true);
  expect(createNativeReconstructionRepository).not.toHaveBeenCalledWith({databaseName:'travel-life-import-v1.db'});
 }else{
  await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_UNAVAILABLE',boundary:'MEDIA_REPLAY_SOUNDTRACK'});
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({reasonCode:'MEDIA_UNAVAILABLE',stage:'MEDIA_REPLAY_SOUNDTRACK',durableOutcome:'blocked'}));
  expect(privateMediaService.getSnapshot().message).not.toBe('Your Replay memories are saved in your account.');
 }
 expect(mockPrepare).not.toHaveBeenCalled();expect(mockSend).not.toHaveBeenCalled();
});
it('keeps the native busy category at the precise Replay manifest read and discards private details',async()=>{
 jest.mocked(createNativeReconstructionRepository).mockReturnValue({loadReplayManifestInput:async()=>{throw new Error('database is locked SYNTHETIC_PRIVATE_SENTINEL');}} as unknown as ReturnType<typeof createNativeReconstructionRepository>);
 let failure:unknown;try{await privateMediaService.syncReplay({correlationId:'runtime-simple-busy',propagateErrors:true});}catch(error){failure=error;}
 expect(failure).toMatchObject({reason:'DATABASE_BUSY',boundary:'MEDIA_REPLAY_MANIFEST',diagnosticRecorded:true});
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'MEDIA_REPLAY_MANIFEST',reasonCode:'DATABASE_BUSY',retryable:true,correlationId:'runtime-simple-busy'}));
 expect(JSON.stringify([failure,jest.mocked(recordAppDiagnostic).mock.calls])).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
 expect(mockPrepare).not.toHaveBeenCalled();
});
it('retains the source-media SQL timeout boundary through one closed propagated failure',async()=>{
 mockHistory.mockRejectedValue(new HistoryTransferError('HISTORY_READ_TIMEOUT',false,'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT'));
 await expect(privateMediaService.syncReplay({correlationId:'runtime-mapping-timeout',propagateErrors:true})).rejects.toMatchObject({reason:'HISTORY_READ_TIMEOUT',boundary:'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT',diagnosticRecorded:true});
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);
 expect(events.filter(event=>event.reasonCode!=='START')).toEqual([expect.objectContaining({reasonCode:'HISTORY_READ_TIMEOUT',stage:'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT',retryable:true,durableOutcome:'unknown',correlationId:'runtime-mapping-timeout'})]);
});
it.each([
 ['HISTORY_NETWORK','MEDIA_NETWORK','SESSION_UNAVAILABLE','unknown',true],
 ['HISTORY_SCHEMA','MEDIA_SCHEMA','RESPONSE_SHAPE','blocked',false],
 ['HISTORY_CONSENT','MEDIA_CONSENT','RESPONSE_ERROR','blocked',false],
 ['HISTORY_STALE','MEDIA_SCOPE','RESPONSE_ERROR','blocked',false],
 ['HISTORY_INCOMPLETE','MEDIA_SCOPE','RESPONSE_ERROR','blocked',false],
 ['HISTORY_CONFLICT','MEDIA_CONFLICT','RESPONSE_ERROR','blocked',false],
 ['HISTORY_QUOTA','MEDIA_QUOTA','RESPONSE_ERROR','blocked',false],
 ['HISTORY_STORAGE','MEDIA_STORAGE','RESPONSE_ERROR','unknown',true],
 ['ACCOUNT_REAUTH','MEDIA_NETWORK','RESPONSE_ERROR','unknown',true],
 ['UNKNOWN','UNKNOWN','RESPONSE_ERROR','unknown',false],
 ['HISTORY_REVIEW','HISTORY_REVIEW','RESPONSE_ERROR','blocked',false],
 ['HISTORY_FENCED','MEDIA_ACCESS','SESSION_UNAVAILABLE','skipped',false],
 ['ACCOUNT_SESSION','ACCOUNT_SESSION','HTTP_AUTH','blocked',false],
] as const)('preserves mapped %s stage and the initiating correlation without duplicate terminal events',async(reason,mappedReason,boundary,durableOutcome,retryable)=>{
 const stage=`MEDIA_REPLAY_MAPPING_${boundary}` as const;
 const secret='SYNTHETIC_PRIVATE_MAPPING_SENTINEL';
 mockHistory.mockImplementation(async request=>{if(request.action==='source-media')throw Object.assign(new HistoryTransferError(reason,false,stage),{details:secret});return mockStatus;});
 let failure:unknown;try{await privateMediaService.syncReplay({correlationId:'runtime-mapping-propagation',propagateErrors:true});}catch(error){failure=error;}
 expect(failure).toMatchObject({reason:mappedReason,boundary:stage,diagnosticRecorded:true});
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);
 expect(events.filter(event=>event.reasonCode!=='START')).toEqual([{operation:'PRIVATE_MEDIA',reasonCode:mappedReason,stage,retryable,durableOutcome,correlationId:'runtime-mapping-propagation'}]);
 expect(JSON.stringify([failure,events,privateMediaService.getSnapshot().message])).not.toContain('local-selected-asset');expect(mockPrepare).not.toHaveBeenCalled();
 expect(JSON.stringify([failure,events,privateMediaService.getSnapshot().message])).not.toContain(secret);
});
it('does not report ready after media consent is withdrawn following the final acknowledgement',async()=>{
 mockHistory.mockImplementation(async request=>request.action==='source-media'?mockPage:{...mockStatus,mediaConsent:!(mockPrepare.mock.calls.length>0&&mockJob===null)});
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_CONSENT',boundary:'MEDIA_AUTH'});
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({stage:'MEDIA_AUTH',reasonCode:'MEDIA_CONSENT',durableOutcome:'blocked'}));
});
it('rejects a valid second mapping page when its source scope changes before any upload',async()=>{
 const items=Array.from({length:25},(_,index)=>({...mockPage.items[0],id:`80000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,sourceRef:`synthetic-source-${index}`}));
 mockHistory.mockImplementation(async request=>request.action==='source-media'?{...mockPage,pages:2,total:25,page:request.input.page,accountGeneration:request.input.page===0?1:2,items:items.slice(request.input.page*24,(request.input.page+1)*24)}:mockStatus);
 await expect(privateMediaService.syncReplay({propagateErrors:true})).rejects.toMatchObject({reason:'MEDIA_SCOPE',boundary:'MEDIA_REPLAY_MAPPING'});
 expect(mockPrepare).not.toHaveBeenCalled();expect(mockSend).not.toHaveBeenCalled();
});
it('cleans only the generated derivative when durable ownership was definitely not acquired',async()=>{
 await privateMediaService.choose();privateMediaService.toggle(evidence);mockSave.mockRejectedValueOnce(new AccountMediaError('MEDIA_STORAGE','MEDIA_STAGE'));
 await privateMediaService.upload();expect(mockRemove).toHaveBeenCalledWith(expect.stringContaining('/private-selected-'));expect(mockSend).not.toHaveBeenCalled();expect(mockJob).toBeNull();
});
it('retains a durable job and file after an unknown upload and explicitly reconciles abandonment',async()=>{
 await privateMediaService.choose();privateMediaService.toggle(evidence);mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_NETWORK'));
 await privateMediaService.upload();expect(mockJob).not.toBeNull();expect(mockRemove).not.toHaveBeenCalled();
 mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_NETWORK'));await privateMediaService.abandon();expect(mockJob).not.toBeNull();expect(mockRemove).not.toHaveBeenCalled();
 mockSend.mockResolvedValueOnce({status:'abandoned',artifactId:null});await privateMediaService.abandon();expect(mockJob).toBeNull();expect(mockRemove).toHaveBeenCalledTimes(1);
});
it('uses current aggregate source mapping and uploads only the explicitly selected asset',async()=>{
 await privateMediaService.choose();expect(privateMediaService.getSnapshot().selected).toEqual([]);expect(mockPrepare).not.toHaveBeenCalled();
 privateMediaService.toggle(evidence);await privateMediaService.upload();
 expect(mockPrepare).toHaveBeenCalledWith(expect.objectContaining({kind:'photo',sourceRef:'local-selected-asset'}));
 expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({action:'stage',target:{kind:'evidence',id:evidence},sourceId:source}),expect.any(String));
 expect(privateMediaService.getSnapshot()).toMatchObject({done:1,total:1,busy:false,selected:[]});expect(mockJob).toBeNull();
});
it('rejects changed aggregate authority before preparing/uploading private bytes',async()=>{
 await privateMediaService.choose();privateMediaService.toggle(evidence);
 mockHistory.mockResolvedValue({...mockStatus,activeAggregate:'80000000-0000-4000-8000-000000000099'});
 mockPrepare.mockImplementation(async input=>{if(!await input.consented())throw new AccountMediaError('MEDIA_CONSENT');throw new Error('unexpected preparation');});
 await privateMediaService.upload();expect(mockSend).not.toHaveBeenCalled();expect(mockRead).not.toHaveBeenCalled();
 expect(privateMediaService.getSnapshot().selected).toEqual([evidence]);
});
it('fences an old owner page and current explicit status denial without retaining private previews',async()=>{
 mockHistory.mockImplementation(async()=>{mockOwner=null;return mockPage;});await privateMediaService.choose();privateMediaService.checkOwner();
 expect(privateMediaService.getSnapshot()).toMatchObject({page:null,previews:[],busy:false});
 mockOwner=owner;mockHistory.mockRejectedValue(new HistoryTransferError('ACCOUNT_SESSION'));await privateMediaService.refresh();
 expect(mockInvalidate).toHaveBeenCalledTimes(1);privateMediaService.checkOwner();expect(privateMediaService.getSnapshot().page).toBeNull();
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('local-selected-asset');
});

it.each(['consent','abandon'] as const)('fences late %s cleanup from a replacement owner selection',async mode=>{
 let release!:()=>void;let entered!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;});const blocked=new Promise<void>(resolve=>{release=resolve;});
 if(mode==='consent'){
  mockClearControl.mockImplementationOnce(async()=>{entered();await blocked;});
  mockHistory.mockImplementation(async request=>request.action==='consent'?{status:'complete'}:request.action==='source-media'?mockPage:mockStatus);
 }else{
  await privateMediaService.choose();privateMediaService.toggle(evidence);mockSend.mockRejectedValueOnce(new AccountMediaError('MEDIA_NETWORK'));await privateMediaService.upload();
  mockSend.mockResolvedValueOnce({status:'abandoned',artifactId:null});mockRemove.mockImplementationOnce(async()=>{entered();await blocked;});
 }
 const previous=mode==='consent'?privateMediaService.consent(true):privateMediaService.abandon();await started;
 mockOwner='80000000-0000-4000-8000-000000000099';privateMediaService.lock();
 await privateMediaService.choose();privateMediaService.toggle(evidence);release();await previous;
 expect(privateMediaService.getSnapshot().selected).toEqual([evidence]);
 privateMediaService.toggle(evidence);expect(privateMediaService.getSnapshot().selected).toEqual([]);
});
