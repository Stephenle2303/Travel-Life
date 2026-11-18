import { runPrivateMediaUpload, type PrivateMediaUploadJob } from '@/account/media-upload';
import { AccountMediaError } from '@/account/media-cache';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
jest.mock('@/diagnostics/app-diagnostics',()=>({createDiagnosticCorrelationId:()=> 'local_test',recordAppDiagnostic:jest.fn()}));
const id='80000000-0000-4000-8000-000000000001';
const job:PrivateMediaUploadJob={owner:'synthetic-owner',accountGeneration:1,sourceId:id,sourceGeneration:1,target:{kind:'evidence',id},expectedRevision:0,stageMutationId:id,activateMutationId:'80000000-0000-4000-8000-000000000002',uri:'file:///prepared-private',manifest:{contractVersion:'travel-life-private-media-v1',kind:'photo',mimeType:'image/jpeg',byteLength:2,sha256:'a'.repeat(64),width:1,height:1,durationMillis:null},artifactId:null,active:false};
function fixture(){
 let saved=job;const remove=jest.fn(async()=>{});const clear=jest.fn(async()=>{});const send=jest.fn(async(request:Record<string,unknown>):Promise<Record<string,unknown>>=>({status:request.action==='stage'?'staged':request.action==='activate'?'active':'verified',artifactId:id}));
 return {saved:()=>saved,options:{current:()=>true,permitted:async()=>true,save:jest.fn(async(value:PrivateMediaUploadJob)=>{saved=value;}),clear,read:async()=>new Uint8Array([1,2]),digest:async()=>job.manifest.sha256,remove,send,upload:jest.fn(async():Promise<Record<string,unknown>>=>({status:'verified',artifactId:id})),correlationId:'local_test'}};
}
it.each(['status','upload'])('rejects array %s acknowledgement before activation or cleanup',async action=>{
 const f=fixture();
 if(action==='status')f.options.send.mockResolvedValueOnce({status:'staged',artifactId:id}).mockResolvedValueOnce({status:['verified'],artifactId:id});
 else{
  f.options.send.mockResolvedValueOnce({status:'staged',artifactId:id}).mockResolvedValueOnce({status:'staged',artifactId:id});
  f.options.upload.mockResolvedValueOnce({status:['verified'],artifactId:id});
 }
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_SCHEMA',boundary:action==='status'?'MEDIA_ACK':'MEDIA_UPLOAD'});
 expect(f.saved()).toMatchObject({artifactId:id,active:false});
 expect(f.options.send.mock.calls.map(([request])=>request.action)).toEqual(['stage','status']);
 expect(f.options.clear).not.toHaveBeenCalled();expect(f.options.remove).not.toHaveBeenCalled();
});
it('persists before send and reuses exact mutation/artifact identity after unknown activation acknowledgement',async()=>{
 const f=fixture();let lost=true;
 f.options.send.mockImplementation(async request=>{
  expect(f.saved().stageMutationId).toBe(job.stageMutationId);
  if(request.action==='activate'&&lost){lost=false;throw new AccountMediaError('MEDIA_NETWORK');}
  return {status:request.action==='stage'?'staged':request.action==='activate'?'active':'verified',artifactId:id};
 });
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_NETWORK'});
 expect(f.options.remove).not.toHaveBeenCalled();const retained=f.saved();expect(retained.artifactId).toBe(id);
 await runPrivateMediaUpload(retained,f.options);
 const activations=f.options.send.mock.calls.filter(call=>call[0].action==='activate').map(call=>call[0]);
 expect(activations).toHaveLength(2);expect(activations[0]).toEqual(activations[1]);expect(f.options.clear).toHaveBeenCalledWith(job.stageMutationId);
});
it('admits the immutable SQL complete receipt after lost activation acknowledgement without another artifact',async()=>{
 const f=fixture();let lost=true;
 f.options.send.mockImplementation(async request=>{
  if(request.action==='activate'){
   if(lost){lost=false;throw new AccountMediaError('MEDIA_NETWORK');}
   return {status:'complete',artifactId:id,revision:job.expectedRevision+1};
  }
  return {status:request.action==='stage'?'staged':'verified',artifactId:id};
 });
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_NETWORK',boundary:'MEDIA_ACTIVATE'});
 const retained=f.saved();expect(retained.active).toBe(false);expect(f.options.clear).not.toHaveBeenCalled();
 await runPrivateMediaUpload(retained,f.options);
 const actions=f.options.send.mock.calls.map(call=>call[0]);expect(actions.filter(action=>action.action==='stage')).toHaveLength(1);
 const activations=actions.filter(action=>action.action==='activate');expect(activations).toHaveLength(2);expect(activations[0]).toEqual(activations[1]);
 expect(f.saved().active).toBe(true);expect(f.options.clear).toHaveBeenCalledWith(job.stageMutationId);
});
it.each([0,-1,2,1.5,Number.MAX_SAFE_INTEGER+1,'1',null,undefined])('retains immutable activation on invalid complete revision %s',async revision=>{
 jest.mocked(recordAppDiagnostic).mockClear();const f=fixture();
 f.options.send.mockImplementation(async request=>request.action==='activate'?{status:'complete',artifactId:id,revision}:{status:request.action==='stage'?'staged':'verified',artifactId:id});
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_SCHEMA',boundary:'MEDIA_ACTIVATE'});
 expect(f.saved().active).toBe(false);expect(f.saved().activateMutationId).toBe(job.activateMutationId);expect(f.options.remove).not.toHaveBeenCalled();expect(f.options.clear).not.toHaveBeenCalled();
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);expect(events.filter(event=>event.reasonCode!=='START')).toEqual([expect.objectContaining({stage:'MEDIA_ACTIVATE',reasonCode:'MEDIA_SCHEMA',durableOutcome:'blocked',correlationId:'local_test'})]);expect(JSON.stringify(events)).not.toMatch(/prepared-private|80000000/);
});
it('rejects a complete receipt for another artifact without clearing the saved job',async()=>{
 const f=fixture();f.options.send.mockImplementation(async request=>request.action==='activate'?{status:'complete',artifactId:'PRIVATE_RECEIPT_SENTINEL',revision:1}:{status:request.action==='stage'?'staged':'verified',artifactId:id});
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_SCHEMA',boundary:'MEDIA_ACTIVATE'});expect(f.options.clear).not.toHaveBeenCalled();expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('PRIVATE_RECEIPT_SENTINEL');
});
it('does not send if the durable checkpoint fails',async()=>{
 const f=fixture();f.options.save.mockRejectedValue(new Error('PRIVATE_SENTINEL'));
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_STORAGE'});
 expect(f.options.send).not.toHaveBeenCalled();
});
it('withholds a late stage acknowledgement after sign-out without advancing its checkpoint',async()=>{
 const f=fixture();let current=true;f.options.current=()=>current;f.options.send.mockImplementation(async()=>{current=false;return {status:'staged',artifactId:id};});
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_ACCESS'});
 expect(f.options.save).toHaveBeenCalledTimes(1);expect(f.options.upload).not.toHaveBeenCalled();
});
it('rejects changed prepared bytes and redacts fault content with one terminal diagnostic',async()=>{
 jest.mocked(recordAppDiagnostic).mockClear();const f=fixture();f.options.digest=async()=> 'b'.repeat(64);
 f.options.send.mockImplementation(async request=>({status:request.action==='stage'?'staged':request.action==='status'?'staged':'active',artifactId:id}));
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_VERIFY'});
 expect(f.options.upload).not.toHaveBeenCalled();expect(f.options.send.mock.calls.map(call=>call[0].action)).toEqual(['stage','status']);
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);expect(events.filter(event=>event.reasonCode!=='START')).toEqual([expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_VERIFY',reasonCode:'MEDIA_VERIFY',durableOutcome:'blocked',correlationId:'local_test'})]);
 expect(JSON.stringify(events)).not.toContain(job.uri);
});
it.each(['verified','active'])('reconciles %s receipts without requiring evicted prepared bytes',async status=>{
 const f=fixture();const read=jest.fn(async()=>{throw new Error('PRIVATE_EVICTED_BYTES');});f.options.read=read;
 f.options.send.mockImplementation(async request=>({status:request.action==='stage'?'staged':request.action==='status'?status:'active',artifactId:id}));
 await runPrivateMediaUpload(job,f.options);expect(read).not.toHaveBeenCalled();expect(f.options.upload).not.toHaveBeenCalled();expect(f.options.clear).toHaveBeenCalled();
});
it('keeps activated cleanup pending rather than creating another upload after deletion failure',async()=>{
 const f=fixture();f.options.remove.mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'));
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason:'MEDIA_STORAGE'});
 expect(f.saved().active).toBe(true);expect(f.options.clear).not.toHaveBeenCalled();
 f.options.send.mockClear();await runPrivateMediaUpload(f.saved(),f.options);expect(f.options.send).not.toHaveBeenCalled();expect(f.options.clear).toHaveBeenCalledTimes(1);
});
it.each(['MEDIA_ACCESS','MEDIA_SCHEMA'] as const)('retains typed cleanup %s and the active checkpoint',async reason=>{
 jest.mocked(recordAppDiagnostic).mockClear();const f=fixture();
 f.options.clear.mockRejectedValueOnce(new AccountMediaError(reason));
 await expect(runPrivateMediaUpload(job,f.options)).rejects.toMatchObject({reason,boundary:'MEDIA_CLEANUP'});
 expect(f.saved()).toMatchObject({active:true,artifactId:id,stageMutationId:job.stageMutationId});
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(([event])=>event);
 expect(events.filter(event=>event.reasonCode!=='START')).toEqual([{operation:'PRIVATE_MEDIA',stage:'MEDIA_CLEANUP',reasonCode:reason,durableOutcome:reason==='MEDIA_ACCESS'?'skipped':'blocked',retryable:false,correlationId:'local_test'}]);
 expect(JSON.stringify(events)).not.toContain(job.uri);
});
