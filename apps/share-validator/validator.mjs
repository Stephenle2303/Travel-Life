import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const execute = promisify(execFile);
const safeTag = (key, value) => key === 'language' && value === 'und' || key === 'handler_name' && ['VideoHandler', 'SoundHandler'].includes(value) || key === 'encoder' && /^(?:Lavc\d+(?:\.\d+){0,2} (?:mjpeg|libopenh264|h264_videotoolbox|h264_mediacodec)|)$/.test(value) || key === 'vendor_id' && value === '[0][0][0][0]' || key === 'major_brand' && ['isom', 'mp41', 'mp42'].includes(value) || key === 'minor_version' && /^\d{1,10}$/.test(value) || key === 'compatible_brands' && /^(?:isom|iso2|mp41|mp42|avc1)+$/.test(value);
export async function validateDecodedDerivative(bytes, manifest, runner = execute) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 1 || bytes.length > 52_428_800 || manifest.byteLength !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) return null;
  const directory = await mkdtemp(join(tmpdir(), 'share-validator-'));
  const input = join(directory, manifest.kind === 'photo' ? 'derivative.jpg' : 'derivative.mp4');
  try {
    await writeFile(input, bytes, { mode: 0o600 });
    const { stdout } = await runner('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_format', '-show_streams', '-of', 'json', input], { timeout: 30_000, maxBuffer: 128_000, windowsHide: true });
    const probe = JSON.parse(stdout); const streams = probe.streams; if (!Array.isArray(streams) || streams.length < 1 || streams.length > 2) return null;
    const video = streams.filter(stream => stream.codec_type === 'video'); const audio = streams.filter(stream => stream.codec_type === 'audio');
    if (video.length !== 1 || streams.some(stream => !['video', 'audio'].includes(stream.codec_type)) || video[0].width !== manifest.width || video[0].height !== manifest.height) return null;
    if (manifest.kind === 'photo' ? video[0].codec_name !== 'mjpeg' || audio.length !== 0 || !String(probe.format?.format_name).includes('jpeg') : video[0].codec_name !== 'h264' || audio.some(stream => stream.codec_name !== 'aac') || !String(probe.format?.format_name).includes('mp4') || Math.abs(Number(probe.format?.duration) * 1000 - manifest.durationMillis) > 2000) return null;
    for (const scope of [probe.format, ...streams]) {
      if (scope?.tags && Object.entries(scope.tags).some(([key, value]) => !safeTag(key, value))) return null;
      if (scope?.side_data_list?.some(item => !['Display Matrix', 'CPB properties'].includes(item.side_data_type))) return null;
    }
    // Decode the complete file, reject corrupt/truncated streams and unexpected
    // referenced inputs. No URLs, demuxer messages or filesystem details escape.
    await runner('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-err_detect', 'explode', '-protocol_whitelist', 'file,pipe', '-i', input, '-map', '0:v:0', ...(audio.length ? ['-map', '0:a:0'] : []), '-f', 'null', '-'], { timeout: 120_000, maxBuffer: 64_000, windowsHide: true });
    return { contractVersion: 'travel-life-derivative-verification-v1', sha256: manifest.sha256, byteLength: bytes.length, mimeType: manifest.mimeType, width: manifest.width, height: manifest.height, durationMillis: manifest.durationMillis, verified: true };
  } catch { return null; }
  finally { await rm(directory, { recursive: true, force: true }); }
}
