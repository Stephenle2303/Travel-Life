import type { ShareMedia } from './share-protocol.ts';
import { sha256 } from './share-protocol.ts';

/** Native FFmpeg emits moov after mdat here. Removing metadata only from that
 * terminal index preserves every sample's absolute offset and encoded bytes.
 * Reject other layouts instead of guessing how to rewrite sample offsets. */
export function scrubMp4Metadata(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const word = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
  const join = (parts: Uint8Array[]) => { const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; };
  const box = (type: string, body: Uint8Array) => { const output = new Uint8Array(body.length + 8); new DataView(output.buffer).setUint32(0, output.length); output.set(new TextEncoder().encode(type), 4); output.set(body, 8); return output; };
  const rewrite = (start: number, end: number, depth: number): Uint8Array => {
    if (depth > 8) throw new Error('Invalid selected copy.');
    const parts: Uint8Array[] = [];
    for (let at = start; at < end;) {
      if (at + 8 > end) throw new Error('Invalid selected copy.');
      const size = view.getUint32(at); const type = word(at + 4); const limit = at + size;
      if (size < 8 || limit > end) throw new Error('Invalid selected copy.');
      if (['udta', 'meta', 'uuid'].includes(type)) { at = limit; continue; }
      let body: Uint8Array = bytes.slice(at + 8, limit);
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf'].includes(type)) body = rewrite(at + 8, limit, depth + 1);
      else if (['mvhd', 'mdhd', 'tkhd'].includes(type)) {
        if (body.length < 12 || body[0] !== 0) throw new Error('Invalid selected copy.');
        body.fill(0, 4, 12);
      } else if (type === 'hdlr') {
        if (body.length < 25) throw new Error('Invalid selected copy.');
        const handler = word(at + 16); const label = handler === 'vide' ? 'VideoHandler' : handler === 'soun' ? 'SoundHandler' : null;
        if (!label) throw new Error('Invalid selected copy.');
        body = join([body.slice(0, 24), new TextEncoder().encode(label + '\0')]);
      } else if (type === 'stsd') {
        if (body.length < 16 || new DataView(body.buffer, body.byteOffset).getUint32(4) !== 1) throw new Error('Invalid selected copy.');
        const sampleStart = at + 16; const sampleSize = view.getUint32(sampleStart); const codec = word(sampleStart + 4);
        if (sampleStart + sampleSize !== limit) throw new Error('Invalid selected copy.');
        if (codec === 'avc1') {
          if (sampleSize < 86) throw new Error('Invalid selected copy.');
          // The Pascal compressor-name field is exactly 32 bytes.
          body.fill(0, 8 + 50, 8 + 82);
        } else if (codec !== 'mp4a') throw new Error('Invalid selected copy.');
      }
      parts.push(box(type, body)); at = limit;
    }
    return join(parts);
  };
  let moovAt = -1; let mediaEnd = -1;
  for (let at = 0; at < bytes.length;) {
    if (at + 8 > bytes.length) throw new Error('Invalid selected copy.');
    const size = view.getUint32(at); const type = word(at + 4);
    if (size < 8 || at + size > bytes.length) throw new Error('Invalid selected copy.');
    if (type === 'mdat') mediaEnd = at + size;
    if (type === 'moov') { if (moovAt !== -1 || at + size !== bytes.length) throw new Error('Invalid selected copy.'); moovAt = at; }
    at += size;
  }
  if (moovAt < 0 || mediaEnd < 0 || moovAt < mediaEnd) throw new Error('Invalid selected copy.');
  return join([bytes.slice(0, moovAt), rewrite(moovAt, bytes.length, 0)]);
}

