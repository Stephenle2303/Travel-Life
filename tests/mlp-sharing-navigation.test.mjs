import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('MLP navigation exposes local Replay video sharing but no hosted-link route', async () => {
  const replay = await readFile('apps/mobile/src/components/replay-screen.tsx', 'utf8');
  const atlas = await readFile('apps/mobile/src/components/mobile-screens.tsx', 'utf8');
  const atlasReveal = await readFile('apps/mobile/src/components/atlas-reveal.tsx', 'utf8');
  const provider = await readFile('apps/mobile/src/photo-access/provider.tsx', 'utf8');

  assert.match(replay, /Share selected Replay video/);
  assert.doesNotMatch(replay, /Publish selected highlight link/);
  assert.doesNotMatch(atlas, /Share selected highlight/);
  assert.doesNotMatch(atlas, /router\.push\('\/share'/);
  assert.doesNotMatch(atlasReveal, /onShareJourney|Prepare selected share/);
  assert.doesNotMatch(provider, /share\/owner-service/);
  await assert.rejects(access('apps/mobile/src/app/share.tsx'));
});
