import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
const mockSession=jest.fn();const mockInvalidate=jest.fn();const mockLocal=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=> 'owner-a',getVerifiedSession:mockSession,invalidateSession:mockInvalidate})}));
jest.mock('@/account/history-store',()=>({replicaScope:async()=>null}));
jest.mock('@/account/record-context',()=>({recordContext:{local:mockLocal}}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),recordAppDiagnostic:jest.fn()}));

it('preserves an accepted account view and local identity when live verification is offline',async()=>{
 process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL='https://synthetic.example';process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY='synthetic-key';
 const fetcher=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:'71000000-0000-4000-8000-000000000001',sources:[]})));
 try{
  mockSession.mockResolvedValue({ownerId:'owner-a',accessToken:'PRIVATE_SYNTHETIC_TOKEN'});
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {historyService}=require('@/account/history-service') as typeof import('@/account/history-service');
  await historyService.refresh();expect(historyService.getSnapshot().hasSnapshot).toBe(true);
  fetcher.mockClear();mockSession.mockResolvedValue(null);
  await expect(historyService.refresh()).resolves.toBe(false);
  expect(historyService.getSnapshot().hasSnapshot).toBe(true);expect(mockInvalidate).not.toHaveBeenCalled();expect(mockLocal).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({operation:'HISTORY_TRANSFER',stage:'HISTORY_AUTH',reasonCode:'HISTORY_NETWORK',durableOutcome:'unknown'}));
  expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('PRIVATE_SYNTHETIC_TOKEN');
 }finally{fetcher.mockRestore();delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL;delete process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY;}
});
