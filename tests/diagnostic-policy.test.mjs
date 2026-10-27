import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const policyPath = 'docs/development/diagnostic-implementation-policy.md';

test('direct implementation and workflow both load the diagnostic delivery gate', () => {
  assert.ok(existsSync(new URL(`../${policyPath}`, import.meta.url)));
  assert.ok(read('AGENTS.md').includes(policyPath));
  assert.ok(read('docs/development/workflow.md').includes('diagnostic-implementation-policy.md'));
  const policy = read(policyPath);
  for (const section of ['## Before implementation', '## Runtime contract', '## Incident workflow', '## Required completion evidence']) {
    assert.ok(policy.includes(section), `Missing policy section: ${section}`);
  }
});

test('BMAD implementation entry points and context-free handoffs retain the policy', () => {
  for (const name of ['bmad-build', 'bmad-build-auto', 'bmad-agent-dev']) {
    const override = read(`_bmad/custom/${name}.toml`);
    assert.ok(override.includes(`file:{project-root}/${policyPath}`), `${name} lost policy loading`);
    assert.ok(override.includes('activation_steps_prepend'), `${name} lost activation gate`);
    if (name !== 'bmad-agent-dev') {
      const handoff = override.split('implementation_handoff = """')[1]?.split('"""')[0];
      assert.ok(handoff?.includes(policyPath), `${name} lost context-free handoff policy`);
      assert.ok(handoff.includes('AGENTS.md'));
      assert.ok(handoff.includes('{spec_file}'));
    }
  }
});

test('M4.5 requires diagnostic acceptance alongside its runtime contract', () => {
  const base = '_bmad-output/specs/spec-m4-5-selected-share-snapshots/';
  const spec = read(`${base}SPEC.md`);
  assert.ok(spec.includes('  - diagnostics.md'));
  assert.ok(spec.includes(policyPath));
  const acceptance = read(`${base}acceptance.md`);
  for (const id of ['25', '26', '27', '28']) assert.ok(acceptance.includes(`| AC-${id} |`));
  assert.ok(read(`${base}implementation-plan.md`).includes('AC-25–28'));
});
