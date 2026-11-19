import {
  assessWindow, buildStoryCard, findCandidateWindows, inferHomeOffsetMinutes, nameWindow, selectMembers,
  type CaptureRecord, type Clue, type EdgeFix, type PlaceClaim,
} from '@/travel-window';

const VN = 420;
const KR = 540;
const korea: PlaceClaim = { countryCode: 'KR', countryLabel: 'Korea' };
const seoul: PlaceClaim = { countryCode: 'KR', countryLabel: 'Korea', cityId: 'seoul', cityLabel: 'Seoul' };
const japan: PlaceClaim = { countryCode: 'JP', countryLabel: 'Japan' };

function at(year: number, month: number, day: number, hourOfDay: number, minute: number, offset: number) {
  return Date.UTC(year, month - 1, day, hourOfDay, minute) - offset * 60_000;
}

/** Captures every 15 minutes from 08:00, `perDay` per day, local to `offset`. */
function trip(prefix: string, startDay: number, days: number, perDay: number, offset: number, provenance: CaptureRecord['provenance'] = 'camera', month = 6): CaptureRecord[] {
  const records: CaptureRecord[] = [];
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < perDay; i++) {
      records.push({
        id: `${prefix}-${d}-${i}`, capturedAtMillis: at(2026, month, startDay + d, 8, i * 15, offset),
        utcOffsetMinutes: offset, provenance, located: false,
      });
    }
  }
  return records;
}

const homeMay = trip('home', 1, 20, 20, VN, 'camera', 5); // 400 captures: home dominates the library
const koreaTrip = trip('kr', 3, 6, 52, KR); // 312 captures, 3-8 June
const home = { offsetMinutes: VN };
const signage = (n: number, claim: PlaceClaim | null = korea, kind: Clue['kind'] = 'script'): Clue => ({ kind, independenceKey: `signage:s${n}`, claim });
const landmark = (n: number, claim: PlaceClaim = korea): Clue => ({ kind: 'landmark', independenceKey: `landmark:s${n}`, claim });

describe('window detection', () => {
  it('infers home from the most common recorded offset', () => {
    expect(inferHomeOffsetMinutes([...homeMay, ...koreaTrip])).toBe(VN);
    expect(inferHomeOffsetMinutes(koreaTrip.map((r) => ({ ...r, utcOffsetMinutes: null })))).toBeNull();
  });

  it('finds the whole 312-photo Korea window with a clock-shift clue and no place claim', () => {
    const windows = findCandidateWindows([...homeMay, ...koreaTrip], home);
    const trips = windows.filter((w) => w.shiftMinutes !== null);
    expect(trips).toHaveLength(1);
    expect(trips[0].cameraCount).toBe(312);
    expect(trips[0].shiftMinutes).toBe(120);
    expect(trips[0].clues.every((clue) => clue.claim === null)).toBe(true);
    expect(assessWindow(trips[0])).toEqual({ travelLooking: true, reason: 'travel-looking' });
  });

  it('stays silent for a burst at home with no strong clue', () => {
    const windows = findCandidateWindows(homeMay, home);
    expect(windows).toHaveLength(1);
    expect(assessWindow(windows[0])).toEqual({ travelLooking: false, reason: 'no-strong-clue' });
  });

  it('stays silent when the capture offset is not recorded at all', () => {
    const noOffset = koreaTrip.map((r) => ({ ...r, utcOffsetMinutes: null }));
    const [window] = findCandidateWindows(noOffset, home);
    expect(window.shiftMinutes).toBeNull();
    expect(assessWindow(window).travelLooking).toBe(false);
  });

  it('ignores short bursts, received media, screenshots and unknown provenance', () => {
    expect(findCandidateWindows(trip('few', 3, 1, 20, KR), home)).toHaveLength(0);
    for (const provenance of ['messaging', 'screenshot', 'download', 'unknown'] as const) {
      expect(findCandidateWindows(trip('x', 3, 6, 52, KR, provenance), home)).toHaveLength(0);
    }
  });

  it('splits two trips separated by more than 36 hours and at an offset change', () => {
    const second = trip('b', 15, 3, 30, KR);
    expect(findCandidateWindows([...koreaTrip, ...second], home)).toHaveLength(2);
    const adjacentHome = trip('h', 9, 3, 30, VN); // starts 24h after the trip ends
    expect(findCandidateWindows([...koreaTrip, ...adjacentHome], home)).toHaveLength(2);
  });

  it('counts a far-from-home edge fix as a strong clue and ignores one near home', () => {
    const noOffset = koreaTrip.map((r) => ({ ...r, utcOffsetMinutes: null }));
    const near: EdgeFix = { capturedAtMillis: at(2026, 6, 3, 2, 0, KR), farFromHome: false, claim: korea };
    const far: EdgeFix = { ...near, farFromHome: true };
    expect(assessWindow(findCandidateWindows(noOffset, home, [near])[0]).travelLooking).toBe(false);
    const [window] = findCandidateWindows(noOffset, home, [far]);
    expect(window.clues.map((c) => c.kind)).toContain('edge-located');
    expect(assessWindow(window).travelLooking).toBe(true);
  });

  it('does not let one sign or landmark start a story, but two independent ones do', () => {
    const [window] = findCandidateWindows(koreaTrip.map((r) => ({ ...r, utcOffsetMinutes: null })), home);
    expect(assessWindow(window, [signage(1)])).toEqual({ travelLooking: false, reason: 'single-provider-clue' });
    expect(assessWindow(window, [signage(1), signage(1)]).travelLooking).toBe(false);
    expect(assessWindow(window, [signage(1), landmark(2)]).travelLooking).toBe(true);
    expect(assessWindow(window, [{ kind: 'on-device-model', independenceKey: 'model:1', claim: korea }, { kind: 'on-device-model', independenceKey: 'model:2', claim: korea }]).travelLooking).toBe(false);
  });
});

