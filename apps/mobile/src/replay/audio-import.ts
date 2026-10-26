import * as FileSystem from 'expo-file-system/legacy';
import { createReplayOperationId } from './draft-repository-contract';
import type { ReplaySoundtrack } from './types';

export const REPLAY_AUDIO_MAX_BYTES = 5_000_000;
export type ReplayAudioCandidate = { soundtrack: Extract<ReplaySoundtrack, { kind: 'custom' }>; basename: string };
export async function removeUnownedReplayAudio(candidate: ReplayAudioCandidate) { await FileSystem.deleteAsync?.(candidate.soundtrack.localUri, { idempotent: true }).catch(() => undefined); }
/** Local file readiness never acquires or waits for SQL ownership. */
export async function importReplayAudio(source: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }): Promise<ReplayAudioCandidate> {
  const suffix = /\.(mp3|m4a|aac|wav|ogg)$/i.exec(source.name ?? '')?.[1]?.toLowerCase()
    ?? ({ 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'application/ogg': 'ogg' } as Record<string, string>)[source.mimeType?.toLowerCase() ?? ''];
  if (!suffix || !FileSystem.documentDirectory) throw new Error('Replay audio is not supported.');
  const size = typeof source.size === 'number' ? source.size : await FileSystem.getInfoAsync(source.uri).then((info) => info.exists ? info.size : undefined);
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0 || size > REPLAY_AUDIO_MAX_BYTES) throw new Error('Replay audio size is invalid.');
  // Unique immutable destination across remounts and repeated provider URIs.
  const revision = createReplayOperationId();
  const localUri = `${FileSystem.documentDirectory}replay-audio-${revision}.${suffix}`;
  const candidate: ReplayAudioCandidate = { soundtrack: { kind: 'custom', revision, localUri }, basename: (source.name ?? 'Custom audio file').split(/[\\/]/).pop() || 'Custom audio file' };
  try {
    await FileSystem.copyAsync({ from: source.uri, to: localUri });
    const copied = await FileSystem.getInfoAsync(localUri);
    if (!copied.exists || !Number.isFinite(copied.size) || copied.size <= 0 || copied.size > REPLAY_AUDIO_MAX_BYTES) throw new Error('Replay private audio copy is invalid.');
    // A private, bounded copy is enough to acknowledge the owner's choice.
    // Native decode belongs to rendering, the only point that can prove the
    // exact selected track works in the produced Replay. Do not hold the
    // settings sheet behind a best-effort metadata probe.
    return candidate;
  } catch (error) {
    await removeUnownedReplayAudio(candidate);
    throw error;
  }
}
