import { fireEvent, render } from '@testing-library/react-native';
import { AccountMediaPanel } from '@/components/account-media-panel';
import { privateMediaService } from '@/account/private-media-service';
jest.mock('@/account/private-media-service',()=>({privateMediaService:{subscribe:()=>()=>{},getSnapshot:jest.fn(),refresh:jest.fn(),choose:jest.fn(),consent:jest.fn(),toggle:jest.fn(),toggleAudio:jest.fn(),upload:jest.fn(),resume:jest.fn(),abandon:jest.fn()}}));
const base={enabled:true,busy:false,mediaConsent:true,message:'Synthetic selection',page:null,previews:[],selected:[],audioAvailable:false,audioSelected:false,done:0,total:0};
beforeEach(()=>jest.clearAllMocks());
it('keeps the explicit disabled service gate and private consent scope visible',async()=>{
 jest.mocked(privateMediaService.getSnapshot).mockReturnValue({...base,enabled:false,message:'Private media sync is not enabled in this build.'});
 const screen=await render(<AccountMediaPanel/>);expect(screen.queryByLabelText('Choose this phone private memories')).toBeNull();expect(screen.getByText(/not enabled/)).toBeTruthy();
});
it('shows exact recognizable selection and separate permitted audio choice',async()=>{
 jest.mocked(privateMediaService.getSnapshot).mockReturnValue({...base,page:{accountGeneration:1,sourceId:'source',sourceGeneration:1,aggregateId:'aggregate',sourceSnapshotRevision:1,page:0,pages:1,total:1,items:[{id:'evidence',sourceRef:'native-ref',kind:'photo',day:'2024-01-01',expectedRevision:0}],soundtrack:{revision:'track',expectedRevision:0}},previews:[{uri:'file:///synthetic-preview',kind:'photo',availability:'available'}],audioAvailable:true});
 const screen=await render(<AccountMediaPanel/>);expect(screen.getByLabelText('Selected photo')).toBeTruthy();
 await fireEvent.press(screen.getByLabelText('Select photo 1 from 2024-01-01'));expect(privateMediaService.toggle).toHaveBeenCalledWith('evidence');
 await fireEvent.press(screen.getByLabelText('Select committed custom audio with permission'));expect(privateMediaService.toggleAudio).toHaveBeenCalledTimes(1);
 expect(screen.getByText(/only include the committed custom soundtrack/i)).toBeTruthy();
});
