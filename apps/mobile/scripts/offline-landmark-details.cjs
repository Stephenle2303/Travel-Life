const { LandmarkBuildError, requireCondition, negativeControls } = require('./offline-landmark-input.cjs');
const { dinoPatchGridSize: grid } = require('./offline-landmark-model.cjs');
const { setImmediate } = require('node:timers/promises');

const matcherVersion = 'dinov2-small-int8-patch-layout-v1';
const patchCount = grid ** 2;
const patchDimensions = 384;
const scales = [0.5, 0.75, 1, 1.25, 1.5];

function validPatchRegion(region) {
  return region && Object.keys(region).length === 4 && ['x', 'y', 'width', 'height'].every((key) =>
    Number.isInteger(region[key]))
    && region.x >= 0 && region.y >= 0 && region.width >= 2 && region.height >= 2
    && region.x + region.width <= grid && region.y + region.height <= grid;
}

function parseDetailFixture(input) {
  const config = input.detail;
  requireCondition(input.verification && config && input.places.some((place) => place?.id === config.targetPlaceId)
    && Number.isFinite(config.minimumSimilarity) && config.minimumSimilarity > 0 && config.minimumSimilarity < 1
    && Number.isFinite(config.minimumMargin) && config.minimumMargin > 0 && config.minimumMargin < 1
    && Array.isArray(config.regressionQueryIds) && config.regressionQueryIds.length > 0
    && new Set(config.regressionQueryIds).size === config.regressionQueryIds.length
    && config.regions && typeof config.regions === 'object' && !Array.isArray(config.regions));
  const photos = new Map(input.photos.map((photo) => [photo.id, photo]));
  const regions = new Map(Object.entries(config.regions));
  for (const [id, region] of regions) {
    const photo = photos.get(id);
    requireCondition(photo?.placeId === config.targetPlaceId && photo.review === 'approved' && photo.role !== 'query'
      && validPatchRegion(region));
  }
  for (const id of config.regressionQueryIds) {
    const photo = photos.get(id);
    requireCondition(photo?.role === 'query' && photo.review === 'approved' && photo.placeId === null);
  }
  return { ...config, regions, regressionQueryIds: new Set(config.regressionQueryIds) };
}

function captureCampaign(photo) {
  return photo.source === 'seoul-institute'
    ? `${photo.source}:${photo.edition}`
    : photo.author.normalize('NFKC').trim().toLowerCase();
}

function prepareDetailInputs(config, audit) {
  const target = (photo) => photo.placeId === config.targetPlaceId;
  const references = audit.references.filter(target);
  const counterexamples = audit.counterexamples.filter(target);
  const templates = [...references, ...counterexamples];
  const regression = audit.queries.filter((photo) => config.regressionQueryIds.has(photo.id));
  requireCondition(templates.length === config.regions.size && templates.every((photo) => config.regions.has(photo.id))
    && regression.length === config.regressionQueryIds.size, 'INPUT_INTEGRITY');
  const independent = audit.queries.filter((photo) => !config.regressionQueryIds.has(photo.id));
  const targetQueries = independent.filter(target);
  const coverage = {
    targetReferences: references.length,
    targetReferenceSources: new Set(references.map((photo) => photo.source)).size,
    targetReferenceCampaigns: new Set(references.map(captureCampaign)).size,
    targetCounterexamples: counterexamples.length,
    independentTargetQueries: targetQueries.length,
    independentTargetCampaigns: new Set(targetQueries.map(captureCampaign)).size,
    independentNegativeControls: Object.fromEntries(negativeControls.map((control) =>
      [control, independent.filter((photo) => photo.control === control).length])),
  };
  const ready = coverage.targetReferenceSources >= 2 && coverage.targetReferenceCampaigns >= 2
    && coverage.targetCounterexamples >= 1 && coverage.independentTargetCampaigns >= 2
    && Object.values(coverage.independentNegativeControls).every(Boolean);
  return { references, counterexamples, independent, regression, coverage, ready,
    patchPhotoIds: new Set([...templates, ...audit.queries].map((photo) => photo.id)) };
}

function checkCancellation(signal) {
  if (signal?.aborted) throw new LandmarkBuildError('CANCELLED');
}

function similarityTable(query, reference, { x, y, width, height }) {
  const similarities = new Float32Array(width * height * patchCount);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const referenceOffset = ((y + row) * grid + x + column) * patchDimensions;
      const tableOffset = (row * width + column) * patchCount;
      for (let cell = 0; cell < patchCount; cell++) {
        const queryOffset = cell * patchDimensions;
        let score = 0;
        for (let axis = 0; axis < patchDimensions; axis++) {
          score += query[queryOffset + axis] * reference[referenceOffset + axis];
        }
        similarities[tableOffset + cell] = score;
      }
    }
  }
  return similarities;
}

