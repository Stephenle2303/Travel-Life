import { ReplayController, replayChapterIdentity } from '@/replay/controller';
import type { ReplayManifest } from '@/replay/types';

const manifest: ReplayManifest = { generation: 1, groupKeys: ['a', 'b'], memoryKeys: [], durationSeconds: 30 };
describe('Replay controller', () => {
  it('does not expose a late artifact after invalidation', async () => {
    let resolve!: (value: { uri: string; digest: string; manifest: ReplayManifest }) => void;
    const controller = new ReplayController({ render: () => new Promise((done) => { resolve = done; }) });
    const work = controller.prepare(manifest, []);
    controller.invalidate();
    resolve({ uri: 'file:///private.mp4', digest: 'digest', manifest });
    await expect(work).rejects.toThrow('STALE');
    expect(controller.snapshot().artifact).toBeNull();
    expect(controller.snapshot().state).toBe('cancelled');
  });
  it('fails closed when there is no renderer', async () => {
    const controller = new ReplayController({ render: async () => { throw new Error('RENDERER_UNAVAILABLE'); } });
    await expect(controller.prepare(manifest, [])).rejects.toThrow('RENDERER_UNAVAILABLE');
    expect(controller.snapshot().state).toBe('unavailable');
  });
  it('reuses a verified artifact only for the exact current manifest', async () => {
    const render = jest.fn(async () => ({ uri: 'file:///private.mp4', digest: 'digest', manifest }));
    const controller = new ReplayController({ render });
    await controller.prepare(manifest, []);
    await controller.prepare({ ...manifest, groupKeys: [...manifest.groupKeys], memoryKeys: [...manifest.memoryKeys] }, []);
    expect(render).toHaveBeenCalledTimes(1);
    await controller.prepare({ ...manifest, memoryKeys: ['changed'] }, []);
    expect(render).toHaveBeenCalledTimes(2);
    await controller.prepare({ ...manifest, direction: 'newest-first' }, []);
    expect(render).toHaveBeenCalledTimes(3);
  });
  it('retains the selected private direction in an exact export manifest', () => {
    const controller = new ReplayController({ render: async () => ({ uri: 'file:///private.mp4', digest: 'digest', manifest }) });
    expect(controller.exportManifest([{ key: 'a', label: 'Private journey', inferred: true, eligible: true, orderCertain: true }], [], 'newest-first').direction).toBe('newest-first');
  });
  it('does not reuse a silent artifact when bundled music is requested', async () => {
    const render = jest.fn(async (requested: ReplayManifest) => ({ uri: 'file:///private.mp4', digest: 'digest', manifest: requested }));
    const controller = new ReplayController({ render });
    await controller.prepare({ ...manifest, music: { kind: 'custom', revision: 'silent-v1', localUri: 'file:///custom.ogg' } } as ReplayManifest, []);
    await controller.prepare({ ...manifest, music: { kind: 'bundled', revision: 'happy-moments-1.4' } } as ReplayManifest, []);
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('binds a reusable chapter to its exact selected visual inputs and configuration', () => {
    const chapter = { groupKey: 'a', memoryKeys: ['one'], frames: 120, card: { labelToken: 'Private journey', timeToken: '2026', frames: 48 } };
    const base = { ...manifest, chapters: [chapter] };
    expect(replayChapterIdentity(base, chapter)).toBe(replayChapterIdentity({ ...base, groupKeys: ['a'] }, chapter));
    // Chapters are video-only.  Soundtrack changes remux the final playlist
    // but must not re-encode otherwise-identical private visuals.
    expect(replayChapterIdentity(base, chapter)).toBe(replayChapterIdentity({ ...base, music: { kind: 'bundled', revision: 'happy-moments-1.4' } }, chapter));
    expect(replayChapterIdentity(base, chapter)).toBe(replayChapterIdentity({ ...base, generation: 999 }, chapter));
    expect(replayChapterIdentity(base, chapter)).not.toBe(replayChapterIdentity(base, { ...chapter, memoryKeys: ['changed'] }));
    expect(replayChapterIdentity(base, chapter)).not.toContain('file:');
  });
});
