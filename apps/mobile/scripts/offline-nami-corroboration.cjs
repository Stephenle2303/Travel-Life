const { LandmarkBuildError, requireCondition } = require('./offline-landmark-input.cjs');
const { bestLayoutSimilarity, validPatchRegion, patchDimensions } = require('./offline-landmark-details.cjs');
const { dinoPatchGridSize: grid } = require('./offline-landmark-model.cjs');

const matcherVersion = 'dinov2-small-int8-nami-corroboration-v1';
const fullView = { x: 0, y: 0, width: grid, height: grid };
const fixtureId = /^[a-z0-9][a-z0-9-]{0,79}$/;
const validId = (value) => typeof value === 'string' && fixtureId.test(value);
const validThreshold = (value) => Number.isFinite(value) && value > 0 && value < 1;

function validatePolicy(referenceTemplates, competingTemplates, reproductionSources, gates) {
  requireCondition(Array.isArray(referenceTemplates) && Array.isArray(competingTemplates) && Array.isArray(reproductionSources)
    && ['minimumSimilarity', 'minimumMargin', 'minimumReproductionSimilarity'].every((key) => validThreshold(gates?.[key])));
  requireCondition(referenceTemplates.length && competingTemplates.length && reproductionSources.length, 'INPUT_INTEGRITY');
  const templates = [...referenceTemplates, ...competingTemplates];
  requireCondition(templates.every((row) => validId(row?.id) && validPatchRegion(row.region)
    && (row.subject === undefined || validId(row.subject))) && [...reproductionSources].every(validId));
  const templateIds = new Set(templates.map(({ id }) => id));
  requireCondition(templateIds.size === templates.length
    && new Set(reproductionSources).size === reproductionSources.length, 'INPUT_INTEGRITY');
  return new Set([...templateIds, ...reproductionSources]);
}

function readPatches(features, id) {
  const patches = features.get(id)?.[0]?.patches;
  requireCondition(patches instanceof Float32Array && patches.length === grid ** 2 * patchDimensions, 'DESCRIPTOR_SCHEMA');
  for (let offset = 0; offset < patches.length; offset += patchDimensions) {
    let squaredNorm = 0;
    for (let axis = 0; axis < patchDimensions; axis++) squaredNorm += patches[offset + axis] ** 2;
    requireCondition(Math.abs(squaredNorm - 1) <= 0.001, 'DESCRIPTOR_SCHEMA');
  }
  return patches;
}

function createNamiCorroborator(options) {
  requireCondition(options && typeof options === 'object');
  const { referenceTemplates, competingTemplates, reproductionSources, features, gates, signal } = options;
  const templateIds = validatePolicy(referenceTemplates, competingTemplates, reproductionSources, gates);
  const snapshot = ({ id, region, subject }) => ({ id, region: { ...region }, subject });
  const references = referenceTemplates.map(snapshot);
  const competitors = competingTemplates.map(snapshot);
  const knownSources = [...reproductionSources];
  const checkCancellation = () => {
    if (signal?.aborted) throw new LandmarkBuildError('CANCELLED');
  };
  checkCancellation();
  requireCondition(features instanceof Map, 'DESCRIPTOR_SCHEMA');
  const templatePatches = new Map([...templateIds].map((id) => [id, readPatches(features, id).slice()]));
  const { minimumSimilarity, minimumMargin, minimumReproductionSimilarity } = gates;

  return {
    version: matcherVersion,
    match(photo, matchOptions = {}) {
      checkCancellation();
      requireCondition(matchOptions && typeof matchOptions === 'object');
      const { textNominates = false } = matchOptions;
      requireCondition(validId(photo?.id) && typeof textNominates === 'boolean');
      requireCondition(!templateIds.has(photo.id), 'INPUT_INTEGRITY');
      const query = readPatches(features, photo.id);
      const score = (id, region) => {
        checkCancellation();
        return bestLayoutSimilarity(query, templatePatches.get(id), region);
      };
      let bestTemplate = null;
      let detailSimilarity = -1;
      for (const template of references) {
        const similarity = score(template.id, template.region);
        if (bestTemplate === null || similarity > detailSimilarity) {
          bestTemplate = template;
          detailSimilarity = similarity;
        }
      }
      const competingSimilarity = competitors.reduce((best, { id, region }) => Math.max(best, score(id, region)), -1);
      const reproductionSimilarity = knownSources.reduce((best, id) => Math.max(best, score(id, fullView)), -1);
      checkCancellation();

      let reason = 'VISUAL_CORROBORATED';
      if (reproductionSimilarity >= minimumReproductionSimilarity) reason = 'REPRODUCTION_MATCH';
      else if (detailSimilarity < minimumSimilarity) reason = textNominates ? 'TEXT_UNCORROBORATED' : 'DETAIL_UNSUPPORTED';
      else if (detailSimilarity - competingSimilarity < minimumMargin) reason = 'COMPETING_DETAIL';
      const accepted = reason === 'VISUAL_CORROBORATED';
      return { accepted, reason, subject: accepted ? bestTemplate.subject ?? null : null,
        detailSimilarity, competingSimilarity, reproductionSimilarity };
    },
  };
}

module.exports = { createNamiCorroborator, matcherVersion };
