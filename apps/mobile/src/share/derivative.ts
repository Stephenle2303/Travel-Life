import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Image } from 'react-native';
import { execute, getMediaInformation, pickEncoder } from 'munim-ffmpeg';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ShareMedia } from '../../../../supabase/functions/_shared/share-protocol';
import { scrubMp4Metadata } from '../../../../supabase/functions/_shared/share-media';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { ShareOwnerError } from './owner-service';

const bytesOf = (base64: string) => Uint8Array.from(atob(base64), char => char.charCodeAt(0));
const encode = (bytes: Uint8Array) => { let result = ''; for (let index = 0; index < bytes.length; index += 16_384) result += String.fromCharCode(...bytes.slice(index, index + 16_384)); return btoa(result); };
/** Removing JPEG APP/comment segments does not alter the compressed picture. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Invalid selected copy.');
  const parts = [bytes.slice(0, 2)]; let cursor = 2;
  while (cursor < bytes.length - 2) {
    const start = cursor; if (bytes[cursor++] !== 255) throw new Error('Invalid selected copy.'); const marker = bytes[cursor++];
    if (marker === 218) { parts.push(bytes.slice(start)); cursor = bytes.length; break; }
    const size = bytes[cursor] * 256 + bytes[cursor + 1]; if (size < 2 || cursor + size > bytes.length) throw new Error('Invalid selected copy.');
    if (!(marker >= 225 && marker <= 239) && marker !== 254) parts.push(bytes.slice(start, cursor + size)); cursor += size;
  }
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
}
export async function prepareSelectedDerivative(sourceUri: string, kind: 'photo' | 'video', correlationId: string): Promise<{ uri: string; manifest: ShareMedia }> {
  let stage: AppDiagnosticEvent['stage'] = 'SHARE_COPY';
  const emit = (reasonCode: AppDiagnosticEvent['reasonCode'], durableOutcome: AppDiagnosticEvent['durableOutcome']) => recordAppDiagnostic({ operation: 'SHARE_DERIVATIVE', stage, reasonCode, retryable: reasonCode === 'SHARE_STORAGE', durableOutcome, correlationId });
  const key = Crypto.randomUUID(); const directory = FileSystem.cacheDirectory;
  if (!directory) { emit('SHARE_STORAGE', 'failed'); throw new ShareOwnerError('SHARE_STORAGE', stage); }
  const staged = `${directory}share-source-${key}`; const uri = `${directory}share-derivative-${key}.${kind === 'photo' ? 'jpg' : 'mp4'}`;
  emit('START', 'unchanged');
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: staged }); emit('COMPLETE', 'complete');
    stage = 'SHARE_DECODE'; emit('START', 'unchanged');
    let width: number; let height: number; let durationMillis: number | null = null;
    if (kind === 'photo') {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(staged, (width, height) => resolve({ width, height }), reject));
      const scale = Math.min(1, 1600 / Math.max(dimensions.width, dimensions.height)); width = Math.max(1, Math.round(dimensions.width * scale)); height = Math.max(1, Math.round(dimensions.height * scale)); emit('COMPLETE', 'complete');
      stage = 'SHARE_ENCODE'; emit('START', 'unchanged');
      const context = ImageManipulator.manipulate(staged); context.resize({ width, height }); const image = await context.renderAsync(); const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: false });
      const cleaned = stripJpegMetadata(bytesOf(await FileSystem.readAsStringAsync(saved.uri, { encoding: FileSystem.EncodingType.Base64 })));
      await FileSystem.writeAsStringAsync(uri, encode(cleaned), { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.deleteAsync(saved.uri, { idempotent: true });
    } else {
      const info = await getMediaInformation(staged); const videos = info.streams?.filter(stream => stream.codec_type === 'video') ?? [];
      if (!videos[0]?.width || !videos[0]?.height) throw new ShareOwnerError('SHARE_DECODE', stage);
      const scale = Math.min(1, 720 / Math.min(videos[0].width, videos[0].height), 1280 / Math.max(videos[0].width, videos[0].height));
      width = Math.max(2, Math.floor(videos[0].width * scale / 2) * 2); height = Math.max(2, Math.floor(videos[0].height * scale / 2) * 2); durationMillis = Math.round(Number(info.format?.duration) * 1000);
      if (!Number.isSafeInteger(durationMillis) || durationMillis < 1 || durationMillis > 3_600_000) throw new ShareOwnerError('SHARE_CODEC', stage);
      emit('COMPLETE', 'complete'); stage = 'SHARE_ENCODE'; emit('START', 'unchanged');
      const encoder = await pickEncoder(['h264_videotoolbox', 'h264_mediacodec', 'libopenh264']).catch(() => undefined) ?? 'libopenh264';
      const result = await execute(['-y', '-i', staged, '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-map_metadata:s', '-1', '-map_chapters', '-1', '-vf', `scale=${width}:${height}`, '-c:v', encoder, '-pix_fmt', encoder === 'h264_mediacodec' ? 'nv12' : 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact', '-metadata', 'encoder=', '-metadata:s:v', 'encoder=', '-metadata:s:v', 'handler_name=VideoHandler', '-metadata:s:a', 'handler_name=SoundHandler', '-use_editlist', '0', uri]);
      if (!result.success) throw new ShareOwnerError('SHARE_ENCODE', stage);
      const encodedVideo = bytesOf(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
      await FileSystem.writeAsStringAsync(uri, encode(scrubMp4Metadata(encodedVideo)), { encoding: FileSystem.EncodingType.Base64 });
      const output = await getMediaInformation(uri); const streams = output.streams ?? [];
      if (streams.filter(stream => stream.codec_type === 'video' && stream.codec_name === 'h264').length !== 1 || streams.some(stream => stream.codec_type !== 'video' && (stream.codec_type !== 'audio' || stream.codec_name !== 'aac')) || (info.streams?.some(stream => stream.codec_type === 'audio') && !streams.some(stream => stream.codec_type === 'audio'))) throw new ShareOwnerError('SHARE_VERIFY', 'SHARE_VERIFY');
    }
    emit('COMPLETE', 'complete'); stage = 'SHARE_VERIFY'; emit('START', 'unchanged');
    const data = bytesOf(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
    if (!data.length || data.length > 52_428_800) throw new ShareOwnerError('SHARE_QUOTA', stage);
    const hash = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data)); const sha256 = [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const manifest: ShareMedia = { key, kind, mimeType: kind === 'photo' ? 'image/jpeg' : 'video/mp4', width, height, durationMillis, byteLength: data.length, sha256, caption: '' };
    emit('COMPLETE', 'complete'); return { uri, manifest };
  } catch (error) { const safe = error instanceof ShareOwnerError ? error : new ShareOwnerError(stage === 'SHARE_COPY' ? 'SHARE_STORAGE' : stage === 'SHARE_DECODE' ? 'SHARE_DECODE' : stage === 'SHARE_ENCODE' ? 'SHARE_ENCODE' : 'SHARE_VERIFY', stage); stage = safe.stage; emit(safe.reason, 'failed'); await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); throw safe; }
  finally { await FileSystem.deleteAsync(staged, { idempotent: true }).catch(() => {}); }
}
