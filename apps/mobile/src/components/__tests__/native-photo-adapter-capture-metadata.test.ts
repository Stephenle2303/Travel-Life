// Isolated from native-photo-adapter.test.ts because the Android capture-metadata
// reader is captured once at module load time (C-12/C-13, decision 0021): mocking it
// here, before the adapter import, exercises the wiring without disturbing that file's
// existing "no native reader" expectations.
const mockReadCaptureMetadata = jest.fn();
const mockAsset = jest.fn();
const mockExeForMetadata = jest.fn();

jest.mock('@/travel-window/native-capture-metadata', () => ({ nativeCaptureMetadataReader: () => mockReadCaptureMetadata }));
jest.mock('expo-media-library', () => ({
  Query: jest.fn(() => ({ within: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), offset: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), exeForMetadata: mockExeForMetadata })),
  Asset: mockAsset,
  AssetField: { MEDIA_TYPE: 'mediaType', CREATION_TIME: 'creationTime' },
  MediaType: { IMAGE: 'image', VIDEO: 'video' },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

// A plain require, not a top-level `import`: babel hoists `import`
// statements above this file's own `const mockReadCaptureMetadata = jest.fn()`,
// which would let native-adapter.ts's module-level capture of the (mocked)
// reader run before that mock function exists.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { nativePhotoAccess } = require('@/photo-access/native-adapter') as typeof import('@/photo-access/native-adapter');

describe('native adapter capture-metadata wiring (C-12/C-13, decision 0021)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('reports a precise offset and real folder provenance from the native EXIF reader', async () => {
    mockExeForMetadata.mockResolvedValue([{ id: 'seoul-1', mediaType: 'image', creationTime: 1_700_000_000_000, modificationTime: null }]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => null, getIsInCloud: async () => false, getUri: async () => 'file:///dcim/camera/img.jpg' }));
    mockReadCaptureMetadata.mockResolvedValue({ offsetTimeOriginal: '+09:00', relativeDirectory: 'DCIM/Camera' });

    const [result] = await nativePhotoAccess.readMetadataPage(0, 1);

    expect(result).toMatchObject({ hasPreciseOffset: true, sourceOrigin: 'camera' });
    expect(mockReadCaptureMetadata).toHaveBeenCalledWith('file:///dcim/camera/img.jpg');
  });

  it('treats a screenshot folder as review-only with no precise offset', async () => {
    mockExeForMetadata.mockResolvedValue([{ id: 'shot-1', mediaType: 'image', creationTime: 1_700_000_000_000, modificationTime: null }]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => null, getIsInCloud: async () => false, getUri: async () => 'file:///screenshots/shot.png' }));
    mockReadCaptureMetadata.mockResolvedValue({ relativeDirectory: 'Pictures/Screenshots' });

    const [result] = await nativePhotoAccess.readMetadataPage(0, 1);

    expect(result).toMatchObject({ hasPreciseOffset: false, sourceOrigin: 'screenshot' });
  });

  it('keeps conservative defaults when the native reader throws for one asset, without failing the page, and reports one bucketed diagnostic', async () => {
    mockExeForMetadata.mockResolvedValue([{ id: 'unreadable-1', mediaType: 'image', creationTime: 1_700_000_000_000, modificationTime: null }]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => null, getIsInCloud: async () => false, getUri: async () => 'file:///dcim/camera/unreadable.jpg' }));
    mockReadCaptureMetadata.mockRejectedValue(Object.assign(new Error('native decode failure'), { code: 'ERR_CAPTURE_DECODE' }));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const [result] = await nativePhotoAccess.readMetadataPage(0, 1);

      expect(result).toMatchObject({ hasPreciseOffset: false, sourceOrigin: null });
      expect(log).toHaveBeenCalledWith('[Travel Life diagnostic]', expect.objectContaining({
        operation: 'METADATA_IMPORT', stage: 'CAPTURE_METADATA_READ', reasonCode: 'MEDIA_DECODE', durableOutcome: 'unchanged', retryable: false,
      }));
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/unreadable-1|native decode failure/);
    } finally { log.mockRestore(); }
  });

  it('reports only distinct failure reasons once per page, not once per asset', async () => {
    mockExeForMetadata.mockResolvedValue([
      { id: 'bad-1', mediaType: 'image', creationTime: 1_700_000_000_000, modificationTime: null },
      { id: 'bad-2', mediaType: 'image', creationTime: 1_700_000_000_000, modificationTime: null },
      { id: 'bad-3', mediaType: 'image', creationTime: 1_700_000_000_000, modificationTime: null },
    ]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => null, getIsInCloud: async () => false, getUri: async () => 'file:///dcim/camera/x.jpg' }));
    mockReadCaptureMetadata.mockRejectedValue(Object.assign(new Error('decode'), { code: 'ERR_CAPTURE_DECODE' }));
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await nativePhotoAccess.readMetadataPage(0, 3);

      const captureEvents = log.mock.calls.filter(([, event]) => (event as { stage?: string }).stage === 'CAPTURE_METADATA_READ');
      expect(captureEvents).toHaveLength(1);
    } finally { log.mockRestore(); }
  });

  it('skips the native read entirely when the capture time is unknown', async () => {
    mockExeForMetadata.mockResolvedValue([{ id: 'undated-1', mediaType: 'image', creationTime: null, modificationTime: null }]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => null, getIsInCloud: async () => false, getUri: jest.fn() }));

    const [result] = await nativePhotoAccess.readMetadataPage(0, 1);

    expect(result).toMatchObject({ hasPreciseOffset: false, sourceOrigin: null });
    expect(mockReadCaptureMetadata).not.toHaveBeenCalled();
  });
});
