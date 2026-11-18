import { createAccountController } from '@/account/controller';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createAccountAuthAdapter, createAccountFetch } from '@/account/auth-adapter';
import { createClient, processLock } from '@supabase/supabase-js';

const session = { access_token:'PRIVATE_TOKEN',refresh_token:'PRIVATE_REFRESH',expires_at:Date.now()/1000+3600,user:{id:'owner',email_confirmed_at:'2026-10-28',is_anonymous:false} } as Session;
function setup() {
  let memory: Session|null=null;
  const auth={getSession:jest.fn(async()=>({data:{session:memory},error:null})),setSession:jest.fn(async()=>({data:{session},error:null})),getUser:jest.fn(async()=>({data:{user:session.user},error:null})),verifyOtp:jest.fn(async()=>{memory=session;return {data:{session},error:null};}),signInWithOtp:jest.fn(),signOut:jest.fn(async()=>({error:null}))};
  const storage={getItem:jest.fn(async()=>null as string|null),setItem:jest.fn(async()=>{}),removeItem:jest.fn(async()=>{})};
  return {auth,storage,adapter:createAccountAuthAdapter({auth} as unknown as SupabaseClient,storage)};
}
it('fences SDK memory after cancelled verification, even when reopened',async()=>{
  const {adapter,auth,storage}=setup();let finish!:()=>void;
  auth.verifyOtp.mockImplementation(()=>new Promise(resolve=>{finish=()=>resolve({data:{session},error:null});}));
  const pending=adapter.verifyOtp({email:'private@example.test',token:'123456',type:'email'});
  adapter.invalidate();finish();await pending;
  auth.getSession.mockResolvedValue({data:{session},error:null});
  expect((await adapter.getSession()).data.session).toBeNull();
  expect((await adapter.getUser()).data.user).toBeNull();expect(storage.setItem).not.toHaveBeenCalled();
});
it('does not expose a late restore after a fence',async()=>{
  const {adapter,storage,auth}=setup();storage.getItem.mockResolvedValue(JSON.stringify(session));
  let finish!:(value:Awaited<ReturnType<typeof auth.setSession>>)=>void;
  auth.setSession.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=adapter.getSession();await Promise.resolve();adapter.invalidate();finish({data:{session},error:null});
  expect((await pending).data.session).toBeNull();expect(storage.setItem).not.toHaveBeenCalled();
});
it('never hydrates anonymous credentials',async()=>{
  const {adapter,storage,auth}=setup();storage.getItem.mockResolvedValue(JSON.stringify({...session,user:{...session.user,is_anonymous:true}}));
  await expect(adapter.getSession()).rejects.toThrow('Account storage is unavailable.');expect(auth.setSession).not.toHaveBeenCalled();
});
it('keeps old SDK memory fenced after a fresh verification fails',async()=>{
  const {adapter,auth,storage}=setup();adapter.invalidate();
  auth.verifyOtp.mockResolvedValue({data:{session:null},error:{code:'otp_expired'}} as never);
  await adapter.verifyOtp({email:'synthetic@example.test',token:'123456',type:'email'});
  auth.getSession.mockResolvedValue({data:{session},error:null});
  expect((await adapter.getSession()).data.session).toBeNull();expect(storage.setItem).not.toHaveBeenCalled();
});
it('prevents the installed SDK fetch catch from logging a raw transport error',async()=>{
  const consoleError=jest.spyOn(console,'error').mockImplementation(()=>{});
  const transport=jest.fn(async()=>{throw new TypeError('PRIVATE_FETCH_TOKEN PRIVATE_LOCATION');});
  const client=createClient('https://account.example.test','synthetic-publishable-key',{global:{fetch:createAccountFetch(transport)},auth:{storageKey:'account-fetch-test',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,lock:(name,_timeout,work)=>processLock(name,-1,work)}});
  const result=await client.auth.signInWithOtp({email:'synthetic@example.test'});
  expect(result.error?.name).toBe('AuthRetryableFetchError');expect(consoleError).not.toHaveBeenCalled();
  expect(JSON.stringify(result.error)).not.toMatch(/PRIVATE_FETCH_TOKEN|PRIVATE_LOCATION/);consoleError.mockRestore();
});

it('integrates cancellation, late SDK memory and controller reopen without resurrection',async()=>{
  const {adapter,auth,storage}=setup();

  const fence={block:jest.fn(async()=>{}),allow:jest.fn(async()=>{}),removeItem:jest.fn(async()=>{})};
  const events=jest.fn();const controller=createAccountController(adapter,fence,events);
  auth.signInWithOtp.mockResolvedValue({error:null});await controller.requestCode('secret@example.test');
  let finish!:(value:Awaited<ReturnType<typeof auth.verifyOtp>>)=>void;
  auth.verifyOtp.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=controller.verifyCode('secret@example.test','123456');
  await new Promise(resolve=>setTimeout(resolve,0));controller.cancelPending();
  finish({data:{session},error:null});await pending;
  auth.getSession.mockResolvedValue({data:{session},error:null});await controller.restore();
  expect(controller.getSnapshot().signedIn).toBe(false);expect(storage.setItem).not.toHaveBeenCalled();
  expect(JSON.stringify(events.mock.calls)).not.toMatch(/PRIVATE_TOKEN|PRIVATE_REFRESH|secret@example/);
});
it('preserves protected write classification and redacts the native exception',async()=>{
  const {adapter,auth,storage}=setup();
  const events=jest.fn();const controller=createAccountController(adapter,{block:async()=>{},allow:async()=>{},removeItem:async()=>{}},events);
  auth.signInWithOtp.mockResolvedValue({error:null});await controller.requestCode('secret@example.test');
  storage.setItem.mockRejectedValue(new Error('PRIVATE_STORAGE_SECRET'));await controller.verifyCode('secret@example.test','123456');
  const terminal=events.mock.calls.at(-1)?.[0];
  expect(terminal).toMatchObject({operation:'ACCOUNT_VERIFY',stage:'ACCOUNT_SECURE_WRITE',reasonCode:'ACCOUNT_STORAGE',durableOutcome:'blocked'});
  const operation=events.mock.calls.map(([event])=>event).filter(event=>event.operation==='ACCOUNT_VERIFY');
  expect(new Set(operation.map(event=>event.correlationId)).size).toBe(1);
  expect(JSON.stringify([events.mock.calls,controller.getSnapshot()])).not.toMatch(/PRIVATE_STORAGE_SECRET|PRIVATE_TOKEN|PRIVATE_REFRESH|secret@example/);
});
