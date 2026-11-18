import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AccountAuth } from './controller';
import { AccountProviderError, AccountStorageError } from './storage';

type SessionStore = { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; removeItem(key:string):Promise<void> };
const key = 'travel-life-account-v1';
const empty = () => ({data:{session:null},error:null});
/** Auth SDK logs rejected fetch exceptions. Convert transport failure before
 * that boundary so raw native/network exceptions never enter its console path. */
export function createAccountFetch(transport: typeof fetch): typeof fetch {
  return async (input, init) => {
    try { return await transport(input, init); }
    catch { return new Response('{"message":"Account network unavailable."}', {status:503,headers:{'Content-Type':'application/json'}}); }
  };
}
function decode(raw:string):Session {
  const value:unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccountStorageError();
  const session = value as Session;
  if (typeof session.access_token !== 'string' || !session.access_token || typeof session.refresh_token !== 'string' || !session.refresh_token || !session.user || typeof session.user.id !== 'string' || !session.user.id || session.user.is_anonymous === true || !session.user.email_confirmed_at || typeof session.expires_at !== 'number' || !Number.isFinite(session.expires_at)) throw new AccountStorageError();
  return session;
}

/** SDK storage is memory-only. The fence also denies SDK memory after stale work. */
export function createAccountAuthAdapter(client:SupabaseClient, storage:SessionStore):AccountAuth {
  let hydrated = false;
  let generation = 0;
  let denied = false;
  function invalidate() { generation++; denied = true; hydrated = true; }
  const current = (epoch:number) => !denied && epoch === generation;
  async function persist(session:Session|null, epoch:number) {
    if (session && current(epoch)) {
      try { await storage.setItem(key,JSON.stringify(session)); }
      catch { invalidate(); throw new AccountStorageError('ACCOUNT_SECURE_WRITE'); }
    }
  }
  async function provider<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { throw new AccountProviderError(error); }
  }
  async function getSession() {
    if (denied) return empty();
    const epoch = generation;
    if (!hydrated) {
      let raw:string|null;
      try { raw = await storage.getItem(key); }
      catch { invalidate(); throw new AccountStorageError('ACCOUNT_SECURE_READ'); }
      if (!current(epoch)) return empty();
      if (raw) {
        let session:Session;
        try { session = decode(raw); } catch { invalidate(); throw new AccountStorageError('ACCOUNT_SECURE_READ'); }
        const result = await provider(() => client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}));
        if (!current(epoch)) return empty();
        if (result.error) {
          // Protected identity permits offline viewing, never a verified server grant.
          if (result.error.name === 'AuthRetryableFetchError') return {data:{session},error:null};
          return { ...result, error: new AccountProviderError(result.error) };
        }
        await persist(result.data.session,epoch);
      }
      if (current(epoch)) hydrated = true;
    }
    if (!current(epoch)) return empty();
    const result = await provider(() => client.auth.getSession());
    if (!current(epoch)) return empty();
    if (result.error) return { ...result, error: new AccountProviderError(result.error) };
    await persist(result.data.session,epoch);
    return current(epoch) ? result : empty();
  }
  return {
    invalidate,
    getSession,
    async getUser() {
      if (denied) return {data:{user:null},error:null};
      const epoch = generation;
      const result = await provider(() => client.auth.getUser());
      return current(epoch) ? result : {data:{user:null},error:null};
    },
    signInWithOtp:input => client.auth.signInWithOtp(input),
    async verifyOtp(input) {
      // The fence stays closed until this explicit verification succeeds. A
      // failed retry must not reveal a previous canceled SDK memory session.
      generation++; denied = true;
      const epoch = generation;
      const result = await provider(() => client.auth.verifyOtp(input));
      if (epoch !== generation) return empty();
      if (result.error || !result.data.session) return result;
      try { decode(JSON.stringify(result.data.session)); } catch { return result; }
      denied = false;
      await persist(result.data.session,epoch);
      if (current(epoch)) hydrated = true;
      return current(epoch) ? result : empty();
    },
    async signOut(input) { invalidate(); return client.auth.signOut(input); },
    // Never start SDK timer/recovery error-console paths with native credentials.
    startAutoRefresh:() => {}, stopAutoRefresh:() => {},
  };
}
