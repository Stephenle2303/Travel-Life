import { runHistoryControl, sourceReviewResponse, HistoryTransferError, type HistoryRequest } from '@/account/history-transfer';
import { historyLayouts } from '@/account/history-contract';

const mutation:HistoryRequest={action:'source-control',input:{mutationId:'stable-operation',generation:1,sourceId:'source',sourceGeneration:1,mode:'removed'}};
function harness(){
  let saved:HistoryRequest|null=null;let current=true;
  const options={current:()=>current,load:jest.fn(async()=>saved),create:jest.fn(()=>mutation),matches:()=>true,save:jest.fn(async(request:HistoryRequest)=>{saved=request;}),send:jest.fn(async()=>({status:'complete'})),refresh:jest.fn(async()=>{}),clear:jest.fn(async()=>{saved=null;})};
  return {options,saved:()=>saved,fence:()=>{current=false;}};
}
describe('durable source controls and retained-fact review',()=>{
  it('retires only a definite rejected CAS request and creates a fresh identity on explicit retry',async()=>{
    const h=harness();h.options.send.mockRejectedValueOnce(new HistoryTransferError('HISTORY_CONFLICT',true));
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_CONFLICT'});expect(h.saved()).toBeNull();expect(h.options.clear).toHaveBeenCalledWith('stable-operation');
    const next={...mutation,input:{...mutation.input,mutationId:'fresh-operation',sourceGeneration:3}};h.options.create.mockReturnValue(next);
    await runHistoryControl(h.options);expect(h.options.send).toHaveBeenLastCalledWith(next);
  });
  it('saves before send and reuses exact mutation after unknown acknowledgement',async()=>{
    const h=harness();h.options.send.mockImplementationOnce(async()=>{expect(h.saved()).toEqual(mutation);throw new HistoryTransferError('HISTORY_NETWORK');});
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    expect(h.saved()).toEqual(mutation);expect(h.options.clear).not.toHaveBeenCalled();
    await runHistoryControl(h.options);expect(h.options.create).toHaveBeenCalledTimes(1);expect(h.options.send.mock.calls).toEqual([[mutation],[mutation]]);expect(h.saved()).toBeNull();
  });
  it('retains the operation when response decoding fails without a proven server rejection',async()=>{
    const h=harness();h.options.send.mockRejectedValueOnce(new HistoryTransferError('HISTORY_SCHEMA'));
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_SCHEMA'});
    expect(h.saved()).toEqual(mutation);expect(h.options.clear).not.toHaveBeenCalled();
  });
  it('keeps checkpoint across failed refresh and malformed acknowledgement',async()=>{
    const h=harness();h.options.refresh.mockRejectedValueOnce(new HistoryTransferError('HISTORY_STORAGE'));
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_STORAGE'});expect(h.saved()).toEqual(mutation);
    h.options.send.mockResolvedValueOnce({status:'PRIVATE_SENTINEL'});
    const error=await runHistoryControl(h.options).catch(value=>value);expect(error.reason).toBe('HISTORY_NETWORK');expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');expect(h.saved()).toEqual(mutation);
  });
  it('does not send if durable save fails, and fences signout before publication/cleanup',async()=>{
    const h=harness();h.options.save.mockRejectedValueOnce(new HistoryTransferError('HISTORY_STORAGE'));
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_STORAGE'});expect(h.options.send).not.toHaveBeenCalled();
    h.options.send.mockImplementationOnce(async()=>{h.fence();return {status:'complete'};});
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(h.options.refresh).not.toHaveBeenCalled();expect(h.options.clear).not.toHaveBeenCalled();
  });
  it('cannot overwrite a different pending owner action',async()=>{
    const h=harness();h.options.send.mockRejectedValueOnce(new HistoryTransferError('HISTORY_NETWORK'));
    await expect(runHistoryControl(h.options)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    const error=await runHistoryControl({...h.options,matches:()=>false}).catch(value=>value);
    expect(error.reason).toBe('HISTORY_CONFLICT');expect(h.options.send).toHaveBeenCalledTimes(1);expect(h.saved()).toEqual(mutation);
  });
  it('validates complete bounded review pages and rejects evidence, malformed rows and private error serialization',()=>{
    const value=Object.fromEntries(Object.entries(historyLayouts.manual.fields).map(([key,type])=>[key,type.endsWith('?')?null:type==='number'?0:'']));
    const manual={kind:'manual',key:'manual',value:{...value,manual_id:'manual',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-01',owner_label:'PRIVATE_OWNER_FACT'}};
    const response={status:'complete',page:0,pages:2,sourceSnapshotRevision:2,archived:false,records:[manual]};
    expect(sourceReviewResponse('source',0,response).rows).toEqual([manual]);
    for(const bad of [{...response,pages:0},{...response,page:1},{...response,sourceSnapshotRevision:0},{...response,records:[{...manual,kind:'evidence'}]},{...response,records:[{kind:'PRIVATE_SENTINEL'}]}]){
      try{sourceReviewResponse('source',0,bad);throw new Error('unexpected success');}catch(error){expect(error).toHaveProperty('name',expect.stringMatching(/History/));expect(JSON.stringify(error)).not.toContain('PRIVATE_');}
    }
  });
});
