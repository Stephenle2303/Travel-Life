import { useSyncExternalStore } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { privateMediaService } from '@/account/private-media-service';
import { ActionButton, Body, InsetPanel, Title, palette } from './ui';

/** Living Atlas Settings/Trust panel with the existing recognizable gallery pattern. */
export function AccountMediaPanel(){
 const state=useSyncExternalStore(privateMediaService.subscribe,privateMediaService.getSnapshot,privateMediaService.getSnapshot);
 return <InsetPanel>
  <Title>Private memories</Title><Body>{state.message}</Body>
  {state.enabled&&<>
   <ActionButton accessibilityLabel="Check private media consent" variant="secondary" disabled={state.busy} onPress={()=>void privateMediaService.refresh()}>Check private media</ActionButton>
   {!state.mediaConsent?<>
    <Body>Keep only the viewing copies you select in your private account so another phone can play them. The server can read these copies; this is not an original-library backup. Photos, videos and custom audio remain a separate choice from history and AI.</Body>
    <ActionButton accessibilityLabel="Allow selected private media storage" disabled={state.busy} onPress={()=>void privateMediaService.consent(true)}>Allow selected private copies</ActionButton>
   </>:<>
    <ActionButton accessibilityLabel="Choose this phone private memories" disabled={state.busy} onPress={()=>void privateMediaService.choose()}>Choose memories on this phone</ActionButton>
    <ActionButton accessibilityLabel="Withdraw private media consent" disabled={state.busy} variant="secondary" onPress={()=>void privateMediaService.consent(false)}>Stop private media access</ActionButton>
   </>}
   {state.page&&<>
    <Body>{state.selected.length} selected · Page {state.page.page+1} of {state.page.pages}</Body>
    <View style={styles.grid}>{state.page.items.map((item,index)=>{
     const preview=state.previews[index];const selected=state.selected.includes(item.id);const available=preview?.availability==='available'&&Boolean(preview.uri);
     return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={`Select ${item.kind==='video'?'video':'photo'} ${index+1}${item.day?` from ${item.day}`:''}`} accessibilityState={{checked:selected,disabled:state.busy||!available}} disabled={state.busy||!available} style={[styles.tile,selected&&styles.selected]} onPress={()=>privateMediaService.toggle(item.id)}>
      {available?<Image source={{uri:preview!.uri!}} style={styles.image} accessibilityLabel={item.kind==='video'?'Selected video poster':'Selected photo'}/>:<View style={styles.missing}><Text style={styles.caption}>Unavailable on this phone</Text></View>}
      <Text style={styles.caption}>{selected?'✓ Selected':item.kind==='video'?'Video':'Photo'}</Text>
     </Pressable>;
    })}</View>
    {state.page.page>0&&<ActionButton accessibilityLabel="Previous private memories page" disabled={state.busy} variant="secondary" onPress={()=>void privateMediaService.choose(state.page!.page-1)}>Previous</ActionButton>}
    {state.page.page+1<state.page.pages&&<ActionButton accessibilityLabel="Next private memories page" disabled={state.busy} variant="secondary" onPress={()=>void privateMediaService.choose(state.page!.page+1)}>Next</ActionButton>}
    {state.audioAvailable&&<>
     <Body>Only include the committed custom soundtrack if you have permission to store and use it across your devices.</Body>
     <ActionButton accessibilityLabel="Select committed custom audio with permission" accessibilityState={{selected:state.audioSelected}} variant="secondary" disabled={state.busy} onPress={()=>privateMediaService.toggleAudio()}>{state.audioSelected?'✓ Include permitted soundtrack':'Include permitted soundtrack'}</ActionButton>
    </>}
    <ActionButton accessibilityLabel="Upload selected private memories" disabled={state.busy||!state.selected.length&&!state.audioSelected} onPress={()=>void privateMediaService.upload()}>Keep selected copies privately</ActionButton>
   </>}
   {state.busy&&<Body>{state.total?`${state.done} of ${state.total} selected copies acknowledged.`:'Checking your private selection…'}</Body>}
   <ActionButton accessibilityLabel="Resume prepared private media upload" disabled={state.busy} variant="secondary" onPress={()=>void privateMediaService.resume()}>Resume a saved copy</ActionButton>
   <Body>If a prepared copy cannot continue, discard its pending upload and choose again. Already active account copies are kept.</Body>
   <ActionButton accessibilityLabel="Abandon pending private media copy" disabled={state.busy} variant="secondary" onPress={()=>void privateMediaService.abandon()}>Discard prepared upload</ActionButton>
  </>}
 </InsetPanel>;
}
const styles=StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:10},tile:{width:'46%',minHeight:120,borderWidth:2,borderColor:palette.fern,borderRadius:12,overflow:'hidden'},selected:{borderColor:palette.citrus},image:{width:'100%',aspectRatio:1},missing:{aspectRatio:1,justifyContent:'center',backgroundColor:palette.fern},caption:{color:palette.limestone,padding:8,fontSize:14}});
