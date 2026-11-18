const mockInitial='71000000-0000-4000-8000-000000000001',mockAggregate='71000000-0000-4000-8000-000000000002';
let mockMerged=false;const mockCalls:string[]=[];const mockSave=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=> 'owner'})}));
jest.mock('@/account/history-transfer',()=>({...jest.requireActual('@/account/history-transfer'),createHistoryTransport:()=>async(request:{action:string;input:Record<string,unknown>})=>{
 if(request.action==='pull'){mockCalls.push('pull');expect(request.input.aggregateId).toBe(mockAggregate);return {aggregateId:mockAggregate,page:0,pages:1,schemaVersion:37,records:[]};}
 return {status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:mockMerged?null:mockInitial,activeAggregate:mockMerged?mockAggregate:null,aggregateRevision:mockMerged?1:0,aggregatePages:mockMerged?1:null,sources:[]};
},createMergeTransport:()=>async()=>{mockCalls.push('merge');mockMerged=true;}}));
jest.mock('@/account/history-native',()=>({stageAccountReplica:async()=> 'travel-life-account-synthetic.db',exportLocalHistory:async()=>[]}));
jest.mock('@/account/history-store',()=>({loadReplica:async()=>null,loadCorrectionJob:async()=>null,retireReplicaFile:async()=>{},replicaScope:async()=>null,mergeOperation:async()=>mockAggregate,clearMergeOperation:async()=>{},saveReplica:mockSave}));
jest.mock('@/account/record-context',()=>({recordContext:{local:jest.fn(),selectionIntent:()=>null,rebind:async()=>false}}));
jest.mock('@/reconstruction/repository',()=>({createNativeReconstructionRepository:()=>({rebuild:async()=>{},loadDurableReveal:async()=>{}})}));
jest.mock('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async()=> 'digest'}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),recordAppDiagnostic:jest.fn()}));

it('merges initial source authority before explicit M7 restore and stores a canonical correction baseline',async()=>{
 process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED='true';process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED='true';
 try{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {historyService}=require('@/account/history-service') as typeof import('@/account/history-service');
  await expect(historyService.restore()).resolves.toBe(true);expect(mockCalls).toEqual(['merge','pull']);
  expect(mockSave.mock.calls[0][2]).toBe(mockAggregate);expect(mockSave.mock.calls[0][6]).toMatchObject({canonical:true});
 }finally{delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED;delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED;}
});
