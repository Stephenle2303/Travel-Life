import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { takeCapability, createRecipientClient } from '../apps/share-viewer/src/recipient.ts';
import { secureViewerDocument } from '../apps/share-viewer/api/viewer.mjs';
test('viewer consumes fragment once, erases history including query, rejects query capabilities', () => {
  const replaced = []; const history = { replaceState(...args) { replaced.push(args); } };
  assert.equal(takeCapability({ hash: '#' + 'S'.repeat(43), pathname: '/', search: '' }, history), 'S'.repeat(43));
  assert.deepEqual(replaced[0], [null, '', '/']);
  assert.equal(takeCapability({ hash: '#' + 'S'.repeat(43), pathname: '/', search: '?token=PRIVATE' }, history), null);
});
test('recipient rejects unsupported payload and never puts capability in request URL', async () => {
  const requests = []; const logs = []; const original = console.info; console.info = (...args) => logs.push(args);
  try {
    const client = createRecipientClient('https://synthetic.example/read', 'publishable', 'S'.repeat(43), async (...args) => { requests.push(args); return new Response(JSON.stringify({ snapshot: { schemaVersion: 'unsupported', raw: 'PRIVATE_SENTINEL' } }), { status: 200 }); });
    assert.equal(await client.snapshot(), null);
    assert.equal(requests[0][0].includes('SSSS'), false);
    assert.equal(requests[0][1].cache, 'no-store');
    assert.equal(JSON.stringify(logs).includes('PRIVATE_SENTINEL'), false);
    assert.equal(logs.at(-1)[1].reasonCode, 'INVALID_REQUEST');
  } finally { console.info = original; }
});
test('hosting package denies persistence and uses generic metadata with no analytics/service worker', async () => {
  const root = new URL('../apps/share-viewer/', import.meta.url);
  const config = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
  const headers = Object.fromEntries(config.headers[0].headers.map(h => [h.key, h.value]));
  assert.match(headers['Cache-Control'], /no-store/); assert.equal(headers['Referrer-Policy'], 'no-referrer');
  const shell=secureViewerDocument('<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">','S'.repeat(43));
  assert.match(shell.csp,/frame-ancestors 'none'/);assert.match(shell.csp,/'strict-dynamic'/);assert.doesNotMatch(shell.csp,/unsafe-inline|unsafe-eval/);
  assert.equal((shell.html.match(/nonce="S{43}"/g)??[]).length,2);
  assert.throws(()=>secureViewerDocument('', 'PRIVATE_SENTINEL'));
  assert.deepEqual(config.rewrites,[{source:'/',destination:'/api/viewer'},{source:'/index.html',destination:'/api/viewer'}]);
  const source = await readFile(new URL('src/main.tsx', root), 'utf8');
  assert.doesNotMatch(source, /innerHTML|serviceWorker|analytics|localStorage|sessionStorage/);
  assert.match(source, /Date unknown/); assert.match(source, /Inferred/);
  assert.match(source, /addEventListener\('hashchange'/);
  assert.match(source, /replaceChildren\(\)/);
  assert.match(source, /window\.location\.reload\(\)/);
});
