/** Physical-device-only S0 entry point. Use synthetic local files; do not run against private evidence. */
import { runSyntheticS0, verifyReplayOutput } from '../src/replay/renderer';
export async function runReplayS0Synthetic(args: string[], outputUri: string) {
  const result = await runSyntheticS0(args);
  return { completed: result, outputVerified: await verifyReplayOutput(outputUri) };
}
