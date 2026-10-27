import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('mobile Metro bundles the vetted Replay audio and resolves shared share sources', async () => {
  const metro = await readFile('apps/mobile/metro.config.js', 'utf8');
  assert.match(metro, /assetExts[\s\S]*['"]ogg['"]/);
  await stat('apps/mobile/assets/audio/meadow-thoughts.ogg');
  const ownerService = await readFile('apps/mobile/src/share/owner-service.ts', 'utf8');
  assert.match(ownerService, /supabase\/functions\/_shared\/share-protocol/);
  await stat('supabase/functions/_shared/share-protocol.ts');
});
