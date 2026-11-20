import type { NamingResult } from './naming';
import type { CandidateWindow } from './window-detector';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const day = 86_400_000;

export type StoryAction = 'search-place' | 'confirm' | 'not-quite' | 'not-a-trip';
export type StoryCard = {
  state: 'facts-only' | 'named';
  headline: string;
  detail: string[];
  named: { title: string; evidenceLine: string } | null;
  actions: StoryAction[];
  /** Orders the search box. Never shown, so an unconfirmed country cannot appear. */
  searchRankingHints: string[];
};

function localDate(millis: number, offsetMinutes: number) {
  const date = new Date(millis + offsetMinutes * 60_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), dayNumber: Math.floor((millis + offsetMinutes * 60_000) / day) };
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function clockLine(shiftMinutes: number) {
  const direction = shiftMinutes > 0 ? 'ahead' : 'back';
  const abs = Math.abs(shiftMinutes);
  const hours = Math.trunc(abs / 60);
  const rest = abs % 60;
  const amount = rest === 0 ? plural(hours, 'hour')
    : rest === 30 ? (hours === 0 ? '30 minutes' : `${hours}½ hours`)
      : plural(abs, 'minute');
  return `Your clock moved ${amount} ${direction}.`;
}

/**
 * Facts only until two clues agree. The story states what the metadata
 * shows, never where the owner was not, and never names an unconfirmed place.
 */
export function buildStoryCard(input: {
  window: CandidateWindow;
  memberCount: number;
  homeOffsetMinutes: number | null;
  naming: NamingResult;
}): StoryCard {
  const { window, memberCount, naming } = input;
  const offset = input.homeOffsetMinutes ?? 0;
  const start = localDate(window.startMillis, offset);
  const end = localDate(window.endMillis, offset);
  const days = end.dayNumber - start.dayNumber + 1;
  const when = start.year === end.year && start.month === end.month
    ? `in ${months[start.month]} ${start.year}`
    : `starting ${start.day} ${months[start.month]} ${start.year}`;
  const headline = `You were away for ${plural(days, 'day')} ${when}.`;
  const detail = [plural(memberCount, 'photo')];
  if (window.shiftMinutes !== null && window.shiftMinutes !== 0) detail.push(clockLine(window.shiftMinutes));

  if (naming.status === 'owner-named') {
    const title = naming.claim.cityLabel ?? naming.claim.countryLabel;
    return { state: 'named', headline, detail, named: { title, evidenceLine: 'You named this trip.' }, actions: ['not-a-trip'], searchRankingHints: [] };
  }
  if (naming.status === 'named') {
    const title = naming.level === 'city' ? naming.claim.cityLabel ?? naming.claim.countryLabel : naming.claim.countryLabel;
    return {
      state: 'named', headline, detail,
      named: { title: `Looks like ${title}.`, evidenceLine: 'More than one clue in your photos agree.' },
      actions: ['confirm', 'not-quite', 'not-a-trip'], searchRankingHints: [],
    };
  }
  return { state: 'facts-only', headline, detail, named: null, actions: ['search-place', 'not-a-trip'], searchRankingHints: naming.rankingHints };
}
