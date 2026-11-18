import {fireEvent,render} from '@testing-library/react-native';
import {AccountDeletionPanel} from '@/components/account-deletion-panel';
import {accountDeletionService} from '@/account/deletion-service';
jest.mock('@/account/deletion-service',()=>{const snapshot={busy:false,message:'',pending:false};return {accountControlsEnabled:true,accountDeletionService:{getSnapshot:jest.fn(()=>snapshot),subscribe:()=>()=>{},remove:jest.fn(),check:jest.fn()}};});
it('requires one explicit account deletion confirmation and keeps receipt status reachable while signed out',async()=>{
 const screen=await render(<AccountDeletionPanel signedIn/>);
 await fireEvent.press(screen.getByLabelText('Review account deletion'));expect(accountDeletionService.remove).not.toHaveBeenCalled();
 expect(screen.getByText(/Block every account session/)).toBeTruthy();
 await fireEvent.press(screen.getByLabelText('Confirm account deletion'));expect(accountDeletionService.remove).toHaveBeenCalledTimes(1);
 await screen.rerender(<AccountDeletionPanel signedIn={false}/>);
 expect(screen.queryByLabelText('Review account deletion')).toBeNull();
 await fireEvent.press(screen.getByLabelText('Check saved account deletion receipt'));expect(accountDeletionService.check).toHaveBeenCalledTimes(1);
});
