import { createAccountStorage } from '@/account/storage';

describe('private account credential storage', () => {
  it('acknowledges manifest commit even if obsolete chunk cleanup fails',async()=>{
    const values=new Map<string,string>();let generation=0;
    const native={getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:jest.fn(async(key:string)=>{values.delete(key);})};
    const storage=createAccountStorage(native,()=>`generation-${++generation}`);
    await storage.setItem('session','old');native.removeItem.mockRejectedValueOnce(new Error('PRIVATE_CLEANUP'));
    await expect(storage.setItem('session','new')).resolves.toBeUndefined();expect(await storage.getItem('session')).toBe('new');
  });
  const setup = () => {
    const values = new Map<string, string>();
    const native = { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), removeItem: jest.fn(async (key: string) => { values.delete(key); }) };
    return { values, native, storage: createAccountStorage(native, () => 'generation-1') };
  };
  it('round trips long Unicode sessions with bounded native values', async () => {
    const { native, storage } = setup();
    const session = 'PRIVATE_TOKEN_旅行'.repeat(1000);
    await storage.setItem('session', session);
    expect(await storage.getItem('session')).toBe(session);
    expect(native.setItem.mock.calls.every(([,v]) => new TextEncoder().encode(v).length <= 1800)).toBe(true);
  });
  it('does not activate a partial generation', async () => {
    const { native, storage } = setup();
    native.setItem.mockRejectedValueOnce(new Error('PRIVATE_STORAGE_FAILURE'));
    await expect(storage.setItem('session', 'private')).rejects.toThrow('Account storage is unavailable.');
    expect(await storage.getItem('session')).toBeNull();
  });
  it('rejects corrupt manifests without leaking native messages', async () => {
    const { values, storage } = setup();
    values.set('session', '{"count":999999,"generation":"private"}');
    await expect(storage.getItem('session')).rejects.toThrow('Account storage is unavailable.');
  });
  it('fences queued and late writes after signout across restart', async () => {
    const { native, storage } = setup();
    await storage.setItem('session', 'old');
    await storage.block();
    await storage.setItem('session', 'late');
    expect(await storage.getItem('session')).toBeNull();
    const restarted = createAccountStorage(native, () => 'generation-2');
    expect(await restarted.getItem('session')).toBeNull();
    await restarted.allow();
    await restarted.setItem('session', 'new');
    expect(await restarted.getItem('session')).toBe('new');
  });
});
