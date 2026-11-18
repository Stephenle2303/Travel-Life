import { runHistorySync, HistorySyncError, type HistorySyncConfig, type SyncTransferJob } from '@/account/history-sync';
import { HistoryTransferError } from '@/account/history-transfer';
const source='80000000-0000-4000-8000-000000000001';
const config:HistorySyncConfig={ownerId:'owner',accountGeneration:1,sourceId:source,sourceGeneration:1,enabled:true,lastDigest:null,attempts:0,nextAttemptAt:0,lastSuccessAt:null};
function fixture(){
 let saved:SyncTransferJob|null=null;let sequence=0;
 const options={trigger:'foreground' as 'foreground'|'background',now:()=>1000,current:()=>true,stage:jest.fn(),uuid:()=>String(++sequence),claim:jest.fn(async()=>true),renew:jest.fn(async()=>true),release:jest.fn(async()=>{}),cleanupFailed:jest.fn(),load:async()=>saved,checkpoint:jest.fn(async(job:SyncTransferJob)=>{saved=job;}),finish:jest.fn(async()=>{saved=null;}),failed:jest.fn(async()=>{}),status:async()=>({status:'active' as const,generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[{sourceId:source,generation:1,state:'active',lastUpdatedAt:null,sourceSnapshotRevision:0}]}),permitted:async()=>true,exportRows:async()=>[],digest:async()=> 'a'.repeat(64),transport:jest.fn(async(request:{action:string})=>({status:request.action==='begin'?'staging':request.action==='activate'?'pending':'complete'})),progress:jest.fn()};
 return {options,saved:()=>saved};
}
it('does not send when another foreground/background executor owns this source',async()=>{
 const f=fixture();f.options.claim.mockResolvedValue(false);expect(await runHistorySync(config,f.options)).toBe('already-running');expect(f.options.transport).not.toHaveBeenCalled();expect(f.options.release).not.toHaveBeenCalled();
});
it('reconciles identical durable request IDs after a lost response and bounds automatic retries',async()=>{
 const f=fixture();let lost=true;const mutations:string[]=[];
 f.options.transport.mockImplementation(async request=>{mutations.push(String((request as unknown as {input:{mutationId:string}}).input.mutationId));if(request.action==='page'&&lost){lost=false;throw new HistoryTransferError('HISTORY_NETWORK');}return {status:request.action==='begin'?'staging':request.action==='activate'?'pending':'complete'};});
 await expect(runHistorySync(config,f.options)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});expect(f.saved()?.next).toBe(1);expect(f.options.failed).toHaveBeenCalledWith(expect.objectContaining({attempts:1,nextAttemptAt:61000}));
 expect(await runHistorySync(config,f.options)).toBe('complete');expect(mutations).toEqual(['2','3','3','4']);
 f.options.trigger='background';expect(await runHistorySync({...config,attempts:5},f.options)).toBe('deferred');
});
it('loses authority after a held response without advancing checkpoint or progress',async()=>{
 const f=fixture();let current=true;f.options.current=()=>current;f.options.transport.mockImplementation(async()=>{current=false;return {status:'staging'};});
 await expect(runHistorySync(config,f.options)).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(f.saved()?.next).toBe(0);expect(f.options.progress).not.toHaveBeenCalled();expect(f.options.release).toHaveBeenCalledTimes(1);
});
it('rejects a changed source fence and skips unchanged snapshots without upload',async()=>{
 const f=fixture();expect(await runHistorySync({...config,lastDigest:'a'.repeat(64)},f.options)).toBe('unchanged');expect(f.options.transport).not.toHaveBeenCalled();
 await expect(runHistorySync({...config,sourceGeneration:2},f.options)).resolves.toBe('source-unavailable');
 await expect(runHistorySync({...config,accountGeneration:2},f.options)).rejects.toMatchObject({reason:'HISTORY_FENCED'});
});
it('defers unavailable local source reads without blocking independently authorized account convergence',async()=>{
 const f=fixture();const exportRows=jest.fn(async()=>[]);f.options.exportRows=exportRows;f.options.permitted=async()=>false;
 await expect(runHistorySync(config,f.options)).resolves.toBe('source-unavailable');expect(exportRows).not.toHaveBeenCalled();expect(f.options.transport).not.toHaveBeenCalled();expect(f.options.release).toHaveBeenCalledTimes(1);
});
it('preserves the exact typed export boundary through lease cleanup without network or checkpoint',async()=>{
 const f=fixture();f.options.exportRows=async()=>{throw new HistorySyncError('HISTORY_SCHEMA','HISTORY_EXPORT_MANUAL_READ');};
 await expect(runHistorySync(config,f.options)).rejects.toMatchObject({reason:'HISTORY_SCHEMA',boundary:'HISTORY_EXPORT_MANUAL_READ'});
 expect(f.options.transport).not.toHaveBeenCalled();expect(f.options.checkpoint).not.toHaveBeenCalled();expect(f.options.release).toHaveBeenCalledTimes(1);
});
