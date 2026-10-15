import { Platform } from 'react-native';

import type { SourceCandidate } from '@/import-record/types';

import type { PermissionSnapshot, PhotoAccessAdapter, SelectionResult } from './types';

const mediaPermissions = ['photo', 'video'] as const;

function supported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function mediaLibrary(): typeof import('expo-media-library') {
  // Keep native module loading behind the platform guard so web can explain
  // unavailability without trying to initialize the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-media-library');
}

function imagePicker(): typeof import('expo-image-picker') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-image-picker');
}

function permissionScope(response: {
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
  status: string;
}): PermissionSnapshot {
  if (response.accessPrivileges === 'none') {
    return { scope: 'denied', canAskAgain: false };
  }
  if (response.granted) {
    return {
      scope: response.accessPrivileges === 'limited' ? 'limited' : 'full',
      canAskAgain: response.canAskAgain,
    };
  }
  return {
    scope: response.status === 'undetermined' ? 'unasked' : 'denied',
    canAskAgain: response.canAskAgain,
  };
}

async function candidateFromMetadata(metadata: { id: string; mediaType: string; creationTime: number | null; modificationTime: number | null }): Promise<SourceCandidate> {
  const library = mediaLibrary();
  const asset = new library.Asset(metadata.id);
  let locationAvailable: boolean | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let reportedAccuracyMeters: number | null = null;
  let availability: SourceCandidate['availability'] = 'unknown';
  try {
    const location = await asset.getLocation();
    locationAvailable = location !== null;
    if (location && typeof location === 'object') {
      const candidate = location as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
      latitude = typeof candidate.latitude === 'number' && Number.isFinite(candidate.latitude) ? candidate.latitude : null;
      longitude = typeof candidate.longitude === 'number' && Number.isFinite(candidate.longitude) ? candidate.longitude : null;
      reportedAccuracyMeters = typeof candidate.accuracy === 'number' && Number.isFinite(candidate.accuracy) ? candidate.accuracy : null;
    }
  } catch {
    // Missing platform metadata permission is distinct from a missing location.
  }
  try {
    availability = await asset.getIsInCloud() ? 'unavailable' : 'available';
  } catch {
    // Android and disconnected assets can leave cloud status unknown.
  }
  return {
    assetId: metadata.id,
    mediaType: metadata.mediaType === 'video' ? 'video' : 'image',
    capturedAtMillis: metadata.creationTime,
    capturedDay: metadata.creationTime === null ? null : (() => { const date = new Date(metadata.creationTime); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; })(),
    hasPreciseOffset: false,
    modifiedAtMillis: metadata.modificationTime,
    locationAvailable,
    latitude,
    longitude,
    reportedAccuracyMeters,
    // Expo Media Library exposes no documented stable duplicate-family
    // relationship. Keep this explicit null rather than deriving one from
    // metadata that merely happens to look similar.
    platformDuplicateFamilyId: null,
    sourceOrigin: null,
    supportEligible: true,
    availability,
  };
}

/** Returns only normalized local metadata; paths, filenames, EXIF, media and coordinates never escape. */
export const nativePhotoAccess: PhotoAccessAdapter = {
  async inspect() {
    if (!supported()) return null;
    const library = mediaLibrary();
    return permissionScope(await library.getPermissionsAsync(false, [...mediaPermissions]));
  },

  async request() {
    if (!supported()) return null;
    const library = mediaLibrary();
    return permissionScope(await library.requestPermissionsAsync(false, [...mediaPermissions]));
  },

  async readPage(offset, limit) {
    if (!supported()) throw new Error('Native photo library unavailable');
    const { Query, AssetField, MediaType } = mediaLibrary();
    const page = await new Query()
      .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
      .orderBy(AssetField.CREATION_TIME)
      .offset(offset)
      .limit(limit)
      .exeForMetadata();
    return page.length;
  },

  async readMetadataPage(offset, limit) {
    if (!supported()) throw new Error('Native photo library unavailable');
    const { Query, AssetField, MediaType } = mediaLibrary();
    const page = await new Query()
      .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
      .orderBy(AssetField.CREATION_TIME)
      .offset(offset)
      .limit(limit)
      .exeForMetadata();
    return Promise.all(page.map((metadata) => candidateFromMetadata(metadata)));
  },

  async readSelectedMetadata(assetIds) {
    if (!supported()) throw new Error('Native photo library unavailable');
    const library = mediaLibrary();
    const candidates: SourceCandidate[] = [];
    for (const assetId of assetIds) {
      try {
        const asset = new library.Asset(assetId);
        candidates.push(await candidateFromMetadata({
          id: assetId,
          mediaType: await asset.getMediaType(),
          creationTime: await asset.getCreationTime(),
          modificationTime: await asset.getModificationTime(),
        }));
      } catch {
        // A selected identifier can disappear before import. It is not replaced.
      }
    }
    return candidates;
  },

  async manageLimited() {
    if (!supported()) throw new Error('Native photo library unavailable');
    const library = mediaLibrary();
    await library.presentPermissionsPicker(['photo', 'video']);
  },

  async select(): Promise<SelectionResult> {
    if (!supported()) throw new Error('Native photo picker unavailable');
    const picker = imagePicker();
    const result = await picker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      allowsEditing: false,
      exif: false,
      base64: false,
      shouldDownloadFromNetwork: false,
    });
    if (result.canceled) return { canceled: true };
    const stableAssetIds = result.assets.flatMap((asset) => asset.assetId ? [asset.assetId] : []);
    return {
      canceled: false,
      count: result.assets.length,
      missingAssetIds: result.assets.filter((asset) => !asset.assetId).length,
      stableAssetIds,
    };
  },

  async resolveOwnerPreviews(assetIds, limit) {
    if (!supported()) throw new Error('Native photo library unavailable');
    const permission = await this.inspect();
    if (permission?.scope !== 'full' && permission?.scope !== 'limited') throw new Error('Photo access is not permitted');
    const previews: import('./types').OwnerPreview[] = [];
    for (const assetId of assetIds.slice(0, Math.max(0, limit))) {
      if (assetId === null) { previews.push({ uri: null, availability: 'unavailable', kind: 'photo' }); continue; }
      try {
        const asset = new (mediaLibrary().Asset)(assetId) as { getIsInCloud(): Promise<boolean>; getUri(): Promise<string>; getMediaType(): Promise<string> };
        const kind = await asset.getMediaType() === 'video' ? 'video' as const : 'photo' as const;
        // `getIsInCloud` is an iOS-only Expo Media Library API. On Android it
        // throws before `getUri` can run, which would incorrectly turn every
        // otherwise accessible local asset into an unavailable gallery slot.
        if (Platform.OS === 'ios' && await asset.getIsInCloud()) { previews.push({ uri: null, availability: 'unavailable', kind }); continue; }
        previews.push({ uri: await asset.getUri(), availability: 'available', kind });
      } catch { previews.push({ uri: null, availability: 'unavailable', kind: 'photo' }); }
    }
    return previews;
  },
};
