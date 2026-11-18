import { createAccountMediaAdapter, currentAccountMediaScope } from '@/account/media-adapter';
const id='80000000-0000-4000-8000-000000000001';
it('denies final account-media authority after consent withdrawal or aggregate change',()=>{
 const status={status:'active' as const,generation:1,revision:1,historyConsent:true,mediaConsent:true,activeSnapshot:null,activeAggregate:id,sources:[]};
 expect(currentAccountMediaScope(status,id)).toBe(true);
 expect(currentAccountMediaScope({...status,mediaConsent:false},id)).toBe(false);
 expect(currentAccountMediaScope({...status,activeAggregate:'new-snapshot'},id)).toBe(false);
 expect(currentAccountMediaScope({...status,status:'deleted'},id)).toBe(false);
});
it('resolves canonical account evidence only, in exact caller order',async()=>{
 const resolve=jest.fn(async()=>({uri:'file:///private',kind:'video' as const}));const onResolved=jest.fn();
 const adapter=createAccountMediaAdapter({current:()=>true,authorized:async()=>true,resolve});
 const previews=await adapter.resolveOwnerPreviews!(['native-private-ref',`account:${id}`,null],3,onResolved);
 expect(resolve).toHaveBeenCalledTimes(1);expect(resolve).toHaveBeenCalledWith({kind:'evidence',id});
 expect(previews.map(preview=>preview.availability)).toEqual(['unavailable','available','unavailable']);
 expect(onResolved.mock.calls.map(call=>call[1])).toEqual([0,1,2]);
});
it('preserves the exact custom soundtrack revision and never falls back',async()=>{
 const resolve=jest.fn(async()=>({uri:'file:///private-audio',kind:'audio' as const}));
 const adapter=createAccountMediaAdapter({current:()=>true,authorized:async()=>true,resolve});
 await expect(adapter.resolveReplaySoundtrack!({kind:'custom',revision:'chosen-track',localUri:''})).resolves.toEqual({kind:'custom',revision:'chosen-track',localUri:'file:///private-audio'});
 expect(resolve).toHaveBeenCalledWith({kind:'soundtrack',revision:'chosen-track'});
 resolve.mockRejectedValue(new Error('private-sentinel'));
 await expect(adapter.resolveReplaySoundtrack!({kind:'custom',revision:'chosen-track',localUri:''})).rejects.toThrow();
 expect(resolve).toHaveBeenCalledTimes(2);
});
it('loads three previews concurrently and publishes them in caller order', async () => {
 const ids = [1, 2, 3, 4].map(number => `80000000-0000-4000-8000-00000000000${number}`);
 const finish: (() => void)[] = [];
 const resolve = jest.fn(() => new Promise<{uri:string;kind:'photo'}>(done => {
  const index = finish.length;
  finish.push(() => done({uri:`file:///preview-${index}`,kind:'photo'}));
 }));
 const onResolved = jest.fn();
 const adapter = createAccountMediaAdapter({current:()=>true,authorized:async()=>true,resolve});
 const pending = adapter.resolveOwnerPreviews!(ids.map(value => `account:${value}`), ids.length, onResolved);
 expect(resolve).toHaveBeenCalledTimes(3);
 finish[2]!();
 await Promise.resolve();
 expect(resolve).toHaveBeenCalledTimes(4);
 expect(onResolved).not.toHaveBeenCalled();
 finish[3]!();
 finish[1]!();
 finish[0]!();
 expect((await pending).map(preview => preview.uri)).toEqual(ids.map((_, index) => `file:///preview-${index}`));
 expect(onResolved.mock.calls.map(call => call[1])).toEqual([0, 1, 2, 3]);
});
it('fences callbacks and source permission when the context changes',async()=>{
 let current=true;const onResolved=jest.fn();
 const adapter=createAccountMediaAdapter({current:()=>current,authorized:async()=>true,resolve:async()=>{current=false;return {uri:'file:///private',kind:'photo'};}});
 await expect(adapter.resolveOwnerPreviews!([`account:${id}`],1,onResolved)).rejects.toMatchObject({reason:'MEDIA_ACCESS'});
 expect(onResolved).not.toHaveBeenCalled();expect(await adapter.accountAuthorized!()).toBe(false);
});
