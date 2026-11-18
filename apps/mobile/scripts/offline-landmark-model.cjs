const path = require('node:path');
const { LandmarkBuildError, megabyte, parseJson, readPinned, requireCondition, dinoVerifierVersion } = require('./offline-landmark-input.cjs');

const dinoPatchGridSize = 16;

function loadSource(filename) {
  return require(path.join(__dirname, '../src', filename));
}

function readPixels(image, size, rotateClockwise, portrait, crop) {
  const width = rotateClockwise ? image.height : image.width;
  const height = rotateClockwise ? image.width : image.height;
  const cropWidth = crop ? width * crop.width : portrait ? Math.min(width, height * 0.8) : width;
  const cropHeight = crop ? height * crop.height : height;
  const left = crop ? width * crop.x : (width - cropWidth) / 2;
  const top = crop ? height * crop.y : 0;
  const rgba = new Uint8Array(size * size * 4);
  function pixel(row, column, channel) {
    const index = rotateClockwise ? (image.height - 1 - column) * image.width + row : row * image.width + column;
    return image.data[index * 4 + channel];
  }
  for (let row = 0; row < size; row++) {
    const y = Math.max(0, top + (row + 0.5) * cropHeight / size - 0.5);
    const upperRow = Math.floor(y);
    const bottom = Math.min(upperRow + 1, height - 1);
    const vertical = y - upperRow;
    for (let column = 0; column < size; column++) {
      const x = Math.max(0, left + (column + 0.5) * cropWidth / size - 0.5);
      const leftColumn = Math.floor(x);
      const right = Math.min(leftColumn + 1, width - 1);
      const horizontal = x - leftColumn;
      const offset = (row * size + column) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const upper = pixel(upperRow, leftColumn, channel) * (1 - horizontal) + pixel(upperRow, right, channel) * horizontal;
        const lower = pixel(bottom, leftColumn, channel) * (1 - horizontal) + pixel(bottom, right, channel) * horizontal;
        rgba[offset + channel] = Math.round(upper * (1 - vertical) + lower * vertical);
      }
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function decodeImages(images, photos, size, decodeImage, queryCrops = []) {
  if (!decodeImage) {
    try {
      decodeImage = require('jpeg-js').decode;
    } catch {
      throw new LandmarkBuildError('MODEL_UNAVAILABLE', true);
    }
  }
  const pixels = new Map();
  for (const photo of photos) {
    let image;
    try {
      image = decodeImage(images.get(photo.id), { useTArray: true, maxResolutionInMP: 20, maxMemoryUsageInMB: 144 });
    } catch {
      throw new LandmarkBuildError('IMAGE_DECODE');
    }
    requireCondition(image.width > 0 && image.height > 0 && image.data.length === image.width * image.height * 4, 'IMAGE_DECODE');
    const full = readPixels(image, size, photo.rotateClockwise, false);
    const views = photo.role === 'query' ? [full, ...queryCrops.map((crop) => readPixels(image, size, photo.rotateClockwise, false, crop))]
      : [full, readPixels(image, size, photo.rotateClockwise, true)];
    pixels.set(photo.id, views);
  }
  return pixels;
}

async function loadDino(directory, modelHash) {
  let session;
  try {
    const runtime = require(path.resolve(directory, 'onnx-runtime/node_modules/onnxruntime-node'));
    const modelFile = path.join(__dirname, '../assets/models/dinov2-small-int8.onnx');
    const model = readPinned(modelFile, modelHash, 128 * megabyte);
    session = await runtime.InferenceSession.create(model, { intraOpNumThreads: 2, interOpNumThreads: 1 });
    return { session, Tensor: runtime.Tensor };
  } catch (error) {
    if (error instanceof LandmarkBuildError && error.reasonCode !== 'INPUT_UNAVAILABLE') throw error;
    throw new LandmarkBuildError('MODEL_UNAVAILABLE', true);
  }
}

function normalizeDinoPatches(data, dimensions) {
  const patches = data.slice(dimensions);
  requireCondition(patches.length === dinoPatchGridSize ** 2 * dimensions, 'DESCRIPTOR_SCHEMA');
  for (let offset = 0; offset < patches.length; offset += dimensions) {
    let squaredNorm = 0;
    for (let index = offset; index < offset + dimensions; index++) squaredNorm += patches[index] ** 2;
    requireCondition(Number.isFinite(squaredNorm) && squaredNorm > 0, 'DESCRIPTOR_SCHEMA');
    const norm = Math.sqrt(squaredNorm);
    for (let index = offset; index < offset + dimensions; index++) patches[index] /= norm;
  }
  return patches;
}

async function extractDino({ session, Tensor }, api, pixels, signal, patchPhotoIds) {
  const features = new Map();
  const imageSize = api.landmarkImageSize;
  let failed = false;
  try {
    for (const [id, views] of pixels) {
      const descriptors = [];
      for (const view of views) {
        if (signal?.aborted) throw new LandmarkBuildError('CANCELLED');
        let output;
        try {
          const input = new Tensor('float32', api.prepareLandmarkPixels(view), [1, 3, imageSize, imageSize]);
          output = (await session.run({ pixel_values: input })).last_hidden_state;
        } catch {
          throw new LandmarkBuildError('MODEL_INFERENCE', true);
        }
        const descriptor = output && api.summarizeLandmarkTensor(output.data, output.dims);
        requireCondition(descriptor, 'DESCRIPTOR_SCHEMA');
        const includePatches = descriptors.length === 0 && patchPhotoIds?.has(id);
        descriptors.push(includePatches
          ? { ...descriptor, patches: normalizeDinoPatches(output.data, output.dims[2]) }
          : descriptor);
      }
      features.set(id, descriptors);
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await session.release();
    } catch {
      if (!failed) throw new LandmarkBuildError('MODEL_CLEANUP', true);
    }
  }
  return features;
}

function readSalad(file, expectedDigest, modelDigest, manifestDigest, photos) {
  const bytes = readPinned(file, expectedDigest, 64 * megabyte);
  let data;
  try {
    data = parseJson(bytes);
  } catch {
    throw new LandmarkBuildError('DESCRIPTOR_SCHEMA');
  }
  requireCondition(data?.version === 'salad-v1.0.0' && data.modelSha256 === modelDigest
    && data.manifestSha256 === manifestDigest
    && data.descriptors && typeof data.descriptors === 'object' && !Array.isArray(data.descriptors), 'DESCRIPTOR_SCHEMA');
  const features = new Map();
  for (const photo of photos) {
    const vector = data.descriptors[photo.sha256];
    requireCondition(Array.isArray(vector) && vector.length === 8448 && vector.every(Number.isFinite), 'DESCRIPTOR_SCHEMA');
    const norm = Math.hypot(...vector);
    requireCondition(Number.isFinite(norm) && norm > 0, 'DESCRIPTOR_SCHEMA');
    features.set(photo.id, [Float32Array.from(vector, (value) => value / norm)]);
  }
  return features;
}

function cosine(left, right) {
  let score = 0;
  for (let index = 0; index < left.length; index++) score += left[index] * right[index];
  return score;
}

function dinoMatcher(api, features) {
  return {
    version: 'dinov2-small-int8-android-pilot',
    features,
    match(photo, references) {
      const matches = new Set();
      for (const row of references) {
        const query = features.get(photo.id)[0];
        if (features.get(row.id).some((vector) => api.matchesLandmarkEmbedding(query, vector, row.kind))) matches.add(row.placeId);
      }
      return matches.size === 1 ? matches.values().next().value : null;
    },
  };
}

function dinoVerifiedMatcher(api, features, counterexamples, verification) {
  const baseline = dinoMatcher(api, features);
  const competitors = new Map();
  for (const row of counterexamples) {
    const rows = competitors.get(row.placeId) ?? [];
    rows.push(row);
    competitors.set(row.placeId, rows);
  }
  return {
    ...baseline,
    version: dinoVerifierVersion,
    counterexamples,
    verification,
    match(photo, references) {
      const place = baseline.match(photo, references);
      const negatives = competitors.get(place);
      if (!negatives) return place;
      const query = features.get(photo.id)[0];
      const score = (row) => Math.max(...features.get(row.id).map((vector) => {
        const { global, pooled, regional } = api.scoreLandmarkEmbedding(query, vector);
        return (global + pooled + regional) / 3;
      }));
      const positive = Math.max(...references.filter((row) => row.placeId === place).map(score));
      return positive - Math.max(...negatives.map(score)) >= verification.margin ? place : null;
    },
  };
}

function saladMatcher(features) {
  return {
    version: 'salad-v1.0.0-cosine-v1',
    features,
    match(photo, references) {
      const scores = new Map();
      const query = features.get(photo.id)[0];
      for (const row of references) {
        const score = cosine(query, features.get(row.id)[0]);
        scores.set(row.placeId, Math.max(scores.get(row.placeId) ?? -1, score));
      }
      const [[place, best], [, runnerUp]] = [...scores].sort((left, right) => right[1] - left[1])
        .concat([[null, -1], [null, -1]]).slice(0, 2);
      return best >= 0.65 && best - runnerUp >= 0.08 ? place : null;
    },
  };
}

module.exports = { loadSource, decodeImages, loadDino, extractDino, readSalad, dinoMatcher, dinoVerifiedMatcher, saladMatcher,
  dinoPatchGridSize };
