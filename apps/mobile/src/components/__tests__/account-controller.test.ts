import { createAccountController, type AccountAuth } from '@/account/controller';
import type { Session } from '@supabase/supabase-js';

const session = { access_token:'PRIVATE_TOKEN', expires_at:Date.now()/1000+3600, user:{id:'owner-a',is_anonymous:false,email_confirmed_at:'2026-10-28'} } as Session;
function setup() {
  const auth = { invalidate:jest.fn(), getSession:jest.fn(async()=>({data:{session:null as Session|null},error:null})), getUser:jest.fn(async()=>({data:{user:session.user},error:null})), signInWithOtp:jest.fn(async()=>({error:null as unknown})), verifyOtp:jest.fn(async()=>({data:{session},error:null as unknown})),signOut:jest.fn(async()=>({error:null as unknown})),startAutoRefresh:jest.fn(),stopAutoRefresh:jest.fn() } satisfies AccountAuth;
  const storage={block:jest.fn(async()=>{}),allow:jest.fn(async()=>{}),removeItem:jest.fn(async()=>{})};
  const sink=jest.fn(); const controller=createAccountController(auth,storage,sink);
  return {auth,storage,sink,controller};
}
describe('optional private email account',()=>{
  it('preserves the authenticated owner across a screen remount restore and cleanup',async()=>{
    const {controller,auth,storage,sink}=setup();auth.getSession.mockResolvedValue({data:{session},error:null});await controller.restore();
    const owners:(string|null)[]=[];let cancelled=false;
    const unsubscribe=controller.subscribe(()=>{owners.push(controller.getLocalOwner());if(!controller.getLocalOwner()&&!cancelled){cancelled=true;controller.cancelPending();}});
    await controller.restore();unsubscribe();
    expect(controller.getLocalOwner()).toBe('owner-a');expect(owners).not.toContain(null);
    expect(auth.getSession).toHaveBeenCalledTimes(1);expect(storage.block).not.toHaveBeenCalled();expect(auth.invalidate).not.toHaveBeenCalled();
    expect(sink.mock.calls.at(-1)![0]).toMatchObject({operation:'ACCOUNT_RESTORE',stage:'ACCOUNT_SESSION',reasonCode:'SKIPPED',durableOutcome:'skipped'});
    expect(JSON.stringify(sink.mock.calls)).not.toContain('PRIVATE_TOKEN');controller.dispose();
  });
  it('coalesces queued bootstrap restores without publishing a second owner loss',async()=>{
    const {controller,auth,storage,sink}=setup();
    let release!:(value:Awaited<ReturnType<typeof auth.getSession>>)=>void;
    auth.getSession.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const owners:(string|null)[]=[];controller.subscribe(()=>owners.push(controller.getLocalOwner()));
    const first=controller.restore();await Promise.resolve();const second=controller.restore();
    release({data:{session},error:null});await Promise.all([first,second]);
    expect(controller.getLocalOwner()).toBe('owner-a');expect(auth.getSession).toHaveBeenCalledTimes(1);expect(storage.block).not.toHaveBeenCalled();
    expect(owners.slice(owners.indexOf('owner-a'))).not.toContain(null);
    const terminal=sink.mock.calls.map(call=>call[0]).filter(event=>event.reasonCode!=='START');
    expect(terminal.map(event=>event.reasonCode)).toEqual(['COMPLETE','SKIPPED']);controller.dispose();
  });
  it.each([
    {name:'AuthSessionMissingError'},
    {code:'session_expired'},
    {code:'refresh_token_not_found'},
    {code:'refresh_token_already_used'},
    {code:'bad_jwt'},
    {code:'user_not_found'},
    {code:'user_banned'},
  ])('locks observed provider session denial %j before any later grant',async denial=>{
    const {controller,auth,storage,sink}=setup();
    auth.getSession.mockResolvedValue({data:{session},error:null});await controller.restore();
    auth.getUser.mockResolvedValue({data:{user:session.user},error:{...denial,message:'PRIVATE_TOKEN PRIVATE_LOCATION'}} as never);
    expect(await controller.getVerifiedSession()).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({status:'blocked',signedIn:false,reason:'ACCOUNT_SESSION'});
    expect(controller.getLocalOwner()).toBeNull();expect(auth.invalidate).toHaveBeenCalled();expect(storage.block).toHaveBeenCalled();
    expect(await controller.getVerifiedSession()).toBeNull();expect(auth.getUser).toHaveBeenCalledTimes(1);
    const terminal=sink.mock.calls.at(-1)![0];
    expect(terminal).toMatchObject({operation:'ACCOUNT_REFRESH',stage:'ACCOUNT_SESSION',reasonCode:'ACCOUNT_SESSION',durableOutcome:'blocked'});
    expect(terminal.correlationId).toBe(sink.mock.calls.at(-2)![0].correlationId);
    expect(JSON.stringify([sink.mock.calls,controller.getSnapshot()])).not.toMatch(/PRIVATE_TOKEN|PRIVATE_LOCATION/);
  });
  it('retains unlocked offline identity on a retryable validation network failure',async()=>{
    const {controller,auth,storage}=setup();auth.getSession.mockResolvedValue({data:{session},error:null});await controller.restore();
    auth.getUser.mockRejectedValue(new TypeError('PRIVATE_NETWORK'));
    expect(await controller.getVerifiedSession()).toBeNull();expect(controller.getLocalOwner()).toBe('owner-a');expect(storage.block).not.toHaveBeenCalled();
  });
  it('locks immediately and classifies a failed durable denial block without exposing its cause',async()=>{
    const {controller,auth,storage,sink}=setup();auth.getSession.mockResolvedValue({data:{session},error:null});await controller.restore();
    auth.getUser.mockResolvedValue({data:{user:session.user},error:{name:'AuthSessionMissingError'}} as never);
    storage.block.mockRejectedValue(new Error('PRIVATE_STORAGE'));
    expect(await controller.getVerifiedSession()).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({signedIn:false,reason:'ACCOUNT_STORAGE'});
    expect(sink.mock.calls.at(-1)![0]).toMatchObject({stage:'ACCOUNT_SECURE_DELETE',reasonCode:'ACCOUNT_STORAGE',durableOutcome:'blocked'});
    expect(JSON.stringify(sink.mock.calls)).not.toContain('PRIVATE_STORAGE');
  });
  it.each([null,{...session,user:{...session.user,is_anonymous:true}},{...session,user:{...session.user,id:'other-owner'}}])('denies missing or changed refresh identity',async(next)=>{
    jest.useFakeTimers();const {controller,auth}=setup();
    auth.getSession.mockResolvedValueOnce({data:{session:{...session,expires_at:Date.now()/1000+60}},error:null});
    await controller.restore();auth.getSession.mockResolvedValue({data:{session:next},error:null});controller.foreground(true);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(controller.getSnapshot()).toMatchObject({signedIn:false,reason:'ACCOUNT_SESSION'});
    controller.dispose();jest.useRealTimers();
  });
  it('denies a grant when signout occurs during live user validation',async()=>{
    const {controller,auth}=setup();auth.getSession.mockResolvedValue({data:{session},error:null});await controller.restore();
    let finish!:(value:Awaited<ReturnType<typeof auth.getUser>>)=>void;
    auth.getUser.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=controller.getVerifiedSession();await controller.signOut();finish({data:{user:session.user},error:null});expect(await pending).toBeNull();
  });
  it('requests without a session and verifies a non-anonymous identity',async()=>{
    const {controller,auth}=setup(); await controller.requestCode(' user@example.test ');
    expect(controller.getSnapshot()).toMatchObject({status:'awaiting-code',signedIn:false});
    expect(auth.signInWithOtp).toHaveBeenCalledWith({email:'user@example.test',options:{shouldCreateUser:true}});
    await controller.verifyCode('user@example.test','123456'); expect(controller.getSnapshot().signedIn).toBe(true);
  });
  it('restores only verified account identity',async()=>{
    const {controller,auth}=setup(); auth.getSession.mockResolvedValue({data:{session:{...session,user:{...session.user,is_anonymous:true}}},error:null});
    await controller.restore(); expect(controller.getSnapshot().signedIn).toBe(false);
    auth.getSession.mockResolvedValue({data:{session},error:null}); await controller.restore(); expect(controller.getSnapshot().signedIn).toBe(true);
  });
  it.each([['otp_expired',400,'ACCOUNT_CODE'],['over_email_send_rate_limit',429,'ACCOUNT_RATE_LIMIT'],['unknown',500,'ACCOUNT_PROVIDER']])('classifies %s without raw content',async(code,status,reason)=>{
    const {controller,auth,sink}=setup(); await controller.requestCode('SECRET_EMAIL@example.test');
    auth.verifyOtp.mockResolvedValue({data:{session},error:{code,status,message:'PRIVATE_LOCATION PRIVATE_TOKEN'}});
    await controller.verifyCode('SECRET_EMAIL@example.test','123456');
    expect(controller.getSnapshot().reason).toBe(reason);
    expect(JSON.stringify([sink.mock.calls,controller.getSnapshot()])).not.toMatch(/SECRET_EMAIL|PRIVATE_LOCATION|PRIVATE_TOKEN/);
    const events=sink.mock.calls.slice(-2).map(x=>x[0]); expect(events[0].correlationId).toBe(events[1].correlationId);
  });
  it('fences a verification that completes after local signout',async()=>{
    const {controller,auth,storage}=setup(); await controller.requestCode('user@example.test');
    let finish!:(value:{data:{session:Session};error:null})=>void;
    auth.verifyOtp.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=controller.verifyCode('user@example.test','123456');
    await new Promise(resolve=>setTimeout(resolve,0)); const logout=controller.signOut();
    expect(controller.getSnapshot().signedIn).toBe(false); expect(storage.block).toHaveBeenCalled();
    finish({data:{session},error:null}); await pending; await logout;
    expect(controller.getSnapshot().signedIn).toBe(false); expect(auth.signOut).toHaveBeenCalledWith({scope:'local'});
  });
  it('keeps local session inaccessible when remote logout fails',async()=>{
    const {controller,auth,storage}=setup(); auth.getSession.mockResolvedValue({data:{session},error:null}); await controller.restore();
    auth.signOut.mockResolvedValue({error:new TypeError('SECRET_NETWORK')}); await controller.signOut();
    expect(controller.getSnapshot()).toMatchObject({signedIn:false,reason:'ACCOUNT_NETWORK'}); expect(storage.removeItem).toHaveBeenCalled();
  });
  it('does no provider work when disabled',async()=>{
    const {storage,sink}=setup(); const controller=createAccountController(null,storage,sink); await controller.requestCode('user@example.test');
    expect(controller.getSnapshot().status).toBe('disabled'); expect(sink).not.toHaveBeenCalled();
  });
});
