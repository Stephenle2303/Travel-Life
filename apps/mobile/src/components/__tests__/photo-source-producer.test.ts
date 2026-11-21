import { applyPhotoSourceClues } from '@/clues/consumption';
import { photoSourceClues } from '@/clues/producers/photo-source';
import type { TripDetectorEvidence } from '@/reconstruction/types';

const revision = { evidenceRevision: 1, homeRevision: 0, correctionRevision: 0 };

describe('photoSourceClues (CAP-5 metadata-stage producer)', () => {
  it('emits a clue for every unambiguous origin and maps the folder classifier term to the public vocabulary', () => {
    const subjects = [
      { evidenceId: 'a', duplicateFamilyId: null, sourceOrigin: 'camera' },
      { evidenceId: 'b', duplicateFamilyId: null, sourceOrigin: 'imported' },
      { evidenceId: 'c', duplicateFamilyId: null, sourceOrigin: 'messaging' },
      { evidenceId: 'd', duplicateFamilyId: null, sourceOrigin: 'screenshot' },
      { evidenceId: 'e', duplicateFamilyId: null, sourceOrigin: 'download' },
    ];
    const clues = photoSourceClues(subjects, revision, 1000);
    const bySubject = new Map(clues.map((clue) => [clue.subject.evidenceKeys[0], clue]));
    expect(bySubject.get('E:a')?.value).toEqual({ source: 'camera' });
    expect(bySubject.get('E:b')?.value).toEqual({ source: 'imported' });
    expect(bySubject.get('E:c')?.value).toEqual({ source: 'received' });
    expect(bySubject.get('E:d')?.value).toEqual({ source: 'screenshot' });
    expect(bySubject.get('E:e')?.value).toEqual({ source: 'download' });
    expect(clues).toHaveLength(5);
    for (const clue of clues) {
      expect(clue.strength).toBe('strong');
      expect(clue.producerId).toBe('photo-source-metadata');
      expect(clue.inputsRevision).toEqual(revision);
    }
  });

  it('abstains for unknown or unset origin rather than emitting a weak guess', () => {
    const subjects = [
      { evidenceId: 'f', duplicateFamilyId: null, sourceOrigin: 'unknown' },
      { evidenceId: 'g', duplicateFamilyId: null, sourceOrigin: null },
    ];
    expect(photoSourceClues(subjects, revision, 1000)).toHaveLength(0);
  });

  it('deduplicates a duplicate family to one clue, first-seen origin wins', () => {
    const subjects = [
      { evidenceId: 'h1', duplicateFamilyId: 'fam-1', sourceOrigin: 'messaging' },
      { evidenceId: 'h2', duplicateFamilyId: 'fam-1', sourceOrigin: 'camera' },
    ];
    const clues = photoSourceClues(subjects, revision, 1000);
    expect(clues).toHaveLength(1);
    expect(clues[0].subject.evidenceKeys).toEqual(['F:fam-1']);
    expect(clues[0].value).toEqual({ source: 'received' });
  });

  it('round-trips through applyPhotoSourceClues end to end: a messaging-origin photo is excluded from support', () => {
    const subjects = [{ evidenceId: 'm1', duplicateFamilyId: null, sourceOrigin: 'messaging' }];
    const clues = photoSourceClues(subjects, revision, 1000);
    const evidence: Pick<TripDetectorEvidence, 'id' | 'duplicateFamilyId' | 'sourceOrigin'>[] = [
      { id: 'm1', duplicateFamilyId: null, sourceOrigin: null },
    ];
    const result = applyPhotoSourceClues(evidence as TripDetectorEvidence[], clues);
    expect(result[0].sourceOrigin).toBe('messaging');
  });
});
