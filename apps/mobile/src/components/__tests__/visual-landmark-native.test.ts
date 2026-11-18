import { Asset } from 'expo-asset';
import { digest } from 'expo-crypto';
import { File } from 'expo-file-system';
import { prepareNativeLandmark, readNativeLandmark } from '@/visual-place/native-landmark';
import references from '@/visual-place/data/ewha-campus-embeddings.json';
import { ewhaCampusVisual } from '@/visual-place/place-catalog';
import { regionalLandmarkModelSha256 } from '@/visual-place/regional-landmarks';

jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-crypto', () => ({ digest: jest.fn(), CryptoDigestAlgorithm: { SHA256: 'SHA-256' } }));
jest.mock('../../../assets/models/dinov2-small-int8.onnx', () => 1);

it('rejects a substituted native model and enables regional inference only after verifying its bytes', async () => {
  const uri = 'file:///synthetic-public-model';
  (Asset.fromModule as jest.Mock).mockReturnValue({ localUri: uri, downloadAsync: jest.fn(async () => {}) });
  const size = 24_451_943;
  const fileBytes = jest.fn(async () => new Uint8Array(size));
  (File as unknown as jest.Mock).mockReturnValue({ size, bytes: fileBytes });
  (digest as jest.Mock).mockResolvedValueOnce(new Uint8Array(32).buffer)
    .mockResolvedValueOnce(Uint8Array.from(Buffer.from(regionalLandmarkModelSha256, 'hex')).buffer);
  const load = jest.fn(async () => {});
  const signal = new AbortController().signal;
  await prepareNativeLandmark(load, signal);
  expect(fileBytes).not.toHaveBeenCalled();
  await expect(prepareNativeLandmark(load, signal, true)).rejects.toMatchObject({ reason: 'MEDIA_VERIFY' });
  expect(load).toHaveBeenCalledTimes(1);
  await prepareNativeLandmark(load, signal, true);
  await prepareNativeLandmark(load, signal, true);
  expect(fileBytes).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenLastCalledWith(uri);
});

it('accepts the Android feature envelope and withholds malformed or withdrawn results', async () => {
  const { global, regions } = references[0].embedding;
  const raw = Buffer.alloc(257 * 384 * Float32Array.BYTES_PER_ELEMENT);
  for (let token = 0; token < 257; token++) {
    const patch = token - 1;
    const values = token === 0 ? global : regions[Math.floor(patch / 64) * 4 + Math.floor(patch % 16 / 4)];
    values.forEach((value, index) => raw.writeFloatLE(value, (token * 384 + index) * 4));
  }
  const uri = 'content://synthetic-local-photo';
  const controller = new AbortController();
  await expect(readNativeLandmark(async () => raw.toString('base64'), uri, controller.signal))
    .resolves.toMatchObject({ place: { id: ewhaCampusVisual.id } });
  await expect(readNativeLandmark(async () => 'private-sentinel', uri, controller.signal))
    .rejects.toMatchObject({ reason: 'MEDIA_SCHEMA', message: 'Visual place review could not continue.' });
  const withdraw = async () => { controller.abort(); return raw.toString('base64'); };
  await expect(readNativeLandmark(withdraw, uri, controller.signal)).rejects.toMatchObject({ reason: 'SKIPPED' });
});
