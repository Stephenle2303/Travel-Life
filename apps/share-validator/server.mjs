import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { validateDecodedDerivative } from './validator.mjs';
const secret = process.env.SHARE_VALIDATOR_SECRET;
if (!secret || secret.length < 43) throw new Error('Validator configuration unavailable.');
let active = 0;
const authorized = value => { const expected = Buffer.from('Bearer ' + secret); const actual = Buffer.from(value ?? ''); return expected.length === actual.length && timingSafeEqual(expected, actual); };
http.createServer(async (request, response) => {
  response.setHeader('cache-control', 'no-store'); response.setHeader('content-type', 'application/json'); response.setHeader('x-content-type-options', 'nosniff');
  const deny = status => { response.writeHead(status); response.end('{"status":"unavailable"}'); };
  if (request.method !== 'POST' || request.url !== '/verify' || !authorized(request.headers.authorization) || active >= 1) { deny(503); request.resume(); return; }
  active++;
  try {
    const manifestHeader = request.headers['x-share-manifest']; if (typeof manifestHeader !== 'string' || manifestHeader.length > 4096) { deny(400); return; }
    const manifest = JSON.parse(Buffer.from(manifestHeader, 'base64url').toString('utf8'));
    if (!manifest || !['photo', 'video'].includes(manifest.kind) || !['image/jpeg', 'video/mp4'].includes(manifest.mimeType) || !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength < 1 || manifest.byteLength > 52_428_800) { deny(400); return; }
    let size = 0; const chunks = [];
    for await (const chunk of request) { size += chunk.length; if (size > manifest.byteLength || size > 52_428_800) { deny(413); return; } chunks.push(chunk); }
    const result = await validateDecodedDerivative(Buffer.concat(chunks), manifest);
    if (!result) { deny(422); return; }
    response.end(JSON.stringify(result));
  } catch { deny(400); }
  finally { active--; }
}).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
