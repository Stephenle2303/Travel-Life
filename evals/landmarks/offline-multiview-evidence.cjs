'use strict';

const { requireCondition } = require('../../apps/mobile/scripts/offline-landmark-input.cjs');

const measurementKeys = [
  'correspondences', 'epipolarInliers', 'planarInliers', 'planarCoveragePpm', 'epipolarCoveragePpm',
  'depthInliers', 'depthCoveragePpm',
];

function classifyGeometry(measurement) {
  requireCondition(measurement && measurementKeys.every((key) => Number.isSafeInteger(measurement[key])
    && measurement[key] >= 0));
  const { correspondences, epipolarInliers, planarInliers, planarCoveragePpm, epipolarCoveragePpm,
    depthInliers, depthCoveragePpm } = measurement;
  requireCondition(correspondences <= 2500 && epipolarInliers <= correspondences && planarInliers <= correspondences
    && depthInliers <= epipolarInliers && epipolarInliers - depthInliers <= planarInliers
    && [planarCoveragePpm, epipolarCoveragePpm, depthCoveragePpm].every((value) => value <= 1_000_000)
    && depthCoveragePpm <= epipolarCoveragePpm);
  // Planar agreement is a reason to withhold, including real scenes
  // dominated by a planar surface or camera rotation.
  if (planarInliers >= 25 && planarInliers / correspondences >= 0.8 && planarCoveragePpm >= 150_000) {
    return 'planar-match';
  }
  if (epipolarInliers >= 25 && epipolarInliers / correspondences >= 0.6 && epipolarCoveragePpm >= 100_000
    && depthInliers >= 15 && depthInliers / epipolarInliers >= 0.35 && depthCoveragePpm >= 60_000) {
    return 'distinct-view';
  }
  return 'inconclusive';
}

function assessMultiview(photos, matches, target, geometry) {
  requireCondition(Array.isArray(photos) && photos.length === 2 && new Set(photos).size === 2
    && ['inconclusive', 'planar-match', 'distinct-view'].includes(geometry));
  const pair = photos.map((id) => {
    requireCondition(matches.has(id), 'INPUT_INTEGRITY');
    return [id, matches.get(id)];
  });
  const clues = pair.filter(([, match]) => match.place === target && match.reason !== 'REPRODUCTION_MATCH');
  const canPromote = geometry === 'distinct-view' && clues.length === 2;
  return {
    clues: clues.map(([id]) => ({ id, placeId: target, status: canPromote ? 'capture-eligible' : 'pending' })),
    observations: new Map(pair.filter(([, match]) => match.place === target || match.reason === 'REPRODUCTION_MATCH')
      .map(([id]) => [id, canPromote ? { placeId: target } : null])),
  };
}

module.exports = { assessMultiview, classifyGeometry };
