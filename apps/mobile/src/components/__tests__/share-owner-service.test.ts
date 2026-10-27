import { confirmShareJob, loadShareJob, ownerRequest, protectedShareChunks, publishShareJob, queueRemoteRemoval, reconcileRemoteRemoval } from '@/share/owner-service';
import type { ShareSnapshot } from '../../../../../supabase/functions/_shared/share-protocol';
const mockValues = new Map<string, string>();
const mockAuth = { getSession: jest.fn(), signInAnonymously: jest.fn() };
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async (key: string) => mockValues.get(key) ?? null), setItemAsync: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }), deleteItemAsync: jest.fn(async (key: string) => { mockValues.delete(key); }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001', getRandomBytesAsync: async () => new Uint8Array(32), CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digestStringAsync: async () => 'a'.repeat(64) }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
const snapshot = (): ShareSnapshot => ({ schemaVersion: 'travel-life-share-v1', version: 'version_one', title: 'Synthetic', kind: 'journey', destinations: [{ key: 'place', name: 'Synthetic place', country: '', centroid: null, date: null, status: 'inferred' }], chapters: [{ destinationKey: 'place', mediaKeys: [] }], media: [], summary: { destinationCount: 1, mediaCount: 0 } });
describe('protected share recovery', () => {
  it('chunks Unicode by encoded bytes without splitting emoji or changing content', () => {
    const encoded = JSON.stringify({ title: 'Hành trình 東京 😀'.repeat(800) }); const chunks = protectedShareChunks(encoded);
    expect(chunks.join('')).toBe(encoded); expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) { expect(encodeURIComponent(chunk).replace(/%[A-F\d]{2}/gi, '_').length).toBeLessThanOrEqual(1700); expect(() => encodeURIComponent(chunk)).not.toThrow(); }
  });
  const originalFetch = global.fetch;
  beforeEach(() => { mockValues.clear(); jest.clearAllMocks(); process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL = 'https://synthetic.example'; process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY = 'public'; mockAuth.getSession.mockResolvedValue({ data: { session: { user: { is_anonymous: true }, expires_at: Date.now() / 1000 + 3600, access_token: 'PRIVATE_SENTINEL' } }, error: null }); });
  afterEach(() => { global.fetch = originalFetch; });
  it('persists confirmed snapshot and capability before publication, starts no session/network', async () => {
    global.fetch = jest.fn(); const job = await confirmShareJob(snapshot(), [], [], 30);
    expect(await loadShareJob()).toEqual(job); expect(global.fetch).not.toHaveBeenCalled(); expect(mockAuth.getSession).not.toHaveBeenCalled();
  });
  it('does not create credentials when old-owner removal cannot authenticate and retains the pending queue through restart', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null }); global.fetch = jest.fn();
    mockValues.set('travel-life.share-remote-intent-v1', 'pending-or-existing');
    await queueRemoteRemoval(); expect(await reconcileRemoteRemoval()).toBe('pending'); expect(await reconcileRemoteRemoval()).toBe('pending'); expect(mockAuth.signInAnonymously).not.toHaveBeenCalled(); expect(global.fetch).not.toHaveBeenCalled(); expect(mockValues.has('travel-life.share-removal-v1')).toBe(true);
    await expect(confirmShareJob(snapshot(), [], [], 30)).rejects.toMatchObject({ reason: 'SHARE_DELETE_FENCED' });
  });
  it('finishes never-published offline local deletion without creating a false removal queue/session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null }); global.fetch = jest.fn();
    await queueRemoteRemoval(); expect(await reconcileRemoteRemoval()).toBe('complete'); expect(mockValues.has('travel-life.share-removal-v1')).toBe(false); expect(mockAuth.getSession).not.toHaveBeenCalled(); expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
    expect(await confirmShareJob(snapshot(), [], [], 30)).toBeTruthy();
  });
  it('reconciles a lost activation acknowledgement without publishing a second request', async () => {
    const job = await confirmShareJob(snapshot(), [], [], 30); let activated = false; const actions: string[] = [];
    global.fetch = jest.fn(async (_url, options) => { const body = JSON.parse(String(options?.body)); actions.push(body.action); if (body.action === 'activate') { activated = true; throw new Error('PRIVATE_SENTINEL'); } return { ok: true, json: async () => body.action === 'status' ? { status: activated ? 'activated' : 'staged', requestId: job.requestId, contentDigest: job.contentDigest, shareId: '00000000-0000-4000-8000-000000000002', version: 'version_one', expiresAt: '2026-12-01' } : { status: 'staged', requestId: job.requestId, contentDigest: job.contentDigest } } as Response; });
    const result = await publishShareJob(job, async () => true, () => {}); expect(result.status).toBe('activated'); expect(actions).toEqual(['begin', 'activate', 'status']);
    actions.length = 0; expect((await publishShareJob(result, async () => true, () => {})).status).toBe('activated'); expect(actions).toEqual(['status']);
  });
  it('classifies nested provider faults at known stage and never serializes raw secrets', async () => {
    const logs = jest.spyOn(console, 'info').mockImplementation(() => {}); global.fetch = jest.fn(async () => { throw { nested: { token: 'PRIVATE_SENTINEL' } }; });
    await expect(ownerRequest({ action: 'status', requestId: 'synthetic' }, 'runtime-local-1', 'SHARE_RECONCILE')).rejects.toMatchObject({ reason: 'SHARE_NETWORK', stage: 'SHARE_RECONCILE' });
    expect(JSON.stringify(logs.mock.calls)).not.toContain('PRIVATE_SENTINEL'); expect(logs.mock.calls.at(-1)?.[1]).toMatchObject({ operation: 'SHARE_PUBLISH', stage: 'SHARE_RECONCILE', reasonCode: 'SHARE_NETWORK', durableOutcome: 'failed', correlationId: 'runtime-local-1' }); logs.mockRestore();
  });
  it('rechecks scope before reserve and before activation, preserving explicit stale outcome', async () => {
    const job = await confirmShareJob(snapshot(), [{ displayId: 'local', snapshotToken: 1, privacyRevision: 1 }], [], 30);
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'staged', requestId: job.requestId, contentDigest: job.contentDigest }) }) as Response);
    const recheck = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(publishShareJob(job, recheck, () => {})).rejects.toMatchObject({ reason: 'SHARE_ELIGIBILITY_CHANGED' }); expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a cross-request receipt and coalesces simultaneous status checks', async () => {
    const job = { ...await confirmShareJob(snapshot(), [], [], 30), status: 'checking' as const };
    let release!: (value: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>(resolve => { release = resolve; }));
    const first = publishShareJob(job, async () => true, () => {}); const second = publishShareJob(job, async () => true, () => {});
    expect(first).toBe(second); await new Promise(resolve => setTimeout(resolve, 0));
    release({ ok: true, json: async () => ({ status: 'activated', requestId: 'different', contentDigest: job.contentDigest, shareId: '00000000-0000-4000-8000-000000000002', version: job.snapshot.version, expiresAt: '2026-12-01' }) } as Response);
    await expect(first).rejects.toMatchObject({ reason: 'SHARE_RECEIPT_CONFLICT' }); expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});



