import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluateTrace, evaluateBatch, parseJsonl } from '../evals/lib.mjs';

const good = JSON.parse(readFileSync(new URL('../evals/fixtures/passing.jsonl', import.meta.url), 'utf8').trim().split('\n')[0]);
const fresh = () => structuredClone(good);
const has = (trace, rule) => evaluateTrace(trace).errors.some(error => error.rule === rule);

test('valid envelopes do not imply measured product quality', () => {
  assert.equal(evaluateTrace(good).passed, true);
  const report = evaluateBatch([good]);
  assert.equal(report.product_quality.status, 'not_measured');
  assert.equal(report.infrastructure_only, true);
  assert.equal(report.total, 1);
});
for (const [name, mutate, rule] of [
  ['missing model identity', t => delete t.run.model, 'schema'],
  ['unknown evidence reference', t => t.output.claims[0].evidence_ids = ['missing'], 'evidence_reference'],
  ['duplicate evidence IDs', t => t.input.evidence.push(structuredClone(t.input.evidence[0])), 'unique_evidence_id'],
  ['duplicate claim IDs', t => t.output.claims.push(structuredClone(t.output.claims[0])), 'unique_claim_id'],
  ['unsupported supported claim', t => t.output.claims[0].evidence_ids = [], 'supported_evidence'],
  ['out-of-range confidence', t => t.output.claims[0].confidence = 1.1, 'schema'],
  ['negative latency', t => t.run.latency_ms = -1, 'schema'],
  ['negative cost', t => t.run.cost_usd = -1, 'schema'],
  ['plumbing fixture labelled holdout', t => t.split = 'holdout', 'schema'],
]) {
  test(name + ' fails', () => { const t = fresh(); mutate(t); assert.equal(has(t, rule), true); });
}
test('abstention may lack evidence but cannot assert a value', () => {
  const t = fresh(); Object.assign(t.output.claims[0], {status:'abstained', value:null, evidence_ids:[]});
  assert.equal(evaluateTrace(t).passed, true);
  t.output.claims[0].value = { name: 'Invented' };
  assert.equal(has(t, 'abstention_value'), true);
});
test('unknown measurements stay null', () => {
  const t = fresh(); t.run.latency_ms = null; t.run.cost_usd = null;
  assert.equal(evaluateTrace(t).passed, true);
});
test('real data needs a consent reference (not proof of consent)', () => {
  const t = fresh(); t.data_origin = 'consented-real'; t.split = 'development';
  assert.equal(has(t, 'schema'), true);
  t.consent_record_id = 'private-consent-record';
  assert.equal(evaluateTrace(t).passed, true);
});
test('empty, malformed and non-object input fail closed', () => {
  assert.throws(() => parseJsonl(' \n'), /empty/i);
  assert.throws(() => parseJsonl('{broken}'), /line 1/);
  assert.throws(() => parseJsonl('null'), /object/i);
  assert.throws(() => evaluateBatch([]), /empty/i);
});
test('JSONL accepts BOM and blank lines', () => {
  assert.equal(parseJsonl('\uFEFF' + JSON.stringify(good) + '\n\n').length, 1);
});
test('duplicate observations rejected; explicitly identified repeats retained', () => {
  assert.throws(() => evaluateBatch([good, fresh()]), /duplicate/i);
  const t = fresh(); t.run.id = 'another-run'; t.run.repetition = 2;
  assert.equal(evaluateBatch([good, t]).total, 2);
});
test('mixed reports show failures without fabricating quality scores', () => {
  const t = fresh(); t.case_id = 'bad'; t.output.claims[0].evidence_ids = ['missing'];
  const report = evaluateBatch([good, t]);
  assert.equal(report.failed, 1);
  assert.equal(report.contract_pass_rate, 0.5);
  assert.equal(report.product_quality.status, 'not_measured');
});
test('CLI exits 0 for pass, 1 for failed checks, 2 for invalid invocation/data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'travel-life-eval-test-'));
  const cli = fileURLToPath(new URL('../evals/run.mjs', import.meta.url));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, ...args], { cwd:root, encoding:'utf8' });
  try {
    const report = join(dir, 'report.json');
    assert.equal(run(['--input','evals/fixtures/passing.jsonl','--output',report]).status, 0);
    assert.equal(JSON.parse(readFileSync(report)).product_quality.status, 'not_measured');
    assert.equal(run(['--input','evals/fixtures/failing.jsonl','--output',report]).status, 1);
    assert.equal(run([]).status, 2);
    assert.equal(run(['--unknown']).status, 2);
    const empty = join(dir, 'empty.jsonl'); writeFileSync(empty, '');
    assert.equal(run(['--input',empty,'--output',report]).status, 2);
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    rmSync(dir, { recursive:true, force:true });
  }
});
