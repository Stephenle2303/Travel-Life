import { createShareCapabilityStore } from '@/share/capability-store';

describe('share capability store', () => {
  it('generates a 256-bit opaque capability and persists it only behind the protected store boundary', async () => {
    const storage = { setItemAsync: jest.fn().mockResolvedValue(undefined), getItemAsync: jest.fn(), deleteItemAsync: jest.fn() };
    const randomBytes = jest.fn().mockResolvedValue(new Uint8Array(32).fill(7));
    const store = createShareCapabilityStore({ storage, randomBytes });

    const capability = await store.create('request-a');

    expect(capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(storage.setItemAsync).toHaveBeenCalledWith('travel-life.share-capability.request-a', capability);
  });

  it('does not recreate a lost capability from public operation state', async () => {
    const storage = { setItemAsync: jest.fn(), getItemAsync: jest.fn().mockResolvedValue(null), deleteItemAsync: jest.fn() };
    const store = createShareCapabilityStore({ storage, randomBytes: jest.fn() });

    await expect(store.read('request-a')).resolves.toBeNull();
  });
});
