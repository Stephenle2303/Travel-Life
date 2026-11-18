export const FIRST_REVEAL_QUESTION_LIMIT = 3;
export const FIRST_REVEAL_MINIMUM_GAIN = 3;

export type FirstRevealDecision = 'offer' | 'yes' | 'no' | 'dismiss' | 'retire' | 'undo';
export type FirstRevealReceipt = {
  offerKey: string;
  /** Identity of the original offer snapshot. The write fence is separate. */
  scope: string;
  command: string;
  decision: FirstRevealDecision;
  revision: number;
};
export type FirstRevealMutation = Omit<FirstRevealReceipt, 'revision'> & { expectedRevision: number };

/** Repository callers verify current history and the scope inside the writer turn. */
export function nextFirstRevealReceipt(prior: FirstRevealReceipt | null, mutation: FirstRevealMutation): FirstRevealReceipt | null {
  const { offerKey, scope, command, decision, expectedRevision } = mutation;
  if (![offerKey, scope, command].every((value) => value.length > 0 && value.length <= 1024)
    || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return null;
  if (prior?.command === command) {
    return prior.offerKey === offerKey && prior.scope === scope && prior.decision === decision
      && prior.revision === expectedRevision + 1 ? prior : null;
  }
  if ((prior?.revision ?? 0) !== expectedRevision) return null;
  if (!prior) return decision === 'offer' ? { offerKey, scope, command, decision, revision: 1 } : null;
  if (prior.offerKey !== offerKey || prior.scope !== scope) return null;
  const allowed = prior.decision === 'offer'
    ? decision === 'yes' || decision === 'no' || decision === 'dismiss' || decision === 'retire'
    : (prior.decision === 'yes' || prior.decision === 'no') && decision === 'undo';
  return allowed ? { offerKey, scope, command, decision, revision: expectedRevision + 1 } : null;
}

type ReliableTrip = {
  /** Canonical verified-family support keys. */
  support: readonly string[];
  /** Proven links to already reliable trips in this generation's lineage. */
  reliablePredecessors?: readonly string[];
};

type AnswerProjection = {
  safe: boolean;
  reliable: readonly ReliableTrip[];
  removedOrChanged: number;
};

export type FirstRevealSimulation = {
  key: string;
  recognizable: boolean;
  periodKnown: boolean;
  alreadyResolved: boolean;
  yes: AnswerProjection;
  no: AnswerProjection;
};

type QuestionCandidate = Omit<FirstRevealSimulation, 'yes' | 'no'>;
type QuestionOffer = NonNullable<ReturnType<typeof selectFirstRevealQuestion>>;

function eligibleQuestions<T extends QuestionCandidate>(items: readonly T[]): T[] {
  const counts = new Map<string, number>();
  for (const { key } of items) counts.set(key, (counts.get(key) ?? 0) + 1);
  return items.filter((item) => item.key && counts.get(item.key) === 1
    && item.recognizable && item.periodKnown && !item.alreadyResolved)
    .sort((a, b) => a.key.localeCompare(b.key)).slice(0, FIRST_REVEAL_QUESTION_LIMIT);
}

/** One caller-owned scope. Every branch is read-only and checks the same fence. */
export async function simulateFirstRevealQuestion(options: {
  baseline: readonly ReliableTrip[];
  candidates: readonly QuestionCandidate[];
  current(): boolean;
  signal: AbortSignal;
  project(candidate: QuestionCandidate, answer: 'yes' | 'no', signal: AbortSignal): Promise<AnswerProjection>;
}): Promise<QuestionOffer | null> {
  const current = () => !options.signal.aborted && options.current();
  const candidates = eligibleQuestions(options.candidates);
  const results: FirstRevealSimulation[] = [];
  if (!current()) return null;
  let stop = () => {};
  const cancelled = new Promise<null>((resolve) => { stop = () => resolve(null); });
  options.signal.addEventListener('abort', stop, { once: true });
  const compare = async () => {
    for (const candidate of candidates) {
      if (!current()) return null;
      const yes = await options.project(candidate, 'yes', options.signal);
      if (!current()) return null;
      if (!yes.safe) continue;
      const no = await options.project(candidate, 'no', options.signal);
      if (!current()) return null;
      results.push({ ...candidate, yes, no });
    }
    return selectFirstRevealQuestion(options.baseline, results);
  };
  try { return await Promise.race([compare(), cancelled]); }
  finally { options.signal.removeEventListener('abort', stop); }
}

function newlyReliable(branch: AnswerProjection, existingSupport: ReadonlySet<string>) {
  const supportCounts = new Map<string, number>();
  for (const trip of branch.reliable) {
    for (const key of new Set(trip.support)) supportCounts.set(key, (supportCounts.get(key) ?? 0) + 1);
  }
  return branch.reliable.filter((trip) => trip.support.length > 0 && !trip.reliablePredecessors?.length
    && trip.support.every((key) => !existingSupport.has(key) && supportCounts.get(key) === 1)).length;
}

/** Rank already completed simulations. The caller owns its read and time budget. */
export function selectFirstRevealQuestion(baseline: readonly ReliableTrip[], simulations: readonly FirstRevealSimulation[]) {
  const existingSupport = new Set(baseline.flatMap((trip) => trip.support));
  const ranked = eligibleQuestions(simulations)
    .filter(({ yes, no }) => yes.safe && no.safe)
    .map(({ key, yes, no }) => {
      const yesGain = newlyReliable(yes, existingSupport);
      const noGain = newlyReliable(no, existingSupport);
      return { key, yesGain, noGain, gain: Math.max(yesGain, noGain), disruption: Math.max(yes.removedOrChanged, no.removedOrChanged) };
    })
    .filter(({ gain }) => gain >= FIRST_REVEAL_MINIMUM_GAIN)
    .sort((a, b) => b.gain - a.gain || a.disruption - b.disruption || a.key.localeCompare(b.key));
  return ranked[0] ?? null;
}
