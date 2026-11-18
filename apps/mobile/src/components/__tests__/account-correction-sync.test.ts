import { syncOwnerCorrections, type CorrectionJob } from '@/account/correction-sync';
import { HistoryTransferError } from '@/account/history-transfer';
const manual=(title:string)=>({kind:'manual',key:'manual',value:{manual_id:'manual',command_key:'command',owner_label:title,owner_context:'Synthetic place',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',latitude:0,longitude:0,created_at_millis:1}});
function fixture(){let saved:CorrectionJob|null=null;const options={owner:'owner',generation:1,current:()=>true,uuid:()=> 'mutation',stage:jest.fn(),load:async()=>saved,baseline:async()=>({snapshotId:'aggregate',revision:0,rows:[manual('Before')]}),rows:async()=>[manual('After')],save:jest.fn(async(job:CorrectionJob)=>{saved=job;}),accepted:jest.fn(async()=>{saved=null;}),send:jest.fn(async()=>({status:'accepted',ownerRevision:1}))};return {options,saved:()=>saved};}
it('persists exact offline owner changes before send and replays the same mutation after lost acknowledgement',async()=>{
 const f=fixture();f.options.send.mockRejectedValueOnce(new HistoryTransferError('HISTORY_NETWORK'));
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});expect(f.saved()?.mutationId).toBe('mutation');
 await expect(syncOwnerCorrections(f.options)).resolves.toBe(true);expect(f.options.send.mock.calls[0]).toEqual(f.options.send.mock.calls[1]);expect(f.options.accepted).toHaveBeenCalledTimes(1);
});
it('retains conflicting local proposal without new operations or accepted-target replacement',async()=>{
 const f=fixture();f.options.send.mockResolvedValue({status:'conflict',ownerRevision:1});
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_CONFLICT'});
 expect(f.saved()?.conflict).toBe(true);await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_CONFLICT'});expect(f.options.send).toHaveBeenCalledTimes(1);expect(f.options.accepted).not.toHaveBeenCalled();
});
it('fences a delayed acknowledgement before baseline or local progress updates',async()=>{
 const f=fixture();let current=true;f.options.current=()=>current;f.options.send.mockImplementation(async()=>{current=false;return {status:'accepted',ownerRevision:1};});
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(f.options.accepted).not.toHaveBeenCalled();expect(f.saved()?.mutationId).toBe('mutation');
});
it.each(['load','baseline','rows','save','accepted'] as const)('classifies %s storage faults without leaking native content',async boundary=>{
 const f=fixture();const fail=async()=>{throw new Error('PRIVATE_NATIVE_SENTINEL');};
 Object.assign(f.options,{[boundary]:fail});
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_STORAGE',boundary:['baseline','rows'].includes(boundary)?'HISTORY_READ':'HISTORY_STAGE'});
 expect(JSON.stringify(f.options.stage.mock.calls)).not.toContain('PRIVATE_NATIVE_SENTINEL');
 if(boundary!=='accepted')expect(f.options.send).not.toHaveBeenCalled();
});
it('retains a resolved branch for pull without re-proposing or marking its local rows accepted',async()=>{
 const f=fixture();f.options.send.mockResolvedValue({status:'conflict',ownerRevision:1});
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_CONFLICT'});
 await f.options.save({...f.saved()!,resolved:'accepted',resolutionRevision:2});
 f.options.send.mockClear();
 await expect(syncOwnerCorrections(f.options)).resolves.toBe(true);
 expect(f.options.send).not.toHaveBeenCalled();expect(f.options.accepted).not.toHaveBeenCalled();expect(f.saved()?.resolved).toBe('accepted');
});
it('preserves edits to an initial or unknown source-local replica for explicit compatibility review',async()=>{
 const f=fixture();Object.assign(f.options,{baseline:async()=>({snapshotId:'source-snapshot',revision:0,rows:[manual('Before')],canonical:false})});
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_REVIEW',boundary:'HISTORY_READ'});expect(f.options.save).not.toHaveBeenCalled();expect(f.options.send).not.toHaveBeenCalled();
});
it('freezes a legacy branch and retries the same verified migration without rebasing',async()=>{
 const f=fixture();const migrate=jest.fn().mockRejectedValueOnce(new HistoryTransferError('HISTORY_NETWORK')).mockResolvedValue({status:'accepted',ownerRevision:4});
 Object.assign(f.options,{baseline:async()=>({snapshotId:'initial',revision:2,rows:[manual('Before')],canonical:false}),digest:async()=> 'a'.repeat(64),migrate});
 await expect(syncOwnerCorrections(f.options)).rejects.toMatchObject({reason:'HISTORY_NETWORK',boundary:'HISTORY_CORRECTION'});
 const pending=f.saved();expect(pending).toMatchObject({expectedOwnerRevision:2,legacy:{baselineDigest:'a'.repeat(64)}});
 await expect(syncOwnerCorrections(f.options)).resolves.toBe(true);
 expect(migrate.mock.calls[0]).toEqual(migrate.mock.calls[1]);expect(f.options.send).not.toHaveBeenCalled();
});
