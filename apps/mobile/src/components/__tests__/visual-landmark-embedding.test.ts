import { landmarkImageSize, matchesLandmarkEmbedding, prepareLandmarkPixels, summarizeLandmarkTensor } from '@/visual-place/landmark-embedding';

it('normalizes the bounded RGB image into planar model input', () => {
  const area = landmarkImageSize ** 2;
  const rgba = new Uint8Array(area * 4);
  rgba.set([255, 128, 0, 42]);
  const pixels = prepareLandmarkPixels(rgba);
  expect(pixels).toHaveLength(area * 3);
  expect(pixels![0]).toBeCloseTo((1 - 0.485) / 0.229);
  expect(pixels![area]).toBeCloseTo((128 / 255 - 0.456) / 0.224);
  expect(pixels![area * 2]).toBeCloseTo(-0.406 / 0.225);
  expect(prepareLandmarkPixels(rgba.subarray(4))).toBeNull();
});

it('requires regional agreement alongside global similarity and rejects malformed tensors', () => {
  const shape = [1, 257, 384];
  const features = new Float32Array(257 * 384);
  features[0] = 1;
  const shuffled = features.slice();
  for (let patch = 0; patch < 256; patch++) {
    const column = patch % 16;
    features[(patch + 1) * 384 + Number(column >= 8)] = 1;
    shuffled[(patch + 1) * 384 + Number(column < 8)] = 1;
  }
  const reference = summarizeLandmarkTensor(features, shape)!;
  const differentLayout = summarizeLandmarkTensor(shuffled, shape)!;
  expect(matchesLandmarkEmbedding(reference, reference)).toBe(true);
  expect(matchesLandmarkEmbedding(reference, differentLayout)).toBe(false);
  expect(summarizeLandmarkTensor(features, [1, 256, 384])).toBeNull();
  features[384] = NaN;
  expect(summarizeLandmarkTensor(features, shape)).toBeNull();
});
