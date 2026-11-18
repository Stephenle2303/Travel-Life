import * as SecureStore from 'expo-secure-store';
import {getAccountService} from '@/account/service';
import {recordAppDiagnostic} from '@/diagnostics/app-diagnostics';
import {clearReplica,clearAccountJobs} from '@/account/history-store';
const mockTransport=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:jest.fn()}));
jest.mock('@/account/history-store',()=>({clearReplica:jest.fn(async()=>{}),clearAccountJobs:jest.fn(async()=>{})}));
jest.mock('@/account/record-context',()=>({recordContext:{local:jest.fn()}}));
jest.mock('@/account/history-transfer',()=>({...jest.requireActual('@/account/history-transfer'),createHistoryTransport:()=>mockTransport}));
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn(),deleteItemAsync:jest.fn(),WHEN_UNLOCKED_THIS_DEVICE_ONLY:'unlocked'}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '37000000-0000-4000-8000-000000000001',getRandomBytes:()=>new Uint8Array(32).fill(9)}));
jest.mock('@/diagnostics/app-diagnostics',()=>({recordAppDiagnostic:jest.fn()}));
let service:typeof import('@/account/deletion-service').accountDeletionService;
let owner:string|null;
beforeAll(()=>{
 process.env.EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_CONTROLS_ENABLED='true';process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL='https://synthetic.invalid';process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY='public';
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 service=require('@/account/deletion-service').accountDeletionService;
});
afterAll(()=>{delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_CONTROLS_ENABLED;});
beforeEach(()=>{
 jest.clearAllMocks();owner='17000000-0000-4000-8000-000000000001';
 (getAccountService as jest.Mock).mockReturnValue({getLocalOwner:()=>owner,subscribe:()=>()=>{},getVerifiedSession:async()=>({ownerId:owner,accessToken:'PRIVATE_TOKEN'}),invalidateSession:jest.fn(async()=>{owner=null;}),signOut:jest.fn(async()=>{}),getSnapshot:()=>({reason:null})});
 (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);(SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
 mockTransport.mockImplementation(async request=>request.action==='status'?{status:'active',generation:1,revision:0,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[]}:{status:'pending'});
});
it('stores a protected receipt before deletion, fences local authority and never reports pending as completed',async()=>{
 mockTransport.mockImplementation(async request=>{
  if(request.action==='status')return {status:'active',generation:1,revision:0,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[]};
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);expect(request.input.ticket).toHaveLength(64);return {status:'pending'};
 });
 await service.remove();expect(getAccountService().invalidateSession).toHaveBeenCalledTimes(1);expect(clearReplica).toHaveBeenCalled();expect(clearAccountJobs).toHaveBeenCalled();
 expect(service.getSnapshot()).toMatchObject({pending:true,busy:false});expect(service.getSnapshot().message).toContain('pending');
 expect(JSON.stringify((recordAppDiagnostic as jest.Mock).mock.calls)).not.toMatch(/PRIVATE_TOKEN|09090909/);
});
it('withholds deletion when secure persistence fails and emits exact boundary',async()=>{
 (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('PRIVATE_NATIVE'));await service.remove();
 expect(mockTransport.mock.calls.map(call=>call[0].action)).toEqual(['status']);
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({reasonCode:'ACCOUNT_STORAGE',stage:'ACCOUNT_SECURE_WRITE',durableOutcome:'blocked'}));
 expect(JSON.stringify((recordAppDiagnostic as jest.Mock).mock.calls)).not.toContain('PRIVATE_NATIVE');
});
it.each(['remove','check'] as const)('reconciles a saved pending receipt on %s before fenced status and clears only its owner context',async method=>{
 const ticket={owner,generation:1,mutationId:'37000000-0000-4000-8000-000000000001',ticket:'a'.repeat(64)};
 (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(ticket));
 mockTransport.mockRejectedValue(new Error('PRIVATE_FENCED_STATUS'));
 const previous=global.fetch;global.fetch=jest.fn(async()=>({ok:true,json:async()=>({status:'pending'})}) as Response);
 try{await service[method]();expect(mockTransport).not.toHaveBeenCalled();expect(getAccountService().invalidateSession).toHaveBeenCalledTimes(1);expect(clearReplica).toHaveBeenCalledWith(ticket.owner);expect(clearAccountJobs).toHaveBeenCalledWith(ticket.owner);expect(service.getSnapshot().pending).toBe(true);expect(JSON.stringify((recordAppDiagnostic as jest.Mock).mock.calls)).not.toMatch(/PRIVATE_FENCED_STATUS|aaaaaaaa/);}
 finally{global.fetch=previous;}
});
