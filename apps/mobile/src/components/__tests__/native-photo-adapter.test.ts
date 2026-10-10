import { nativePhotoAccess } from '@/photo-access/native-adapter';

const mockQuery = {
  within: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exeForMetadata: jest.fn(),
};
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockPresentPicker = jest.fn();
const mockLaunchPicker = jest.fn();
const mockAsset = jest.fn();

jest.mock('expo-media-library', () => ({
  Query: jest.fn(() => mockQuery),
  Asset: mockAsset,
  AssetField: { MEDIA_TYPE: 'mediaType', CREATION_TIME: 'creationTime' },
  MediaType: { IMAGE: 'image', VIDEO: 'video' },
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  presentPermissionsPicker: (...args: unknown[]) => mockPresentPicker(...args),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchPicker(...args),
}));

describe('Expo SDK 57 native adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads photo/video permission and counts a lightweight query page', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true, status: 'granted', accessPrivileges: 'limited', canAskAgain: false });
    mockQuery.exeForMetadata.mockResolvedValue([{ id: 'synthetic-1', mediaType: 'image', creationTime: null, modificationTime: null }, { id: 'synthetic-2', mediaType: 'video', creationTime: 2, modificationTime: 3 }]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => null, getIsInCloud: async () => false }));

    expect(await nativePhotoAccess.inspect()).toEqual({ scope: 'limited', canAskAgain: false });
    expect(mockGetPermissions).toHaveBeenCalledWith(false, ['photo', 'video']);
    expect(await nativePhotoAccess.readPage(100, 100)).toBe(2);
    expect(mockQuery.within).toHaveBeenCalledWith('mediaType', ['image', 'video']);
    expect(mockQuery.offset).toHaveBeenCalledWith(100);
    expect(mockQuery.exeForMetadata).toHaveBeenCalledTimes(1);
    expect(await nativePhotoAccess.readMetadataPage(0, 100)).toEqual([
      { assetId: 'synthetic-1', mediaType: 'image', capturedAtMillis: null, capturedDay: null, hasPreciseOffset: false, modifiedAtMillis: null, locationAvailable: false, latitude: null, longitude: null, reportedAccuracyMeters: null, availability: 'available' },
      { assetId: 'synthetic-2', mediaType: 'video', capturedAtMillis: 2, capturedDay: '1970-01-01', hasPreciseOffset: false, modifiedAtMillis: 3, locationAvailable: false, latitude: null, longitude: null, reportedAccuracyMeters: null, availability: 'available' },
    ]);
  });

  it('uses the system picker and returns counts without retaining media fields', async () => {
    mockLaunchPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://synthetic-a', assetId: 'a' }, { uri: 'file://synthetic-b', assetId: null }],
    });

    expect(await nativePhotoAccess.select()).toEqual({ canceled: false, count: 2, missingAssetIds: 1, stableAssetIds: ['a'] });
    expect(mockLaunchPicker).toHaveBeenCalledWith(expect.objectContaining({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      exif: false,
      base64: false,
      shouldDownloadFromNetwork: false,
    }));
  });

  it('omits a selected stable ID that disappears before metadata lookup', async () => {
    mockAsset.mockImplementation((id: string) => {
      if (id === 'gone') return { getMediaType: async () => { throw new Error('missing'); } };
      return {
        getMediaType: async () => 'image',
        getCreationTime: async () => null,
        getModificationTime: async () => null,
        getLocation: async () => null,
        getIsInCloud: async () => false,
      };
    });

    await expect(nativePhotoAccess.readSelectedMetadata(['stable', 'gone'])).resolves.toEqual([
      { assetId: 'stable', mediaType: 'image', capturedAtMillis: null, capturedDay: null, hasPreciseOffset: false, modifiedAtMillis: null, locationAvailable: false, latitude: null, longitude: null, reportedAccuracyMeters: null, availability: 'available' },
    ]);
  });

  it('opens limited-scope management only on request', async () => {
    await nativePhotoAccess.manageLimited();
    expect(mockPresentPicker).toHaveBeenCalledWith(['photo', 'video']);
  });

  it('fails closed when the native response contradicts a granted status', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true, status: 'granted', accessPrivileges: 'none', canAskAgain: true });
    expect(await nativePhotoAccess.inspect()).toEqual({ scope: 'denied', canAskAgain: false });
  });
});
