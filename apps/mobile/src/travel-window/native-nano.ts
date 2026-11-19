import { requireOptionalNativeModule } from 'expo';

type NanoNativeModule = {
  checkNanoStatus?(): Promise<unknown>;
  downloadNanoModel?(): Promise<void>;
  nanoDescribeImage?(uri: string, prompt: string): Promise<unknown>;
};

export type NativeNano = {
  checkStatus(): Promise<unknown>;
  download(): Promise<void>;
  describeImage(uri: string, prompt: string): Promise<unknown>;
};

/** Android-only native Nano binding (Story 1 Q3). Null on iOS or older native builds. */
export function nativeNano(): NativeNano | null {
  const module = requireOptionalNativeModule<NanoNativeModule>('TravelLifeSignage');
  const { checkNanoStatus, downloadNanoModel, nanoDescribeImage } = module ?? {};
  if (!checkNanoStatus || !downloadNanoModel || !nanoDescribeImage) return null;
  return {
    checkStatus: checkNanoStatus.bind(module),
    download: downloadNanoModel.bind(module),
    describeImage: nanoDescribeImage.bind(module),
  };
}
