import type { Session } from '@supabase/supabase-js';
import { createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent, type AppDiagnosticReasonCode } from '@/diagnostics/app-diagnostics';
import { AccountProviderError, AccountStorageError } from './storage';

export type AccountSnapshot = Readonly<{
  status: 'disabled' | 'signed-out' | 'restoring' | 'requesting' | 'awaiting-code' | 'verifying' | 'signed-in' | 'signing-out' | 'blocked';
  reason: AppDiagnosticReasonCode | null;
  busy: boolean;
  signedIn: boolean;
}>;
export type AccountAuth = {
  invalidate(): void;
  getSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
  getUser(): Promise<{ data: { user: Session['user'] | null }; error: unknown }>;
  signInWithOtp(input: { email: string; options: { shouldCreateUser: true } }): Promise<{ error: unknown }>;
  verifyOtp(input: { email: string; token: string; type: 'email' }): Promise<{ data: { session: Session | null }; error: unknown }>;
  signOut(input: { scope: 'local' }): Promise<{ error: unknown }>;
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
};
type Fence = { block(): Promise<void>; allow(): Promise<void>; removeItem(key: string): Promise<void> };
const emailValid = (value: string) => value.length <= 254 && /^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(value);
const validSession = (session: Session | null): session is Session => !!session && !!session.access_token && !!session.user.id && session.user.is_anonymous !== true && !!session.user.email_confirmed_at && !!session.expires_at && session.expires_at * 1000 > Date.now();
const offlineIdentity = (session: Session | null): session is Session => !!session && !!session.access_token && !!session.user.id && session.user.is_anonymous !== true && !!session.user.email_confirmed_at;
class AccountSessionError extends Error { constructor() { super('Account session is unavailable.'); } }
function category(error: unknown): AppDiagnosticReasonCode {
  if (error instanceof AccountSessionError) return 'ACCOUNT_SESSION';
  if (error instanceof AccountProviderError) return category(error.originalError);
  if (error instanceof AccountStorageError) return 'ACCOUNT_STORAGE';
  const source = error && typeof error === 'object' ? error as { code?: string; status?: number; name?: string } : {};
  if (source.name === 'AuthSessionMissingError' || ['session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used','bad_jwt','user_not_found','user_banned'].includes(source.code ?? '')) return 'ACCOUNT_SESSION';
  if (source.status === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit'].includes(source.code ?? '')) return 'ACCOUNT_RATE_LIMIT';
  if (['otp_expired', 'otp_disabled', 'invalid_credentials'].includes(source.code ?? '')) return 'ACCOUNT_CODE';
  if (source.name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'ACCOUNT_NETWORK';
  return 'ACCOUNT_PROVIDER';
}

/** Public state is content-free. Auth payloads remain below this boundary. */
export function createAccountController(auth: AccountAuth | null, storage: Fence, sink = recordAppDiagnostic) {
  let snapshot: AccountSnapshot = { status: auth ? 'signed-out' : 'disabled', reason: auth ? null : 'ACCOUNT_DISABLED', busy: false, signedIn: false };
  let epoch = 0; let disposed = false; let session: Session | null = null;
  let requestedEmail: string | null = null;
  let operationQueue: Promise<unknown> = Promise.resolve();
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let refreshQueued = false;
  const listeners = new Set<() => void>();
  function set(status: AccountSnapshot['status'], reason: AppDiagnosticReasonCode | null = null) {
    snapshot = { status, reason, busy: ['requesting','restoring','verifying','signing-out'].includes(status), signedIn: status === 'signed-in' };
    listeners.forEach(listener => listener());
  }
  function emit(operation: AppDiagnosticEvent['operation'], stage: AppDiagnosticEvent['stage'], reasonCode: AppDiagnosticReasonCode, correlationId: string, durableOutcome: AppDiagnosticEvent['durableOutcome']) {
    sink({ operation, stage, reasonCode, correlationId, retryable: ['ACCOUNT_NETWORK','ACCOUNT_STORAGE','ACCOUNT_PROVIDER','ACCOUNT_RATE_LIMIT'].includes(reasonCode), durableOutcome });
  }
  /** Caller owns the action diagnostic; this fence must precede its async storage. */
  async function invalidateSession() {
    epoch++; session = null; requestedEmail = null; auth?.invalidate(); auth?.stopAutoRefresh();
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    set('blocked','ACCOUNT_SESSION');
    try { await storage.block(); }
    catch { set('blocked','ACCOUNT_STORAGE'); throw new AccountStorageError('ACCOUNT_SECURE_DELETE'); }
  }
  async function run(operation: AppDiagnosticEvent['operation'], work: (current: () => boolean, correlation: string, stage: (value: AppDiagnosticEvent['stage']) => void) => Promise<void|'skipped'>) {
    if (!auth || disposed) return;
    const generation = epoch; const correlation = createDiagnosticCorrelationId();
    let stage: AppDiagnosticEvent['stage'] = 'ACCOUNT_PROVIDER';
    const current = () => !disposed && generation === epoch;
    const pending = operationQueue.then(async () => {
      if (!current()) return;
      emit(operation, stage, 'START', correlation, 'unchanged');
      let skipped=false;
      try { skipped=await work(current, correlation, value => { stage = value; })==='skipped'; }
      catch (error) {
        if (!current()) { emit(operation,'ACCOUNT_SESSION','SKIPPED',correlation,'skipped'); return; }
        let reason = category(error);
        if ((error instanceof AccountStorageError || error instanceof AccountProviderError) && error.stage) stage = error.stage;
        if (reason === 'ACCOUNT_SESSION') {
          stage = 'ACCOUNT_SESSION';
          try { await invalidateSession(); }
          catch { reason = 'ACCOUNT_STORAGE'; stage = 'ACCOUNT_SECURE_DELETE'; }
        }
        else if (current()) {
          if (operation === 'ACCOUNT_REFRESH' && reason === 'ACCOUNT_NETWORK' && validSession(session)) set('signed-in',reason);
          else { session = null; set(reason === 'ACCOUNT_STORAGE' ? 'blocked' : requestedEmail ? 'awaiting-code' : 'signed-out', reason); }
        }
        emit(operation, stage, reason, correlation, reason === 'ACCOUNT_STORAGE' || reason === 'ACCOUNT_SESSION' ? 'blocked' : 'failed');
        return;
      }
      emit(operation, stage, current()&&!skipped ? 'COMPLETE' : 'SKIPPED', correlation, current()&&!skipped ? 'complete' : 'skipped');
    });
    operationQueue = pending.catch(() => {});
    return pending;
  }
  return {
    getSnapshot: () => snapshot,
    invalidateSession,
    getLocalOwner: () => snapshot.signedIn ? session?.user.id ?? null : null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async restore() {
      return run('ACCOUNT_RESTORE', async (current, _correlation, stage) => {
        if(snapshot.signedIn&&session){stage('ACCOUNT_SESSION');return 'skipped';}
        set('restoring'); stage('ACCOUNT_SECURE_READ');
        const result = await auth!.getSession(); if (result.error) throw result.error;
        if (!current()) return;
        stage('ACCOUNT_SESSION');
        if (result.data.session && !offlineIdentity(result.data.session)) throw new AccountSessionError();
        session = result.data.session; set(session ? 'signed-in' : 'signed-out');
      });
    },
    async requestCode(rawEmail: string) {
      if (!auth || disposed) return;
      const email = rawEmail.trim();
      if (!emailValid(email) || /[\x00-\x1f\x7f]/.test(rawEmail)) { set('signed-out', 'ACCOUNT_INPUT'); emit('ACCOUNT_REQUEST','ACCOUNT_INPUT','ACCOUNT_INPUT',createDiagnosticCorrelationId(),'unchanged'); return; }
      return run('ACCOUNT_REQUEST', async (current) => {
        set('requesting'); requestedEmail = null;
        const result = await auth!.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (result.error) throw result.error;
        if (current()) { requestedEmail = email; set('awaiting-code'); }
      });
    },
    async verifyCode(rawEmail: string, token: string) {
      if (!auth || disposed) return;
      const email = rawEmail.trim();
      if (email !== requestedEmail || !/^[0-9]{6,10}$/.test(token)) { set('awaiting-code','ACCOUNT_INPUT'); emit('ACCOUNT_VERIFY','ACCOUNT_INPUT','ACCOUNT_INPUT',createDiagnosticCorrelationId(),'unchanged'); return; }
      return run('ACCOUNT_VERIFY', async (current, _correlation, stage) => {
        set('verifying');
        // Old auth work is serialized before allowing credential writes again.
        stage('ACCOUNT_SECURE_WRITE'); await storage.allow();
        if (!current()) return;
        stage('ACCOUNT_PROVIDER');
        const result = await auth!.verifyOtp({ email, token, type: 'email' });
        if (result.error) throw result.error;
        if (!current()) return;
        stage('ACCOUNT_SESSION');
        if (!validSession(result.data.session)) { auth!.invalidate(); stage('ACCOUNT_SECURE_DELETE'); await storage.block(); stage('ACCOUNT_SESSION'); throw new AccountSessionError(); }
        session = result.data.session; requestedEmail = null; set('signed-in');
      });
    },
    async getVerifiedSession(actionCorrelation?:string) {
      if (!auth || !snapshot.signedIn || !session) return null;
      const generation = epoch;
      const correlation = actionCorrelation??createDiagnosticCorrelationId();
      emit('ACCOUNT_REFRESH','ACCOUNT_PROVIDER','START',correlation,'unchanged');
      try {
        const result = await auth.getUser();
        if (result.error) throw result.error;
        if (generation !== epoch || !snapshot.signedIn || !session) { emit('ACCOUNT_REFRESH','ACCOUNT_SESSION','SKIPPED',correlation,'skipped'); return null; }
        if (!result.data.user || result.data.user.is_anonymous || !result.data.user.email_confirmed_at || result.data.user.id !== session.user.id) throw new AccountSessionError();
        const refreshed = await auth.getSession();
        if (refreshed.error) throw refreshed.error;
        if (generation !== epoch || !snapshot.signedIn) { emit('ACCOUNT_REFRESH','ACCOUNT_SESSION','SKIPPED',correlation,'skipped'); return null; }
        if (!validSession(refreshed.data.session) || refreshed.data.session.user.id !== result.data.user.id) throw new AccountSessionError();
        session = refreshed.data.session;
        emit('ACCOUNT_REFRESH','ACCOUNT_SESSION','COMPLETE',correlation,'complete');
        return { ownerId: session.user.id, accessToken: session.access_token };
      } catch(error) {
        if (generation!==epoch) { emit('ACCOUNT_REFRESH','ACCOUNT_SESSION','SKIPPED',correlation,'skipped'); return null; }
        let reason=category(error);
        let stage:AppDiagnosticEvent['stage']=(error instanceof AccountStorageError || error instanceof AccountProviderError) && error.stage ? error.stage : 'ACCOUNT_PROVIDER';
        if(reason==='ACCOUNT_SESSION'){
          stage='ACCOUNT_SESSION';
          try { await invalidateSession(); }
          catch { reason='ACCOUNT_STORAGE';stage='ACCOUNT_SECURE_DELETE'; }
        }
        if(reason==='ACCOUNT_STORAGE'){session=null;set('blocked',reason);}
        emit('ACCOUNT_REFRESH',stage,reason,correlation,reason==='ACCOUNT_STORAGE'||reason==='ACCOUNT_SESSION'?'blocked':'failed');return null;
      }
    },
    async signOut() {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      epoch++; requestedEmail = null; session = null; set('signing-out'); auth?.invalidate(); auth?.stopAutoRefresh();
      try { await storage.block(); } catch {
        set('blocked','ACCOUNT_STORAGE');
        emit('ACCOUNT_SIGN_OUT','ACCOUNT_SECURE_DELETE','ACCOUNT_STORAGE',createDiagnosticCorrelationId(),'blocked');
        return;
      }
      return run('ACCOUNT_SIGN_OUT', async (current, _correlation, stage) => {
        let providerError: unknown = null;
        try { const result = await auth!.signOut({ scope: 'local' }); providerError = result.error; }
        catch (error) { providerError = error; }
        // SDK local signout may not erase storage on a network error; the fence remains.
        stage('ACCOUNT_SECURE_DELETE'); await storage.removeItem('travel-life-account-v1');
        if (providerError) { stage('ACCOUNT_PROVIDER'); throw providerError; }
        if (current()) set('signed-out');
      });
    },
    cancelPending() {
      if (!snapshot.busy && snapshot.signedIn) return;
      epoch++; requestedEmail = null;
      if (snapshot.status === 'verifying' || snapshot.status === 'restoring') { auth?.invalidate(); session = null; void storage.block().catch(() => { set('blocked','ACCOUNT_STORAGE'); emit('ACCOUNT_SIGN_OUT','ACCOUNT_SECURE_DELETE','ACCOUNT_STORAGE',createDiagnosticCorrelationId(),'blocked'); }); }
      set('signed-out');
    },
    foreground(active: boolean) {
      if (active && snapshot.signedIn && !refreshTimer) {
        const refresh = () => {
          if (refreshQueued || !session || (session.expires_at ?? 0) * 1000 - Date.now() > 120_000) return;
          refreshQueued = true;
          void run('ACCOUNT_REFRESH',async (current,_correlation,stage)=>{
            stage('ACCOUNT_PROVIDER');const result=await auth!.getSession();if(result.error)throw result.error;
            if(current()){
              stage('ACCOUNT_SESSION');
              if(!validSession(result.data.session)||result.data.session.user.id!==session?.user.id){auth!.invalidate();session=null;throw new AccountSessionError();}
              session=result.data.session;set('signed-in');
            }
          }).finally(() => { refreshQueued = false; });
        };
        refreshTimer=setInterval(refresh,30_000);refresh();
      } else if ((!active || !snapshot.signedIn) && refreshTimer) {clearInterval(refreshTimer);refreshTimer=null;}
    },
    dispose() {
      disposed = true; epoch++; session=null; auth?.invalidate();
      // Persisting work may already have crossed the adapter's await. Fence the
      // storage queue too; a subsequent process must explicitly verify again.
      void storage.block().catch(() => emit('ACCOUNT_SIGN_OUT','ACCOUNT_SECURE_DELETE','ACCOUNT_STORAGE',createDiagnosticCorrelationId(),'blocked'));
      if(refreshTimer)clearInterval(refreshTimer); refreshTimer=null; auth?.stopAutoRefresh(); listeners.clear();
    },
  };
}
export type AccountController = ReturnType<typeof createAccountController>;
