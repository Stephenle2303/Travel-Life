import { createShareDiagnostic, newCorrelation, object } from './share-protocol.ts';
type Backend = {
  rpc(name: string, input: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  storage: { from(bucket: string): { remove(paths: string[]): Promise<{ error: unknown }> } };
};
export async function handleShareCleanup(request: Request, options: { backend: Backend; secret?: string; sink(event: Record<string, unknown>): void }): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  const correlationId = newCorrelation(); const log = createShareDiagnostic(options.sink);
  let stage = 'SHARE_CLEANUP_LEASE';
  const event = (reasonCode: string, durableOutcome: string) => log({ operation: 'SHARE_CLEANUP', stage, reasonCode, durableOutcome, retryable: reasonCode === 'UNAVAILABLE', correlationId });
  const deny = () => new Response('{"status":"unavailable"}', { status: 503, headers });
  if (request.method !== 'POST' || !options.secret || options.secret.length < 43 || request.headers.get('authorization') !== 'Bearer ' + options.secret) return deny();
  event('START', 'unchanged');
  try {
    const batch = await options.backend.rpc('travel_life_share_cleanup', { batch_limit: 25 });
    if (batch.error || !Array.isArray(batch.data) || batch.data.length > 25) { event('UNAVAILABLE', 'failed'); return deny(); }
    for (const item of batch.data) {
      if (!object(item) || typeof item.objectPath !== 'string' || typeof item.versionId !== 'string' || typeof item.mediaKey !== 'string' || typeof item.lease !== 'string') { event('INVALID_REQUEST', 'failed'); return deny(); }
      stage = 'SHARE_OBJECT_DELETE';
      const removal = await options.backend.storage.from('travel-life-share-private').remove([item.objectPath]);
      if (removal.error) { event('UNAVAILABLE', 'failed'); return deny(); }
      stage = 'SHARE_CLEANUP_ACK';
      const acknowledged = await options.backend.rpc('travel_life_share_cleanup_ack', { requested_version: item.versionId, requested_media: item.mediaKey, requested_lease: item.lease });
      if (acknowledged.error || acknowledged.data !== true) { event('UNAVAILABLE', 'failed'); return deny(); }
    }
    event('COMPLETE', 'complete'); return new Response('{"status":"complete"}', { headers });
  } catch { event('UNKNOWN', 'failed'); return deny(); }
}
