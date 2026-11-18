import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccountHistoryPanel } from '@/components/account-history-panel';
import { historyService } from '@/account/history-service';
import { recordContext } from '@/account/record-context';

const mockReplace=jest.fn();
jest.mock('expo-router',()=>({useRouter:()=>({replace:mockReplace})}));
jest.mock('@/account/history-service',()=>({accountControlsEnabled:true,historyService:{subscribe:()=>()=>{},getSnapshot:jest.fn(),refresh:jest.fn(),enable:jest.fn(),withdraw:jest.fn(),sessions:jest.fn(),revokeSession:jest.fn(),closeSessions:jest.fn(),transfer:jest.fn(),restore:jest.fn(),sourceControl:jest.fn(),previewSourceRemoval:jest.fn(),closeSourceRemoval:jest.fn(),reviewSource:jest.fn(),archiveSourceProposals:jest.fn(),closeSourceReview:jest.fn(),resumeSourceAction:jest.fn()}}));
jest.mock('@/account/record-context',()=>({recordContext:{local:jest.fn(),openAccount:jest.fn(async()=>{})}}));
const base:ReturnType<typeof historyService.getSnapshot>={busy:false,historyEnabled:true,hasSnapshot:false,message:'Saved history',done:0,total:0,revision:1,sourceCount:1,sources:[{sourceId:'source',generation:2,state:'removed',lastUpdatedAt:null}],review:null,sessions:null,impact:null,impactPreviews:[],conflict:null,conflictCount:0,conflictPreviews:{accepted:[],proposed:[]}};
beforeEach(()=>jest.clearAllMocks());
it('opens Atlas only after account history binds successfully',async()=>{
 jest.mocked(historyService.getSnapshot).mockReturnValue({...base,hasSnapshot:true});
 jest.mocked(recordContext.openAccount).mockRejectedValueOnce(new Error('synthetic failure'));
 const screen=await render(<AccountHistoryPanel/>);
 const button=screen.getByLabelText('View restored account history');
 fireEvent.press(button);
 await waitFor(()=>expect(screen.getByText('Restore saved history on this phone first.')).toBeTruthy());
 expect(mockReplace).not.toHaveBeenCalled();
 fireEvent.press(button);
 await waitFor(()=>expect(mockReplace).toHaveBeenCalledWith('/history'));
});
it('shows downloaded pages and switches to indeterminate progress while preparing the replica',async()=>{
 const getSnapshot=jest.mocked(historyService.getSnapshot);
 getSnapshot.mockReturnValue({...base,hasSnapshot:true,busy:true,restorePhase:'Downloading saved history…',done:2,total:5});
 const screen=await render(<AccountHistoryPanel/>);
 expect(screen.getByText('2 of 5 pages downloaded · 40%')).toBeTruthy();
 expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({min:0,max:5,now:2});
 getSnapshot.mockReturnValue({...base,hasSnapshot:true,busy:true,restorePhase:'Preparing history on this phone…'});
 await screen.rerender(<AccountHistoryPanel/>);
 expect(screen.getByText('Preparing history on this phone…')).toBeTruthy();
 expect(screen.getByRole('progressbar').props.accessibilityValue).toBeUndefined();
});
it('shows actual affected facts and one all-page destructive confirmation',async()=>{
 (historyService.getSnapshot as jest.Mock).mockReturnValue({...base,impact:{sourceId:'source',sourceGeneration:2,sourceSnapshotRevision:3,accountGeneration:1,accountRevision:4,aggregateId:null,page:0,pages:2,total:25,records:[{kind:'manual',key:'manual',value:{owner_label:'Synthetic retained trip',date_start:'2024-01-01',date_end:'2024-01-02'}}],media:[]},impactPreviews:[]});
 const screen=await render(<AccountHistoryPanel/>);
 expect(screen.getByText('Trip: Synthetic retained trip')).toBeTruthy();expect(screen.getByText(/25 affected source records/)).toBeTruthy();
 expect(screen.queryByLabelText('Confirm source contribution removal')).toBeNull();
 await fireEvent.press(screen.getByLabelText('Review removal confirmation'));expect(historyService.sourceControl).not.toHaveBeenCalled();
 expect(screen.getByText(/all 25 source records across every page/)).toBeTruthy();
 await fireEvent.press(screen.getByLabelText('Confirm source contribution removal'));expect(historyService.sourceControl).toHaveBeenCalledWith('source','removed');
});
it('confirms session revocation and consent withdrawal with their distinct scopes',async()=>{
 (historyService.getSnapshot as jest.Mock).mockReturnValue({...base,sessions:{page:0,pages:1,sessions:[{sessionId:'other',createdAt:'2026-10-28T00:00:00Z',updatedAt:'2026-10-28T00:00:00Z',current:false}]}});
 const screen=await render(<AccountHistoryPanel/>);
 await fireEvent.press(screen.getByLabelText('Review revoke session 1'));expect(historyService.revokeSession).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByLabelText('Confirm revoke session'));expect(historyService.revokeSession).toHaveBeenCalledWith('other');
 await fireEvent.press(screen.getByLabelText('Review stop account uploads'));expect(historyService.withdraw).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByLabelText('Confirm stop account uploads'));expect(historyService.withdraw).toHaveBeenCalledTimes(1);
});
it('shows actual owner proposal values and requires an explicit archive confirmation',async()=>{
  (historyService.getSnapshot as jest.Mock).mockReturnValue({...base,review:{sourceId:'source',revision:2,archived:false,page:0,pages:2,rows:[{kind:'journey-correction',key:'rev',value:{action:'place',state:'pending_remap',owner_title:'Island holiday',owner_place_name:'Island',owner_place_context:'Owner place',owner_date_start:'2024-01-01',owner_date_end:'2024-01-03',reviewed_snapshot_json:'{"title":"Previous island title"}'}}]}});
  const screen=await render(<AccountHistoryPanel/>);
  expect(screen.getByText('Owner edit: Island holiday')).toBeTruthy();expect(screen.getByText('Owner place: Island · Owner place')).toBeTruthy();expect(screen.getByText('Reviewed title: Previous island title')).toBeTruthy();
  expect(screen.queryByLabelText('Confirm archive source proposals')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Review archive source proposals'));
  expect(historyService.archiveSourceProposals).not.toHaveBeenCalled();
  expect(screen.getByText(/This applies to every page/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Confirm archive source proposals'));
  expect(historyService.archiveSourceProposals).toHaveBeenCalledTimes(1);
});
it('keeps every review page reachable and archived proposals read only',async()=>{
  (historyService.getSnapshot as jest.Mock).mockReturnValue({...base,review:{sourceId:'source',revision:2,archived:true,page:1,pages:3,rows:[]}});
  const screen=await render(<AccountHistoryPanel/>);
  expect(screen.queryByLabelText('Review archive source proposals')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Previous owner facts page'));expect(historyService.reviewSource).toHaveBeenCalledWith('source',0,true);
  await fireEvent.press(screen.getByLabelText('Next owner facts page'));expect(historyService.reviewSource).toHaveBeenCalledWith('source',2,true);
});
it('exposes pause and disconnect but leaves removal gated pending affected-content preview',async()=>{
  (historyService.getSnapshot as jest.Mock).mockReturnValue({...base,sources:[{...base.sources[0],state:'active'}]});
  const screen=await render(<AccountHistoryPanel/>);
  expect(screen.queryByText('Remove imported contributions')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Pause source 1'));expect(historyService.sourceControl).toHaveBeenCalledWith('source','paused');
  await fireEvent.press(screen.getByLabelText('Disconnect source 1'));expect(historyService.sourceControl).toHaveBeenCalledWith('source','disconnected');
});
