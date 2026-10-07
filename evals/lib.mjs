import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

export const evaluatorVersion = 'trace-contract-v1';
const schema = JSON.parse(readFileSync(new URL('./schemas/trace.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ allErrors:true, strict:true }).compile(schema);

export function parseJsonl(text) {
  const rows = [];
  for (const [index, line] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let value;
    try { value = JSON.parse(line); }
    catch { throw new Error('Invalid JSON at line ' + (index + 1)); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Expected an object at line ' + (index + 1));
    }
    rows.push(value);
  }
  if (!rows.length) throw new Error('Empty dataset: no traces evaluated');
  return rows;
}

export function evaluateTrace(trace) {
  const errors = [];
  const result = () => ({
    case_id:trace?.case_id ?? null,
    run_id:trace?.run?.id ?? null,
    repetition:trace?.run?.repetition ?? null,
    passed:errors.length === 0,
    errors
  });
  if (!validate(trace)) {
    for (const error of validate.errors) {
      errors.push({ rule:'schema', path:error.instancePath, reason:error.message });
    }
    return result();
  }
  const ids = new Set();
  for (const evidence of trace.input.evidence) {
    if (ids.has(evidence.id)) errors.push({rule:'unique_evidence_id', reason:'Duplicate evidence ID'});
    ids.add(evidence.id);
  }
  const claims = new Set();
  for (const claim of trace.output.claims) {
    if (claims.has(claim.id)) errors.push({rule:'unique_claim_id', reason:'Duplicate claim ID'});
    claims.add(claim.id);
    if (claim.evidence_ids.some(id => !ids.has(id))) {
      errors.push({rule:'evidence_reference', reason:'Claim references evidence absent from the input'});
    }
    if (claim.status === 'supported' && !claim.evidence_ids.length) {
      errors.push({rule:'supported_evidence', reason:'Supported claim has no evidence reference'});
    }
    if (claim.status === 'abstained' && claim.value !== null) {
      errors.push({rule:'abstention_value', reason:'Abstention must not assert a value'});
    }
  }
  return result();
}

export function evaluateBatch(traces) {
  if (!Array.isArray(traces) || !traces.length) throw new Error('Empty dataset: no traces evaluated');
  const observed = new Set();
  for (const trace of traces) {
    if (trace?.case_id && trace?.run?.id && trace?.run?.repetition) {
      const key = JSON.stringify([trace.dataset_version, trace.case_id, trace.run.id, trace.run.repetition]);
      if (observed.has(key)) throw new Error('Duplicate observation identity; use explicit run/repetition identities');
      observed.add(key);
    }
  }
  const results = traces.map(evaluateTrace);
  const passed = results.filter(result => result.passed).length;
  return {
    report_version:'1.0',
    evaluator_version:evaluatorVersion,
    generated_at:new Date().toISOString(),
    scope:'trace-contract-and-provenance-only',
    infrastructure_only:traces.every(trace => trace?.data_origin === 'synthetic-plumbing'),
    total:traces.length,
    passed,
    failed:traces.length - passed,
    contract_pass_rate:passed / traces.length,
    dataset_versions:[...new Set(traces.map(t => t?.dataset_version ?? 'invalid'))],
    splits:[...new Set(traces.map(t => t?.split ?? 'invalid'))],
    origins:[...new Set(traces.map(t => t?.data_origin ?? 'invalid'))],
    product_quality:{
      status:'not_measured',
      reason:'No reconstruction engine, reviewed reference labels, or calibrated behavioral evaluators are invoked by this runner.'
    },
    results
  };
}
