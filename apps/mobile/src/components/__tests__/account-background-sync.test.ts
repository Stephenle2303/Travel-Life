const mockCatchUp=jest.fn();const mockRestore=jest.fn(async()=>{});let mockOwner:string|null='synthetic-owner';
const mockLoad=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:()=>({restore:mockRestore,getLocalOwner:()=>mockOwner})}));
jest.mock('@/account/history-service',()=>({historyService:{catchUp:mockCatchUp}}));
jest.mock('@/account/history-store',()=>({loadHistorySyncConfig:mockLoad}));
jest.mock('@/account/history-native',()=>({exportLocalHistory:jest.fn()}));
jest.mock('@/photo-access/native-adapter',()=>({nativePhotoAccess:{}}));
jest.mock('@/import-record/repository',()=>({createNativeImportRepository:jest.fn()}));

beforeEach(()=>{jest.clearAllMocks();mockOwner='synthetic-owner';process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_SYNC_ENABLED='true';process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED='true';});
afterEach(()=>{delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_SYNC_ENABLED;delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED;});
it('does not read credentials or upload account history during local maintenance',async()=>{
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const {runBackgroundAccountSync}=require('@/account/history-sync-native') as typeof import('@/account/history-sync-native');
 await expect(runBackgroundAccountSync()).resolves.toBe(true);
 expect(mockRestore).not.toHaveBeenCalled();expect(mockCatchUp).not.toHaveBeenCalled();expect(mockLoad).not.toHaveBeenCalled();
});
it('does not schedule account work when credential restore has no unlocked owner',async()=>{
 mockOwner=null;
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const {runBackgroundAccountSync}=require('@/account/history-sync-native') as typeof import('@/account/history-sync-native');
 await expect(runBackgroundAccountSync()).resolves.toBe(true);expect(mockCatchUp).not.toHaveBeenCalled();expect(mockLoad).not.toHaveBeenCalled();
});
