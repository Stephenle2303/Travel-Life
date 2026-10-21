/* Synthetic, local reconstruction benchmark. No owner evidence is read. */
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const enginePath = path.join(__dirname, '../src/reconstruction/engine.ts');
const sizeArgument = process.argv[2] ?? '240';
const size = Number(sizeArgument);
if (!Number.isInteger(size) || size < 1 || size > 3000) throw new Error('Evidence count must be an integer from 1 to 3000.');
if (process.argv[3] !== undefined && process.argv[3] !== '--revision') throw new Error('Only --revision is supported after the evidence count.');
const revision = process.argv[3] === '--revision' ? process.argv[4] : null;
if (process.argv[3] === '--revision' && revision === undefined) throw new Error('Revision requires a full Git commit ID.');
if (revision && !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Revision must be a full Git commit ID.');
let reconstructV1;
if (revision) {
  const source = execFileSync('git', ['show', `${revision}:apps/mobile/src/reconstruction/engine.ts`], {
    cwd: path.join(__dirname, '../../..'), encoding: 'utf8',
  });
  const baseline = new Module(enginePath, module);
  baseline.filename = enginePath;
  baseline.paths = Module._nodeModulePaths(path.dirname(enginePath));
  baseline._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: enginePath,
  }).outputText, enginePath);
  reconstructV1 = baseline.exports.reconstructV1;
} else {
  ({ reconstructV1 } = require(enginePath));
}
const { resolveCountry } = require(path.join(__dirname, '../src/reconstruction/country-resolver.ts'));
const dense = Array.from({ length: size }, (_, index) => ({
  id: `synthetic-${String(index).padStart(5, '0')}`,
  capturedAtMillis: Date.UTC(2026, 0, 1), capturedDay: '2026-01-01', hasPreciseOffset: true,
  latitude: 10 + (index % 20) * 0.00001, longitude: 100 + Math.floor(index / 20) * 0.00001,
  reportedAccuracyMeters: 10, availability: 'available', duplicateFamilyId: null,
  duplicateConflict: false, excluded: false,
}));
const start = performance.now();
const graph = reconstructV1(dense);
const millis = Math.round(performance.now() - start);
const graphSha256 = createHash('sha256').update(JSON.stringify(graph)).digest('hex');
const resolverStart = performance.now();
for (const item of dense) resolveCountry({ latitude: item.latitude, longitude: item.longitude, reportedAccuracyMeters: item.reportedAccuracyMeters });
const countryMilliseconds = Math.round(performance.now() - resolverStart);
process.stdout.write(JSON.stringify({ scenario: 'synthetic-dense-place', revision: revision ?? 'working-tree', evidence: size, places: graph.places.length, visits: graph.visits.length, journeys: graph.journeys.length, graphSha256, engineMilliseconds: millis, countryMilliseconds }) + '\n');