/** Bounded structural verifier. Deployment additionally requires trusted codec decode acceptance. */
export async function verifyDerivative(bytes: Uint8Array, manifest: ShareMedia): Promise<boolean> {
  if (bytes.byteLength !== manifest.byteLength || bytes.byteLength > 52_428_800 || await sha256(bytes) !== manifest.sha256) return false;
  try { return manifest.kind === 'photo' ? jpeg(bytes, manifest) : mp4(bytes, manifest); } catch { return false; }
}
function jpeg(bytes: Uint8Array, manifest: ShareMedia) {
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return false;
  let cursor = 2; let dimensions = false; let scan = false;
  while (cursor < bytes.length - 2) {
    if (bytes[cursor++] !== 255) return false;
    const marker = bytes[cursor++];
    if (marker === 0 || marker === 216 || marker === 217) return false;
    if (marker >= 208 && marker <= 215) continue;
    const length = bytes[cursor] * 256 + bytes[cursor + 1];
    if (length < 2 || cursor + length > bytes.length - 2) return false;
    // APP0 JFIF contains only fixed format/density fields; EXIF/XMP/ICC/comments are forbidden.
    if (marker >= 224 && marker <= 239) {
      if (marker !== 224 || length !== 16 || String.fromCharCode(...bytes.slice(cursor + 2, cursor + 7)) !== 'JFIF\0' || bytes[cursor + 14] !== 0 || bytes[cursor + 15] !== 0) return false;
    } else if (marker === 254) return false;
    else if (marker === 192 || marker === 194) {
      if (bytes[cursor + 2] !== 8 || bytes[cursor + 7] !== 3 || bytes[cursor + 3] * 256 + bytes[cursor + 4] !== manifest.height || bytes[cursor + 5] * 256 + bytes[cursor + 6] !== manifest.width) return false;
      dimensions = true;
    } else if (![196, 219, 221, 218].includes(marker)) return false;
    cursor += length;
    if (marker === 218) {
      scan = true;
      while (cursor < bytes.length - 2) {
        if (bytes[cursor++] !== 255) continue;
        const next = bytes[cursor];
        if (next === 0 || next >= 208 && next <= 215) { cursor++; continue; }
        cursor--; break;
      }
    }
  }
  return cursor === bytes.length - 2 && dimensions && scan;
}
function mp4(bytes: Uint8Array, manifest: ShareMedia) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read = (offset: number) => view.getUint32(offset);
  const word = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  let video = 0; let audio = 0; let mdat = 0; let moov = 0; let ftyp = 0;
  const boxes = (start: number, end: number, depth: number) => {
    if (depth > 7) return false;
    for (let position = start; position < end;) {
      if (end - position < 8) return false;
      const size = read(position); const type = word(position + 4);
      if (size < 8 || size > end - position) return false;
      const body = position + 8; const limit = position + size;
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf'].includes(type)) {
        if (type === 'moov') moov++;
        if (!boxes(body, limit, depth + 1)) return false;
      } else if (type === 'ftyp') { if (depth !== 0 || size < 16 || !['isom', 'mp42', 'mp41'].includes(word(body))) return false; ftyp++; }
      else if (type === 'mdat') { if (depth !== 0 || size < 9) return false; mdat++; }
      else if (type === 'free') { for (let i = body; i < limit; i++) if (bytes[i] !== 0) return false; }
      else if (type === 'hdlr') {
        if (size < 33 || !['vide', 'soun'].includes(word(body + 8))) return false;
        // Only fixed encoder-generated handler labels are accepted.
        const name = new TextDecoder().decode(bytes.slice(body + 24, limit)).replace(/\0+$/, '');
        if (!['', 'VideoHandler', 'SoundHandler'].includes(name)) return false;
      } else if (type === 'stsd') {
        if (size < 24 || read(body + 4) !== 1) return false;
        const sample = body + 8; const sampleSize = read(sample); const codec = word(sample + 4);
        if (sampleSize !== limit - sample) return false;
        if (codec === 'avc1') {
          if (++video > 1 || sampleSize < 86 || view.getUint16(sample + 32) !== manifest.width || view.getUint16(sample + 34) !== manifest.height) return false;
          // Compressor name is a metadata channel; only blank or fixed native encoder label.
          const length = bytes[sample + 50]; const compressor = new TextDecoder().decode(bytes.slice(sample + 51, sample + 51 + length));
          if (length > 31 || !['', 'Lavc libx264', 'H.264', 'h264_videotoolbox', 'h264_mediacodec'].includes(compressor)) return false;
          if (!boxes(sample + 86, limit, depth + 1)) return false;
        } else if (codec === 'mp4a') { if (++audio > 1 || sampleSize < 36 || !boxes(sample + 36, limit, depth + 1)) return false; }
        else return false;
      } else if (type === 'mvhd' || type === 'mdhd') {
        // Reject original creation/modification timestamps. Native sanitizer emits zero.
        if (bytes[body] !== 0 || read(body + 4) !== 0 || read(body + 8) !== 0) return false;
        if (type === 'mvhd') { const scale = read(body + 12); const duration = read(body + 16); if (!scale || Math.abs(duration / scale * 1000 - Number(manifest.durationMillis)) > 2000) return false; }
      } else if (type === 'tkhd') {
        if (size < 32 || bytes[body] !== 0 || read(body + 4) !== 0 || read(body + 8) !== 0) return false;
      } else if (type === 'dref') {
        // One self-contained data reference; external URLs or filenames are forbidden.
        if (size !== 28 || read(body) !== 0 || read(body + 4) !== 1 || read(body + 8) !== 12 || word(body + 12) !== 'url ' || read(body + 16) !== 1) return false;
      } else if (type === 'colr') {
        if (!['nclx', 'nclc'].includes(word(body)) || ![18, 19].includes(size)) return false;
      } else if (!['vmhd', 'smhd', 'stts', 'stsc', 'stsz', 'stco', 'co64', 'stss', 'ctts', 'avcC', 'esds', 'pasp', 'btrt', 'sdtp', 'sgpd', 'sbgp'].includes(type)) return false;
      position = limit;
    }
    return true;
  };
  return boxes(0, bytes.length, 0) && ftyp === 1 && moov === 1 && mdat === 1 && video === 1;
}
