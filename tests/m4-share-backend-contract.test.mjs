import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('M4.5 owner mutation function is JWT protected, no-store and does not log request content', async () => {
  const [config, source] = await Promise.all([
    read('supabase/config.toml'),
    read('supabase/functions/travel-life-share/index.ts'),
  ]);
  assert.match(config, /\[functions\.travel-life-share\][\s\S]*verify_jwt = true/);
  const runtime = await read('supabase/functions/_shared/share-runtime.ts');
  assert.match(runtime, /cache-control': 'no-store'/);
  assert.match(source, /withSupabase\(\{ auth: 'user' \}/);
  assert.doesNotMatch(source, /console\./);
  assert.match(runtime, /opaque\(input.capability, 43, 43\)/);
});

test('M4.5 server migration keeps share state private and fences activation before cleanup', async () => {
  const source = await read('supabase/migrations/20261026090000_m4_5_selected_share_snapshots.sql');
  assert.match(source, /create schema if not exists share_private/);
  assert.match(source, /enable row level security/g);
  assert.match(source, /revoke all on all tables in schema share_private from public, anon, authenticated/);
  assert.match(source, /delete_fenced_at/);
  assert.match(source, /activate_travel_life_share_publish/);
  assert.match(source, /state = 'revoke_pending'/);
  assert.match(source, /grant execute on function .* to service_role/g);
});
