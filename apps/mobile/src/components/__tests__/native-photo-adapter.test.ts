import { nativePhotoAccess } from '@/photo-access/native-adapter';
import { Platform } from 'react-native';

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
      { assetId: 'synthetic-1', mediaType: 'image', capturedAtMillis: null, capturedDay: null, hasPreciseOffset: false, modifiedAtMillis: null, locationAvailable: false, latitude: null, longitude: null, reportedAccuracyMeters: null, platformDuplicateFamilyId: null, sourceOrigin: null, supportEligible: true, availability: 'available' },
      { assetId: 'synthetic-2', mediaType: 'video', capturedAtMillis: 2, capturedDay: '1970-01-01', hasPreciseOffset: false, modifiedAtMillis: 3, locationAvailable: false, latitude: null, longitude: null, reportedAccuracyMeters: null, platformDuplicateFamilyId: null, sourceOrigin: null, supportEligible: true, availability: 'available' },
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

  it('normalizes numeric native coordinates for reconstruction support', async () => {
    mockQuery.exeForMetadata.mockResolvedValue([{ id: 'synthetic-location', mediaType: 'image', creationTime: Date.UTC(2026, 0, 1), modificationTime: null }]);
    mockAsset.mockImplementation(() => ({ getLocation: async () => ({ latitude: 13.7, longitude: 100.5 }), getIsInCloud: async () => false }));

    const [candidate] = await nativePhotoAccess.readMetadataPage(0, 1);
    expect(candidate).toMatchObject({ locationAvailable: true, latitude: 13.7, longitude: 100.5, reportedAccuracyMeters: null, supportEligible: true, availability: 'available' });
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
      { assetId: 'stable', mediaType: 'image', capturedAtMillis: null, capturedDay: null, hasPreciseOffset: false, modifiedAtMillis: null, locationAvailable: false, latitude: null, longitude: null, reportedAccuracyMeters: null, platformDuplicateFamilyId: null, sourceOrigin: null, supportEligible: true, availability: 'available' },
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

  it('resolves only the bounded permitted preview set and keeps cloud or missing assets unavailable', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true, status: 'granted', accessPrivileges: 'full', canAskAgain: false });
    mockAsset.mockImplementation((id: string) => id === 'cloud'
      ? { getIsInCloud: async () => true, getUri: jest.fn(), getMediaType: async () => 'video' }
      : id === 'gone'
        ? { getIsInCloud: async () => { throw new Error('gone'); }, getMediaType: async () => 'photo' }
        : { getIsInCloud: async () => false, getUri: async () => 'file://private-preview', getMediaType: async () => 'photo' });

    await expect(nativePhotoAccess.resolveOwnerPreviews!([null, 'ready', 'cloud', 'gone', 'ignored'], 4)).resolves.toEqual([
      { uri: null, availability: 'unavailable', kind: 'photo' },
      { uri: 'file://private-preview', availability: 'available', kind: 'photo' },
      { uri: null, availability: 'unavailable', kind: 'video' },
      { uri: null, availability: 'unavailable', kind: 'photo' },
    ]);
    expect(mockAsset).not.toHaveBeenCalledWith('ignored');
  });

  it('resolves a bounded gallery page in parallel while preserving tile order', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true, status: 'granted', accessPrivileges: 'full', canAskAgain: false });
    let active = 0;
    let peak = 0;
    mockAsset.mockImplementation((id: string) => ({
      getMediaType: async () => 'image',
      getIsInCloud: async () => false,
      getUri: async () => {
        active += 1; peak = Math.max(peak, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return `file://preview-${id}`;
      },
    }));

    const ids = Array.from({ length: 12 }, (_value, index) => `asset-${index + 1}`);
    await expect(nativePhotoAccess.resolveOwnerPreviews!(ids, ids.length)).resolves.toEqual(ids.map((id) => ({ uri: `file://preview-${id}`, availability: 'available', kind: 'photo' })));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(6);
  });

  it('does not call the iOS-only cloud check before resolving an Android local URI', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const getIsInCloud = jest.fn(async () => { throw new Error('iOS only'); });
    mockGetPermissions.mockResolvedValue({ granted: true, status: 'granted', accessPrivileges: 'full', canAskAgain: false });
    mockAsset.mockImplementation(() => ({ getIsInCloud, getUri: async () => 'file://android-preview', getMediaType: async () => 'image' }));

    try {
      await expect(nativePhotoAccess.resolveOwnerPreviews!(['android-ready'], 1)).resolves.toEqual([
        { uri: 'file://android-preview', availability: 'available', kind: 'photo' },
      ]);
      expect(getIsInCloud).not.toHaveBeenCalled();
    } finally {
      if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    }
  });
});
