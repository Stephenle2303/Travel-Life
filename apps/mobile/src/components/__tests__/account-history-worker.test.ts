import { classifyHistoryFailure, createHistoryTransport, createMergeTransport, HistoryTransferError, runMergeJob } from '@/account/history-transfer';
import { HistoryContractError } from '@/account/history-contract';

it('keeps a bounded merge window long enough for the isolated finalization RPC',async()=>{
 const timer=jest.spyOn(global,'setTimeout');const operationId='70000000-0000-4000-8000-000000000001';
 const fetcher=jest.fn(async()=>({ok:true,status:200,json:async()=>({status:'complete',aggregateId:operationId,aggregateRevision:1,pages:1})} as Response));
 try {
  await createMergeTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'PRIVATE_SENTINEL'}),fetcher})(operationId);
  expect(timer).toHaveBeenLastCalledWith(expect.any(Function),120_000);
 } finally {timer.mockRestore();}
});

const id='71000000-0000-4000-8000-000000000001';
const config={url:'https://synthetic.example',key:'public-key',session:async()=>({accessToken:'private-token'})};

describe('private history merge request',()=>{
  it('continues durable prepare/build progress with refreshed sessions and one operation/correlation until finalization',async()=>{
    let tokens=0;
    const session=jest.fn(async(_correlation?:string)=>({accessToken:`token-${++tokens}`,ownerId:'owner-a'}));
    const requests:RequestInit[]=[];
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      requests.push(init!);
      return new Response(JSON.stringify(requests.length<3?{status:'progress',operationId:id}:{status:'complete',aggregateId:id,aggregateRevision:4,pages:2}));
    }) as unknown as typeof fetch;
    const clear=jest.fn(async()=>{}),refresh=jest.fn(async()=>{});
    const send=createMergeTransport({...config,session,fetcher,fence:{owner:'owner-a',current:()=>true},correlationId:'runtime-synthetic-1'});
    await runMergeJob({current:()=>true,load:async()=>id,send,refresh,clear});
    expect(requests).toHaveLength(3);
    expect(session.mock.calls).toHaveLength(3);
    expect(session.mock.calls).toEqual(Array.from({length:3},()=>['runtime-synthetic-1']));
    requests.forEach((request,index)=>{
      expect(JSON.parse(String(request.body))).toEqual({operationId:id});
      expect(new Headers(request.headers).get('authorization')).toBe(`Bearer token-${index+1}`);
      expect(new Headers(request.headers).get('x-travel-life-correlation')).toBe('runtime-synthetic-1');
    });
    expect(refresh).toHaveBeenCalledTimes(1);expect(clear).toHaveBeenCalledWith(id);
  });
  it.each([{status:'progress'},{status:'progress',operationId:'wrong'},{status:'progress',operationId:id,phase:'PRIVATE_SENTINEL'},{status:'progress',operationId:id,pages:1}])('rejects a malformed or foreign progress receipt and retains the merge job',async receipt=>{
    const fetcher=jest.fn(async()=>new Response(JSON.stringify(receipt))) as unknown as typeof fetch;
    const clear=jest.fn(async()=>{}),refresh=jest.fn(async()=>{});
    const error=await runMergeJob({current:()=>true,load:async()=>id,send:createMergeTransport({...config,fetcher}),refresh,clear}).catch(value=>value);
    expect(error).toMatchObject({reason:'HISTORY_NETWORK'});expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');
    expect(fetcher).toHaveBeenCalledTimes(1);expect(clear).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled();
  });
  it('stops after progress when cancelled and never asks for another session',async()=>{
    let current=true;
    const session=jest.fn(async()=>({accessToken:'token',ownerId:'owner-a'}));
    const fetcher=jest.fn(async()=>{current=false;return new Response(JSON.stringify({status:'progress',operationId:id}));}) as unknown as typeof fetch;
    await expect(createMergeTransport({...config,session,fetcher,fence:{owner:'owner-a',current:()=>current}})(id)).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(session).toHaveBeenCalledTimes(1);
  });
  it('refuses continuation under a different owner after progress',async()=>{
    const session=jest.fn().mockResolvedValueOnce({accessToken:'token-a',ownerId:'owner-a'}).mockResolvedValueOnce({accessToken:'token-b',ownerId:'owner-b'});
    const fetcher=jest.fn(async()=>new Response(JSON.stringify({status:'progress',operationId:id}))) as unknown as typeof fetch;
    await expect(createMergeTransport({...config,session,fetcher,fence:{owner:'owner-a',current:()=>true}})(id)).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(session).toHaveBeenCalledTimes(2);
  });
  it('bounds endless progress and retains its durable operation',async()=>{
    const fetcher=jest.fn(async()=>new Response(JSON.stringify({status:'progress',operationId:id}))) as unknown as typeof fetch;
    const clear=jest.fn(async()=>{}),refresh=jest.fn(async()=>{});
    await expect(runMergeJob({current:()=>true,load:async()=>id,send:createMergeTransport({...config,fetcher}),refresh,clear})).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    expect(fetcher).toHaveBeenCalledTimes(16);expect(clear).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled();
  });
  it('uses a fresh timeout for each progress request and retains the operation on timeout',async()=>{
    jest.useFakeTimers();
    try{
      let finishFirst!:()=>void;const signals:AbortSignal[]=[];
      const fetcher=jest.fn((_url:RequestInfo|URL,init?:RequestInit)=>{
        signals.push(init!.signal!);
        if(signals.length===1)return new Promise<Response>(resolve=>{finishFirst=()=>resolve(new Response(JSON.stringify({status:'progress',operationId:id})));});
        return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new Error('PRIVATE_SENTINEL'))));
      }) as unknown as typeof fetch;
      const clear=jest.fn(async()=>{}),refresh=jest.fn(async()=>{});
      const result=runMergeJob({current:()=>true,load:async()=>id,send:createMergeTransport({...config,fetcher}),refresh,clear}).catch(error=>error);
      await jest.advanceTimersByTimeAsync(119_000);finishFirst();await jest.advanceTimersByTimeAsync(0);
      expect(signals).toHaveLength(2);
      await jest.advanceTimersByTimeAsync(119_999);expect(signals[1].aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const error=await result;expect(error).toMatchObject({reason:'HISTORY_NETWORK'});expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');
      expect(signals[0].aborted).toBe(false);expect(signals[1].aborted).toBe(true);
      expect(clear).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled();
    }finally{jest.useRealTimers();}
  });
  it('reconciles a lost acknowledgement after progress using the same retained operation',async()=>{
    const bodies:unknown[]=[];
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      bodies.push(JSON.parse(String(init?.body)));
      if(bodies.length===1)return new Response(JSON.stringify({status:'progress',operationId:id}));
      if(bodies.length===2)throw new Error('PRIVATE_SENTINEL');
      return new Response(JSON.stringify({status:'complete',aggregateId:id,aggregateRevision:1,pages:1}));
    }) as unknown as typeof fetch;
    const clear=jest.fn(async()=>{}),refresh=jest.fn(async()=>{}),send=createMergeTransport({...config,fetcher});
    const job={current:()=>true,load:async()=>id,send,refresh,clear};
    await expect(runMergeJob(job)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    expect(clear).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled();
    await runMergeJob(job);expect(bodies).toEqual([{operationId:id},{operationId:id},{operationId:id}]);expect(clear).toHaveBeenCalledTimes(1);
  });
  it.each(['accepted','conflict'])('serializes exact legacy envelope/correlation and validates %s receipt',async status=>{
    const legacy={generation:1,baseSnapshot:id,expectedOwnerRevision:0,baselineDigest:'a'.repeat(64),editedDigest:'b'.repeat(64),changes:{rows:[],deleted:[]}};
    const session=jest.fn(async(_correlation?:string)=>({accessToken:'private-token'}));
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      expect(JSON.parse(String(init?.body))).toEqual({operationId:id,legacy});expect(new Headers(init?.headers).get('x-travel-life-correlation')).toBe('runtime-synthetic-1');
      return new Response(JSON.stringify({status,ownerRevision:2}));
    }) as unknown as typeof fetch;
    await expect(createMergeTransport({...config,session,fetcher,correlationId:'runtime-synthetic-1'}).legacy(id,legacy)).resolves.toEqual({status,ownerRevision:2});expect(session).toHaveBeenCalledWith('runtime-synthetic-1');
  });
  it.each([null,-1,0,1.5,Number.MAX_SAFE_INTEGER+1,'1'])('rejects malformed accepted legacy revision %s',async ownerRevision=>{
    const fetcher=(async()=>new Response(JSON.stringify({status:'accepted',ownerRevision}))) as typeof fetch;
    await expect(createMergeTransport({...config,fetcher}).legacy(id,{})).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
  });
  it('keeps an unlocked owner through offline token verification without sending or asserting revocation',async()=>{
    const fetcher=jest.fn();let current=true;
    const bound={...config,session:async()=>null,fetcher,fence:{owner:'owner-a',current:()=>current}};
    await expect(createHistoryTransport(bound)({action:'status',input:{}})).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    await expect(createMergeTransport(bound)(id)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    current=false;
    await expect(createHistoryTransport(bound)({action:'status',input:{}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    await expect(createMergeTransport(bound)(id)).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('never sends after the owning session changes during token lookup',async()=>{
    let release!:(value:{accessToken:string;ownerId:string})=>void;let current=true;
    const fetcher=jest.fn();const fence={owner:'owner-a',current:()=>current};
    const session=()=>new Promise<{accessToken:string;ownerId:string}>(resolve=>{release=resolve;});
    const request=createMergeTransport({...config,session,fetcher,fence})(id);
    current=false;release({accessToken:'PRIVATE_TOKEN',ownerId:'owner-a'});
    await expect(request).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('distinguishes known schema and storage from unknown private errors',()=>{
    expect(classifyHistoryFailure(new HistoryContractError())).toBe('HISTORY_SCHEMA');
    expect(classifyHistoryFailure(new HistoryTransferError('HISTORY_STORAGE'))).toBe('HISTORY_STORAGE');
    expect(classifyHistoryFailure(new Error('PRIVATE_SENTINEL'))).toBe('UNKNOWN');
  });
  it('sends only the persisted operation and accepts its confirmed receipt',async()=>{
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      expect(JSON.parse(String(init?.body))).toEqual({operationId:id});
      return new Response(JSON.stringify({status:'complete',aggregateId:id,aggregateRevision:1,pages:1}));
    }) as unknown as typeof fetch;
    await expect(createMergeTransport({...config,fetcher})(id)).resolves.toBeUndefined();
  });
  it('carries the one action correlation separately from its durable operation',async()=>{
    const correlationId='runtime-synthetic-1';
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      expect(new Headers(init?.headers).get('x-travel-life-correlation')).toBe(correlationId);
      expect(JSON.parse(String(init?.body))).toEqual({operationId:id});
      return new Response(JSON.stringify({status:'complete',aggregateId:id,aggregateRevision:1,pages:1}));
    }) as unknown as typeof fetch;
    await createMergeTransport({...config,fetcher,correlationId})(id);
  });
  it('retains unknown outcome for lost or malformed acknowledgements without leaking private data',async()=>{
    const requests:string[]=[];
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{requests.push(String(init?.body));throw new Error('PRIVATE_SENTINEL');}) as unknown as typeof fetch;
    const merge=createMergeTransport({...config,fetcher});
    for(let attempt=0;attempt<2;attempt++){
      const error=await merge(id).catch(value=>value);
      expect(error).toBeInstanceOf(HistoryTransferError);expect(error.reason).toBe('HISTORY_NETWORK');
      expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');
    }
    expect(requests).toEqual([JSON.stringify({operationId:id}),JSON.stringify({operationId:id})]);
    const malformed=createMergeTransport({...config,fetcher:(async()=>new Response(JSON.stringify({status:'complete',aggregateId:'wrong',aggregateRevision:1,pages:1}))) as typeof fetch});
    await expect(malformed(id)).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
  });
  it('classifies fixed server errors and refuses invalid IDs before network access',async()=>{
    const fetcher=jest.fn(async()=>new Response(JSON.stringify({error:'HISTORY_REVIEW',private:'PRIVATE_SENTINEL'}),{status:409})) as unknown as typeof fetch;
    const merge=createMergeTransport({...config,fetcher});
    await expect(merge(id)).rejects.toMatchObject({reason:'HISTORY_REVIEW'});
    await expect(merge('PRIVATE_SENTINEL')).rejects.toMatchObject({reason:'HISTORY_SCHEMA'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains an unknown receipt, clears explicit stale, and fences sign-out',async()=>{
    const clear=jest.fn(async()=>{});let active=true;
    const base={current:()=>active,load:async()=>id,refresh:async()=>{},clear};
    await expect(runMergeJob({...base,send:async()=>{throw new HistoryTransferError('HISTORY_NETWORK');}})).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    expect(clear).not.toHaveBeenCalled();
    await expect(runMergeJob({...base,send:async()=>{throw new HistoryTransferError('HISTORY_STALE');}})).rejects.toMatchObject({reason:'HISTORY_STALE'});
    expect(clear).toHaveBeenCalledWith(id);clear.mockClear();
    await expect(runMergeJob({...base,send:async()=>{active=false;}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(clear).not.toHaveBeenCalled();
    active=true;
    await expect(runMergeJob({...base,send:async()=>{},refresh:async()=>{throw new HistoryTransferError('HISTORY_NETWORK');}})).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
    expect(clear).not.toHaveBeenCalled();
  });
  it('retires a known stale operation and automatically completes a fresh operation with the same action correlation',async()=>{
    const next='72000000-0000-4000-8000-000000000001',correlationId='runtime-synthetic-1';
    let pending:string|null=id;
    const load=jest.fn(async()=>pending??(pending=next));
    const clear=jest.fn(async(cleared:string)=>{expect(pending).toBe(cleared);pending=null;});
    const refresh=jest.fn(async()=>{}),sent:string[]=[];
    const fetcher=jest.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      expect(new Headers(init?.headers).get('x-travel-life-correlation')).toBe(correlationId);
      const operation=JSON.parse(String(init?.body)).operationId;sent.push(operation);
      return new Response(JSON.stringify(operation===id?{error:'HISTORY_STALE'}:{status:'complete',aggregateId:operation,aggregateRevision:2,pages:1}),{status:operation===id?409:200});
    }) as unknown as typeof fetch;
    await runMergeJob({current:()=>true,load,send:createMergeTransport({...config,fetcher,correlationId}),refresh,clear});
    expect(sent).toEqual([id,next]);expect(clear.mock.calls).toEqual([[id],[next]]);expect(pending).toBeNull();expect(refresh).toHaveBeenCalledTimes(1);
  });
  it.each(['HISTORY_NETWORK','UNKNOWN'] as const)('retains the fresh operation after stale recovery ends with %s',async reason=>{
    const next='72000000-0000-4000-8000-000000000001';let pending:string|null=id;
    const load=jest.fn(async()=>pending??(pending=next));
    const clear=jest.fn(async()=>{pending=null;}),refresh=jest.fn(async()=>{});
    const send=jest.fn(async(operation:string)=>{throw new HistoryTransferError(operation===id?'HISTORY_STALE':reason);});
    await expect(runMergeJob({current:()=>true,load,send,refresh,clear})).rejects.toMatchObject({reason});
    expect(send.mock.calls).toEqual([[id],[next]]);expect(load).toHaveBeenCalledTimes(2);expect(clear.mock.calls).toEqual([[id]]);expect(pending).toBe(next);expect(refresh).not.toHaveBeenCalled();
  });
  it('retires a second explicitly stale operation and stops without allocating a third',async()=>{
    const next='72000000-0000-4000-8000-000000000001';
    const load=jest.fn().mockResolvedValueOnce(id).mockResolvedValueOnce(next),clear=jest.fn(async()=>{}),refresh=jest.fn(async()=>{});
    const send=jest.fn(async()=>{throw new HistoryTransferError('HISTORY_STALE');});
    await expect(runMergeJob({current:()=>true,load,send,refresh,clear})).rejects.toMatchObject({reason:'HISTORY_STALE'});
    expect(load).toHaveBeenCalledTimes(2);expect(send.mock.calls).toHaveLength(2);expect(clear.mock.calls).toEqual([[id],[next]]);expect(refresh).not.toHaveBeenCalled();
  });
  it('stops at owner fencing during stale retirement before loading or writing a new operation',async()=>{
    let current=true;const load=jest.fn(async()=>id),clear=jest.fn(async()=>{current=false;}),refresh=jest.fn(async()=>{});
    const send=jest.fn(async()=>{throw new HistoryTransferError('HISTORY_STALE');});
    await expect(runMergeJob({current:()=>current,load,send,refresh,clear})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(load).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(1);expect(clear).toHaveBeenCalledTimes(1);expect(refresh).not.toHaveBeenCalled();
  });
  it('does no merge storage or network work when already fenced',async()=>{
    const load=jest.fn(async()=>id),clear=jest.fn(async()=>{}),send=jest.fn(async()=>{}),refresh=jest.fn(async()=>{});
    await expect(runMergeJob({current:()=>false,load,send,refresh,clear})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(load).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();expect(clear).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled();
  });
});