describe('naming', () => {
  it('never names a place from metadata clues alone, even when a claim is supplied', () => {
    const forged: Clue[] = [
      { kind: 'offset-shift', independenceKey: 'metadata:offset', claim: japan },
      { kind: 'burst', independenceKey: 'metadata:burst', claim: japan },
    ];
    expect(nameWindow(forged)).toEqual({ status: 'facts-only', reason: 'no-claims', rankingHints: [] });
  });

  it('abstains on a single clue and keeps the country only as a hidden hint', () => {
    expect(nameWindow([signage(1)])).toEqual({ status: 'facts-only', reason: 'single-clue', rankingHints: ['KR'] });
    expect(nameWindow([signage(1), signage(1)]).status).toBe('facts-only');
  });

  it('names the country when two independent clues agree', () => {
    const result = nameWindow([signage(1), landmark(2)]);
    expect(result).toMatchObject({ status: 'named', level: 'country', claim: korea });
  });

  it('names the city only when two independent clues agree on it', () => {
    const one = nameWindow([signage(1), landmark(2, seoul)]);
    expect(one).toMatchObject({ status: 'named', level: 'country' });
    const two = nameWindow([signage(1, seoul, 'sign-place'), landmark(2, seoul)]);
    expect(two).toMatchObject({ status: 'named', level: 'city', claim: seoul });
    const split = nameWindow([signage(1, seoul, 'sign-place'), landmark(2, { ...seoul, cityId: 'busan', cityLabel: 'Busan' })]);
    expect(split).toMatchObject({ status: 'named', level: 'country' });
  });

  it('abstains on any conflict, even with several agreeing clues', () => {
    const result = nameWindow([signage(1), landmark(2), landmark(3), { kind: 'landmark', independenceKey: 'landmark:s4', claim: japan }]);
    expect(result).toMatchObject({ status: 'facts-only', reason: 'conflicting-clues' });
  });

  it('ignores on-device model clues until they are explicitly allowed', () => {
    const model = (n: number, claim: PlaceClaim): Clue => ({ kind: 'on-device-model', independenceKey: `model:${n}`, claim });
    expect(nameWindow([model(1, korea)])).toMatchObject({ status: 'facts-only', reason: 'model-only' });
    expect(nameWindow([signage(1), model(1, korea)])).toMatchObject({ status: 'facts-only', reason: 'single-clue' });
    expect(nameWindow([signage(1), landmark(2), model(3, japan)])).toMatchObject({ status: 'named', claim: korea });
    const allowed = { modelClueCounts: true };
    expect(nameWindow([signage(1), model(1, korea)], allowed)).toMatchObject({ status: 'named' });
    expect(nameWindow([signage(1), landmark(2), model(3, japan)], allowed)).toMatchObject({ status: 'facts-only', reason: 'conflicting-clues' });
  });

  it('lets the owner name the trip', () => {
    const owner: Clue = { kind: 'owner-answer', independenceKey: 'owner', claim: seoul };
    expect(nameWindow([signage(1, japan), owner])).toEqual({ status: 'owner-named', claim: seoul });
  });
});

