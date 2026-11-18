import { Asset } from 'expo-asset';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { File } from 'expo-file-system';
import { matchesLandmarkEmbedding, summarizeLandmarkTensor, type LandmarkEmbedding } from './landmark-embedding';
import { canonicalVisualStop, ewhaCampusVisual, resolveVisualPlace } from './place-catalog';
import { VisualPlaceError } from './recovery';
import { regionalLandmarkModelSha256 } from './regional-landmarks';
import references from './data/ewha-campus-embeddings.json';

const outputShape = [1, 257, 384] as const;
const outputBytes = outputShape[1] * outputShape[2] * Float32Array.BYTES_PER_ELEMENT;
const regionalModelBytes = 24_451_943;
let prepared: { regional: boolean; work: Promise<void> } | null = null;
const index: readonly { embedding: LandmarkEmbedding; kind: string; placeId?: string }[] = references;

function validatedReferencePlaces() {
  return index.map(({ embedding, placeId, kind }) => {
    const place = resolveVisualPlace(placeId ?? ewhaCampusVisual.id);
    const vectors = [embedding.global, embedding.pooled, ...embedding.regions];
    if (!place || typeof kind !== 'string' || embedding.regions.length !== 16
      || vectors.some((vector) => vector.length !== outputShape[2] || !Array.from(vector).every(Number.isFinite))) {
      throw new VisualPlaceError('MEDIA_SCHEMA');
    }
    return { place, embedding, kind };
  });
}

let validatedIndex: ReturnType<typeof validatedReferencePlaces> | undefined;

async function verifyRegionalAsset(uri: string, signal: AbortSignal) {
  const model = new File(uri);
  if (model.size !== regionalModelBytes) throw new VisualPlaceError('MEDIA_VERIFY');
  const bytes = await model.bytes();
  if (signal.aborted) throw new VisualPlaceError('SKIPPED');
  if (bytes.byteLength !== regionalModelBytes) throw new VisualPlaceError('MEDIA_VERIFY');
  const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes.buffer));
  const sha256 = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== regionalLandmarkModelSha256) throw new VisualPlaceError('MEDIA_VERIFY');
}

async function prepareAsset(loadModel: (uri: string) => Promise<void>, signal: AbortSignal, regional: boolean) {
  // The public checkpoint is a Metro asset on the development client.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/models/dinov2-small-int8.onnx'));
  await asset.downloadAsync();
  if (signal.aborted) throw new VisualPlaceError('SKIPPED');
  if (!asset.localUri?.startsWith('file:///')) throw new VisualPlaceError('MEDIA_UNAVAILABLE');
  if (regional) await verifyRegionalAsset(asset.localUri, signal);
  if (signal.aborted) throw new VisualPlaceError('SKIPPED');
  await loadModel(asset.localUri);
}

export async function prepareNativeLandmark(loadModel: (uri: string) => Promise<void>, signal: AbortSignal, regional = false) {
  if (!prepared || (regional && !prepared.regional)) {
    const work = prepareAsset(loadModel, signal, regional).catch((error) => {
      if (prepared?.work === work) prepared = null;
      if (error instanceof VisualPlaceError) throw error;
      throw new VisualPlaceError('MEDIA_UNAVAILABLE');
    });
    prepared = { regional, work };
  }
  await prepared.work;
}

function decodeLandmarkFeatures(encoded: unknown) {
  if (typeof encoded !== 'string' || encoded.length !== 4 * Math.ceil(outputBytes / 3)) throw new VisualPlaceError('MEDIA_SCHEMA');
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new VisualPlaceError('MEDIA_SCHEMA');
  }
  if (binary.length !== outputBytes) throw new VisualPlaceError('MEDIA_SCHEMA');
  const bytes = new Uint8Array(outputBytes);
  for (let index = 0; index < bytes.length; index++) bytes[index] = binary.charCodeAt(index);
  // Android's supported ABIs and the native module's encoded floats are little-endian.
  const features = new Float32Array(bytes.buffer);
  const query = summarizeLandmarkTensor(features, outputShape);
  if (!query) throw new VisualPlaceError('MEDIA_SCHEMA');
  return query;
}

export async function readNativeLandmark(read: (uri: string) => Promise<unknown>, uri: string, signal: AbortSignal, regional = false) {
  if (signal.aborted) throw new VisualPlaceError('SKIPPED');
  let encoded: unknown;
  try {
    encoded = await read(uri);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'ERR_LANDMARK_DECODE') throw new VisualPlaceError('MEDIA_DECODE');
    if (code === 'ERR_LANDMARK_SCHEMA') throw new VisualPlaceError('MEDIA_SCHEMA');
    throw new VisualPlaceError('MEDIA_VERIFY');
  }
  if (signal.aborted) throw new VisualPlaceError('SKIPPED');
  const query = decodeLandmarkFeatures(encoded);
  if (regional) return { place: null, embedding: query };
  validatedIndex ??= validatedReferencePlaces();
  const matches = new Map(validatedIndex.flatMap(({ embedding, kind, place }) =>
    matchesLandmarkEmbedding(query, embedding, kind) ? [[canonicalVisualStop(place.id), place] as const] : []));
  return { place: matches.size > 1 ? 'ambiguous' as const : matches.values().next().value ?? null, embedding: query };
}
