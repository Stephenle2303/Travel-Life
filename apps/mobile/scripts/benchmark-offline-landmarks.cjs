const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { LandmarkBuildError, createRun, readPinned, parseManifest, mapPlaces, auditSnapshot, readPublicImages, requireCondition } =
  require('./offline-landmark-input.cjs');
const models = require('./offline-landmark-model.cjs');
const benchmark = require('./offline-landmark-benchmark.cjs');

async function runBenchmark(options, writeEvent, signal, adapters = {}) {
  const model = { ...models, ...adapters.model };
  const build = { ...benchmark, ...adapters.benchmark };
  const run = createRun(writeEvent, signal);
  const start = performance.now();
  const inputBytes = await run.stage('SOURCE_READ', () => {
    requireCondition(options.manifest && /^[a-f0-9]{64}$/.test(options.manifestHash)
      && options.directory && options.destination && !options.invalidArguments);
    return readPinned(options.manifest, options.manifestHash);
  });
  const input = await run.stage('SOURCE_PARSE', () => parseManifest(inputBytes));
  const places = await run.stage('PLACE_MAPPING', () => mapPlaces(input.places));
  const audit = await run.stage('REFERENCE_ADMISSION', () => auditSnapshot(input, places));
  const photos = [...audit.references, ...audit.queries];
  const dinoPhotos = [...photos, ...audit.counterexamples];
  const report = {
    version: 1, snapshot: input.id, manifestSha256: options.manifestHash,
    dinoModelSha256: input.dinoModelSha256, saladModelSha256: input.saladModelSha256,
    saladDescriptorSha256: options.saladHash ?? null,
    coverage: audit.coverage, negativeCoverage: audit.negatives, exclusions: audit.exclusions,
    verifierCounterexamples: audit.counterexamples.length,
    gates: input.gates, host: null, scores: {}, packManifests: [],
  };
  const eligibleForScoring = !options.auditOnly && audit.references.length > 0 && audit.queries.length > 0;
  let episodes = [];
  let packs = [];
  if (eligibleForScoring) {
    episodes = await run.stage('BENCHMARK_SCORE', () => build.prepareEpisodes(input.episodes, audit.queries, places));
    const images = await run.stage('SOURCE_READ', () => readPublicImages(options.directory, dinoPhotos));
    const matcherApi = await run.stage('MODEL_LOAD', () => model.loadSource('visual-place/landmark-embedding.ts'));
    const pixels = await run.stage('IMAGE_DECODE', () => model.decodeImages(images, dinoPhotos, matcherApi.landmarkImageSize));
    images.clear();
    const runtime = await run.stage('MODEL_LOAD', () => model.loadDino(options.directory, input.dinoModelSha256));
    const inferenceStart = performance.now();
    const dinoFeatures = await run.stage('DESCRIPTOR_GENERATE', () => model.extractDino(runtime, matcherApi, pixels, signal));
    const dinoDescriptorMillis = performance.now() - inferenceStart;
    pixels.clear();
    const matchers = [model.dinoMatcher(matcherApi, dinoFeatures)];
    if (input.verification) matchers.push(model.dinoVerifiedMatcher(matcherApi, dinoFeatures, audit.counterexamples, input.verification));
    if (options.salad) {
      const saladFeatures = await run.stage('DESCRIPTOR_GENERATE', () => {
        requireCondition(input.saladModelSha256 && /^[a-f0-9]{64}$/.test(options.saladHash), 'DESCRIPTOR_SCHEMA');
        return model.readSalad(options.salad, options.saladHash, input.saladModelSha256, options.manifestHash, photos);
      });
      matchers.push(model.saladMatcher(saladFeatures));
    } else if (!input.verification) {
      run.outcome('DESCRIPTOR_GENERATE', 'MODEL_UNAVAILABLE');
    }
    report.scores = await run.stage('BENCHMARK_SCORE', () => {
      const discovery = model.loadSource('visual-place/discovery.ts');
      return build.compareMatchers(input, audit, episodes, places, discovery, matchers, signal);
    });
    packs = await run.stage('ARTIFACT_VERIFY', () => {
      const artifacts = matchers.flatMap((matcher) => build.buildArtifacts(matcher, input, options.manifestHash,
        audit.references, places, audit.coverage));
      build.verifyArtifacts(artifacts);
      return artifacts;
    });
    report.packManifests = packs.map((pack) => pack.manifest);
    report.host = {
      totalMillisBeforePublication: performance.now() - start,
      dinoDescriptorMillis,
      dinoDescriptorCount: (audit.references.length + audit.counterexamples.length) * 2 + audit.queries.length,
      saladInferenceMillis: null,
      processMaxRssBytes: process.resourceUsage().maxRSS * 1024,
    };
  }
  report.result = await run.stage('BENCHMARK_SCORE', () => build.assessGate(input, audit, episodes, report.scores, packs));
  await run.stage('ARTIFACT_WRITE', () => build.publishArtifacts(options.destination, packs, report));
  if (report.result.publicGate === 'failed') run.outcome('BENCHMARK_SCORE', 'GATE_NOT_MET');
  if (report.result.publicGate === 'incomplete') run.outcome('BENCHMARK_SCORE', 'COVERAGE_INCOMPLETE');
  return report;
}

function main() {
  const args = process.argv.slice(2);
  const auditOnly = args.includes('--audit-only');
  const values = args.filter((arg) => arg !== '--audit-only');
  const [manifest, manifestHash, directory, destination, salad, saladHash] = values;
  const invalidArguments = (values.length !== 4 && values.length !== 6) || (auditOnly && values.length !== 4)
    || args.length !== values.length + Number(auditOnly) || args.some((arg) => arg !== '--audit-only' && arg.startsWith('--'));
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  runBenchmark({ manifest, manifestHash, directory, destination: destination && path.resolve(destination),
    salad, saladHash, auditOnly, invalidArguments }, (event) => process.stdout.write(JSON.stringify(event) + '\n'), controller.signal)
    .then((report) => { if (!auditOnly && report.result.publicGate !== 'passed') process.exitCode = 1; })
    .catch((error) => { process.exitCode = error instanceof LandmarkBuildError && error.reasonCode === 'CANCELLED' ? 130 : 2; });
}

if (require.main === module) main();

module.exports = { runBenchmark };
