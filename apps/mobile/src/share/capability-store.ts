import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'travel-life.share-capability.';

const isOperationId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);

function base64Url(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]; const b = bytes[index + 1]; const c = bytes[index + 2];
    output += alphabet[a >> 2];
    output += alphabet[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
    if (b !== undefined) output += alphabet[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
    if (c !== undefined) output += alphabet[c & 63];
  }
  return output;
}

export type ShareCapabilityStore = Readonly<{
  create(requestId: string): Promise<string>;
  read(requestId: string): Promise<string | null>;
  remove(requestId: string): Promise<void>;
}>;

export function createShareCapabilityStore(options: Readonly<{
  storage: Pick<typeof SecureStore, 'setItemAsync' | 'getItemAsync' | 'deleteItemAsync'>;
  randomBytes(size: number): Promise<Uint8Array>;
}>): ShareCapabilityStore {
  const key = (requestId: string) => {
    if (!isOperationId(requestId)) throw new Error('Invalid share operation.');
    return `${KEY_PREFIX}${requestId}`;
  };
  return {
    async create(requestId) {
      const capability = base64Url(await options.randomBytes(32));
      if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) throw new Error('Share capability did not finish.');
      await options.storage.setItemAsync(key(requestId), capability);
      return capability;
    },
    async read(requestId) { return await options.storage.getItemAsync(key(requestId)); },
    async remove(requestId) { await options.storage.deleteItemAsync(key(requestId)); },
  };
}

export const expoShareCapabilityStore = createShareCapabilityStore({
  storage: SecureStore,
  randomBytes: getRandomBytesAsync,
});
