import { fireEvent,render,waitFor } from '@testing-library/react-native';
import { AccountScreen } from '@/components/account-screen';
import type { AccountController } from '@/account/controller';

const mockRouter={back:jest.fn(),replace:jest.fn()};
const mockSync=jest.fn(async(_consent:boolean)=>true);
const mockListeners=new Set<()=>void>();
let mockState={phase:'idle',busy:false,message:'',done:0,total:0};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useFocusEffect:jest.requireActual('react').useEffect}));
jest.mock('@/account/account-sync-service',()=>({accountSyncService:{subscribe:(listener:()=>void)=>{mockListeners.add(listener);return()=>mockListeners.delete(listener);},getSnapshot:()=>mockState,consumeReady:()=>{if(mockState.phase!=='ready')return false;mockState={...mockState,phase:'idle'};mockListeners.forEach(listener=>listener());return true;},sync:async(consent:boolean)=>{const complete=await mockSync(consent);if(complete){mockState={...mockState,phase:'ready'};mockListeners.forEach(listener=>listener());}return complete;}},observeAccountSyncOwner:()=>()=>{}}));
jest.mock('@/components/account-history-panel',()=>({AccountHistoryPanel:()=>{const {Text}=jest.requireActual('react-native');return <Text>Advanced history</Text>;}}));
jest.mock('@/components/account-media-panel',()=>({AccountMediaPanel:()=>{const {Text}=jest.requireActual('react-native');return <Text>Advanced media</Text>;}}));
jest.mock('@/components/account-deletion-panel',()=>({AccountDeletionPanel:()=>{const {Text}=jest.requireActual('react-native');return <Text>Account deletion</Text>;}}));
const snapshot={status:'signed-in',signedIn:true,busy:false,reason:null};
const controller={subscribe:()=>()=>{},getSnapshot:()=>snapshot,restore:async()=>{},cancelPending:()=>{}} as unknown as AccountController;
beforeEach(()=>{jest.clearAllMocks();mockState={phase:'idle',busy:false,message:'',done:0,total:0};});
it('presents one consent-bearing Sync action and hides technical controls in Details',async()=>{
 const screen=await render(<AccountScreen controller={controller}/>);
 expect(screen.getByText(/already used in Replay/)).toBeTruthy();
 expect(screen.queryByText('Advanced history')).toBeNull();expect(screen.queryByText('Advanced media')).toBeNull();
 await fireEvent.press(screen.getByLabelText('Sync history and Replay to account'));
 await waitFor(()=>expect(mockSync).toHaveBeenCalledWith(true));
 await waitFor(()=>expect(mockRouter.replace).toHaveBeenCalledWith('/history'));
 await fireEvent.press(screen.getByLabelText('Account sync details'));
 expect(screen.getByText('Advanced history')).toBeTruthy();expect(screen.getByText('Advanced media')).toBeTruthy();
});
it('shows measured progress and never offers a second enabled Sync while busy',async()=>{
 mockState={phase:'media',busy:true,message:'Saving Replay memories…',done:2,total:5};
 const screen=await render(<AccountScreen controller={controller}/>);
 expect(screen.getByText('2 of 5 memories saved')).toBeTruthy();expect(screen.getByLabelText('Sync history and Replay to account')).toBeDisabled();
 expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({min:0,max:5,now:2});
 expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('keeps syncing after leaving the screen without redirecting the user on completion',async()=>{
 let finish!:(value:boolean)=>void;mockSync.mockImplementationOnce(async()=>new Promise<boolean>(resolve=>{finish=resolve;}));
 const screen=await render(<AccountScreen controller={controller}/>);
 await fireEvent.press(screen.getByLabelText('Sync history and Replay to account'));
 await screen.unmount();finish(true);await Promise.resolve();await Promise.resolve();
 expect(mockRouter.replace).not.toHaveBeenCalled();
});
