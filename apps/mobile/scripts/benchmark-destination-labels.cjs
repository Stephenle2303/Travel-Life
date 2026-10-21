/* Public synthetic parity/performance probe. Never reads owner evidence or a device. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '../../..');
const sourceRoot = path.resolve(__dirname, '../src/reconstruction');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--revision' || !/^[a-f0-9]{40}$/.test(args[1])) {
  throw new Error('Usage: node scripts/benchmark-destination-labels.cjs --revision FULL40SHA');
}
const revision = args[1];
const dataPath = path.join(sourceRoot, 'data/natural-earth-destinations-5.1.1.json');
const dataSource = fs.readFileSync(dataPath, 'utf8');
const dataset = JSON.parse(dataSource);
const datasetSha256 = hash(dataSource);
const sourceNames = ['country-resolver.ts', 'destination-label.ts'];
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function readSources(selectedRevision) {
  return Object.fromEntries(sourceNames.map((name) => [name, selectedRevision
    ? execFileSync('git', ['show', `${selectedRevision}:apps/mobile/src/reconstruction/${name}`], { cwd: projectRoot, encoding: 'utf8' })
    : fs.readFileSync(path.join(sourceRoot, name), 'utf8')]));
}
const currentSources = readSources(null);
const baselineSources = readSources(revision);
const baselineData = execFileSync('git', ['show', `${revision}:apps/mobile/src/reconstruction/data/natural-earth-destinations-5.1.1.json`], {
  cwd: projectRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
});
assert.equal(hash(baselineData), datasetSha256, 'Comparison requires identical public geometry.');
function compileSources(sources) {
  return Object.fromEntries(sourceNames.map((name) => [name, ts.transpileModule(sources[name], {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: name,
  }).outputText]));
}
const compiledCurrent = compileSources(currentSources);
const compiledBaseline = compileSources(baselineSources);
function isolatedModules(compiled) {
  const loaded = new Map();
  function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const filename = path.join(sourceRoot, name);
    const isolated = new Module(filename, module);
    isolated.filename = filename;
    isolated.paths = Module._nodeModulePaths(sourceRoot);
    isolated.require = (request) => {
      if (request === './country-resolver') return load('country-resolver.ts');
      if (request === './data/natural-earth-destinations-5.1.1.json') return dataset;
      throw new Error('Unexpected benchmark module dependency.');
    };
    loaded.set(name, isolated);
    isolated._compile(compiled[name], filename);
    return isolated.exports;
  }
  return { ...load('country-resolver.ts'), ...load('destination-label.ts') };
}

const coordinates = [];
for (let latitude = -90; latitude <= 90; latitude += 30) {
  for (let longitude = -180; longitude <= 180; longitude += 30) coordinates.push({ latitude, longitude });
}
function decodeVertices(packed) {
  const values = packed.split(',');
  const vertices = [];
  let x = 0; let y = 0;
  for (let index = 0; index < values.length; index += 2) {
    x += parseInt(values[index], 36); y += parseInt(values[index + 1], 36);
    vertices.push({ latitude: y / 10000, longitude: x / 10000 });
  }
  return vertices;
}
// Decode bounded selections from first and later public rings, including polar
// and antimeridian areas. These test inputs are never exported as output.
let laterRingCases = 0;
for (const code of ['IDN', 'VNM', 'FRA', 'CAN', 'RUS', 'FJI', 'ATA', 'USA']) {
  const area = dataset.countries.find((candidate) => candidate.code === code);
  assert.ok(area, 'Required public boundary fixture must exist.');
  const ringIndexes = [...new Set([0, Math.floor(area.rings.length / 2), area.rings.length - 1])];
  for (const ringIndex of ringIndexes) {
    const vertices = decodeVertices(area.rings[ringIndex]);
    for (const fraction of [0, 0.5]) coordinates.push(vertices[Math.floor((vertices.length - 1) * fraction)]);
    if (ringIndex > 0) laterRingCases += 2;
  }
}
const samples = coordinates.flatMap((point) => [0, 1000, 1001].map((reportedAccuracyMeters) => ({ ...point, reportedAccuracyMeters })));
samples.push(
  { latitude: null, longitude: null }, { latitude: NaN, longitude: 0 },
  { latitude: 0, longitude: Infinity }, { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: -181 }, { latitude: 10, longitude: 100, reportedAccuracyMeters: -1 },
  { latitude: 10, longitude: 100, reportedAccuracyMeters: NaN },
);
const publicPlaces = [
  [-8.5069, 115.2625], [21.0285, 105.8542], [35.6762, 139.6503],
  [48.8566, 2.3522], [-6.2088, 106.8456], [0, -140], [90, 180],
];
samples.push(...publicPlaces.map(([latitude, longitude]) => ({ latitude, longitude, reportedAccuracyMeters: 0 })));
let regionBoundaryCases = 0;
for (const [code, name] of [['IDN', 'Bali'], ['VNM', 'Kon Tum'], ['FRA', 'French Guiana']]) {
  const area = dataset.regions.find((candidate) => candidate.code === code && candidate.name === name);
  assert.ok(area, 'Required public region fixture must exist.');
  const vertices = decodeVertices(area.rings[0]);
  for (const fraction of [0, 0.5]) {
    const vertex = vertices[Math.floor((vertices.length - 1) * fraction)];
    for (const offset of [-0.003, 0, 0.003]) {
      for (const reportedAccuracyMeters of [0, 1000]) {
        samples.push({ latitude: vertex.latitude + offset, longitude: vertex.longitude, reportedAccuracyMeters });
        regionBoundaryCases += 1;
      }
    }
  }
}
// Offset from edge midpoints along a local metre-normal so threshold comparisons
// exercise both sides of the 250m and 1250m margins, rather than only vertices.
const thresholdPairs = { zeroAccuracy: [], maxAccuracy: [] };
const thresholdVertices = decodeVertices(dataset.countries.find((area) => area.code === 'VNM').rings[0]);
for (const fraction of [0.1, 0.3, 0.6, 0.8]) {
  const index = Math.floor((thresholdVertices.length - 2) * fraction);
  const first = thresholdVertices[index];
  const second = thresholdVertices[index + 1];
  const middle = { latitude: (first.latitude + second.latitude) / 2, longitude: (first.longitude + second.longitude) / 2 };
  const scaleX = 111320 * Math.cos(middle.latitude * Math.PI / 180);
  const dx = (second.longitude - first.longitude) * scaleX;
  const dy = (second.latitude - first.latitude) * 110574;
  const length = Math.hypot(dx, dy);
  assert.ok(length > 0, 'Threshold edge must be nondegenerate.');
  for (const sign of [-1, 1]) {
    for (const [kind, reportedAccuracyMeters, distances] of [['zeroAccuracy', 0, [249, 251]], ['maxAccuracy', 1000, [1249, 1251]]]) {
      const indexes = [];
      for (const distance of distances) {
        indexes.push(samples.length);
        samples.push({ latitude: middle.latitude + sign * dx / length * distance / 110574,
          longitude: middle.longitude - sign * dy / length * distance / scaleX, reportedAccuracyMeters });
      }
      thresholdPairs[kind].push(indexes);
    }
  }
}
function pair(placeId, point, accuracy) {
  return ['a', 'b'].map((suffix) => ({ placeId, familyId: `${placeId}-${suffix}`, latitude: point[0], longitude: point[1], reportedAccuracyMeters: accuracy }));
}
const labels = [];
for (let index = 0; index < publicPlaces.length; index += 1) {
  const first = pair(`p${index}`, publicPlaces[index], 0);
  const next = pair(`q${index}`, publicPlaces[(index + 1) % publicPlaces.length], 1000);
  const mixed = [...first, ...next];
  labels.push(first, first.slice(0, 1), [...first, ...first], mixed, [...mixed].reverse(),
    [...first, { ...next[0], placeId: first[0].placeId, familyId: first[0].familyId }]);
}
labels.push([], [...pair('accuracy', publicPlaces[0], 0), ...pair('accuracy', publicPlaces[0], 1001)],
  [...pair('multi-a', publicPlaces[0], 0), ...pair('multi-b', publicPlaces[1], 0), ...pair('multi-c', publicPlaces[2], 0)]);

function execute(api) {
  return {
    countries: samples.map((point) => api.resolveCountry(point)),
    destinations: samples.map((point) => api.resolveDestination(point)),
    labels: labels.map((support) => api.destinationLabel(support)),
  };
}
function timed(api) {
  const start = performance.now();
  const output = execute(api);
  return { output, milliseconds: Number((performance.now() - start).toFixed(3)) };
}
const rounds = [];
let expected;
for (let round = 0; round < 3; round += 1) {
  const baseline = isolatedModules(compiledBaseline);
  const current = isolatedModules(compiledCurrent);
  const cold = {};
  const warm = {};
  // Alternate execution order to reduce a fixed baseline-first timing bias.
  for (const [name, api] of round % 2 ? [['current', current], ['baseline', baseline]] : [['baseline', baseline], ['current', current]]) {
    const result = timed(api);
    expected ??= result.output;
    assert.deepEqual(result.output, expected, 'Synthetic destination parity changed.');
    cold[name] = result.milliseconds;
  }
  for (const [name, api] of round % 2 ? [['baseline', baseline], ['current', current]] : [['current', current], ['baseline', baseline]]) {
    const result = timed(api);
    assert.deepEqual(result.output, expected, 'Warm synthetic destination parity changed.');
    warm[name] = result.milliseconds;
  }
  rounds.push({ coldMilliseconds: cold, warmMilliseconds: warm });
}
const countryOutcomes = Object.fromEntries(['resolved', 'border', 'invalid', 'unresolved'].map((status) => [status, expected.countries.filter((value) => value.status === status).length]));
for (const count of Object.values(countryOutcomes)) assert.ok(count > 0, 'Every country outcome must be exercised.');
const destinationRegions = {
  known: expected.destinations.filter((value) => value && value.region !== null).length,
  unknown: expected.destinations.filter((value) => value && value.region === null).length,
};
assert.ok(destinationRegions.known > 0 && destinationRegions.unknown > 0, 'Both known and null region results must be exercised.');
assert.ok(laterRingCases > 0 && regionBoundaryCases > 0, 'Later-ring and region-boundary samples must exist.');
const thresholdTransitions = Object.fromEntries(Object.entries(thresholdPairs).map(([kind, pairs]) => [kind,
  pairs.filter(([inside, outside]) => expected.countries[inside].status === 'border' && expected.countries[outside].status !== 'border').length]));
for (const count of Object.values(thresholdTransitions)) assert.ok(count > 0, 'Both accuracy margins must have a border transition.');
process.stdout.write(JSON.stringify({
  scenario: 'public-synthetic-destination-parity', baselineRevision: revision,
  coordinateCases: samples.length, labelCases: labels.length, rounds: rounds.length,
  coverage: { countryOutcomes, destinationRegions, laterRingCases, regionBoundaryCases, thresholdTransitions },
  sourceSha256: { baseline: Object.fromEntries(sourceNames.map((name) => [name, hash(baselineSources[name])])),
    current: Object.fromEntries(sourceNames.map((name) => [name, hash(currentSources[name])])) },
  harnessSha256: hash(fs.readFileSync(__filename)),
  runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch },
  datasetSha256, outputSha256: hash(JSON.stringify(expected)), parity: true, timings: rounds,
  timingScope: 'Host JS only; cold resets decoded rings, warm reuses bounded cache; excludes transpile/loading; not device latency.',
}) + '\n');
