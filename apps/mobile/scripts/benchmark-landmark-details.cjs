const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { LandmarkBuildError, createRun, readPinned, parseManifest, mapPlaces, auditSnapshot, readPublicImages, requireCondition } =
  require('./offline-landmark-input.cjs');
const models = require('./offline-landmark-model.cjs');
const { publishArtifacts } = require('./offline-landmark-benchmark.cjs');
const { parseDetailFixture, prepareDetailInputs, compareDetailMatchers, scales } = require('./offline-landmark-details.cjs');

async function runDetailBenchmark(options, writeEvent, signal, adapters = {}) {
  const model = { ...models, ...adapters.model };
  const publish = adapters.publish ?? publishArtifacts;
  const run = createRun(writeEvent, signal);
  const start = performance.now();
  const bytes = await run.stage('SOURCE_READ', () => {
    requireCondition(options.manifest && /^[a-f0-9]{64}$/.test(options.manifestHash)
      && options.directory && options.destination && !options.invalidArguments);
    return readPinned(options.manifest, options.manifestHash);
  });
  const { input, config } = await run.stage('SOURCE_PARSE', () => {
    const input = parseManifest(bytes);
    return { input, config: parseDetailFixture(input) };
  });
  const places = await run.stage('PLACE_MAPPING', () => mapPlaces(input.places));
  const { audit, plan } = await run.stage('REFERENCE_ADMISSION', () => {
    const audit = auditSnapshot(input, places);
    return { audit, plan: prepareDetailInputs(config, audit) };
  });
  const report = {
    version: 1, snapshot: input.id, manifestSha256: options.manifestHash, dinoModelSha256: input.dinoModelSha256,
    config: { targetPlaceId: config.targetPlaceId, minimumSimilarity: config.minimumSimilarity,
      minimumMargin: config.minimumMargin, scales, minimumCorrectTargetGain: input.gates.minimumStopGain,
      maximumFalseMatchRate: input.gates.maximumFalseMatchRate,
      maximumScanMillis: input.gates.maximumScanMillis, maximumPeakMemoryBytes: input.gates.maximumPeakMemoryBytes },
    coverage: plan.coverage, independentQueries: plan.independent.length, regressionQueries: plan.regression.length,
    host: null, comparison: null, result: { targetPilotGate: 'incomplete' },
  };
  if (audit.references.length && audit.queries.length) {
    const photos = [...audit.references, ...audit.counterexamples, ...audit.queries];
    const images = await run.stage('SOURCE_READ', () => readPublicImages(options.directory, photos));
    const api = await run.stage('MODEL_LOAD', () => model.loadSource('visual-place/landmark-embedding.ts'));
    const pixels = await run.stage('IMAGE_DECODE', () => model.decodeImages(images, photos, api.landmarkImageSize));
    images.clear();
    const runtime = await run.stage('MODEL_LOAD', () => model.loadDino(options.directory, input.dinoModelSha256));
    const descriptorStart = performance.now();
    const features = await run.stage('DESCRIPTOR_GENERATE', () =>
      model.extractDino(runtime, api, pixels, signal, plan.patchPhotoIds));
    const descriptorMillis = performance.now() - descriptorStart;
    pixels.clear();
    const scoreStart = performance.now();
    report.comparison = await run.stage('BENCHMARK_SCORE', () => compareDetailMatchers(input, config, plan,
      model.dinoMatcher(api, features),
      model.dinoVerifiedMatcher(api, features, audit.counterexamples, input.verification),
      audit.references, features, signal));
    report.host = {
      totalMillisBeforePublication: performance.now() - start,
      descriptorMillis, scoreMillis: performance.now() - scoreStart,
      descriptorCount: 2 * (audit.references.length + audit.counterexamples.length) + audit.queries.length,
      fullViewsWithPatches: plan.patchPhotoIds.size,
      processMaxRssBytes: process.resourceUsage().maxRSS * 1024,
    };
    const hostResourceGate = report.host.totalMillisBeforePublication <= input.gates.maximumScanMillis
      && report.host.processMaxRssBytes <= input.gates.maximumPeakMemoryBytes;
    report.result = { targetPilotGate: !plan.ready ? 'incomplete'
      : report.comparison.qualityPassed && hostResourceGate ? 'passed' : 'failed', hostResourceGate };
  }
  await run.stage('ARTIFACT_WRITE', () => publish(options.destination, [], report));
  if (report.result.targetPilotGate === 'failed') run.outcome('BENCHMARK_SCORE', 'GATE_NOT_MET');
  if (report.result.targetPilotGate === 'incomplete') run.outcome('BENCHMARK_SCORE', 'COVERAGE_INCOMPLETE');
  return report;
}

function main() {
  const args = process.argv.slice(2);
  const [manifest, manifestHash, directory, destination] = args;
  const invalidArguments = args.length !== 4 || args.some((arg) => arg.startsWith('--'));
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  runDetailBenchmark({ manifest, manifestHash, directory, destination: destination && path.resolve(destination), invalidArguments },
    (event) => process.stdout.write(JSON.stringify(event) + '\n'), controller.signal)
    .then((report) => { if (report.result.targetPilotGate !== 'passed') process.exitCode = 1; })
    .catch((error) => { process.exitCode = error instanceof LandmarkBuildError && error.reasonCode === 'CANCELLED' ? 130 : 2; });
}

if (require.main === module) main();

module.exports = { runDetailBenchmark };
