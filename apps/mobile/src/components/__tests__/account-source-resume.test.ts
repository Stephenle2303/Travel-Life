import { runNativeHistorySync } from '@/account/history-sync-native';
import { runHistorySync } from '@/account/history-sync';
const source='48000000-0000-4000-8000-000000000001';
const mockConfig={ownerId:'owner',accountGeneration:1,sourceId:source,sourceGeneration:1,enabled:true,lastDigest:null,attempts:0,nextAttemptAt:0,lastSuccessAt:null};
const mockReconcile=jest.fn(async()=>({...mockConfig,sourceGeneration:3}));
jest.mock('@/account/history-store',()=>({loadHistorySyncConfig:async()=>mockConfig,installationId:async()=> 'installation',reconcileHistorySource:()=>mockReconcile()}));
jest.mock('@/account/history-sync',()=>({...jest.requireActual('@/account/history-sync'),runHistorySync:jest.fn(async()=> 'unchanged')}));
jest.mock('@/account/history-native',()=>({exportLocalHistory:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '88000000-0000-4000-8000-000000000001'}));
it('reconciles only an acknowledged resumed generation before the next source run',async()=>{
 const transport=jest.fn(async(request:{action:string})=>request.action==='register-source'?{sourceId:source,sourceGeneration:3}:{status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[{sourceId:source,generation:3,state:'active',lastUpdatedAt:null}]});
 await expect(runNativeHistorySync({owner:'owner',current:()=>true,trigger:'foreground',transport,stage:()=>{},progress:()=>{}})).resolves.toBe('unchanged');
 expect(mockReconcile).toHaveBeenCalledTimes(1);expect(runHistorySync).toHaveBeenCalledWith(expect.objectContaining({sourceGeneration:3}),expect.anything());
 jest.mocked(runHistorySync).mockClear();mockReconcile.mockClear();
 transport.mockImplementation(async request=>request.action==='register-source'?{sourceId:source,sourceGeneration:2}:{status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[{sourceId:source,generation:3,state:'active',lastUpdatedAt:null}]});
 await expect(runNativeHistorySync({owner:'owner',current:()=>true,trigger:'foreground',transport,stage:()=>{},progress:()=>{}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});
 expect(mockReconcile).not.toHaveBeenCalled();expect(runHistorySync).not.toHaveBeenCalled();
});
