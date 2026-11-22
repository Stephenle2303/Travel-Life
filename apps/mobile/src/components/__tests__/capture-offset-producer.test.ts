import { captureOffsetClues } from '@/clues/producers/capture-offset';

const revision = { evidenceRevision: 1, homeRevision: 0, correctionRevision: 0 };

describe('captureOffsetClues (CAP-4 capture-offset producer)', () => {
  it('emits one clue per subject with its known offset', () => {
    const subjects = [
      { evidenceId: 'a', duplicateFamilyId: null, offsetMinutes: 540 },
      { evidenceId: 'b', duplicateFamilyId: null, offsetMinutes: -300 },
    ];
    const clues = captureOffsetClues(subjects, revision, 1000);
    const bySubject = new Map(clues.map((clue) => [clue.subject.evidenceKeys[0], clue]));
    expect(bySubject.get('E:a')?.value).toEqual({ offsetMinutes: 540 });
    expect(bySubject.get('E:b')?.value).toEqual({ offsetMinutes: -300 });
    expect(clues).toHaveLength(2);
    for (const clue of clues) {
      expect(clue.strength).toBe('strong');
      expect(clue.producerId).toBe('capture-offset-metadata');
      expect(clue.inputsRevision).toEqual(revision);
    }
  });

  it('deduplicates a duplicate family to one clue, first-seen offset wins', () => {
    const subjects = [
      { evidenceId: 'h1', duplicateFamilyId: 'fam-1', offsetMinutes: 540 },
      { evidenceId: 'h2', duplicateFamilyId: 'fam-1', offsetMinutes: 0 },
    ];
    const clues = captureOffsetClues(subjects, revision, 1000);
    expect(clues).toHaveLength(1);
    expect(clues[0].subject.evidenceKeys).toEqual(['F:fam-1']);
    expect(clues[0].value).toEqual({ offsetMinutes: 540 });
  });

  it('emits nothing for an empty subject list', () => {
    expect(captureOffsetClues([], revision, 1000)).toHaveLength(0);
  });
});
