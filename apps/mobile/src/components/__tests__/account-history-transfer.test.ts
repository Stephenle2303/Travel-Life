import { createHistoryTransport, createTransferJob, currentHistoryStep, fetchHistorySnapshot, historyStatus, publishCurrentHistoryStatus, sendTransferJob, type TransferJob } from '@/account/history-transfer';

it('counts accepted restore pages and excludes a page rejected by validation',async()=>{
  const progress=jest.fn();
  const transport:Parameters<typeof fetchHistorySnapshot>[1]=async({input})=>({
    snapshotId:'snapshot',page:input.page,pages:2,schemaVersion:37,
    records:input.page===0?[]:[{kind:'raw',key:'synthetic',value:{}}],
  });
  await expect(fetchHistorySnapshot('snapshot',transport,()=>true,false,progress)).rejects.toThrow();
  expect(progress.mock.calls).toEqual([[1,2]]);
});

describe('resumable private history transfer',()=>{
  it.each([
    ['CONFIG','HISTORY_NETWORK',false],
    ['SESSION_READ','HISTORY_NETWORK',false],
    ['SESSION_UNAVAILABLE','HISTORY_NETWORK',false],
    ['REQUEST','HISTORY_NETWORK',false],
    ['RESPONSE_JSON','HISTORY_NETWORK',false],
    ['HTTP_AUTH','ACCOUNT_SESSION',false],
    ['HTTP_RETRY','HISTORY_NETWORK',false],
    ['HTTP_REJECT','HISTORY_NETWORK',false],
    ['RESPONSE_SHAPE','HISTORY_SCHEMA',false],
    ['RESPONSE_ERROR','HISTORY_CONSENT',true],
  ] as const)('distinguishes source-media %s without serializing private failures',async(stage,reason,definitive)=>{
    const secret='SYNTHETIC_PRIVATE_TRANSPORT_SENTINEL';
    const session=jest.fn(async()=>{
      if(stage==='SESSION_READ')throw new Error(secret);
      return stage==='SESSION_UNAVAILABLE'?null:{accessToken:secret,ownerId:'owner'};
    });
    const json=jest.fn(async()=>{
      if(stage==='RESPONSE_JSON'||stage==='HTTP_AUTH')throw new Error(secret);
      if(stage==='RESPONSE_SHAPE')return [secret];
      return stage==='RESPONSE_ERROR'?{error:'HISTORY_CONSENT',details:secret}:{message:secret};
    });
    const fetcher=jest.fn(async()=>{
      if(stage==='REQUEST')throw new Error(secret);
      return {ok:!stage.startsWith('HTTP_'),status:stage==='HTTP_AUTH'?401:stage==='HTTP_RETRY'?503:stage==='HTTP_REJECT'?400:200,json} as unknown as Response;
    });
    const transport=createHistoryTransport({url:stage==='CONFIG'?secret:'https://synthetic.example',key:'public',session,fetcher,fence:{owner:'owner',current:()=>true},correlationId:'runtime-mapping-fault'});
    const error=await transport({action:'source-media',input:{page:0}}).catch(value=>value);
    expect(error).toMatchObject({reason,definitive,boundary:`MEDIA_REPLAY_MAPPING_${stage}`});
    expect(JSON.stringify(error)).not.toContain(secret);expect(String(error)).not.toContain(secret);
    if(stage==='HTTP_AUTH')expect(json).not.toHaveBeenCalled();
    if(['CONFIG','SESSION_READ','SESSION_UNAVAILABLE'].includes(stage))expect(fetcher).not.toHaveBeenCalled();
    if(stage!=='CONFIG')expect(session).toHaveBeenCalledWith('runtime-mapping-fault');
    if(fetcher.mock.calls.length)expect(fetcher).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({headers:expect.objectContaining({'x-travel-life-correlation':'runtime-mapping-fault'})}));
  });
  it.each([401,403])('prioritizes source-media HTTP %s over even a SQL-timeout payload',async status=>{
    const json=jest.fn(async()=>({code:'57014',error:'HISTORY_READ_TIMEOUT'}));
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher:async()=>({ok:false,status,json}) as unknown as Response});
    await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:status===401?'ACCOUNT_SESSION':'ACCESS',boundary:status===401?'MEDIA_REPLAY_MAPPING_HTTP_AUTH':'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN'});expect(json).not.toHaveBeenCalled();
  });
  it.each(['malformed','valid'] as const)('keeps source-media 403 %s body out of session denial',async body=>{
    const json=jest.fn(async()=>{if(body==='malformed')throw new Error('SYNTHETIC_PRIVATE_BODY');return {error:'ACCOUNT_SESSION'};});
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher:async()=>({ok:false,status:403,json}) as unknown as Response});
    await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:'ACCESS',boundary:'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN'});expect(json).not.toHaveBeenCalled();
  });
  it.each([429,503])('preserves retryable HTTP %s for malformed, null and array bodies',async status=>{
    for(const body of ['reject','null','array'] as const){
      const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher:async()=>({ok:false,status,json:async()=>{if(body==='reject')throw new Error('SYNTHETIC_PRIVATE_BODY');return body==='null'?null:['SYNTHETIC_PRIVATE_BODY'];}}) as unknown as Response});
      const error=await transport({action:'source-media',input:{}}).catch(value=>value);
      expect(error).toMatchObject({reason:'HISTORY_NETWORK',boundary:'MEDIA_REPLAY_MAPPING_HTTP_RETRY'});expect(JSON.stringify(error)).not.toContain('SYNTHETIC_PRIVATE_BODY');
    }
  });
  it.each(['session','fetch','json'] as const)('fences delayed %s success and rejection after signout',async seam=>{
    for(const reject of [false,true]){
      let current=true;let enter!:()=>void;let release!:()=>void;
      const entered=new Promise<void>(resolve=>{enter=resolve;});const delayed=new Promise<void>(resolve=>{release=resolve;});
      const wait=async(where:string)=>{if(where===seam){enter();await delayed;if(reject)throw new Error('SYNTHETIC_PRIVATE_LATE');}};
      const json=jest.fn(async()=>{await wait('json');return {status:'complete'};});
      const fetcher=jest.fn(async()=>{await wait('fetch');return {ok:false,status:401,json} as unknown as Response;});
      // Only the fetch seam needs an auth response; JSON must actually be read.
      if(seam==='json')fetcher.mockImplementation(async()=>({ok:true,status:200,json}) as unknown as Response);
      const session=jest.fn(async()=>{await wait('session');return {accessToken:'private',ownerId:'owner'};});
      const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fetcher,fence:{owner:'owner',current:()=>current}});
      const pending=transport({action:'source-media',input:{}}).catch(value=>value);await entered;current=false;release();
      const error=await pending;expect(error).toMatchObject({reason:'HISTORY_FENCED'});expect(JSON.stringify(error)).not.toContain('SYNTHETIC_PRIVATE_LATE');
      if(seam==='session')expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it('fences source-media before asking for a session',async()=>{
    const session=jest.fn();const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fence:{owner:'owner',current:()=>false}});
    await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(session).not.toHaveBeenCalled();
  });
  it.each([429,500])('marks source-media HTTP %s as a retry boundary',async status=>{
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher:async()=>({ok:false,status,json:async()=>({})}) as Response});
    await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:'HISTORY_NETWORK',boundary:'MEDIA_REPLAY_MAPPING_HTTP_RETRY'});
  });
  it('keeps source-media unavailable session owner fencing and non-media rejected-session behavior',async()=>{
    const fetcher=jest.fn();
    for(const current of [true,false]){
      const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>null,fetcher,fence:{owner:'owner',current:()=>current}});
      await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:current?'HISTORY_NETWORK':'HISTORY_FENCED',boundary:'MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'});
    }
    const rejected=new Error('synthetic non-media rejection');
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>{throw rejected;},fetcher});
    await expect(transport({action:'status',input:{}})).rejects.toBe(rejected);expect(fetcher).not.toHaveBeenCalled();
  });
  it('recovers source-media from one transient verification miss using only a freshly verified token',async()=>{
    const session=jest.fn<Promise<{accessToken:string;ownerId:string}|null>,[string?]>().mockResolvedValueOnce(null).mockResolvedValueOnce({accessToken:'fresh-token',ownerId:'owner'});
    const fetcher=jest.fn(async()=>({ok:true,status:200,json:async()=>({status:'complete'})}) as Response);
    const timer=jest.spyOn(global,'setTimeout');
    try{
      const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fetcher,fence:{owner:'owner',current:()=>true},correlationId:'runtime-session-recovery'});
      await expect(transport({action:'source-media',input:{}})).resolves.toEqual({status:'complete'});
      expect(session.mock.calls).toEqual([['runtime-session-recovery'],['runtime-session-recovery']]);expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({headers:expect.objectContaining({authorization:'Bearer fresh-token','x-travel-life-correlation':'runtime-session-recovery'})}));
      expect(timer).toHaveBeenCalledTimes(1);expect(timer).toHaveBeenCalledWith(expect.any(Function),30_000);
    }finally{timer.mockRestore();}
  });
  it('bounds source-media verification recovery to two reads and no request when both are unavailable',async()=>{
    const session=jest.fn(async()=>null);const fetcher=jest.fn();
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fetcher,fence:{owner:'owner',current:()=>true}});
    await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:'HISTORY_NETWORK',boundary:'MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'});
    expect(session).toHaveBeenCalledTimes(2);expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['before-retry','during-retry'] as const)('fences source-media signout %s without sending',async when=>{
    let current=true;let reads=0;const fetcher=jest.fn();
    const session=jest.fn(async()=>{
      reads++;
      if(when==='before-retry'||reads===2)current=false;
      return reads===1?null:{accessToken:'synthetic-token',ownerId:'owner'};
    });
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fetcher,fence:{owner:'owner',current:()=>current}});
    await expect(transport({action:'source-media',input:{}})).rejects.toMatchObject({reason:'HISTORY_FENCED',boundary:'MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'});
    expect(session).toHaveBeenCalledTimes(when==='before-retry'?1:2);expect(fetcher).not.toHaveBeenCalled();
  });
  it('never retries wrong-owner verification or a rejected provider',async()=>{
    const fetcher=jest.fn();
    for(const rejects of [false,true]){
      const session=jest.fn(async()=>{if(rejects)throw new Error('SYNTHETIC_PRIVATE_SESSION_SENTINEL');return {accessToken:'synthetic-token',ownerId:'another-owner'};});
      const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fetcher,fence:{owner:'owner',current:()=>true}});
      const error=await transport({action:'source-media',input:{}}).catch(value=>value);
      expect(error).toMatchObject({reason:rejects?'HISTORY_NETWORK':'HISTORY_FENCED',boundary:rejects?'MEDIA_REPLAY_MAPPING_SESSION_READ':'MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'});
      expect(session).toHaveBeenCalledTimes(1);expect(fetcher).not.toHaveBeenCalled();expect(JSON.stringify(error)).not.toContain('SYNTHETIC_PRIVATE_SESSION_SENTINEL');
    }
  });
  it.each([false,true])('does not retry absent verification for non-mapping reads (fence=%s)',async fenced=>{
    const session=jest.fn(async()=>null);const fetcher=jest.fn();
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session,fetcher,...(fenced?{fence:{owner:'owner',current:()=>true}}:{})});
    await expect(transport({action:'status',input:{}})).rejects.toMatchObject({reason:fenced?'HISTORY_NETWORK':'ACCOUNT_SESSION',boundary:undefined});
    expect(session).toHaveBeenCalledTimes(1);expect(fetcher).not.toHaveBeenCalled();
  });
  it('classifies source-media SQL timeout at the exact read boundary with unchanged budgets and redaction',async()=>{
    const timer=jest.spyOn(global,'setTimeout');
    const fetcher=jest.fn(async()=>({ok:false,status:500,json:async()=>({code:'57014',message:'PRIVATE_SQL_SENTINEL',details:'PRIVATE_SQL_SENTINEL'})} as Response));
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher});
    try{const error=await transport({action:'source-media',input:{installationId:'synthetic',page:0}}).catch(value=>value);
      expect(error).toMatchObject({reason:'HISTORY_READ_TIMEOUT',boundary:'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT',definitive:false});expect(JSON.stringify(error)).not.toContain('PRIVATE_SQL_SENTINEL');
      expect(timer).toHaveBeenLastCalledWith(expect.any(Function),30_000);
    }finally{timer.mockRestore();}
  });
  it('distinguishes the explicit source-media client deadline without claiming server rollback',async()=>{
    jest.useFakeTimers();
    const fetcher=jest.fn(async(_url:string|URL|Request,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('PRIVATE_DEADLINE_SENTINEL')),{once:true});}));
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher});
    try{const pending=transport({action:'source-media',input:{installationId:'synthetic',page:0}}).catch(value=>value);await jest.advanceTimersByTimeAsync(30_000);
      const error=await pending;expect(error).toMatchObject({reason:'HISTORY_READ_TIMEOUT',boundary:'MEDIA_REPLAY_MAPPING_DEADLINE',definitive:false});expect(JSON.stringify(error)).not.toContain('PRIVATE_DEADLINE_SENTINEL');
    }finally{jest.useRealTimers();}
  });
  it.each(['reject','null'] as const)('retains own deadline while parsing a retryable HTTP body (%s)',async body=>{
    jest.useFakeTimers();
    const fetcher=jest.fn(async(_url:string|URL|Request,init?:RequestInit)=>({ok:false,status:503,json:()=>new Promise((resolve,reject)=>{init?.signal?.addEventListener('abort',()=>{if(body==='reject')reject(new Error('SYNTHETIC_PRIVATE_JSON'));else resolve(null);},{once:true});})}) as unknown as Response);
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher});
    try{
      const pending=transport({action:'source-media',input:{}}).catch(value=>value);await jest.advanceTimersByTimeAsync(30_000);
      const error=await pending;expect(error).toMatchObject({reason:'HISTORY_READ_TIMEOUT',boundary:'MEDIA_REPLAY_MAPPING_DEADLINE',definitive:false});expect(JSON.stringify(error)).not.toContain('SYNTHETIC_PRIVATE_JSON');
    }finally{jest.useRealTimers();}
  });
  it('bounds only aggregate readback and classifies SQL cancellation without exposing its payload',async()=>{
    const timer=jest.spyOn(global,'setTimeout');
    const fetcher=jest.fn(async(_url:string|URL|Request,_init?:RequestInit)=>({ok:false,status:500,json:async()=>({code:'57014',message:'PRIVATE_SENTINEL',details:'PRIVATE_SENTINEL'})} as Response));
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'private'}),fetcher,correlationId:'runtime-synthetic-1'});
    try{
      const error=await transport({action:'pull',input:{aggregateId:'aggregate',page:0}}).catch(value=>value);
      expect(error).toMatchObject({reason:'HISTORY_READ_TIMEOUT',definitive:false});expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');
      expect(fetcher.mock.calls[0][0]).toBe('https://synthetic.example/rest/v1/rpc/travel_life_history_read');
      expect(timer).toHaveBeenLastCalledWith(expect.any(Function),65_000);
      await expect(transport({action:'pull',input:{snapshotId:'snapshot',page:0}})).rejects.toMatchObject({reason:'HISTORY_NETWORK'});
      expect(fetcher.mock.calls[1][0]).toBe('https://synthetic.example/rest/v1/rpc/travel_life_history');
      expect(timer).toHaveBeenLastCalledWith(expect.any(Function),30_000);
    }finally{timer.mockRestore();}
  });
  it('routes only final activation to its bounded RPC and preserves request identity/correlation',async()=>{
    const timer=jest.spyOn(global,'setTimeout');
    const fetcher=jest.fn(async(_url:string|URL|Request,_init?:RequestInit)=>({ok:true,status:200,json:async()=>({status:'initial'})} as Response));
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'PRIVATE_AUTH'}),fetcher,correlationId:'runtime-synthetic-1'});
    const request={action:'activate',input:{mutationId:'same-mutation',snapshotId:'same-snapshot'}};
    try {
      await transport(request);
      expect(fetcher.mock.calls[0][0]).toBe('https://synthetic.example/rest/v1/rpc/travel_life_history_finalize');
      expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(request);
      expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({'x-travel-life-correlation':'runtime-synthetic-1'});
      expect(timer).toHaveBeenLastCalledWith(expect.any(Function),65_000);
      await transport({action:'status',input:{}});
      expect(fetcher.mock.calls[1][0]).toBe('https://synthetic.example/rest/v1/rpc/travel_life_history');
      expect(timer).toHaveBeenLastCalledWith(expect.any(Function),30_000);
    } finally {timer.mockRestore();}
  });
  it('retains the exact prior checkpoint when a held acknowledgement arrives after sign-out',async()=>{
    let current=true;let release!:(value:{status:string})=>void;let sequence=0;
    const job=createTransferJob({ownerId:'owner',sourceId:'source',sourceGeneration:1,generation:1,rows:[],uuid:()=>String(++sequence)});
    const checkpoint=jest.fn(async()=>{});const progress=jest.fn();
    const pending=sendTransferJob(job,{transport:()=>new Promise(resolve=>{release=resolve;}),checkpoint,current:()=>current,progress});
    await Promise.resolve();await Promise.resolve();current=false;release({status:'staging'});
    await expect(pending).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(checkpoint).toHaveBeenCalledTimes(1);expect(checkpoint).toHaveBeenCalledWith(job);expect(progress).not.toHaveBeenCalled();
  });
  it('does not publish progress after a durable checkpoint finishes in a stale context',async()=>{
    let current=true;let saves=0;
    const job=createTransferJob({ownerId:'owner',sourceId:'source',sourceGeneration:1,generation:1,rows:[],uuid:()=> 'uuid'});
    const progress=jest.fn();const transport=jest.fn(async()=>({status:'staging'}));
    await expect(sendTransferJob(job,{transport,checkpoint:async()=>{if(++saves===2)current=false;},current:()=>current,progress})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(transport).toHaveBeenCalledTimes(1);expect(progress).not.toHaveBeenCalled();
  });
  it('fences delayed source registration before export or checkpoint',async()=>{
    let current=true;let release!:(value:string)=>void;const exportHistory=jest.fn();
    const operation=(async()=>{await currentHistoryStep(()=>current,()=>new Promise<string>(resolve=>{release=resolve;}));exportHistory();})();
    current=false;release('source');await expect(operation).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(exportHistory).not.toHaveBeenCalled();
  });
  it('does not publish a previous owner status after an awaited read and sign-out',async()=>{
    let release!:(value:string)=>void;let current=true;const publish=jest.fn();
    const pending=publishCurrentHistoryStatus(()=>new Promise<string>(resolve=>{release=resolve;}),()=>current,publish);
    current=false;release('PRIVATE_SENTINEL');
    const error=await pending.catch(value=>value);
    expect(error).toMatchObject({reason:'HISTORY_FENCED'});expect(publish).not.toHaveBeenCalled();expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');
  });
  it('validates status identities, source states and aggregate bounds without leaking values',()=>{
    const source='40000000-0000-4000-8000-000000000001';const aggregate='70000000-0000-4000-8000-000000000001';
    const status={status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[{sourceId:source,generation:1,state:'active',lastUpdatedAt:null}],activeAggregate:aggregate,aggregateRevision:1,aggregatePages:1};
    expect(historyStatus(status).activeAggregate).toBe(aggregate);
    const retained=Array.from({length:101},(_,i)=>({...status.sources[0],sourceId:`40000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,state:'disconnected'}));
    expect(historyStatus({...status,sources:retained}).sources).toHaveLength(101);
    for(const bad of [{...status,activeAggregate:'PRIVATE_SENTINEL'},{...status,aggregatePages:0},{...status,sources:[...status.sources,...status.sources]},{...status,sources:[{...status.sources[0],state:'PRIVATE_SENTINEL'}]}]){
      try{historyStatus(bad);throw new Error('unexpected success');}catch(error){expect(error).toMatchObject({reason:'HISTORY_SCHEMA',message:'Private history transfer did not finish.'});expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL');}
    }
  });
  it('persists immutable request identities before send and resumes unknown acknowledgements',async()=>{
    let sequence=0;
    const job=createTransferJob({ownerId:'owner',sourceId:'source',sourceGeneration:1,generation:1,rows:[],uuid:()=>String(++sequence)});
    let saved:TransferJob|null=null; let fail=true; const accepted=new Set<string>(); const calls:string[]=[];
    const checkpoint=async(value:TransferJob)=>{saved=value;};
    const transport=jest.fn(async(request:TransferJob['requests'][number])=>{
      expect(saved).not.toBeNull();const id=String(request.input.mutationId);calls.push(id);accepted.add(id);
      if(request.action==='page'&&fail){fail=false;throw new TypeError('PRIVATE_NETWORK');}
      return {status:request.action==='begin'?'staging':request.action==='activate'?'initial':'complete'};
    });
    await expect(sendTransferJob(job,{transport,checkpoint,current:()=>true,progress:()=>{}})).rejects.toThrow();
    await sendTransferJob(saved!,{transport,checkpoint,current:()=>true,progress:()=>{}});
    expect(accepted.size).toBe(3);expect(calls).toEqual(['2','3','3','4']);
  });
  it('rejects stale work before network and rejects malformed restore records',async()=>{
    const job=createTransferJob({ownerId:'owner',sourceId:'source',sourceGeneration:1,generation:1,rows:[],uuid:()=> 'uuid'});
    const transport=jest.fn();
    const checkpoint=jest.fn(async()=>{});
    await expect(sendTransferJob(job,{transport,checkpoint,current:()=>false,progress:()=>{}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
    expect(checkpoint).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
    await expect(fetchHistorySnapshot('snapshot',async()=>({snapshotId:'snapshot',page:0,pages:1,schemaVersion:37,records:[{kind:'raw',key:'x',value:{}}]}),()=>true)).rejects.toThrow();
  });
  it('never propagates a raw server error or sends a request without verified auth',async()=>{
    const fetcher=jest.fn(async()=>({ok:false,status:500,json:async()=>({message:'PRIVATE_SERVER_TOKEN',error:'PRIVATE_COORDINATE'})} as Response));
    const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'PRIVATE_AUTH'}),fetcher});
    await expect(transport({action:'status',input:{}})).rejects.toMatchObject({reason:'HISTORY_SCHEMA',message:'Private history transfer did not finish.'});
    const unauth=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>null,fetcher});
    await expect(unauth({action:'status',input:{}})).rejects.toMatchObject({reason:'ACCOUNT_SESSION'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not send one owner history with a different owner token',async()=>{
    const fetcher=jest.fn();const transport=createHistoryTransport({url:'https://synthetic.example',key:'public',session:async()=>({accessToken:'PRIVATE_TOKEN',ownerId:'owner-b'}),fence:{owner:'owner-a',current:()=>true},fetcher});
    await expect(transport({action:'status',input:{}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(fetcher).not.toHaveBeenCalled();
  });
});
