export const landmarkImageSize = 224;
const channels = 3;
const patchesPerSide = 16;
const dimensions = 384;
const regionGrid = 4;
const pixelsPerChannel = landmarkImageSize ** 2;
const imageNetMean = [0.485, 0.456, 0.406];
const imageNetDeviation = [0.229, 0.224, 0.225];

export type LandmarkEmbedding = { readonly global: ArrayLike<number>; readonly pooled: ArrayLike<number>; readonly regions: readonly ArrayLike<number>[] };

export function prepareLandmarkPixels(rgba: Uint8Array) {
  if (rgba.length !== pixelsPerChannel * 4) return null;
  const pixels = new Float32Array(pixelsPerChannel * channels);
  for (let channel = 0; channel < channels; channel++) {
    const offset = channel * pixelsPerChannel;
    for (let index = 0; index < pixelsPerChannel; index++) {
      pixels[offset + index] = (rgba[index * 4 + channel] / 255 - imageNetMean[channel]) / imageNetDeviation[channel];
    }
  }
  return pixels;
}

function normalize(vector: Float32Array) {
  const squared = vector.reduce((sum, value) => sum + value * value, 0);
  if (!Number.isFinite(squared) || squared <= 0) return false;
  const norm = Math.sqrt(squared);
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  return true;
}

export function summarizeLandmarkTensor(features: Float32Array, shape: readonly number[]): LandmarkEmbedding | null {
  const patches = patchesPerSide ** 2;
  if (shape.length !== 3 || shape[0] !== 1 || shape[1] !== patches + 1 || shape[2] !== dimensions
    || features.length !== (patches + 1) * dimensions) return null;

  const global = features.slice(0, dimensions);
  const pooled = new Float32Array(dimensions);
  const regions = Array.from({ length: regionGrid ** 2 }, () => new Float32Array(dimensions));
  for (let patch = 0; patch < patches; patch++) {
    const row = Math.floor(patch / patchesPerSide);
    const col = patch % patchesPerSide;
    const region = regions[Math.floor(row / 4) * regionGrid + Math.floor(col / 4)];
    const offset = (patch + 1) * dimensions;
    for (let index = 0; index < dimensions; index++) {
      const value = features[offset + index];
      pooled[index] += value;
      region[index] += value;
    }
  }
  return [global, pooled, ...regions].every(normalize) ? { global, pooled, regions } : null;
}

function similarity(left: ArrayLike<number>, right: ArrayLike<number>) {
  let sum = 0;
  for (let i = 0; i < dimensions; i++) sum += left[i] * right[i];
  return sum;
}

export function scoreLandmarkEmbedding(query: LandmarkEmbedding, reference: LandmarkEmbedding) {
  const global = similarity(query.global, reference.global);
  const pooled = similarity(query.pooled, reference.pooled);
  const regional = query.regions.reduce((sum, region, index) => sum + similarity(region, reference.regions[index]), 0) / query.regions.length;
  return { global, pooled, regional };
}

export function matchesLandmarkEmbedding(query: LandmarkEmbedding, reference: LandmarkEmbedding, kind = 'campus-complex') {
  return matchesLandmarkScore(scoreLandmarkEmbedding(query, reference), kind);
}

export function matchesLandmarkScore({ global, pooled, regional }: ReturnType<typeof scoreLandmarkEmbedding>, kind = 'campus-complex') {
  if (kind === 'pfeiffer-hall') return global >= 0.51 && pooled >= 0.66 && regional >= 0.54;
  return global >= 0.59 && pooled >= 0.65 && regional >= 0.57;
}
