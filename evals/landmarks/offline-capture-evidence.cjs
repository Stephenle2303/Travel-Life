'use strict';

const { requireCondition } = require('../../apps/mobile/scripts/offline-landmark-input.cjs');

const captureEvidencePolicyVersion = 'nami-capture-evidence-v1';
const captureKind = 'original-camera-gps';
const validId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/u.test(id);
const positiveMeters = (value) => Number.isFinite(value) && value > 0;
const validTime = (value) => Number.isSafeInteger(value) && Math.abs(value) <= 8.64e15;

function validLocation(point) {
  return point != null && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

function distanceMeters(a, b) {
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (((b.longitude - a.longitude + 540) % 360) - 180) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function indexAssets(photos, matches) {
  const byId = new Map();
  for (const photo of photos) {
    requireCondition(validId(photo?.evidence_id) && validId(photo.family) && validTime(photo.captured_at_millis)
      && (photo.source_origin == null || ['capture-like', 'screenshot', 'download', 'unknown'].includes(photo.source_origin)));
    const id = photo.evidence_id;
    requireCondition(!byId.has(id) && matches.has(id), 'INPUT_INTEGRITY');
    const match = matches.get(id);
    requireCondition(match != null && (match.place === null || validId(match.place))
      && (match.conflictingCandidate === undefined || validId(match.conflictingCandidate))
      && typeof match.reason === 'string' && /^[A-Z_]{1,40}$/u.test(match.reason));
    byId.set(id, photo);
  }
  return byId;
}

function indexCaptureRecords(captureRecords, assetsById) {
  const evidenceIds = new Set();
  const byAsset = new Map();
  for (const record of captureRecords) {
    requireCondition(validLocation(record) && record.kind === captureKind && positiveMeters(record.accuracyMeters)
      && validId(record.evidenceId) && validId(record.assetId) && validId(record.captureFamily)
      && validTime(record.observedAtMillis));
    const asset = assetsById.get(record.assetId);
    requireCondition(asset?.family === record.captureFamily && asset.captured_at_millis === record.observedAtMillis
      && !byAsset.has(record.assetId) && !evidenceIds.has(record.evidenceId) && !assetsById.has(record.evidenceId),
    'INPUT_INTEGRITY');
    evidenceIds.add(record.evidenceId);
    byAsset.set(record.assetId, record);
  }
  return byAsset;
}

function assessCaptureEvidence(options) {
  requireCondition(options != null && typeof options === 'object');
  const { photos, matches, captureRecords, target, maximumDistanceMeters, maximumAccuracyMeters } = options;
  requireCondition(Array.isArray(photos) && matches instanceof Map && Array.isArray(captureRecords)
    && validLocation(target) && validId(target.id) && positiveMeters(maximumDistanceMeters)
    && positiveMeters(maximumAccuracyMeters));
  const assetsById = indexAssets(photos, matches);
  const capturesByAsset = indexCaptureRecords(captureRecords, assetsById);
  const ordered = [...assetsById.values()].sort((a, b) => a.captured_at_millis - b.captured_at_millis
    || a.evidence_id.localeCompare(b.evidence_id));
  const observations = new Map();
  const privateClues = [];

  for (const photo of ordered) {
    const id = photo.evidence_id;
    const { place, reason, conflictingCandidate } = matches.get(id);
    const capture = capturesByAsset.get(id);
    const targetClue = place === target.id;
    const reproduction = reason === 'REPRODUCTION_MATCH';
    if (conflictingCandidate === target.id && !reproduction && !targetClue) {
      privateClues.push({ id, placeId: target.id, status: 'pending' });
      if (place === null) observations.set(id, null);
      continue;
    }
    if (!reproduction && !targetClue && (place !== null || !capture)) continue;

    const eligible = !reproduction && photo.source_origin === 'capture-like' && capture
      && capture.accuracyMeters <= maximumAccuracyMeters
      && distanceMeters(capture, target) + capture.accuracyMeters <= maximumDistanceMeters;
    observations.set(id, eligible ? { placeId: target.id, kind: captureKind, captureEvidenceId: capture.evidenceId } : null);
    if (targetClue) privateClues.push({ id, placeId: target.id, status: eligible ? 'capture-eligible' : 'pending' });
  }

  return { privateClues, observations };
}

module.exports = { assessCaptureEvidence, captureEvidencePolicyVersion };
