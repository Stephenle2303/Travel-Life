import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { evaluateBatch, parseJsonl } from './lib.mjs';

try {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--input','--output'].includes(key) || !args[i + 1] ||
        args[i + 1].startsWith('--') || opts[key]) {
      throw new Error('Usage: npm run evals:run -- --input <traces.jsonl> [--output <report.json>]');
    }
    opts[key] = args[i + 1];
  }
  if (!opts['--input']) throw new Error('An --input JSONL file is required');
  const input = resolve(opts['--input']);
  const output = resolve(opts['--output'] ?? ('evals/runs/' + Date.now() + '-' + randomUUID() + '.json'));
  if (input === output) throw new Error('Output must not overwrite the input dataset');
  const data = readFileSync(input);
  const report = evaluateBatch(parseJsonl(data.toString('utf8')));
  report.input_sha256 = createHash('sha256').update(data).digest('hex');
  mkdirSync(dirname(output), {recursive:true});
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('Contract checks: ' + report.passed + '/' + report.total + ' passed. Product quality: NOT MEASURED.');
  console.log('Report: ' + output);
  process.exitCode = report.failed ? 1 : 0;
} catch (error) {
  console.error('Evaluation input/run error: ' + error.message);
  process.exitCode = 2;
}
