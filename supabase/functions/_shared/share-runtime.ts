import { SHARE_CONTRACT, canonical, createShareDiagnostic, keys, object, opaque, parseRange, safeCorrelation, sha256, validateSnapshot } from './share-protocol.ts';
import { verifyDerivative } from './share-media.ts';
import type { ShareMedia } from './share-protocol.ts';

export type ShareBackend = {
  rpc(name: string, input: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: unknown }>; upload(path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }): Promise<{ error: unknown }> } };
};
type Options = { backend: ShareBackend; owner?: string; recipient?: boolean; allowedOrigins?: string[]; sink(event: Record<string, unknown>): void };
// Structural parsing cannot prove metadata-free decoded media. Keep all remote
// media disabled until a trusted bounded decoder integration has acceptance.
const VERIFIED_MEDIA_PUBLICATION = false;
const common = { 'cache-control': 'no-store', 'pragma': 'no-cache', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer' };
export async function boundedBody(request: Request, max: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader(); if (!reader) return null;
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > max) { await reader.cancel(); return null; } chunks.push(chunk.value); }
    const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } return output;
  } catch { return null; }
}
export async function handleProtocol(request: Request, options: Options): Promise<Response> {
  const log = createShareDiagnostic(options.sink); const correlationId = safeCorrelation(request.headers.get('x-travel-life-correlation'));
  const origin = request.headers.get('origin'); const cors: Record<string, string> = origin && options.allowedOrigins?.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
  const headers: Record<string, string> = { ...common, ...cors };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'content-type': 'application/json' } });
  let operation = options.recipient ? 'SHARE_READ' : 'SHARE_PUBLISH'; let stage = options.recipient ? 'SHARE_TOKEN' : 'SHARE_AUTH';
  const event = (reasonCode: string, durableOutcome = 'failed') => log({ operation, stage, reasonCode, durableOutcome, retryable: reasonCode === 'UNAVAILABLE' || reasonCode === 'UNKNOWN', correlationId });
  const fail = (reason: string, status = 400) => { event(reason); return json(options.recipient ? { status: 'unavailable' } : { status: 'skipped', reason }, options.recipient ? 404 : status); };
  if (origin && !options.allowedOrigins?.includes(origin)) return fail('ACCESS', 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization,apikey,content-type,x-travel-life-correlation,x-share-capability,x-share-request,x-share-media,range', 'access-control-max-age': '0' } });
  if (request.method !== 'POST') return fail('INVALID_REQUEST', 405);
  event('START', 'unchanged');
  try {
    if (options.recipient) {
      const bytes = await boundedBody(request, 4096); let input: unknown;
      try { input = bytes && JSON.parse(new TextDecoder().decode(bytes)); } catch { return fail('INVALID_REQUEST'); }
      if (!object(input)) return fail('INVALID_REQUEST');
      if (keys(input, ['action']) && input.action === 'readiness') {
        stage = 'SHARE_SNAPSHOT';
        const probe = await options.backend.rpc('travel_life_share_read', { capability_hash: '0'.repeat(64), requested_version: null, requested_media: null });
        if (probe.error) return fail('UNAVAILABLE');
        event('COMPLETE', 'complete'); return json({ contractVersion: SHARE_CONTRACT, status: 'ready', mediaPublication: 'disabled' });
      }
      const capability = request.headers.get('x-share-capability');
      if (!opaque(capability, 43, 43) || !['snapshot', 'media'].includes(String(input.action))) return fail('INVALID_REQUEST');
      const isMedia = input.action === 'media';
      if (!keys(input, isMedia ? ['action', 'version', 'mediaKey'] : ['action']) || isMedia && (!opaque(input.version) || !opaque(input.mediaKey))) return fail('INVALID_REQUEST');
      stage = isMedia ? 'SHARE_MEDIA' : 'SHARE_SNAPSHOT';
      const result = await options.backend.rpc('travel_life_share_read', { capability_hash: await sha256(capability), requested_version: isMedia ? input.version : null, requested_media: isMedia ? input.mediaKey : null });
      if (result.error || !object(result.data)) return fail('UNAVAILABLE');
      if (!isMedia) {
        const snapshot = validateSnapshot(result.data.snapshot);
        if (!snapshot || typeof result.data.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.data.expiresAt))) return fail('UNAVAILABLE');
        event('COMPLETE', 'complete'); return json({ snapshot, expiresAt: result.data.expiresAt });
      }
      if (typeof result.data.objectPath !== 'string' || !object(result.data.manifest)) return fail('UNAVAILABLE');
      const manifest = result.data.manifest as ShareMedia;
      const downloaded = await options.backend.storage.from('travel-life-share-private').download(result.data.objectPath);
      if (downloaded.error || !downloaded.data || downloaded.data.size !== manifest.byteLength) return fail('UNAVAILABLE');
      const rangeHeader = request.headers.get('range'); const range = rangeHeader ? parseRange(rangeHeader, manifest.byteLength) : null;
      if (rangeHeader && !range) return fail('INVALID_REQUEST');
      event('COMPLETE', 'complete');
      return new Response(range ? downloaded.data.slice(range.start, range.end + 1) : downloaded.data, { status: range ? 206 : 200, headers: { ...headers, 'content-type': manifest.mimeType, 'content-disposition': 'inline', 'accept-ranges': 'bytes', 'content-length': String(range ? range.end - range.start + 1 : manifest.byteLength), ...(range ? { 'content-range': `bytes ${range.start}-${range.end}/${manifest.byteLength}` } : {}) } });
    }
    if (!options.owner) return fail('ACCESS', 401);
    const requestId = request.headers.get('x-share-request'); const mediaKey = request.headers.get('x-share-media');
    if (request.headers.get('content-type') === 'application/octet-stream') {
      stage = 'SHARE_UPLOAD'; if (!opaque(requestId) || !opaque(mediaKey)) return fail('INVALID_REQUEST');
      if (!VERIFIED_MEDIA_PUBLICATION) return fail('UNAVAILABLE', 503);
      const target = await options.backend.rpc('travel_life_share_owner', { requested_owner: options.owner, action: 'upload-target', input: { requestId, mediaKey } });
      if (target.error || !object(target.data) || !object(target.data.manifest) || typeof target.data.objectPath !== 'string') return fail('ACCESS');
      const manifest = target.data.manifest as ShareMedia;
      const bytes = await boundedBody(request, Math.min(manifest.byteLength, 52_428_800));
      stage = 'SHARE_VERIFY'; if (!bytes || !await verifyDerivative(bytes, manifest)) return fail('INVALID_REQUEST');
      stage = 'SHARE_UPLOAD';
      if (!target.data.verified) {
        const stored = await options.backend.storage.from('travel-life-share-private').upload(target.data.objectPath, bytes, { contentType: manifest.mimeType, upsert: false });
        if (stored.error) {
          // Lost upload acknowledgement: verify immutable existing object before treating retry as success.
          const old = await options.backend.storage.from('travel-life-share-private').download(target.data.objectPath);
          if (old.error || !old.data || !await verifyDerivative(new Uint8Array(await old.data.arrayBuffer()), manifest)) return fail('UNAVAILABLE');
        }
      }
      const verified = await options.backend.rpc('travel_life_share_owner', { requested_owner: options.owner, action: 'verify', input: { requestId, mediaKey } });
      if (verified.error || !object(verified.data) || verified.data.verified !== true) return fail('UNAVAILABLE');
      event('COMPLETE', 'complete'); return json({ status: 'uploaded' });
    }
    const bytes = await boundedBody(request, 270_000); let input: unknown;
    try { input = bytes && JSON.parse(new TextDecoder().decode(bytes)); } catch { return fail('INVALID_REQUEST'); }
    if (!object(input) || typeof input.action !== 'string') return fail('INVALID_REQUEST');
    const action = input.action; let payload: Record<string, unknown>;
    if (action === 'revoke' || action === 'expiry' || action === 'list') operation = 'SHARE_MANAGE';
    if (action === 'delete-all') operation = 'SHARE_DELETE_ALL';
    if (action === 'begin') {
      stage = 'SHARE_SERIALIZE'; const snapshot = validateSnapshot(input.snapshot);
      const allowed = ['action', 'requestId', 'snapshot', 'capability', 'expiresInDays', 'contentDigest', 'replaceShareId'];
      if (!keys(input, allowed) || !snapshot || !opaque(input.requestId) || !opaque(input.capability, 43, 43) || !Number.isInteger(input.expiresInDays) || Number(input.expiresInDays) < 1 || Number(input.expiresInDays) > 90 || input.contentDigest !== await sha256(canonical(snapshot)) || input.replaceShareId !== null && (typeof input.replaceShareId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.replaceShareId))) return fail('INVALID_REQUEST');
      if (snapshot.media.length && !VERIFIED_MEDIA_PUBLICATION) { stage = 'SHARE_VERIFY'; return fail('UNAVAILABLE', 503); }
      payload = { requestId: input.requestId, snapshot, expiresInDays: input.expiresInDays, contentDigest: input.contentDigest, capabilityDigest: await sha256(input.capability), replaceShareId: input.replaceShareId };
      stage = 'SHARE_QUOTA';
    } else {
      const allowed: Record<string, string[]> = { status: ['action', 'requestId'], activate: ['action', 'requestId', 'contentDigest'], cancel: ['action', 'requestId'], list: ['action'], revoke: ['action', 'shareId'], expiry: ['action', 'shareId', 'expectedVersion', 'expiresInDays'], 'delete-all': ['action'] };
      if (!allowed[action] || !keys(input, allowed[action]) || input.requestId !== undefined && !opaque(input.requestId) || input.shareId !== undefined && (typeof input.shareId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.shareId)) || input.contentDigest !== undefined && (typeof input.contentDigest !== 'string' || !/^[a-f0-9]{64}$/.test(input.contentDigest)) || input.expiresInDays !== undefined && (!Number.isInteger(input.expiresInDays) || Number(input.expiresInDays) < 1 || Number(input.expiresInDays) > 90)) return fail('INVALID_REQUEST');
      payload = { ...input }; delete payload.action;
      stage = ({ status: 'SHARE_RECONCILE', activate: 'SHARE_ACTIVATE', cancel: 'SHARE_RECONCILE', list: 'SHARE_RECONCILE', revoke: 'SHARE_REVOKE', expiry: 'SHARE_EXPIRY_UPDATE', 'delete-all': 'SHARE_DELETE_FENCE' } as Record<string, string>)[action];
    }
    const result = await options.backend.rpc('travel_life_share_owner', { requested_owner: options.owner, action, input: payload });
    if (result.error || !object(result.data)) return fail('UNAVAILABLE', 503);
    if (result.data.error) return fail(['ACCESS', 'QUOTA', 'CONFLICT', 'FENCED', 'TERMINAL', 'INVALID_REQUEST'].includes(String(result.data.error)) ? String(result.data.error) : 'UNKNOWN', 409);
    event('COMPLETE', 'complete'); return json(result.data);
  } catch { return fail('UNKNOWN', 503); }
}
