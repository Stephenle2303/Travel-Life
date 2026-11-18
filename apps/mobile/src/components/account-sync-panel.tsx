import { useCallback,useEffect,useSyncExternalStore } from 'react';
import { ActivityIndicator,View } from 'react-native';
import { useFocusEffect,useRouter } from 'expo-router';
import { accountSyncService,observeAccountSyncOwner } from '@/account/account-sync-service';
import { appRoutes,openRoute } from '@/navigation/app-contract';
import { ActionButton,Body,InsetPanel,Title,palette } from './ui';

export function AccountSyncPanel(){
 const state=useSyncExternalStore(accountSyncService.subscribe,accountSyncService.getSnapshot,accountSyncService.getSnapshot);
 const router=useRouter();useEffect(observeAccountSyncOwner,[]);
 useFocusEffect(useCallback(()=>{
  const open=()=>{if(accountSyncService.consumeReady())openRoute(router,appRoutes.atlas,'replace');};
  const off=accountSyncService.subscribe(open);open();return off;
 },[router]));
 return <InsetPanel>
  <Title>Your history, together.</Title>
  {!state.busy&&<Body>Save your history and the photos, videos and permitted music already used in Replay. Viewing copies only; originals stay on your phone. Private account storage the server can read.</Body>}
  {state.message&&<Body>{state.message}</Body>}
  {state.busy&&<View accessible accessibilityRole="progressbar" accessibilityLabel="Syncing account" accessibilityValue={state.total>0?{min:0,max:state.total,now:state.done}:undefined}>
   {state.total>0?<>
    <View style={{height:5,backgroundColor:palette.sage,borderRadius:3,overflow:'hidden'}}><View style={{height:5,backgroundColor:palette.limestone,width:`${Math.min(100,Math.round(100*state.done/state.total))}%`}}/></View>
    <Body>{state.done} of {state.total} memories saved</Body>
   </>:<ActivityIndicator color={palette.sage}/>}
  </View>}
  <ActionButton accessibilityLabel="Sync history and Replay to account" disabled={state.busy} onPress={()=>{void accountSyncService.sync(true);}}>{state.busy?'Syncing…':state.phase==='error'?'Try sync again':'Sync to account'}</ActionButton>
 </InsetPanel>;
}
