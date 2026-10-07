import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { treeDigest } from '../scripts/integrity.mjs';

test('framework digest survives text line-ending changes and rejects drift', () => {
  const root = mkdtempSync(join(tmpdir(),'travel-life-integrity-'));
  try {
    writeFileSync(join(root,'SKILL.md'),'first\r\nsecond\r\n');
    const before = treeDigest(root);
    writeFileSync(join(root,'SKILL.md'),'first\nsecond\n');
    assert.deepEqual(treeDigest(root),before);
    mkdirSync(join(root,'__pycache__'));
    writeFileSync(join(root,'__pycache__','generated.pyc'),'ignored');
    assert.deepEqual(treeDigest(root),before);
    writeFileSync(join(root,'extra.md'),'unreviewed file');
    assert.notDeepEqual(treeDigest(root),before);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));
    rmSync(root,{recursive:true,force:true});
  }
});
test('binary assets participate in the digest without text conversion', () => {
  const root = mkdtempSync(join(tmpdir(),'travel-life-integrity-'));
  try {
    writeFileSync(join(root,'asset.png'),Buffer.from([0,13,10,255]));
    const before = treeDigest(root);
    writeFileSync(join(root,'asset.png'),Buffer.from([0,10,255]));
    assert.notDeepEqual(treeDigest(root),before);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));
    rmSync(root,{recursive:true,force:true});
  }
});
