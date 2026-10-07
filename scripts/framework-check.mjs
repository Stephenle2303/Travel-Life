import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { treeDigest } from './integrity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root,'framework.lock.json'),'utf8'));
const skillRoot = join(root,'.agents/skills');
const directories = readdirSync(skillRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
const expected = lock.skills.map(s=>s.name).sort();
assert.deepEqual(directories,expected,'Installed skill inventory differs from the reviewed lock');
for(const skill of lock.skills) {
  const path = join(skillRoot,skill.name);
  const doc = readFileSync(join(path,'SKILL.md'),'utf8');
  assert.match(doc,/^---\r?\n/,'Missing frontmatter: '+skill.name);
  const match = doc.match(/^name:\s*['"]?([^\r\n'"]+)['"]?\s*$/m);
  assert.equal(match?.[1]?.trim(),skill.name,'Skill name mismatch: '+skill.name);
  assert.deepEqual(treeDigest(path),skill.integrity,'Skill drift: '+skill.name);
}
for(const path of ['AGENTS.md','docs/project-state.md','docs/development/workflow.md','evals/README.md',
  '_bmad/config.toml','_bmad/scripts/resolve_config.py','_bmad/_config/bmad-help.csv',
  'docs/product/source-analysis.txt','docs/third-party/ECC-LICENSE.txt','docs/third-party/BMAD-LICENSE.txt',
  'docs/third-party/EVALS-SKILLS-LICENSE.txt']) {
  assert.ok(existsSync(join(root,path)),'Missing foundation file: '+path);
}
const manifest = readFileSync(join(root,'_bmad/_config/manifest.yaml'),'utf8');
assert.match(manifest,/version: 6\.12\.1/,'Unexpected BMAD runtime version');
assert.match(manifest,/\bcodex\b/,'BMAD Codex target missing');
for(const runtime of lock.runtime) {
  assert.deepEqual(treeDigest(join(root,runtime.path)),runtime.integrity,'Runtime drift: '+runtime.path);
}
console.log('Framework integrity: '+lock.skills.length+' skills and '+lock.runtime.length+' BMAD runtime trees match pinned records.');
