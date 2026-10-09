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
  let availability: SourceCandidate['availability'] = 'unknown';
  try {
    locationAvailable = (await asset.getLocation()) !== null;
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
    modifiedAtMillis: metadata.modificationTime,
    locationAvailable,
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
};
