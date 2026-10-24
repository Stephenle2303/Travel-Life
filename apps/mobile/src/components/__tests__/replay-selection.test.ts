import { createExportManifest, orderedReplayGroups, planPrivateReplay, replayPanelCount, selectReplayMemories } from '@/replay/selection';
import type { ReplayGroup } from '@/replay/types';

const group = (key: string, startDay: string, endDay = startDay): ReplayGroup => ({ key, label: key, interval: { startDay, endDay }, inferred: false, eligible: true, orderCertain: true });

describe('Replay selection', () => {
  it('orders effective start months despite overlaps and uncertain interval flags', () => {
    const groups = [group('february', '2024-02-01'), { ...group('december', '2023-12-05', '2024-01-12'), orderCertain: false }, group('january', '2024-01-05', '2024-02-09')];
    expect(orderedReplayGroups(groups).map(({ key }) => key)).toEqual(['december', 'january', 'february']);
  });
  it('keeps same-month Journey List ties stable and unknown times last in either direction', () => {
    const unknown: ReplayGroup = { key: 'unknown', label: 'unknown', inferred: true, eligible: true, orderCertain: false };
    const groups = [group('february', '2024-02-01'), group('january-first', '2024-01-20'), unknown, group('january-second', '2024-01-01')];
    expect(orderedReplayGroups(groups).map(({ key }) => key)).toEqual(['january-first', 'january-second', 'february', 'unknown']);
    expect(orderedReplayGroups(groups, undefined, 'newest-first').map(({ key }) => key)).toEqual(['february', 'january-first', 'january-second', 'unknown']);
  });
  it('carries a three-second sanitized private destination card inside each chapter budget', () => {
    const plan = planPrivateReplay([{ ...group('a', '2024-01-01'), label: "A\nprivate: place" }], []);
    expect(plan.chapters[0]).toMatchObject({ frames: 72, card: { labelToken: 'A private place', timeToken: '2024 01', frames: 72 } });
    expect(createExportManifest(1, plan.groups, [], 'newest-first')).toMatchObject({ direction: 'newest-first', chapters: [{ frames: 72, card: { frames: 72 } }] });
  });
  it('preserves Vietnamese letters in the card token while keeping its existing frame budget', () => {
    const plan = planPrivateReplay([{ ...group('a', '2024-01-01'), label: 'Thừa Thiên Huế' }], [{ key: 'photo', groupKey: 'a', kind: 'photo', available: true, eligible: true }]);
    expect(plan.chapters[0]).toMatchObject({ frames: 120, card: { labelToken: 'Thừa Thiên Huế', frames: 72 } });
    expect(plan.chapters[0].frames - (plan.chapters[0].card?.frames ?? 0)).toBe(48);
  });
  it('keeps an undated Journey List item in the unfiltered replay without inventing a date', () => {
    const undated: ReplayGroup = { key: 'undated', label: 'Private journey', inferred: true, eligible: true, orderCertain: false };
    expect(planPrivateReplay([undated], [{ key: 'memory', groupKey: 'undated', kind: 'photo', available: true, eligible: true }])).toMatchObject({ groups: [undated], panelCount: 1 });
    expect(orderedReplayGroups([undated], { startDay: '2024-01-01', endDay: '2024-12-31' })).toEqual([]);
  });
  it('retains every visible trip in a private plan and export', () => {
    const groups = Array.from({ length: 13 }, (_, index) => group(String(index), `2024-01-${String(index + 1).padStart(2, '0')}`));
    expect(planPrivateReplay(groups, []).groups).toHaveLength(13);
    expect(createExportManifest(1, groups, []).groupKeys).toEqual(groups.map((group) => group.key));
  });
  it('requires eligible available exact media for export', () => {
    const groups = [group('a', '2024-01-01'), group('b', '2024-01-02')];
    expect(() => createExportManifest(1, groups, [{ key: 'bad', groupKey: 'a', kind: 'photo', available: false, eligible: true }])).toThrow('no longer eligible');
    expect(createExportManifest(1, groups, []).durationSeconds).toBe(6);
  });
  it('allows one visible trip and retains every eligible attached memory', () => {
    const groups = [group('a', '2024-01-01')];
    const memories = [
      { key: 'first', groupKey: 'a', kind: 'photo' as const, available: true, eligible: true },
      { key: 'second', groupKey: 'a', kind: 'video' as const, available: true, eligible: true },
    ];
    expect(planPrivateReplay(groups, memories)).toMatchObject({ groups, memories, panelCount: 2, durationSeconds: 8 });
    expect(createExportManifest(1, groups, memories).groupKeys).toEqual(['a']);
  });
  it('retains a visible trip with no usable attachment for its honest local slate', () => {
    const plan = planPrivateReplay([group('a', '2024-01-01')], []);
    expect(plan).toMatchObject({ groups: [group('a', '2024-01-01')], memories: [], durationSeconds: 3 });
    expect(createExportManifest(1, plan.groups, []).durationSeconds).toBe(3);
  });
  it('keeps every item as a candidate while selecting a stable six-moment chapter', () => {
    const groups = [group('a', '2024-01-01')];
    const memories = Array.from({ length: 100 }, (_, index) => ({ key: String(index), groupKey: 'a', kind: 'photo' as const, available: true, eligible: true }));
    const plan = planPrivateReplay(groups, memories);
    expect(replayPanelCount(groups, plan.memories)).toBe(6);
    expect(plan.candidateMemories).toHaveLength(100);
    expect(plan.memories).toHaveLength(6);
    expect(plan.editoriallyOmittedMemoryCount).toBe(94);
    expect(plan.durationSeconds).toBe(20);
  });
  it('retains excluded moments for editing without automatically rendering them', () => {
    const memories = [
      { key: 'kept', groupKey: 'a', kind: 'photo' as const, available: true, eligible: true },
      { key: 'excluded', groupKey: 'a', kind: 'video' as const, available: true, eligible: true, intent: 'exclude' as const },
    ];
    const plan = planPrivateReplay([group('a', '2024-01-01')], memories);
    expect(plan.candidateMemories.map((memory) => memory.key)).toEqual(['kept', 'excluded']);
    expect(plan.memories.map((memory) => memory.key)).toEqual(['kept']);
  });
  it('keeps every explicitly selected export moment even when automatic curation would collapse a burst', () => {
    const memories = [
      { key: 'first', groupKey: 'a', kind: 'photo' as const, available: true, eligible: true, capture: { startDay: '2024-01-01', endDay: '2024-01-01' } },
      { key: 'second', groupKey: 'a', kind: 'video' as const, available: true, eligible: true, capture: { startDay: '2024-01-01', endDay: '2024-01-01' } },
    ];
    const manifest = createExportManifest(1, [group('a', '2024-01-01')], memories);
    expect(manifest.memoryKeys).toEqual(['first', 'second']);
    expect(manifest.durationSeconds).toBe(8);
  });
  it('uses sparse chapter timing after duplicate-like bursts reduce to one day representative', () => {
    const memories = Array.from({ length: 10 }, (_, index) => ({ key: String(index), groupKey: 'a', kind: 'photo' as const, available: true, eligible: true, capture: { startDay: '2024-01-01', endDay: '2024-01-01' } }));
    expect(selectReplayMemories(memories).map((memory) => memory.key)).toEqual(['0']);
    expect(planPrivateReplay([group('a', '2024-01-01')], memories).durationSeconds).toBe(5);
  });
});
