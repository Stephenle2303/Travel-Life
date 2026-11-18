export type CredentialStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export class AccountProviderError extends Error {
  readonly stage = 'ACCOUNT_PROVIDER';
  constructor(readonly originalError: unknown) { super('Account provider is unavailable.'); this.name = 'AccountProviderError'; }
}

export class AccountStorageError extends Error {
  readonly reason = 'ACCOUNT_STORAGE';
  constructor(readonly stage?: 'ACCOUNT_SECURE_READ' | 'ACCOUNT_SECURE_WRITE' | 'ACCOUNT_SECURE_DELETE') { super('Account storage is unavailable.'); this.name = 'AccountStorageError'; }
}

type Manifest = { version: 1; generation: string; count: number };
const manifest = (raw: string): Manifest => {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccountStorageError();
  const item = value as Manifest;
  if (Object.keys(item).length !== 3 || item.version !== 1 || !/^[a-zA-Z0-9-]{1,80}$/.test(item.generation) || !Number.isInteger(item.count) || item.count < 1 || item.count > 128) throw new AccountStorageError();
  return item;
};

/** Manifest-last generations preserve the previous complete session on failed writes. */
export function createAccountStorage(native: CredentialStorage, newGeneration: () => string) {
  let queue: Promise<unknown> = Promise.resolve();
  let blocked = false;
  let epoch = 0;
  const fenceKey = 'travel-life-account-v1.blocked';
  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work).catch(() => { throw new AccountStorageError(); });
    queue = result.catch(() => {});
    return result;
  }
  const isBlocked = async () => blocked || await native.getItem(fenceKey) !== null;
  async function remove(key: string) {
    const raw = await native.getItem(key);
    // Remove authority before its now-unreachable chunks.
    await native.removeItem(key);
    if (raw) {
      const previous = manifest(raw);
      for (let i = 0; i < previous.count; i++) await native.removeItem(`${key}.${previous.generation}.${i}`);
    }
  }
  return {
    getItem(key: string) {
      return serialized(async () => {
        if (await isBlocked()) return null;
        const raw = await native.getItem(key);
        if (raw === null) return null;
        const header = manifest(raw);
        let value = '';
        for (let i = 0; i < header.count; i++) {
          const chunk = await native.getItem(`${key}.${header.generation}.${i}`);
          if (chunk === null) throw new AccountStorageError();
          value += chunk;
        }
        return value;
      });
    },
    setItem(key: string, value: string) {
      const requestedEpoch = epoch;
      return serialized(async () => {
        if (requestedEpoch !== epoch || await isBlocked()) return;
        const chunks: string[] = [];
        let chunk = ''; let bytes = 0;
        for (const character of value) {
          const point = character.codePointAt(0)!;
          const size = point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
          if (bytes + size > 1600) { chunks.push(chunk); chunk = ''; bytes = 0; }
          chunk += character; bytes += size;
        }
        chunks.push(chunk);
        if (chunks.length > 128) throw new AccountStorageError();
        const previousRaw = await native.getItem(key);
        const previous = previousRaw ? manifest(previousRaw) : null;
        const generation = newGeneration();
        if (!/^[a-zA-Z0-9-]{1,80}$/.test(generation) || generation === previous?.generation) throw new AccountStorageError();
        for (let i = 0; i < chunks.length; i++) await native.setItem(`${key}.${generation}.${i}`, chunks[i]);
        if (requestedEpoch !== epoch || blocked) return;
        await native.setItem(key, JSON.stringify({ version: 1, generation, count: chunks.length }));
        // Authority is committed. Obsolete chunks are unreachable and cleanup
        // failure must not turn an acknowledged credential write into a failure.
        if (previous) for (let i = 0; i < previous.count; i++) {
          try { await native.removeItem(`${key}.${previous.generation}.${i}`); } catch { /* unreachable protected chunk; safe to retain */ }
        }
      });
    },
    removeItem(key: string) { return serialized(() => remove(key)); },
    block() {
      blocked = true; epoch++;
      return serialized(async () => { await native.setItem(fenceKey, '1'); });
    },
    allow() {
      return serialized(async () => {
        // A previous failed logout may have left credentials behind its fence.
        if (await isBlocked()) await remove('travel-life-account-v1');
        await native.removeItem(fenceKey); epoch++; blocked = false;
      });
    },
  };
}
