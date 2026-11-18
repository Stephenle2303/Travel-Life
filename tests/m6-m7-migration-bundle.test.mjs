import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('M6/M7 migration contains the reviewed SQL drafts in tested order', async () => {
  const directory = '_bmad-output/implementation-artifacts/';
  const names = [
    'm7-source-media-selection-draft.sql', 'm6-account-controls-draft.sql',
    'm7-aggregate-continuity-draft.sql', 'm7-source-impact-draft.sql',
    'm6-account-deletion-draft.sql', 'm7-correction-journal-draft.sql',
    'm7-media-abandon-draft.sql', 'm7-legacy-owner-migration-draft.sql',
  ];
  const parts = await Promise.all(names.map(async name =>
    `-- Source: ${directory}${name}\n${(await readFile(directory + name, 'utf8')).trimEnd()}\n`));
  const expected = '-- Consolidated, locally tested M6/M7 changes; not yet deployed.\n' + parts.join('\n');
  assert.equal(await readFile('supabase/migrations/20261029084647_m6_m7_test_readiness.sql', 'utf8'), expected);
});
