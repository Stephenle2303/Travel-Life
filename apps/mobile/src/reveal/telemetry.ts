export type RevealEvent = { name: 'reveal-opened' | 'replay-availability-opened' | 'history-list-opened'; state: 'ready' | 'sparse' | 'processing' | 'restricted' | 'failed'; journeyCount: number };
export type RevealEventSink = { record(event: RevealEvent): Promise<void> | void };

function isAllowedEvent(event: unknown): event is RevealEvent {
  if (!event || typeof event !== 'object') return false;
  const candidate = event as Record<string, unknown>;
  const allowedKeys = ['name', 'state', 'journeyCount'];
  return Object.keys(candidate).every((key) => allowedKeys.includes(key))
    && (candidate.name === 'reveal-opened' || candidate.name === 'replay-availability-opened' || candidate.name === 'history-list-opened')
    && (candidate.state === 'ready' || candidate.state === 'sparse' || candidate.state === 'processing' || candidate.state === 'restricted' || candidate.state === 'failed')
    && typeof candidate.journeyCount === 'number' && Number.isInteger(candidate.journeyCount) && candidate.journeyCount >= 0;
}

/** Telemetry is opt-in, coarse and intentionally unable to carry history data. */
export async function recordRevealEvent(consented: boolean, sink: RevealEventSink | null | undefined, event: unknown): Promise<void> {
  if (!consented || !sink || !isAllowedEvent(event)) return;
  try { await sink.record(event); } catch { /* local reveal must remain usable */ }
}
