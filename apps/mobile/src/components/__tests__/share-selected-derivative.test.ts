import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import { prepareSelectedDerivative } from '@/share/derivative';
const mockRender = jest.fn(); const mockSave = jest.fn();
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///private-cache/', copyAsync: jest.fn(), deleteAsync: jest.fn(), readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: jest.fn(() => ({ resize: jest.fn(), renderAsync: mockRender })) } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001', CryptoDigestAlgorithm: { SHA256: 'sha256' }, digest: async () => new Uint8Array(32) }));
describe('selected derivative diagnostic boundaries', () => {
  let logs: jest.SpyInstance;
  beforeEach(() => { jest.clearAllMocks(); logs = jest.spyOn(console, 'info').mockImplementation(() => {}); jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => { success(100, 80); }); (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined); (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined); (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined); mockRender.mockResolvedValue({ saveAsync: mockSave }); mockSave.mockResolvedValue({ uri: 'file:///private-cache/reencoded.jpg' }); (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(btoa(String.fromCharCode(255,216,255,218,0,2,1,255,217))); });
  afterEach(() => { jest.restoreAllMocks(); });
  it.each([
    ['SHARE_COPY', 'SHARE_STORAGE', () => (FileSystem.copyAsync as jest.Mock).mockRejectedValue({ nested: { token: 'PRIVATE_SENTINEL' } })],
    ['SHARE_DECODE', 'SHARE_DECODE', () => jest.spyOn(Image, 'getSize').mockImplementation((_uri, _success, failure) => { failure?.(new Error('PRIVATE_SENTINEL')); })],
    ['SHARE_ENCODE', 'SHARE_ENCODE', () => (ImageManipulator.manipulate as jest.Mock).mockImplementationOnce(() => { throw new Error('PRIVATE_SENTINEL'); })],
    ['SHARE_VERIFY', 'SHARE_VERIFY', () => (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(btoa(String.fromCharCode(255,216,255,218,0,2,1,255,217))).mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'))],
  ])('preserves %s classification and correlation without private payloads', async (stage, reason, fault) => {
    (fault as () => void)(); await expect(prepareSelectedDerivative('file:///private-source', 'photo', 'runtime-synthetic-1')).rejects.toMatchObject({ stage, reason });
    expect(logs.mock.calls.at(-1)?.[1]).toMatchObject({ operation: 'SHARE_DERIVATIVE', stage, reasonCode: reason, durableOutcome: 'failed', correlationId: 'runtime-synthetic-1' }); expect(JSON.stringify(logs.mock.calls)).not.toMatch(/PRIVATE_SENTINEL|private-source/);
  });
});

