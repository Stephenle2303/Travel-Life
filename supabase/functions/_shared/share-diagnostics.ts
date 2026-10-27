/** Sole backend console boundary. Input has already passed the closed-field logger. */
export function shareDiagnosticSink(event: Record<string, unknown>) {
  console.info('[Travel Life share diagnostic]', event);
}
