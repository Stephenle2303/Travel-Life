import { createMediaTransport } from '@/account/media-transport';

const owner='80000000-0000-4000-8000-000000000001';
const target={kind:'evidence' as const,id:owner};
const manifest={contractVersion:'travel-life-private-media-v1',kind:'photo',mimeType:'image/jpeg',byteLength:2,sha256:'a'.repeat(64),width:1,height:1,durationMillis:null};
const authorized={status:'complete',artifactId:owner,revision:1,manifest,url:'https://synthetic.invalid/storage/v1/object/sign/private/file?token=secret',expiresInSeconds:300};
const response=(value:unknown)=>({ok:true,status:200,json:async()=>value}) as Response;
function setup(fetcher:jest.Mock,current=()=>true,session=async()=>({ownerId:owner,accessToken:'synthetic-secret'})){
 return createMediaTransport({enabled:true,url:'https://synthetic.invalid',key:'synthetic-key',session,fetcher,current,owner});
}
it('authorizes the exact target with the action correlation',async()=>{
 const fetcher=jest.fn(async(_url:string,_init:RequestInit)=>response(authorized));
 await expect(setup(fetcher).authorize(target,'local_123')).resolves.toMatchObject({revision:1});
 const init=fetcher.mock.calls[0]![1] as RequestInit;
 expect(JSON.parse(String(init.body))).toEqual({action:'download',target});
 expect(init.headers).toMatchObject({'x-travel-life-correlation':'local_123'});
});
it.each(['complete','active'])('admits %s activation for the persisted artifact and revision envelope',async status=>{
 const fetcher=jest.fn(async(_url:string,_init:RequestInit)=>response({status,artifactId:owner,...(status==='complete'?{revision:4}:{})}));
 const input={action:'activate',mutationId:owner,artifactId:owner,expectedRevision:3};
 await expect(setup(fetcher).send(input,'local_activation')).resolves.toMatchObject({status,artifactId:owner});
 const init=fetcher.mock.calls[0]![1];expect(JSON.parse(String(init.body))).toEqual(input);expect(init.headers).toMatchObject({'x-travel-life-correlation':'local_activation'});
});
it.each([{status:'complete',artifactId:owner,revision:0},{status:'complete',artifactId:owner,revision:2},{status:'complete',artifactId:owner,revision:'1'},{status:'complete',artifactId:owner},{status:'complete',artifactId:'PRIVATE_RECEIPT_SENTINEL',revision:1},{status:'active',artifactId:'PRIVATE_RECEIPT_SENTINEL'}])('rejects mismatched activation acknowledgement %#',async value=>{
 const fetcher=jest.fn(async()=>response(value));const error=await setup(fetcher).send({action:'activate',mutationId:owner,artifactId:owner,expectedRevision:0},'local_activation').catch(value=>value);
 expect(error).toMatchObject({reason:'MEDIA_SCHEMA',boundary:'MEDIA_ACTIVATE'});expect(JSON.stringify(error)).not.toContain('PRIVATE_RECEIPT_SENTINEL');
});
it('does not send a token after owner switch during token retrieval',async()=>{
 let current=true;const fetcher=jest.fn();
 const transport=setup(fetcher,()=>current,async()=>{current=false;return {ownerId:owner,accessToken:'synthetic-secret'};});
 await expect(transport.authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_ACCESS'});
 expect(fetcher).not.toHaveBeenCalled();
});
it('rejects mismatched media kind and signed URL destination',async()=>{
 const fetcher=jest.fn(async()=>response({...authorized,url:'https://other.invalid/object'}));
 await expect(setup(fetcher).authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_VERIFY'});
 fetcher.mockImplementation(async()=>response(authorized));
 await expect(setup(fetcher).authorize({kind:'soundtrack',revision:'track-1'},'local_123')).rejects.toMatchObject({reason:'MEDIA_VERIFY'});
});
it('bounds downloaded bytes and strips opaque network errors',async()=>{
 const fetcher=jest.fn(async()=>({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}) as unknown as Response);
 await expect(setup(fetcher).download(authorized.url,2)).rejects.toMatchObject({reason:'MEDIA_VERIFY'});
 fetcher.mockImplementation(async()=>{throw new Error('private-sentinel-token');});
 await expect(setup(fetcher).authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_NETWORK',message:'Account media is unavailable.'});
});
it('invalidates only an explicit current session denial, preserving transient and scope failures',async()=>{
 const invalidateSession=jest.fn(async()=>{});
 const fetcher=jest.fn(async()=>({...response({error:'ACCOUNT_SESSION'}),ok:false,status:401}));
 const transport=createMediaTransport({enabled:true,url:'https://synthetic.invalid',key:'synthetic-key',session:async()=>({ownerId:owner,accessToken:'synthetic-token'}),fetcher,current:()=>true,owner,invalidateSession});
 await expect(transport.authorize(target,'local_123')).rejects.toMatchObject({reason:'ACCOUNT_SESSION',boundary:'MEDIA_SERVICE_AUTH'});
 expect(invalidateSession).toHaveBeenCalledTimes(1);
 fetcher.mockImplementation(async()=>({...response({error:'MEDIA_CONSENT'}),ok:false,status:409}));
 await expect(transport.authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_CONSENT'});
 expect(invalidateSession).toHaveBeenCalledTimes(1);
});

it.each([
 [503,undefined,'MEDIA_NETWORK','MEDIA_SERVICE_HTTP_RETRY'],
 [429,null,'MEDIA_NETWORK','MEDIA_SERVICE_HTTP_RETRY'],
 [503,{error:'MEDIA_NETWORK'},'MEDIA_NETWORK','MEDIA_SERVICE_HTTP_RETRY'],
 [503,{code:'BOOT_ERROR'},'MEDIA_NETWORK','MEDIA_SERVICE_BOOT'],
 [503,{code:'WORKER_ERROR'},'MEDIA_NETWORK','MEDIA_SERVICE_WORKER_ERROR'],
 [546,{code:'WORKER_LIMIT'},'MEDIA_NETWORK','MEDIA_SERVICE_WORKER_LIMIT'],
 [503,{message:'BOOT_ERROR'},'MEDIA_NETWORK','MEDIA_SERVICE_HTTP_RETRY'],
 [403,undefined,'MEDIA_ACCESS','MEDIA_SERVICE_AUTH'],
 [400,{error:'PRIVATE_RESPONSE'},'MEDIA_NETWORK','MEDIA_SERVICE_HTTP_REJECT'],
 [400,undefined,'MEDIA_NETWORK','MEDIA_SERVICE_HTTP_REJECT'],
 [409,{error:['MEDIA_CONFLICT']},'MEDIA_SCHEMA','MEDIA_SERVICE_SCHEMA'],
 [409,{error:{toString:'PRIVATE_RESPONSE'}},'MEDIA_SCHEMA','MEDIA_SERVICE_SCHEMA'],
 [409,{error:'MEDIA_BUSY'},'ALREADY_RUNNING','MEDIA_SERVICE_UPLOAD_LEASE'],
 [200,undefined,'MEDIA_NETWORK','MEDIA_SERVICE_RESPONSE_JSON'],
 [200,null,'MEDIA_SCHEMA','MEDIA_SERVICE_SCHEMA'],
] as const)('classifies service HTTP %s (%#)',async(status,value,reason,boundary)=>{
 const fetcher=jest.fn(async()=>({ok:status===200,status,json:async()=>{if(value===undefined)throw new Error('PRIVATE_RESPONSE');return value;}}));
 const error=await setup(fetcher).authorize(target,'local_123').catch(error=>error);
 expect(error).toMatchObject({reason,boundary});
 expect(JSON.stringify(error)).not.toContain('PRIVATE_RESPONSE');
});

it('distinguishes session-read and fetch rejection, with owner loss taking precedence',async()=>{
 let current=true;
 const fetcher=jest.fn(async()=>{throw new Error('PRIVATE_REQUEST');});
 await expect(setup(fetcher,()=>current,async()=>{throw new Error('PRIVATE_SESSION');}).authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_NETWORK',boundary:'MEDIA_SERVICE_SESSION'});
 expect(fetcher).not.toHaveBeenCalled();
 await expect(setup(fetcher).authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_NETWORK',boundary:'MEDIA_SERVICE_REQUEST'});
 fetcher.mockImplementationOnce(async()=>{current=false;throw new Error('PRIVATE_REQUEST');});
 await expect(setup(fetcher,()=>current).authorize(target,'local_123')).rejects.toMatchObject({reason:'MEDIA_ACCESS',boundary:'MEDIA_SERVICE_REQUEST'});
});

it('classifies its own deadline without returning a late success',async()=>{
 jest.useFakeTimers();
 try{
  let complete!: (value:Response)=>void;
  const transport=setup(jest.fn(async()=>new Promise<Response>(resolve=>{complete=resolve;})));
  const request=transport.authorize(target,'local_123').catch(error=>error);
  await jest.advanceTimersByTimeAsync(30_000);
  complete(response(authorized));
  await expect(request).resolves.toMatchObject({reason:'MEDIA_NETWORK',boundary:'MEDIA_SERVICE_DEADLINE'});
 }finally{jest.useRealTimers();}
});
it('classifies verified-session deadline before sending any request',async()=>{
 jest.useFakeTimers();
 try{
  let complete!: (value:{ownerId:string;accessToken:string})=>void;
  const fetcher=jest.fn();
  const transport=setup(fetcher,()=>true,()=>new Promise(resolve=>{complete=resolve;}));
  const request=transport.authorize(target,'local_123').catch(error=>error);
  await jest.advanceTimersByTimeAsync(30_000);
  complete({ownerId:owner,accessToken:'PRIVATE_SESSION_TOKEN'});
  const error=await request;
  expect(error).toMatchObject({reason:'MEDIA_NETWORK',boundary:'MEDIA_SERVICE_SESSION_DEADLINE'});
  expect(JSON.stringify(error)).not.toContain('PRIVATE_SESSION_TOKEN');
  expect(fetcher).not.toHaveBeenCalled();
 }finally{jest.useRealTimers();}
});
