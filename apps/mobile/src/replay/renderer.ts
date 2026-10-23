import type { ReplayManifest, ReplayRenderSource } from './types';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, getMediaInformation, pickEncoder } from 'munim-ffmpeg';

export type ReplayArtifact = Readonly<{ uri: string; digest: string; manifest: ReplayManifest }>;
export type ReplayRenderProgress = (update: Readonly<{ message: string; completed: number; total: number }>) => void;
export type ReplayFailureStage = 'REPLAY_ACCESS' | 'REPLAY_SCOPE' | 'REPLAY_DECODE' | 'REPLAY_ENCODE' | 'REPLAY_OUTPUT' | 'REPLAY_STALE' | 'REPLAY_UNAVAILABLE';
/** A closed, non-identifying failure stage that is safe for UI and diagnostics. */
export class ReplayPreparationError extends Error {
  constructor(readonly stage: ReplayFailureStage) { super(stage); }
}
function isReplayFailureStage(value: unknown): value is ReplayFailureStage {
  return value === 'REPLAY_ACCESS' || value === 'REPLAY_SCOPE' || value === 'REPLAY_DECODE'
    || value === 'REPLAY_ENCODE' || value === 'REPLAY_OUTPUT' || value === 'REPLAY_STALE'
    || value === 'REPLAY_UNAVAILABLE';
}
export function replayFailureStage(error: unknown): ReplayFailureStage {
  if (error instanceof ReplayPreparationError) return error.stage;
  // During a native Fast Refresh boundary, an Error can retain the previous
  // JS realm's prototype. Accept only our closed stage vocabulary so that a
  // valid access/decode outcome is not relabeled as renderer availability.
  const stage = error && typeof error === 'object' && 'stage' in error ? error.stage : null;
  return isReplayFailureStage(stage) ? stage : 'REPLAY_UNAVAILABLE';
}
export type ReplayRenderer = Readonly<{
  render(manifest: ReplayManifest, sources: readonly ReplayRenderSource[], signal: AbortSignal, onProgress?: ReplayRenderProgress): Promise<ReplayArtifact>;
  dispose?(artifact: ReplayArtifact): Promise<void>;
}>;

type ReplayEncoder = Readonly<{ name: string; pixelFormat: 'nv12' | 'yuv420p' }>;

