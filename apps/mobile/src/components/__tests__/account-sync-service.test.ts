import { AccountSyncStepError } from '@/account/sync-step-error';
import { accountSyncService,observeAccountSyncOwner } from '@/account/account-sync-service';
let mockOwner:string|null='synthetic-owner';
let mockHistoryState={busy:false,historyEnabled:false,hasSnapshot:false};
let mockMediaState={busy:false,mediaConsent:false,done:0,total:0,message:''};
const mockOwnerListeners=new Set<()=>void>();const mockMediaListeners=new Set<()=>void>();const mockHistoryListeners=new Set<()=>void>();
const mockRefreshHistory=jest.fn(async()=>true);const mockEnable=jest.fn(async()=>{mockHistoryState={...mockHistoryState,historyEnabled:true};return true;});
const mockCatchUp=jest.fn(async()=>{mockHistoryState={...mockHistoryState,hasSnapshot:true};return true;});
const mockConsent=jest.fn(async()=>{mockMediaState={...mockMediaState,mediaConsent:true};return true;});
const mockMedia=jest.fn(async()=>true);const mockOpen=jest.fn(async()=>{});
jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=>mockOwner,subscribe:(fn:()=>void)=>{mockOwnerListeners.add(fn);return()=>mockOwnerListeners.delete(fn);}})}));
jest.mock('@/account/history-service',()=>({historyService:{getSnapshot:()=>mockHistoryState,subscribe:(fn:()=>void)=>{mockHistoryListeners.add(fn);return()=>mockHistoryListeners.delete(fn);},refresh:(...args:unknown[])=>mockRefreshHistory(...args as []),enable:(...args:unknown[])=>mockEnable(...args as []),catchUp:(...args:unknown[])=>mockCatchUp(...args as [])}}));
jest.mock('@/account/private-media-service',()=>({privateMediaService:{getSnapshot:()=>mockMediaState,subscribe:(fn:()=>void)=>{mockMediaListeners.add(fn);return()=>mockMediaListeners.delete(fn);},refresh:async()=>true,consent:(...args:unknown[])=>mockConsent(...args as []),syncReplay:(...args:unknown[])=>mockMedia(...args as [])}}));
jest.mock('@/account/record-context',()=>({recordContext:{openAccount:(...args:unknown[])=>mockOpen(...args as [])}}));
jest.mock('@/diagnostics/app-diagnostics',()=>({...jest.requireActual('@/diagnostics/app-diagnostics'),createDiagnosticCorrelationId:()=> 'runtime-wiring-1',recordAppDiagnostic:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();mockOwner='synthetic-owner';mockHistoryState={busy:false,historyEnabled:false,hasSnapshot:false};mockMediaState={busy:false,mediaConsent:false,done:0,total:0,message:''};accountSyncService.lock();});
it('wires one explicit action through consent, history, private Replay media and account binding with the same correlation',async()=>{
 expect(await accountSyncService.sync(true)).toBe(true);
 const options={correlationId:'runtime-wiring-1',propagateErrors:true};
 expect(mockEnable).toHaveBeenCalledWith(options);expect(mockConsent).toHaveBeenCalledWith(true,options);
 expect(mockCatchUp).toHaveBeenCalledWith('foreground',options);expect(mockMedia).toHaveBeenCalledWith(options);expect(mockOpen).toHaveBeenCalledWith('runtime-wiring-1');
});
it('reuses existing consent and never opens account before media acknowledgement',async()=>{
 mockHistoryState.historyEnabled=true;mockMediaState.mediaConsent=true;
 mockMedia.mockRejectedValueOnce(new AccountSyncStepError('MEDIA_NETWORK','MEDIA_ACK',true));
 expect(await accountSyncService.sync(true)).toBe(false);expect(mockEnable).not.toHaveBeenCalled();expect(mockConsent).not.toHaveBeenCalled();expect(mockOpen).not.toHaveBeenCalled();
});
it('waits for existing history work and withdraws the waiting action on owner loss',async()=>{
 const off=observeAccountSyncOwner();mockHistoryState.busy=true;
 const running=accountSyncService.sync(true);await Promise.resolve();expect(mockRefreshHistory).not.toHaveBeenCalled();
 mockOwner=null;mockOwnerListeners.forEach(fn=>fn());expect(await running).toBe(false);
 expect(mockMedia).not.toHaveBeenCalled();expect(mockOpen).not.toHaveBeenCalled();off();
});
