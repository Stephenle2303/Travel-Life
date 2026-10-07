import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateBatch, parseJsonl } from './lib.mjs';

const load = name => parseJsonl(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
const passing = evaluateBatch(load('passing.jsonl'));
const failing = evaluateBatch(load('failing.jsonl'));
assert.equal(passing.failed, 0, 'positive plumbing fixtures must pass');
assert.equal(failing.failed, 1, 'the negative control must be rejected');
assert.ok(failing.results[0].errors.some(e => e.rule === 'evidence_reference'));
assert.equal(passing.product_quality.status, 'not_measured');
console.log('Eval infrastructure smoke: 2 valid fixtures accepted; 1 invalid reference rejected. No AI-quality claim.');
