import { activeClues, ignoredByOwnerCorrection, independentClues, retractCluesForUnavailableEvidence, supersedeCluesForProducerVersion, usableClues } from '@/clues/store';
import type { ClueRecord } from '@/clues/types';

let seq = 0;
function clue(overrides: Partial<ClueRecord> & { kind: ClueRecord['kind']; value: ClueRecord['value'] }): ClueRecord {
  seq += 1;
  return {
    clueId: `clue-${seq}`, subject: { evidenceKeys: ['E:e1'] }, strength: 'strong', independenceKey: `producer-${seq}`,
    producerId: 'sign-reader', producerVersion: 'v1', inputsRevision: { evidenceRevision: 1, homeRevision: 1, correctionRevision: 1 },
    state: 'active', createdAtMillis: 0,
    ...overrides,
  } as ClueRecord;
}

beforeEach(() => { seq = 0; });

describe('retractCluesForUnavailableEvidence', () => {
  test('retracts a clue whose subject unit is no longer available', () => {
    const c = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: ['E:e1'] } });
    const result = retractCluesForUnavailableEvidence([c], new Set());
    expect(result[0].state).toBe('retracted');
  });

  test('keeps a clue whose every subject unit is still available', () => {
    const c = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: ['E:e1', 'E:e2'] } });
    const result = retractCluesForUnavailableEvidence([c], new Set(['E:e1', 'E:e2']));
    expect(result[0].state).toBe('active');
  });

  test('retracts a multi-unit subject if only one unit becomes unavailable', () => {
    const c = clue({ kind: 'same-trip', value: { pairedSubject: { evidenceKeys: ['E:e3'] } }, subject: { evidenceKeys: ['E:e1', 'E:e2'] } });
    const result = retractCluesForUnavailableEvidence([c], new Set(['E:e1']));
    expect(result[0].state).toBe('retracted');
  });

  test('an already-retracted clue stays retracted (no resurrection)', () => {
    const c = clue({ kind: 'photo-source', value: { source: 'screenshot' }, state: 'retracted', subject: { evidenceKeys: ['E:e1'] } });
    const result = retractCluesForUnavailableEvidence([c], new Set(['E:e1']));
    expect(result[0].state).toBe('retracted');
  });
});

describe('supersedeCluesForProducerVersion', () => {
  test('supersedes an active clue whose producer version changed', () => {
    const c = clue({ kind: 'landmark', value: { placeId: 'p1' }, producerId: 'landmark-matcher', producerVersion: 'v1' });
    const result = supersedeCluesForProducerVersion([c], new Map([['landmark-matcher', 'v2']]));
    expect(result[0].state).toBe('superseded');
  });

  test('leaves a clue alone when its producer version still matches', () => {
    const c = clue({ kind: 'landmark', value: { placeId: 'p1' }, producerId: 'landmark-matcher', producerVersion: 'v1' });
    const result = supersedeCluesForProducerVersion([c], new Map([['landmark-matcher', 'v1']]));
    expect(result[0].state).toBe('active');
  });

  test('leaves a clue alone when its producer is missing from the version map', () => {
    const c = clue({ kind: 'landmark', value: { placeId: 'p1' }, producerId: 'landmark-matcher', producerVersion: 'v1' });
    const result = supersedeCluesForProducerVersion([c], new Map());
    expect(result[0].state).toBe('active');
  });

  test('never un-supersedes a retracted clue', () => {
    const c = clue({ kind: 'landmark', value: { placeId: 'p1' }, producerId: 'landmark-matcher', producerVersion: 'v1', state: 'retracted' });
    const result = supersedeCluesForProducerVersion([c], new Map([['landmark-matcher', 'v2']]));
    expect(result[0].state).toBe('retracted');
  });
});

describe('activeClues / ignoredByOwnerCorrection / usableClues', () => {
  test('activeClues keeps only state=active', () => {
    const a = clue({ kind: 'photo-source', value: { source: 'screenshot' }, state: 'active' });
    const b = clue({ kind: 'photo-source', value: { source: 'screenshot' }, state: 'retracted' });
    expect(activeClues([a, b])).toEqual([a]);
  });

  test('a clue on a corrected subject is ignored by the rules', () => {
    const c = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: ['E:e1'] } });
    expect(ignoredByOwnerCorrection(c, new Set(['E:e1']))).toBe(true);
    expect(ignoredByOwnerCorrection(c, new Set(['E:other']))).toBe(false);
  });

  test('usableClues excludes inactive and owner-corrected clues', () => {
    const corrected = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: ['E:e1'] } });
    const retracted = clue({ kind: 'photo-source', value: { source: 'screenshot' }, state: 'retracted', subject: { evidenceKeys: ['E:e2'] } });
    const usable = clue({ kind: 'photo-source', value: { source: 'screenshot' }, subject: { evidenceKeys: ['E:e3'] } });
    const result = usableClues([corrected, retracted, usable], new Set(['E:e1']));
    expect(result).toEqual([usable]);
  });
});

describe('independentClues', () => {
  test('two clues from different producers/sessions are independent', () => {
    const a = clue({ kind: 'sign-place', value: { gazetteerId: 'seoul' }, independenceKey: 'sign-reader:session-1' });
    const b = clue({ kind: 'landmark', value: { placeId: 'gyeongbokgung' }, independenceKey: 'landmark-matcher:session-1' });
    expect(independentClues([a, b])).toBe(true);
  });

  test('a single clue, or clues sharing an independence key, are not independent', () => {
    const a = clue({ kind: 'sign-place', value: { gazetteerId: 'seoul' }, independenceKey: 'sign-reader:session-1' });
    const b = clue({ kind: 'sign-place', value: { gazetteerId: 'seoul' }, independenceKey: 'sign-reader:session-1' });
    expect(independentClues([a])).toBe(false);
    expect(independentClues([a, b])).toBe(false);
  });
});
