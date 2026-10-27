import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateDecodedDerivative } from '../apps/share-validator/validator.mjs';
const bytes = Uint8Array.of(255,216,1,255,217);
const manifest = { kind: 'photo', byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), mimeType: 'image/jpeg', width: 1, height: 1, durationMillis: null };
test('trusted decode package binds attestation to bytes and requires complete decode', async () => {
  const calls = []; const runner = async (...args) => { calls.push(args); return { stdout: JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'mjpeg', width: 1, height: 1 }], format: { format_name: 'jpeg_pipe' } }) }; };
  const result = await validateDecodedDerivative(bytes, manifest, runner); assert.equal(result.verified, true); assert.equal(result.sha256, manifest.sha256); assert.equal(calls.length, 2); assert.ok(calls[1][1].includes('-xerror')); assert.ok(calls[1][1].includes('file,pipe'));
  assert.equal(await validateDecodedDerivative(bytes, { ...manifest, sha256: 'a'.repeat(64) }, runner), null);
});
test('rejects metadata/extra tracks/decoder faults without leaking content', async () => {
  for (const probe of [{ streams: [{ codec_type: 'video', codec_name: 'mjpeg', width: 1, height: 1, tags: { comment: 'PRIVATE_SENTINEL' } }], format: { format_name: 'jpeg_pipe' } }, { streams: [{ codec_type: 'attachment' }], format: {} }]) assert.equal(await validateDecodedDerivative(bytes, manifest, async () => ({ stdout: JSON.stringify(probe) })), null);
  assert.equal(await validateDecodedDerivative(bytes, manifest, async () => { throw new Error('PRIVATE_SENTINEL'); }), null);
});
