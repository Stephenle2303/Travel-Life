import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { canonical, validateSnapshot } from '../../../../supabase/functions/_shared/share-protocol';
import type { ShareSnapshot } from '../../../../supabase/functions/_shared/share-protocol';
import type { PrivateJourneySelection } from '@/reveal/types';

type Stage = AppDiagnosticEvent['stage'];
export type ShareJob = { requestId: string; capability: string; contentDigest: string; snapshot: ShareSnapshot; expiresInDays: number; selections: PrivateJourneySelection[]; derivatives: { key: string; uri: string }[]; replaceShareId: string | null; status: 'confirmed' | 'uploading' | 'activating' | 'checking' | 'activated'; receipt?: SharedLink };
export type SharedLink = { requestId: string; shareId: string; version: string; title: string; status: string; expiresAt: string };
export class ShareOwnerError extends Error {
  constructor(readonly reason: AppDiagnosticEvent['reasonCode'], readonly stage: Stage) { super('Sharing did not finish. Retry or check its status.'); }
}
const JOB_KEY = 'travel-life.share-job-v1'; const REMOVAL_KEY = 'travel-life.share-removal-v1';
const REMOTE_INTENT_KEY = 'travel-life.share-remote-intent-v1';
const configuration = () => ({ url: process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL, key: process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY, viewer: process.env.EXPO_PUBLIC_TRAVEL_LIFE_SHARE_VIEWER_URL });
let client: ReturnType<typeof createClient> | null = null;
function ownerClient() {
  const config = configuration(); if (!config.url || !config.key) throw new ShareOwnerError('SHARE_SESSION', 'SHARE_AUTH');
  client ??= createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'travel-life-share-owner', storage: { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync } } });
  return client;
}
export function protectedShareChunks(encoded: string): string[] {
  const chunks: string[] = []; let chunk = ''; let size = 0;
  for (const character of encoded) {
    const bytes = encodeURIComponent(character).replace(/%[A-F\d]{2}/gi, '_').length;
    if (size + bytes > 1700) { chunks.push(chunk); chunk = ''; size = 0; }
    chunk += character; size += bytes;
  }
  if (chunk) chunks.push(chunk); return chunks;
}
const validHeader = (value: unknown): value is { generation: string; count: number } => !!value && typeof value === 'object' && 'generation' in value && typeof value.generation === 'string' && /^[a-f0-9-]{36}$/.test(value.generation) && 'count' in value && Number.isInteger(value.count) && Number(value.count) > 0 && Number(value.count) <= 512;
async function saveProtected(key: string, value: unknown) {
  const chunks = protectedShareChunks(JSON.stringify(value)); const generation = Crypto.randomUUID(); const count = chunks.length;
  if (count > 512) throw new ShareOwnerError('SHARE_STORAGE', 'SHARE_REMOVAL_QUEUE');
  let old: { generation: string; count: number } | null = null;
  try { const stored = await SecureStore.getItemAsync(key); if (stored) { const header: unknown = JSON.parse(stored); if (!validHeader(header)) throw new Error(); old = header; } } catch { throw new ShareOwnerError('SHARE_STORAGE', 'SHARE_REMOVAL_QUEUE'); }
  try {
    for (let index = 0; index < count; index++) await SecureStore.setItemAsync(`${key}.${generation}.${index}`, chunks[index]);
    await SecureStore.setItemAsync(key, JSON.stringify({ generation, count }));
  } catch { throw new ShareOwnerError('SHARE_STORAGE', 'SHARE_REMOVAL_QUEUE'); }
  // The new generation is committed. Old-chunk cleanup cannot undo it or turn
  // a successful durable write into a false failure.
  if (old && old.generation !== generation) for (let index = 0; index < old.count; index++) await SecureStore.deleteItemAsync(`${key}.${old.generation}.${index}`).catch(() => {});
}
async function readProtected(key: string): Promise<unknown> {
  const header = await SecureStore.getItemAsync(key); if (!header) return null;
  try { const { generation, count } = JSON.parse(header); if (typeof generation !== 'string' || !/^[a-f0-9-]{36}$/.test(generation) || !Number.isInteger(count) || count < 1 || count > 512) throw new Error(); let encoded = ''; for (let index = 0; index < count; index++) { const part = await SecureStore.getItemAsync(`${key}.${generation}.${index}`); if (part === null) throw new Error(); encoded += part; } return JSON.parse(encoded); }
  catch { throw new ShareOwnerError('SHARE_STORAGE', 'SHARE_RECONCILE'); }
}
function emit(correlationId: string, stage: Stage, reasonCode: AppDiagnosticEvent['reasonCode'], durableOutcome: AppDiagnosticEvent['durableOutcome']) { recordAppDiagnostic({ operation: stage === 'SHARE_REMOVAL_QUEUE' || stage === 'SHARE_DELETE_FENCE' ? 'SHARE_DELETE_ALL' : stage === 'SHARE_REVOKE' || stage === 'SHARE_EXPIRY' ? 'SHARE_MANAGE' : 'SHARE_PUBLISH', stage, reasonCode, durableOutcome, retryable: reasonCode === 'SHARE_NETWORK' || reasonCode === 'SHARE_STORAGE', correlationId }); }
async function token(allowCreate: boolean) {
  const auth = ownerClient().auth; const existing = await auth.getSession();
  if (existing.error) throw new ShareOwnerError('SHARE_SESSION', 'SHARE_AUTH');
  let session = existing.data.session;
  if (!session && allowCreate) { const created = await auth.signInAnonymously(); if (created.error) throw new ShareOwnerError('SHARE_SESSION', 'SHARE_AUTH'); session = created.data.session; }
  if (!session?.user.is_anonymous || !session.expires_at || session.expires_at * 1000 <= Date.now()) throw new ShareOwnerError('SHARE_SESSION', 'SHARE_AUTH');
  return session.access_token;
}
export async function ownerRequest(body: Record<string, unknown>, correlationId: string, stage: Stage, allowCreate = false): Promise<Record<string, unknown>> {
  emit(correlationId, stage, 'START', 'unchanged');
  try {
    const accessToken = await token(allowCreate); const config = configuration();
    const response = await fetch(`${config.url}/functions/v1/travel-life-share`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, apikey: config.key!, 'content-type': 'application/json', 'x-travel-life-correlation': correlationId }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || !result || typeof result !== 'object' || result.status === 'skipped') {
      const reason = ({ ACCESS: 'SHARE_SESSION', QUOTA: 'SHARE_QUOTA', CONFLICT: 'SHARE_RECEIPT_CONFLICT', FENCED: 'SHARE_DELETE_FENCED', TERMINAL: 'SHARE_REVOKED', INVALID_REQUEST: 'SHARE_MANIFEST_INVALID' } as const)[result?.reason as 'ACCESS'] ?? 'SHARE_NETWORK';
      throw new ShareOwnerError(reason, stage);
    }
    if (body.action === 'begin' && (result.requestId !== body.requestId || result.contentDigest !== body.contentDigest || !['staged', 'activated'].includes(result.status))) throw new ShareOwnerError('SHARE_RECEIPT_CONFLICT', stage);
    if (body.action === 'status' && (result.requestId !== body.requestId || typeof result.contentDigest !== 'string')) throw new ShareOwnerError('SHARE_RECEIPT_CONFLICT', stage);
    emit(correlationId, stage, 'COMPLETE', 'complete'); return result;
  } catch (error) { const safe = error instanceof ShareOwnerError ? error : new ShareOwnerError('SHARE_NETWORK', stage); emit(correlationId, safe.stage, safe.reason, 'failed'); throw safe; }
}
export async function loadShareJob(): Promise<ShareJob | null> {
  const value = await readProtected(JOB_KEY) as ShareJob | null;
  if (value && (!validateSnapshot(value.snapshot) || !Array.isArray(value.selections) || !Array.isArray(value.derivatives))) throw new ShareOwnerError('SHARE_STORAGE', 'SHARE_RECONCILE');
  return value;
}
function checkedReceipt(receipt: Record<string, unknown>, job: ShareJob): SharedLink {
  if (receipt.status !== 'activated' || receipt.requestId !== job.requestId || receipt.contentDigest !== job.contentDigest || receipt.version !== job.snapshot.version || typeof receipt.shareId !== 'string' || !/^[a-f0-9-]{36}$/.test(receipt.shareId) || typeof receipt.expiresAt !== 'string' || !Number.isFinite(Date.parse(receipt.expiresAt))) throw new ShareOwnerError('SHARE_RECEIPT_CONFLICT', 'SHARE_RECONCILE');
  return { requestId: job.requestId, shareId: receipt.shareId, version: receipt.version, expiresAt: receipt.expiresAt, status: 'active', title: job.snapshot.title };
}
export async function confirmShareJob(snapshot: ShareSnapshot, selections: PrivateJourneySelection[], derivatives: ShareJob['derivatives'], expiresInDays: number, replace?: { shareId: string; capability: string }) {
  if (!validateSnapshot(snapshot) || derivatives.length !== snapshot.media.length) throw new ShareOwnerError('SHARE_MANIFEST_INVALID', 'SHARE_SERIALIZE');
  if (await readProtected(REMOVAL_KEY)) throw new ShareOwnerError('SHARE_DELETE_FENCED', 'SHARE_DELETE_FENCE');
  const previous = await loadShareJob();
  if (previous && previous.status !== 'activated') throw new ShareOwnerError('SHARE_RECEIPT_CONFLICT', 'SHARE_RECONCILE');
  const bytes = await Crypto.getRandomBytesAsync(32); const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let capability = '';
  for (let index = 0; index < bytes.length; index += 3) { const a = bytes[index]; const b = bytes[index + 1]; const c = bytes[index + 2]; capability += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)]; if (b !== undefined) capability += alphabet[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)]; if (c !== undefined) capability += alphabet[c & 63]; }
  const job: ShareJob = { requestId: Crypto.randomUUID(), capability: replace?.capability ?? capability, contentDigest: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical(snapshot)), snapshot, expiresInDays, selections, derivatives, replaceShareId: replace?.shareId ?? null, status: 'confirmed' };
  await saveProtected(JOB_KEY, job); await SecureStore.setItemAsync(`travel-life.share-capability.${job.requestId}`, job.capability); return job;
}
export async function abandonShareJob(job: ShareJob): Promise<'discarded' | 'activated'> {
  if (job.status === 'confirmed') { await SecureStore.deleteItemAsync(JOB_KEY); return 'discarded'; }
  const correlation = createDiagnosticCorrelationId();
  const result = await ownerRequest({ action: 'cancel', requestId: job.requestId }, correlation, 'SHARE_RECONCILE');
  if (result.status === 'activated') return 'activated';
  if (result.status !== 'cancelled') throw new ShareOwnerError('SHARE_RECEIPT_CONFLICT', 'SHARE_RECONCILE');
  await SecureStore.deleteItemAsync(JOB_KEY); return 'discarded';
}
export async function viewerReady(): Promise<boolean> {
  const config = configuration(); if (!config.viewer || !/^https:\/\/[^?#]+$/.test(config.viewer) || !config.url || !config.key) return false;
  try { const result = await fetch(config.viewer.replace(/\/$/, '') + '/share-contract.json', { cache: 'no-store' }); const contract = await result.json(); if (!result.ok || contract.contractVersion !== 'travel-life-share-v1' || contract.endpoint !== `${config.url}/functions/v1/travel-life-share-read`) return false; const api = await fetch(contract.endpoint, { method: 'POST', headers: { apikey: config.key, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'readiness' }) }); return api.ok && (await api.json()).contractVersion === 'travel-life-share-v1'; } catch { return false; }
}
export async function shareLink(requestId: string): Promise<string | null> {
  if (!await viewerReady()) return null; const capability = await SecureStore.getItemAsync(`travel-life.share-capability.${requestId}`); return capability ? configuration().viewer!.replace(/\/$/, '') + '/#' + capability : null;
}
const inflight = new Map<string, Promise<ShareJob>>();
export function publishShareJob(job: ShareJob, recheck: (selection: PrivateJourneySelection) => Promise<boolean>, progress: (message: string) => void, signal?: AbortSignal): Promise<ShareJob> {
  const existing = inflight.get(job.requestId); if (existing) return existing;
  const run = publishOneShareJob(job, recheck, progress, signal).finally(() => { inflight.delete(job.requestId); }); inflight.set(job.requestId, run); return run;
}
async function publishOneShareJob(job: ShareJob, recheck: (selection: PrivateJourneySelection) => Promise<boolean>, progress: (message: string) => void, signal?: AbortSignal): Promise<ShareJob> {
  const correlationId = createDiagnosticCorrelationId();
  const persist = async (status: ShareJob['status']) => { job = { ...job, status }; await saveProtected(JOB_KEY, job); };
  if (await readProtected(REMOVAL_KEY)) throw new ShareOwnerError('SHARE_DELETE_FENCED', 'SHARE_DELETE_FENCE');
  if (job.status === 'checking' || job.status === 'activating' || job.status === 'activated') {
    progress('Checking publication'); const receipt = await ownerRequest({ action: 'status', requestId: job.requestId }, correlationId, 'SHARE_RECONCILE');
    if (receipt.status === 'activated') { job = { ...job, status: 'activated', receipt: checkedReceipt(receipt, job) }; await saveProtected(JOB_KEY, job); return job; }
    if (receipt.status !== 'staged') throw new ShareOwnerError('SHARE_REVOKED', 'SHARE_RECONCILE');
  }
  if (signal?.aborted) { emit(correlationId, 'SHARE_UPLOAD', 'SKIPPED', 'skipped'); return job; }
  for (const selection of job.selections) if (!await recheck(selection)) { emit(correlationId, 'SHARE_ELIGIBILITY', 'SHARE_ELIGIBILITY_CHANGED', 'skipped'); throw new ShareOwnerError('SHARE_ELIGIBILITY_CHANGED', 'SHARE_ELIGIBILITY'); }
  progress('Preparing publication');
  // This minimal marker outlives evidence purge and credential loss. A device
  // that never attempted remote publication does not invent removal work.
  await SecureStore.setItemAsync(REMOTE_INTENT_KEY, 'pending-or-existing');
  await ownerRequest({ action: 'begin', requestId: job.requestId, snapshot: job.snapshot, capability: job.capability, expiresInDays: job.expiresInDays, contentDigest: job.contentDigest, replaceShareId: job.replaceShareId }, correlationId, 'SHARE_QUOTA', true);
  await persist('uploading');
  for (let index = 0; index < job.derivatives.length; index++) {
    if (signal?.aborted) { await ownerRequest({ action: 'cancel', requestId: job.requestId }, correlationId, 'SHARE_RECONCILE'); return job; }
    progress(`Uploading selected copies ${index + 1} of ${job.derivatives.length}`);
    emit(correlationId, 'SHARE_UPLOAD', 'START', 'unchanged');
    const item = job.derivatives[index]; let bytes: Uint8Array;
    try { const data = await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.Base64 }); const binary = atob(data); bytes = Uint8Array.from(binary, char => char.charCodeAt(0)); }
    catch { emit(correlationId, 'SHARE_COPY', 'SHARE_STORAGE', 'failed'); throw new ShareOwnerError('SHARE_STORAGE', 'SHARE_COPY'); }
    try {
      const config = configuration();
      const response = await fetch(`${config.url}/functions/v1/travel-life-share`, { method: 'POST', headers: { authorization: `Bearer ${await token(false)}`, apikey: config.key!, 'content-type': 'application/octet-stream', 'x-share-request': job.requestId, 'x-share-media': item.key, 'x-travel-life-correlation': correlationId }, body: bytes.buffer as ArrayBuffer });
      if (!response.ok || (await response.json()).status !== 'uploaded') throw new Error();
      emit(correlationId, 'SHARE_UPLOAD', 'COMPLETE', 'complete');
    } catch { emit(correlationId, 'SHARE_UPLOAD', 'SHARE_NETWORK', 'failed'); throw new ShareOwnerError('SHARE_NETWORK', 'SHARE_UPLOAD'); }
  }
  if (signal?.aborted) { await ownerRequest({ action: 'cancel', requestId: job.requestId }, correlationId, 'SHARE_RECONCILE'); return job; }
  for (const selection of job.selections) if (!await recheck(selection)) { emit(correlationId, 'SHARE_ELIGIBILITY', 'SHARE_ELIGIBILITY_CHANGED', 'skipped'); throw new ShareOwnerError('SHARE_ELIGIBILITY_CHANGED', 'SHARE_ELIGIBILITY'); }
  if (await readProtected(REMOVAL_KEY)) throw new ShareOwnerError('SHARE_DELETE_FENCED', 'SHARE_DELETE_FENCE');
  progress('Publishing'); await persist('activating');
  try { await ownerRequest({ action: 'activate', requestId: job.requestId, contentDigest: job.contentDigest }, correlationId, 'SHARE_ACTIVATE'); }
  catch { await persist('checking'); progress('Checking publication'); }
  const receipt = await ownerRequest({ action: 'status', requestId: job.requestId }, correlationId, 'SHARE_RECONCILE');
  if (receipt.status !== 'activated') throw new ShareOwnerError('SHARE_RECEIPT_CONFLICT', 'SHARE_RECONCILE');
  job = { ...job, status: 'activated', receipt: checkedReceipt(receipt, job) }; await saveProtected(JOB_KEY, job); progress('Published'); return job;
}
export async function queueRemoteRemoval(shareId?: string) {
  const pending = await readProtected(REMOVAL_KEY) as { all: boolean; shareIds: string[] } | null;
  if (!shareId && !pending && !await SecureStore.getItemAsync(REMOTE_INTENT_KEY)) {
    // Unconfirmed drafts performed no network work and may be forgotten with
    // the local evidence. No owner credentials or remote deletion are needed.
    await SecureStore.deleteItemAsync(JOB_KEY);
    return;
  }
  // Persist the fence before evidence purge even when offline. Do not create a
  // new session to act on a prior owner's records.
  await saveProtected(REMOVAL_KEY, { all: !shareId || pending?.all === true, shareIds: [...new Set([...(pending?.shareIds ?? []), ...(shareId ? [shareId] : [])])] });
}
export async function reconcileRemoteRemoval() {
  const pending = await readProtected(REMOVAL_KEY) as { all: boolean; shareIds: string[] } | null; if (!pending) return 'complete' as const;
  const correlation = createDiagnosticCorrelationId();
  try { if (pending.all) await ownerRequest({ action: 'delete-all' }, correlation, 'SHARE_DELETE_FENCE'); else for (const shareId of pending.shareIds) await ownerRequest({ action: 'revoke', shareId }, correlation, 'SHARE_REVOKE'); await SecureStore.deleteItemAsync(REMOVAL_KEY); return 'complete' as const; }
  catch { return 'pending' as const; }
}

