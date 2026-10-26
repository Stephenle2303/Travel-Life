import { ReplayThumbnailService } from '@/replay/thumbnail-service';
import type { ImageRef } from 'expo-image';

jest.mock('expo-video', () => ({ createVideoPlayer: jest.fn() }));

const ticks = async () => { for (let index = 0; index < 12; index += 1) await Promise.resolve(); };
const handle = (width = 1, height = 1) => ({ width, height, release: jest.fn() }) as unknown as ImageRef;

describe('Replay decoded thumbnail ownership', () => {
  it('leases a newly decoded handle until its promise consumer can pin it', async () => {
    const finishes: ((value: ImageRef) => void)[] = [];
    const service = new ReplayThumbnailService(() => new Promise<ImageRef>((resolve) => { finishes.push(resolve); }), 4);
    const firstHandle = handle(); const secondHandle = handle();
    const first = service.request('first', 'first', false).then((value) => { service.pin('first'); expect(value!.release).not.toHaveBeenCalled(); return value; });
    const second = service.request('second', 'second', false);
    finishes[0]!(firstHandle); finishes[1]!(secondHandle);
    await expect(first).resolves.toBe(firstHandle);
    await expect(second).resolves.toBeNull(); await ticks();
    expect(secondHandle.release).toHaveBeenCalledTimes(1);
    expect(service.getStats().bytes).toBe(4);
    service.unpin('first');
    const next = service.request('next', 'next', false); finishes[2]!(handle());
    await next; expect(firstHandle.release).toHaveBeenCalledTimes(1);
  });

  it('leases cached-hit delivery before another settled decode can evict it', async () => {
    const finishes: ((value: ImageRef) => void)[] = [];
    const service = new ReplayThumbnailService(() => new Promise<ImageRef>((resolve) => { finishes.push(resolve); }), 4);
    const cached = service.request('cached', 'cached', false); const cachedHandle = handle();
    finishes[0]!(cachedHandle); await cached; await ticks();
    const other = service.request('other', 'other', false); finishes[1]!(handle());
    const delivered = service.request('cached', 'cached', false).then((value) => { service.pin('cached'); expect(value!.release).not.toHaveBeenCalled(); return value; });
    await expect(delivered).resolves.toBe(cachedHandle);
    await expect(other).resolves.toBeNull(); await ticks();
    expect(service.getStats().bytes).toBe(4);
  });

  it('deduplicates requests and bounds active decodes to six with one queued page', async () => {
    const finishes: ((value: ImageRef) => void)[] = [];
    const decode = jest.fn(() => new Promise<ImageRef>((resolve) => { finishes.push(resolve); }));
    const service = new ReplayThumbnailService(decode);
    const first = service.request('0', 'file:///0', false);
    expect(service.request('0', 'file:///0', false)).toBe(first);
    const requests = [first, ...Array.from({ length: 53 }, (_, index) => service.request(String(index + 1), `file:///${index + 1}`, false))];
    expect(decode).toHaveBeenCalledTimes(6);
    expect(service.getStats()).toMatchObject({ active: 6, queued: 48 });
    await expect(service.request('overflow', 'file:///overflow', false)).resolves.toBeNull();
    while (finishes.length) { finishes.splice(0).forEach((finish) => finish(handle())); await ticks(); }
    expect((await Promise.all(requests)).every(Boolean)).toBe(true);
    expect(decode).toHaveBeenCalledTimes(54);
    expect(service.getStats()).toMatchObject({ active: 0, queued: 0, bytes: 216 });
  });

  it('retains a shared handle until all mounted consumers unpin it', async () => {
    const shared = handle();
    const replacements: ImageRef[] = [];
    const service = new ReplayThumbnailService(async (uri) => uri === 'shared' ? shared : (() => { const next = handle(); replacements.push(next); return next; })(), 4);
    await service.request('shared', 'shared', false);
    service.pin('shared'); service.pin('shared'); service.unpin('shared');
    await expect(service.request('blocked', 'blocked', false)).resolves.toBeNull();
    expect(shared.release).not.toHaveBeenCalled();
    expect(replacements[0]!.release).toHaveBeenCalledTimes(1);
    service.unpin('shared');
    expect(await service.request('next', 'next', false)).toBe(replacements[1]);
    expect(shared.release).toHaveBeenCalledTimes(1);
    expect(service.getStats().bytes).toBe(4);
  });

  it('evicts the least recently used unpinned entry and rejects oversized decoded handles', async () => {
    let now = 0;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => ++now);
    try {
      const handles = new Map<string, ImageRef>();
      const service = new ReplayThumbnailService(async (uri) => { const value = handle(uri === 'large' ? 3 : 1); handles.set(uri, value); return value; }, 8);
      await service.request('a', 'a', false); await service.request('b', 'b', false);
      await service.request('a', 'a', false);
      await service.request('c', 'c', false);
      expect(handles.get('a')!.release).not.toHaveBeenCalled();
      expect(handles.get('b')!.release).toHaveBeenCalledTimes(1);
      service.pin('a'); service.pin('c');
      await expect(service.request('large', 'large', false)).resolves.toBeNull();
      expect(handles.get('large')!.release).toHaveBeenCalledTimes(1);
      expect(service.getStats().bytes).toBe(8);
    } finally { clock.mockRestore(); }
  });

  it('invalidates mounted, queued and active handles without reusing an old in-flight request', async () => {
    const finish: ((value: ImageRef) => void)[] = [];
    const decode = jest.fn(() => new Promise<ImageRef>((resolve) => { finish.push(resolve); }));
    const service = new ReplayThumbnailService(decode, 4);
    const cachedRequest = service.request('cached', 'cached', false);
    const cached = handle(); finish.shift()!(cached); await cachedRequest; await ticks();
    service.pin('cached');
    const active = Array.from({ length: 6 }, (_, index) => service.request(String(index), String(index), false));
    const queued = service.request('queued', 'queued', false);
    const invalidated = jest.fn(); const unsubscribe = service.subscribeInvalidation(invalidated);
    service.invalidate();
    expect(invalidated).toHaveBeenCalledTimes(1);
    expect(cached.release).toHaveBeenCalledTimes(1);
    await expect(queued).resolves.toBeNull();
    const replacement = service.request('0', 'replacement', false);
    expect(replacement).not.toBe(active[0]);
    const stale = finish.splice(0).map((resolve) => { const value = handle(); resolve(value); return value; });
    expect(await Promise.all(active)).toEqual(Array(6).fill(null)); await ticks();
    expect(stale.every((value) => (value.release as jest.Mock).mock.calls.length === 1)).toBe(true);
    const current = handle(); finish.shift()!(current);
    await expect(replacement).resolves.toBe(current); await ticks();
    service.pin('0'); service.unpin('0', stale[0]);
    const blocked = service.request('blocked', 'blocked', false);
    const other = handle(); finish.shift()!(other);
    await expect(blocked).resolves.toBeNull(); await ticks();
    expect(current.release).not.toHaveBeenCalled();
    expect(other.release).toHaveBeenCalledTimes(1);
    expect(service.getStats()).toMatchObject({ active: 0, queued: 0, bytes: 4 });
    unsubscribe(); service.invalidate(); expect(invalidated).toHaveBeenCalledTimes(1);
  });
});
