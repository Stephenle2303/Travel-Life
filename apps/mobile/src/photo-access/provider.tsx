import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { PhotoAccessController, initialPhotoAccess } from './controller';
import { nativePhotoAccess } from './native-adapter';
import type { PhotoAccessAdapter, PhotoAccessSnapshot } from './types';
import type { ImportCoverage, ImportRepository } from '@/import-record';

type PhotoAccessContextValue = {
  snapshot: PhotoAccessSnapshot;
  controller: PhotoAccessController;
  importCoverage: ImportCoverage;
};

const PhotoAccessContext = createContext<PhotoAccessContextValue | null>(null);

export function PhotoAccessProvider({ children, adapter = nativePhotoAccess, repository }: PropsWithChildren<{ adapter?: PhotoAccessAdapter; repository?: ImportRepository }>) {
  const [snapshot, setSnapshot] = useState(initialPhotoAccess);
  const [importCoverage, setImportCoverage] = useState<ImportCoverage>({ scope: null, accessible: null, scanned: 0, geotagged: 0, unavailable: 0, status: 'idle', message: null });
  const [controller] = useState(() => new PhotoAccessController(adapter, setSnapshot, setImportCoverage, repository));

  useEffect(() => {
    void controller.refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void controller.refresh(!controller.isBusy);
      else controller.interrupt();
    });
    return () => {
      controller.interrupt();
      subscription?.remove();
    };
  }, [controller]);

  return <PhotoAccessContext.Provider value={{ snapshot, controller, importCoverage }}>{children}</PhotoAccessContext.Provider>;
}

export function usePhotoAccess() {
  const value = useContext(PhotoAccessContext);
  if (!value) throw new Error('PhotoAccessProvider is required');
  return value;
}