/** Defense in depth for manifests restored or constructed outside the planner. */
function nativeCardToken(value: string) {
  return value.normalize('NFKC').replace(/[^\p{L}\p{N} ,.\-&]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Private journey';
}

/**
 * Codec discovery is advisory. Munim bundles libopenh264 on both supported
 * platforms, so a malformed or delayed discovery report must not reject a
 * private Replay before FFmpeg has attempted the supported portable encoder.
 */
async function selectReplayEncoder(): Promise<ReplayEncoder> {
  let name: string | undefined;
  try { name = await pickEncoder(['h264_videotoolbox', 'h264_mediacodec', 'libopenh264']); } catch { name = undefined; }
  const selected = name ?? 'libopenh264';
  return { name: selected, pixelFormat: selected === 'h264_mediacodec' ? 'nv12' : 'yuv420p' };
}

/** Native boundary: closed arguments only, never forwards FFmpeg logs or payloads. */
export const munimReplayRenderer: ReplayRenderer = {
  async render(manifest, sources, signal, onProgress) {
    if (signal.aborted) throw new ReplayPreparationError('REPLAY_STALE');
    // A visible qualified trip with no usable attachment renders only its
    // neutral local slate.  It is different from an empty/invalid scope and
    // never invents media or treats an access result as empty history.
    if (!sources.length && !manifest.groupKeys.length) throw new ReplayPreparationError('REPLAY_ACCESS');
    const cacheDirectory = FileSystem.cacheDirectory;
    if (!cacheDirectory) throw new ReplayPreparationError('REPLAY_UNAVAILABLE');
    const job = `replay-${manifest.generation}-${Math.random().toString(36).slice(2)}`;
    const outputUri = `${cacheDirectory}${job}.mp4`;
    const staging = `${cacheDirectory}${job}-staging/`;
    const cleanup = async () => {
      await Promise.all([FileSystem.deleteAsync(outputUri, { idempotent: true }), FileSystem.deleteAsync(staging, { idempotent: true })]);
    };
    const cancelled = () => signal.aborted;
    try {
      onProgress?.({ message: 'Starting the local video renderer.', completed: 0, total: Math.max(1, sources.length + manifest.groupKeys.length + 1) });
      await FileSystem.makeDirectoryAsync(staging, { intermediates: true });
      // Make the native call that S0 uses before asking the module for codecs.
      // Some Android development-process starts expose the hybrid object before
      // its codec inventory has initialized; a successful S0 query warms that
      // closed native boundary without seeing any owner media.
      const nativeReady = await execute(['-version']);
      if (!nativeReady.success || cancelled()) throw new ReplayPreparationError(cancelled() ? 'REPLAY_STALE' : 'REPLAY_UNAVAILABLE');
      // The synthetic physical S0 on Android already verified this ordered
      // local candidate set can write a cache MP4. Keep the same closed set
      // for real composition; output inspection remains the final gate.
      const encoder = await selectReplayEncoder();
      if (cancelled()) throw new ReplayPreparationError('REPLAY_STALE');
      // Every selected source is copied into an anonymous app-private job
      // directory before FFmpeg sees it.  This also turns Android content URIs
      // into local inputs without persisting owner paths in the manifest.
      const media: { source: ReplayRenderSource; uri: string }[] = [];
      for (const [index, source] of sources.entries()) {
        if (cancelled()) throw new ReplayPreparationError('REPLAY_STALE');
        onProgress?.({ message: `Preparing private media ${index + 1} of ${sources.length}.`, completed: index, total: Math.max(1, sources.length + manifest.groupKeys.length + 1) });
        const input = `${staging}input-${index}`;
        await FileSystem.copyAsync({ from: source.uri, to: input });
        if (source.kind === 'video') {
          // Keep the private local video source for a bounded moving clip.
          // The panel command below validates/decode-limits it and pads a short
          // clip without reading the whole original into memory.
          media.push({ source, uri: input });
          continue;
        }
        const still = `${staging}still-${index}.png`;
        const result = await execute(['-y', '-i', input, '-frames:v', '1', still]);
        if (cancelled()) throw new ReplayPreparationError('REPLAY_STALE');
        if (result.success) media.push({ source, uri: still });
      }
      if (!media.length && !manifest.groupKeys.length) throw new ReplayPreparationError('REPLAY_DECODE');
      const fallbackFrames = Math.max(1, Math.round(manifest.durationSeconds * 24 / Math.max(1, manifest.groupKeys.length)));
      const chapters: readonly import('./types').ReplayChapter[] = manifest.chapters ?? manifest.groupKeys.map((groupKey) => ({ groupKey, memoryKeys: media.filter((item) => item.source.groupKey === groupKey).map((item) => item.source.memoryKey), frames: fallbackFrames }));
      const panels: { groupKey: string; items: { source: ReplayRenderSource; uri: string }[]; frames: number; card?: import('./types').ReplayChapterCard }[] = chapters.flatMap((chapter) => {
        const items = media.filter((item) => item.source.groupKey === chapter.groupKey && chapter.memoryKeys.includes(item.source.memoryKey));
        const cardFrames = Math.min(chapter.card?.frames ?? 0, chapter.frames);
        const card = cardFrames ? [{ groupKey: chapter.groupKey, items: [], frames: cardFrames, card: chapter.card }] : [];
        const contentFrames = chapter.frames - cardFrames;
        if (!items.length) return card.length ? card : [{ groupKey: chapter.groupKey, items, frames: chapter.frames }];
        const baseFrames = Math.floor(contentFrames / items.length);
        const remainder = contentFrames % items.length;
        return [...card, ...items.map((item, index) => ({ groupKey: chapter.groupKey, items: [item], frames: baseFrames + (index < remainder ? 1 : 0) }))];
      });
      if (!panels.length) throw new ReplayPreparationError('REPLAY_SCOPE');
      const panelUris: string[] = [];
      const actualChapterFrames = new Map<string, number>();
      const totalWork = Math.max(1, sources.length + panels.length + 1);
      for (const [panelIndex, panel] of panels.entries()) {
        if (cancelled()) throw new ReplayPreparationError('REPLAY_STALE');
        onProgress?.({ message: `Rendering scene ${panelIndex + 1} of ${panels.length}.`, completed: sources.length + panelIndex, total: totalWork });
        let frames = panel.frames;
        const groupKey = panel.groupKey;
        if (panel.items[0]?.source.kind === 'video') {
          // A short owner video stays short.  Repeating its final frame would
          // manufacture motion-free filler merely to reach a still-image
          // timing budget, so probe its local staged duration before render.
          const sourceDuration = Number((await getMediaInformation(panel.items[0].uri)).format?.duration ?? 0);
          if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) throw new ReplayPreparationError('REPLAY_DECODE');
          frames = Math.min(frames, Math.max(1, Math.floor(sourceDuration * 24)));
        }
        const seconds = (frames / 24).toFixed(6);
        const panelUri = `${staging}panel-${panelIndex}.mp4`;
        if (!panel.items.length) {
          // Tokens are normalized before this boundary; raw labels never enter
          // a command, log, filename, or diagnostic payload.
          const drawCard = panel.card ? `drawtext=text='${nativeCardToken(panel.card.labelToken)}':fontcolor=0xF3EEDD:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=text='${nativeCardToken(panel.card.timeToken)}':fontcolor=0xB4C6B5:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2+36` : 'null';
          const result = await execute(['-y', '-f', 'lavfi', '-i', 'color=c=#102C26:s=1280x720:r=24', '-vf', drawCard, '-frames:v', String(frames), '-c:v', encoder.name, '-pix_fmt', encoder.pixelFormat, panelUri]);
          if (!result.success) throw new ReplayPreparationError('REPLAY_ENCODE');
          actualChapterFrames.set(groupKey, (actualChapterFrames.get(groupKey) ?? 0) + frames);
          panelUris.push(panelUri); continue;
        }
        if (panel.items[0]?.source.kind === 'video') {
          const result = await execute(['-y', '-ss', '0', '-t', seconds, '-i', panel.items[0].uri, '-filter_complex', `[0:v]fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,trim=duration=${seconds},setpts=PTS-STARTPTS[out]`, '-map', '[out]', '-frames:v', String(frames), '-c:v', encoder.name, '-pix_fmt', encoder.pixelFormat, panelUri]);
          if (!result.success) throw new ReplayPreparationError('REPLAY_DECODE');
          if (groupKey) actualChapterFrames.set(groupKey, (actualChapterFrames.get(groupKey) ?? 0) + frames);
          panelUris.push(panelUri); continue;
        }
        const args: string[] = ['-y'];
        for (const item of panel.items) args.push('-loop', '1', '-t', seconds, '-i', item.uri);
        const filters = panel.items.map((_, index) => `[${index}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x102C26,fps=24,format=yuv420p[v${index}]`);
        const layout = '[v0]null[out]';
        const result = await execute([...args, '-filter_complex', `${filters.join(';')};${layout}`, '-map', '[out]', '-frames:v', String(frames), '-c:v', encoder.name, '-pix_fmt', encoder.pixelFormat, panelUri]);
        if (!result.success) throw new ReplayPreparationError('REPLAY_ENCODE');
        if (groupKey) actualChapterFrames.set(groupKey, (actualChapterFrames.get(groupKey) ?? 0) + frames);
        panelUris.push(panelUri);
      }
      const listUri = `${staging}concat.txt`;
      onProgress?.({ message: 'Joining and checking your private Replay.', completed: totalWork - 1, total: totalWork });
      await FileSystem.writeAsStringAsync(listUri, panelUris.map((uri) => `file '${uri.replace(/'/g, "'\\''")}'`).join('\n'));
      const joined = await execute(['-y', '-f', 'concat', '-safe', '0', '-i', listUri, '-c', 'copy', '-movflags', '+faststart', outputUri]);
      const actualDurationSeconds = [...actualChapterFrames.values()].reduce((total, frames) => total + frames, 0) / 24;
      if (!joined.success || cancelled() || !(await verifyReplayOutput(outputUri, actualDurationSeconds))) throw new ReplayPreparationError(cancelled() ? 'REPLAY_STALE' : 'REPLAY_OUTPUT');
      const info = await FileSystem.getInfoAsync(outputUri);
      if (!info.exists || (info.size ?? 0) > 32 * 1024 * 1024) throw new ReplayPreparationError('REPLAY_OUTPUT');
      await FileSystem.deleteAsync(staging, { idempotent: true });
      const actualChapters = manifest.chapters?.map((chapter) => ({ ...chapter, frames: actualChapterFrames.get(chapter.groupKey) ?? chapter.frames }));
      return { uri: outputUri, digest: `${manifest.generation}:${manifest.memoryKeys.join(':')}`, manifest: { ...manifest, durationSeconds: actualDurationSeconds, chapters: actualChapters } };
    } catch (error) { await cleanup(); throw error instanceof ReplayPreparationError ? error : new ReplayPreparationError('REPLAY_DECODE'); }
  },
  async dispose(artifact) { await FileSystem.deleteAsync(artifact.uri, { idempotent: true }); },
};

