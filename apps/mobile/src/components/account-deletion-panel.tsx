import {useState,useSyncExternalStore} from 'react';
import {Platform} from 'react-native';
import {accountControlsEnabled,accountDeletionService} from '@/account/deletion-service';
import {ActionButton,Body,InsetPanel,Title} from './ui';

export function AccountDeletionPanel({signedIn}:{signedIn:boolean}){
 const state=useSyncExternalStore(accountDeletionService.subscribe,accountDeletionService.getSnapshot,accountDeletionService.getSnapshot);
 const [confirming,setConfirming]=useState(false);
 if(!accountControlsEnabled||Platform.OS==='web')return null;
 return <InsetPanel>
  <Title>Account deletion</Title>
  {state.message&&<Body>{state.message}</Body>}
  {signedIn&&!confirming&&<ActionButton accessibilityLabel="Review account deletion" variant="secondary" disabled={state.busy} onPress={()=>setConfirming(true)}>Delete account</ActionButton>}
  {signedIn&&confirming&&<>
   <Body>Block every account session, then delete stored history, selected media copies and your sign-in identity. This device history and original photos stay. Offline copies cannot be wiped immediately. Provider backups expire under their configured retention policy; no immediate backup deletion is promised.</Body>
   <ActionButton accessibilityLabel="Confirm account deletion" disabled={state.busy} onPress={()=>{setConfirming(false);void accountDeletionService.remove();}}>Delete my account and stored copies</ActionButton>
   <ActionButton accessibilityLabel="Cancel account deletion" variant="secondary" onPress={()=>setConfirming(false)}>Keep account</ActionButton>
  </>}
  <ActionButton accessibilityLabel="Check saved account deletion receipt" disabled={state.busy} variant="secondary" onPress={()=>void accountDeletionService.check()}>Check deletion status</ActionButton>
 </InsetPanel>;
}