describe('membership', () => {
  it('includes every owner camera capture with no size cap and separates the rest by provenance', () => {
    const [window] = findCandidateWindows(koreaTrip, home);
    const mixed: CaptureRecord[] = [
      ...koreaTrip,
      ...trip('zalo', 4, 1, 10, KR, 'messaging'),
      ...trip('shot', 5, 1, 3, KR, 'screenshot'),
      ...trip('dl', 6, 1, 2, KR, 'download'),
      ...trip('unk', 7, 1, 4, KR, 'unknown'),
      { id: 'gps', capturedAtMillis: at(2026, 6, 5, 12, 0, KR), utcOffsetMinutes: KR, provenance: 'camera', located: true },
      { id: 'before', capturedAtMillis: at(2026, 6, 1, 12, 0, KR), utcOffsetMinutes: KR, provenance: 'camera', located: false },
    ];
    const members = selectMembers(window, mixed);
    expect(members.memberIds).toHaveLength(312);
    expect(members.memberIds.every((id) => id.startsWith('kr-'))).toBe(true);
    expect(members.reviewIds).toHaveLength(4);
    expect(members.excluded.filter((e) => e.reason === 'messaging')).toHaveLength(10);
    expect(members.excluded.filter((e) => e.reason === 'screenshot')).toHaveLength(3);
    expect(members.excluded.filter((e) => e.reason === 'download')).toHaveLength(2);
    expect(members.excluded).toContainEqual({ id: 'gps', reason: 'located' });
    expect([...members.memberIds, ...members.reviewIds, ...members.excluded.map((e) => e.id)]).not.toContain('before');
  });
});

describe('story card', () => {
  const [window] = findCandidateWindows(koreaTrip, home);
  const forbidden = /weren't|were not|not in|left|vanish|missing|you didn't/i;

  it('tells the facts with no place when evidence does not agree', () => {
    const naming = nameWindow([signage(1)]);
    const card = buildStoryCard({ window, memberCount: 312, homeOffsetMinutes: VN, naming });
    expect(card.state).toBe('facts-only');
    expect(card.headline).toBe('You were away for 6 days in June.');
    expect(card.detail).toEqual(['312 photos', 'Your clock moved 2 hours ahead.']);
    expect(card.actions).toEqual(['search-place', 'not-a-trip']);
    const text = JSON.stringify([card.headline, card.detail, card.named, card.actions]);
    expect(text).not.toMatch(/Korea|Japan|KR|JP|Seoul/);
    expect(text).not.toMatch(forbidden);
    expect(card.searchRankingHints).toEqual(['KR']);
  });

  it('never shows a wrong country when clues conflict', () => {
    const naming = nameWindow([signage(1), landmark(2), { kind: 'landmark', independenceKey: 'landmark:s3', claim: japan }]);
    const card = buildStoryCard({ window, memberCount: 312, homeOffsetMinutes: VN, naming });
    expect(card.named).toBeNull();
    expect(JSON.stringify([card.headline, card.detail, card.actions])).not.toMatch(/Korea|Japan/);
  });

  it('offers one-tap confirmation when two clues agree and shows no unconfirmed alternatives', () => {
    const naming = nameWindow([signage(1, seoul, 'sign-place'), landmark(2, seoul)]);
    const card = buildStoryCard({ window, memberCount: 312, homeOffsetMinutes: VN, naming });
    expect(card.state).toBe('named');
    expect(card.named?.title).toBe('Looks like Seoul.');
    expect(card.actions).toEqual(['confirm', 'not-quite', 'not-a-trip']);
    expect(card.searchRankingHints).toEqual([]);
    expect(JSON.stringify(card)).not.toMatch(forbidden);
  });

  it('omits the clock line when there is no shift and formats half-hour shifts', () => {
    const naming = nameWindow([]);
    const plain = buildStoryCard({ window: { ...window, shiftMinutes: null }, memberCount: 1, homeOffsetMinutes: VN, naming });
    expect(plain.detail).toEqual(['1 photo']);
    const india = buildStoryCard({ window: { ...window, shiftMinutes: -330 }, memberCount: 5, homeOffsetMinutes: VN, naming });
    expect(india.detail[1]).toBe('Your clock moved 5½ hours back.');
  });

  it('describes a trip across months without naming the end', () => {
    const across = trip('m', 28, 7, 30, KR, 'camera', 6); // 28 June - 4 July (7 days)
    const [w] = findCandidateWindows(across.map((r) => ({ ...r, capturedAtMillis: r.capturedAtMillis })), home);
    const card = buildStoryCard({ window: w, memberCount: w.cameraCount, homeOffsetMinutes: VN, naming: nameWindow([]) });
    expect(card.headline).toBe('You were away for 7 days starting 28 June.');
  });

  it('shows the owner-chosen name and a single dismissal', () => {
    const owner: Clue = { kind: 'owner-answer', independenceKey: 'owner', claim: seoul };
    const card = buildStoryCard({ window, memberCount: 312, homeOffsetMinutes: VN, naming: nameWindow([owner]) });
    expect(card.named?.title).toBe('Seoul');
    expect(card.actions).toEqual(['not-a-trip']);
  });

  it('never carries opaque record ids into card text', () => {
    const secret = trip('SECRET-ID', 3, 6, 52, KR);
    const [w] = findCandidateWindows(secret, home);
    const members = selectMembers(w, secret);
    const card = buildStoryCard({ window: w, memberCount: members.memberIds.length, homeOffsetMinutes: VN, naming: nameWindow([signage(1)]) });
    expect(JSON.stringify(card)).not.toContain('SECRET-ID');
    expect(members.memberIds).toHaveLength(312);
  });
});
