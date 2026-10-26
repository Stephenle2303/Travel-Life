import { Image, type ImageRef, type ImageSource } from 'expo-image';
import type { VideoThumbnail } from 'expo-video';
type Handle = ImageRef | VideoThumbnail;
type Entry = { handle: Handle; cost: number; pins: number; deliveries: number; touched: number };
type Job = { key: string; uri: string; video: boolean; epoch: number; resolve(handle: Handle | null): void; promise: Promise<Handle | null> };
/** A local decoded-handle cache. No disk copies are created by this service. */
export class ReplayThumbnailService {
  private readonly entries = new Map<string, Entry>();
  private readonly jobs = new Map<string, Job>();
  private readonly pending: Job[] = [];
  private active = 0;
  private bytes = 0;
  private epoch = 0;
  private readonly invalidationListeners = new Set<() => void>();
  constructor(private readonly decode: (uri: string, video: boolean) => Promise<Handle> = decodeThumbnail, readonly budget = 24 * 1024 * 1024) {}
  getStats() { return { bytes: this.bytes, active: this.active, queued: this.pending.length, diskBytes: 0 }; }
  request(key: string, uri: string, video: boolean) {
    const cached = this.entries.get(key);
    if (cached) { cached.touched = Date.now(); this.leaseDelivery(cached); return Promise.resolve(cached.handle); }
    const existing = this.jobs.get(key); if (existing) return existing.promise;
    // Only one metadata page may wait behind the global native lanes.
    if (this.pending.length >= 48) return Promise.resolve(null);
    let resolve!: (handle: Handle | null) => void;
    const promise = new Promise<Handle | null>((finish) => { resolve = finish; });
    const job: Job = { key, uri, video, epoch: this.epoch, promise, resolve };
    this.jobs.set(key, job); this.pending.push(job); this.drain(); return promise;
  }
  subscribeInvalidation(listener: () => void) { this.invalidationListeners.add(listener); return () => { this.invalidationListeners.delete(listener); }; }
  pin(key: string) { const entry = this.entries.get(key); if (entry) { entry.pins += 1; entry.touched = Date.now(); } }
  unpin(key: string, handle?: Handle) { const entry = this.entries.get(key); if (entry && (!handle || entry.handle === handle)) entry.pins = Math.max(0, entry.pins - 1); this.evict(0); }
  invalidate() {
    this.epoch += 1;
    for (const listener of this.invalidationListeners) listener();
    for (const job of this.pending.splice(0)) job.resolve(null);
    // Active driver calls still own their six lanes until settlement, but a
    // new scope must never join an old scope's promise for the same URI.
    this.jobs.clear();
    for (const entry of this.entries.values()) entry.handle.release();
    this.entries.clear(); this.bytes = 0;
  }
  private leaseDelivery(entry: Entry) {
    entry.deliveries += 1;
    // Cached hits return an already resolved promise: two microtasks give its
    // immediate consumer a turn to pin, without retaining an unclaimed lease.
    void Promise.resolve().then(() => undefined).then(() => { entry.deliveries -= 1; });
  }
  private evict(required: number) {
    const candidates = [...this.entries.entries()].filter(([, entry]) => !entry.pins && !entry.deliveries).sort(([, left], [, right]) => left.touched - right.touched);
    for (const [key, entry] of candidates) { if (this.bytes + required <= this.budget) break; this.entries.delete(key); this.bytes -= entry.cost; entry.handle.release(); }
    return this.bytes + required <= this.budget;
  }
  private drain() {
    while (this.active < 6 && this.pending.length) {
      const job = this.pending.shift()!; this.active += 1;
      void this.decode(job.uri, job.video).then((handle) => {
        if (!handle || !Number.isFinite(handle.width) || !Number.isFinite(handle.height)) { job.resolve(null); return; }
        const cost = Math.max(1, handle.width) * Math.max(1, handle.height) * 4;
        if (job.epoch !== this.epoch || !this.evict(cost)) { handle.release(); job.resolve(null); return; }
        const entry = { handle, cost, pins: 0, deliveries: 0, touched: Date.now() };
        this.entries.set(job.key, entry); this.bytes += cost; this.leaseDelivery(entry); job.resolve(handle);
      }).catch(() => job.resolve(null)).finally(() => { if (this.jobs.get(job.key) === job) this.jobs.delete(job.key); this.active -= 1; this.drain(); });
    }
  }
}
async function decodeThumbnail(uri: string, video: boolean): Promise<Handle> {
  if (!video) return Image.loadAsync({ uri } satisfies ImageSource, { maxWidth: 360, maxHeight: 360 });
  // Installed expo-media-library has no thumbnail API. expo-video's service
  // player is released after extraction; no grid tile mounts a video player.
  const { createVideoPlayer } = await import('expo-video');
  const player = createVideoPlayer(uri);
  try { player.muted = true; player.pause(); const [poster] = await player.generateThumbnailsAsync(0, { maxWidth: 360, maxHeight: 360 }); if (!poster) throw new Error('Replay poster unavailable.'); return poster; }
  finally { player.release(); }
}
export const replayThumbnails = new ReplayThumbnailService();