export async function verifyReplayOutput(uri: string, expectedDuration?: number): Promise<boolean> {
  try {
    const media = await getMediaInformation(uri);
    const video = media.streams?.filter((stream) => stream.codec_type === 'video') ?? [];
    const disallowed = media.streams?.some((stream) => ['audio', 'data', 'subtitle', 'attachment'].includes(stream.codec_type ?? ''));
    const duration = Number(media.format?.duration ?? 0);
    return video.length === 1 && video[0]?.codec_name === 'h264' && video[0]?.width === 1280 && video[0]?.height === 720
      && video[0]?.pix_fmt === 'yuv420p' && !disallowed && Number.isFinite(duration) && duration > 0
      && (expectedDuration === undefined || Math.abs(duration - expectedDuration) <= 1 / 24 + 0.01);
  } catch { return false; }
}

/** A returned void only means the OS sheet closed; no delivery claim is made. */
export async function shareReplayArtifact(artifact: ReplayArtifact): Promise<'unavailable' | 'closed'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(artifact.uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
  return 'closed';
}

/** Kept reachable for S0's synthetic adapter; no log callback is ever attached. */
export async function runSyntheticS0(arguments_: string[]) { return execute(arguments_); }

/** Creates only a one-second colour test clip in cache; it never accepts owner media. */
export async function runSyntheticEncodeS0(): Promise<boolean> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return false;
  const outputUri = `${cacheDirectory}travel-life-replay-s0.mp4`;
  try {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
    const encoder = await selectReplayEncoder();
    const session = await execute([
      '-y', '-f', 'lavfi', '-i', 'color=c=#102C26:s=176x144:r=30',
      '-t', '1', '-c:v', encoder.name, '-pix_fmt', encoder.pixelFormat, '-movflags', '+faststart', outputUri,
    ]);
    if (!session.success) return false;
    const media = await getMediaInformation(outputUri);
    const duration = Number(media.format?.duration ?? 0);
    return Number.isFinite(duration) && duration > 0 && media.streams?.some((stream) => stream.codec_type === 'video') === true;
  } catch {
    return false;
  }
}

/**
 * The native S0 gate has not selected a production encoder. This explicit
 * adapter fails closed so a host build cannot accidentally claim rendering.
 */
export const unavailableReplayRenderer: ReplayRenderer = {
  async render() { throw new ReplayPreparationError('REPLAY_UNAVAILABLE'); },
};