function bestLayoutSimilarity(query, reference, region) {
  const { width, height } = region;
  const similarities = similarityTable(query, reference, region);
  const windowSizes = new Set();
  let best = -1;
  for (const scale of scales) {
    const scaledWidth = Math.max(2, Math.round(width * scale));
    const scaledHeight = Math.max(2, Math.round(height * scale));
    const size = scaledHeight * grid + scaledWidth;
    if (scaledWidth > grid || scaledHeight > grid || windowSizes.has(size)) continue;
    windowSizes.add(size);
    const pairs = [];
    for (let row = 0; row < scaledHeight; row++) {
      const referenceRow = Math.floor((row + 0.5) * height / scaledHeight);
      for (let column = 0; column < scaledWidth; column++) {
        const referenceColumn = Math.floor((column + 0.5) * width / scaledWidth);
        pairs.push({ templateOffset: (referenceRow * width + referenceColumn) * patchCount, queryOffset: row * grid + column });
      }
    }
    for (let y = 0; y <= grid - scaledHeight; y++) {
      for (let x = 0; x <= grid - scaledWidth; x++) {
        let sum = 0;
        const origin = y * grid + x;
        for (const { templateOffset, queryOffset } of pairs) sum += similarities[templateOffset + origin + queryOffset];
        best = Math.max(best, sum / pairs.length);
      }
    }
  }
  return best;
}

async function compareDetailMatchers(input, config, plan, baseline, verifier, allReferences, features, signal) {
  const patchesByPhoto = new Map();
  for (const id of plan.patchPhotoIds) {
    const patches = features.get(id)?.[0]?.patches;
    requireCondition(patches?.length === patchCount * patchDimensions, 'DESCRIPTOR_SCHEMA');
    patchesByPhoto.set(id, patches);
  }
  const target = config.targetPlaceId;
  const detail = {
    version: matcherVersion,
    match(photo) {
      if (!plan.references.length || !plan.counterexamples.length) return null;
      const score = (template) => {
        checkCancellation(signal);
        return bestLayoutSimilarity(patchesByPhoto.get(photo.id), patchesByPhoto.get(template.id), config.regions.get(template.id));
      };
      const positive = Math.max(...plan.references.map(score));
      const negative = Math.max(...plan.counterexamples.map(score));
      return positive >= config.minimumSimilarity && positive - negative >= config.minimumMargin ? target : null;
    },
  };
  const scores = {};
  for (const matcher of [baseline, verifier, detail]) {
    const totals = { correctTarget: 0, falseTarget: 0, otherPlaceOnTarget: 0, targetAbstained: 0,
      correctAnyPlace: 0, falseAnyPlace: 0, abstained: 0 };
    const score = async (photo) => {
      await setImmediate();
      checkCancellation(signal);
      return matcher.match(photo, allReferences);
    };
    for (const photo of plan.independent) {
      const predicted = await score(photo);
      if (predicted === null) totals.abstained++;
      else if (predicted === photo.placeId) totals.correctAnyPlace++;
      else totals.falseAnyPlace++;
      if (photo.placeId === target) {
        if (predicted === target) totals.correctTarget++;
        else if (predicted === null) totals.targetAbstained++;
        else totals.otherPlaceOnTarget++;
      } else if (predicted === target) totals.falseTarget++;
    }
    const regression = {};
    for (const photo of plan.regression) regression[photo.id] = await score(photo);
    scores[matcher.version] = { ...totals, regression };
  }
  const candidate = scores[detail.version];
  const targetNegatives = plan.independent.length - plan.coverage.independentTargetQueries;
  const targetFalseMatchRate = targetNegatives ? candidate.falseTarget / targetNegatives : null;
  const correctTargetGain = candidate.correctTarget - Math.max(scores[baseline.version].correctTarget, scores[verifier.version].correctTarget);
  const targetRegressionClear = Object.values(candidate.regression).every((predicted) => predicted === null);
  return { scores, targetNegatives, targetFalseMatchRate, correctTargetGain, targetRegressionClear,
    qualityPassed: correctTargetGain >= input.gates.minimumStopGain && targetFalseMatchRate !== null
      && targetFalseMatchRate <= input.gates.maximumFalseMatchRate && targetRegressionClear };
}

module.exports = { parseDetailFixture, prepareDetailInputs, compareDetailMatchers, bestLayoutSimilarity, validPatchRegion,
  matcherVersion, scales, patchDimensions };
