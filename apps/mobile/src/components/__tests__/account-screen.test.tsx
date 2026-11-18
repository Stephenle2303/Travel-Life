import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccountScreen } from '@/components/account-screen';
import { createAccountController, type AccountAuth } from '@/account/controller';

jest.mock('@/account/service',()=>({getAccountService:jest.fn()}));
jest.mock('expo-router',()=>({useRouter:()=>({back:jest.fn()}),useFocusEffect:jest.requireActual('react').useEffect}));

it('keeps account entry optional and presents provider failures with fixed accessible copy',async()=>{
  const auth={getSession:async()=>({data:{session:null},error:null}),signInWithOtp:jest.fn(async()=>({error:{status:429,message:'PRIVATE_EMAIL PRIVATE_TOKEN'}})),stopAutoRefresh:jest.fn(),startAutoRefresh:jest.fn()} as unknown as AccountAuth;
  const controller=createAccountController(auth,{block:async()=>{},allow:async()=>{},removeItem:async()=>{}},()=>{});
  const screen=await render(<AccountScreen controller={controller}/>);
  await waitFor(()=>expect(controller.getSnapshot().busy).toBe(false));
  await fireEvent.changeText(screen.getByLabelText('Account email'),'user@example.test');
  await fireEvent.press(screen.getByLabelText('Send email code'));
  await waitFor(()=>expect(screen.getByText('Please wait before trying again.')).toBeTruthy());
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/PRIVATE_EMAIL|PRIVATE_TOKEN/);
  expect(screen.getByLabelText('Return to private record controls')).toBeTruthy();
});
