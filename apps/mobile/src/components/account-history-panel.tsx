import { useState, useSyncExternalStore } from 'react';
import { accountControlsEnabled, historyService } from '@/account/history-service';
import { recordContext } from '@/account/record-context';
import { ActionButton, Body, InsetPanel, Title, palette } from './ui';
import type { HistoryRow } from '@/account/history-contract';
import { ActivityIndicator, Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { appRoutes, openRoute } from '@/navigation/app-contract';

function ownerFactLabel(row:HistoryRow):string {
  const value=row.value;
  const label=value.owner_title??value.owner_label??value.reviewed_label;
  const type=row.kind==='manual'?'Trip':row.kind==='home'?'Home area':row.kind==='privacy'?'Privacy choice':row.kind==='replay'?'Replay selection':'Owner edit';
  return typeof label==='string'&&label.trim()?`${type}: ${label}`:type;
}
function ownerFactDetails(row:HistoryRow):string[] {
  const value=row.value;
  const details:string[]=[];
  if(typeof value.owner_context==='string'&&value.owner_context)details.push(value.owner_context);
  if(typeof value.date_start==='string')details.push(`${value.date_kind==='approximate'?'Approximate dates':'Dates'}: ${value.date_start} – ${value.date_end}`);
  if(typeof value.action==='string')details.push(`Choice: ${value.action}`);
  if(typeof value.owner_place_name==='string'&&value.owner_place_name)details.push(`Owner place: ${value.owner_place_name}${value.owner_place_context?` · ${value.owner_place_context}`:''}`);
  if(typeof value.owner_date_start==='string')details.push(`Owner dates: ${value.owner_date_start} – ${value.owner_date_end??value.owner_date_start}`);
  if(typeof value.owner_value==='string'&&value.owner_value)details.push(`Owner value: ${value.owner_value}`);
  if(row.kind==='journey-correction'&&typeof value.reviewed_snapshot_json==='string'){
    // This is owner content already validated as a semantic row, never executable.
    const snapshot=JSON.parse(value.reviewed_snapshot_json) as Record<string,unknown>;
    for(const key of ['title','label','dateStart','dateEnd','startDay','endDay','placeName']){
      if(typeof snapshot[key]==='string'&&snapshot[key])details.push(`Reviewed ${key}: ${snapshot[key]}`);
    }
  }
  if(row.kind==='replay'&&typeof value.committed_overrides_json==='string'){
    const composition=JSON.parse(value.committed_overrides_json) as Record<string,unknown>;
    details.push(`Committed order: ${composition.direction==='oldest-first'?'oldest first':composition.direction==='newest-first'?'newest first':'saved selection'}`);
    if(Array.isArray(composition.orderedMemoryRefs))details.push(`${composition.orderedMemoryRefs.length} ordered memories`);
    const soundtrack=composition.soundtrack as {kind?:string}|undefined;
    if(soundtrack)details.push(soundtrack.kind==='custom'?'Selected custom soundtrack; playback requires its acknowledged private copy.':'Happy Moments soundtrack');
  }
  if(row.kind==='privacy')details.push(value.target_kind==='manual'?'Applies to the independently entered trip.':'Applies to the retained source-linked evidence scope; archiving makes this proposal inactive.');
  if(value.state==='pending_remap')details.push('Needs review; this edit is not active.');
  return details;
}

export function AccountHistoryPanel() {
  const router=useRouter();
  const state=useSyncExternalStore(historyService.subscribe,historyService.getSnapshot,historyService.getSnapshot);
  const [consenting,setConsenting]=useState(false);const [openMessage,setOpenMessage]=useState<string|null>(null);
  const [archiveKey,setArchiveKey]=useState<string|null>(null);
  const [removeKey,setRemoveKey]=useState<string|null>(null);
  const impactKey=state.impact?JSON.stringify([state.impact.sourceId,state.impact.sourceGeneration,state.impact.sourceSnapshotRevision,state.impact.accountRevision]):null;
  const [stopping,setStopping]=useState(false);
  const [revokeKey,setRevokeKey]=useState<string|null>(null);
  const revokeTarget=state.sessions?.sessions.find(session=>session.sessionId===revokeKey&&!session.current);
  const reviewKey=state.review?JSON.stringify([state.review.sourceId,state.review.revision,state.review.archived,state.review.page]):null;
  const archiving=reviewKey!==null&&archiveKey===reviewKey;
  return <InsetPanel>
    <Title>Account history</Title>
    <Body>{state.message}</Body>
    {!state.restorePhase&&state.total>0&&<Body>{state.done} of {state.total} transfer steps acknowledged.</Body>}
    <Body>{state.sourceCount} device sources · Saved revision {state.revision}</Body>
    <ActionButton accessibilityLabel="Refresh account history status" disabled={state.busy} variant="secondary" onPress={()=>void historyService.refresh()}>Check saved history</ActionButton>
    {process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED==='true'&&<>
      <ActionButton accessibilityLabel="Sync account corrections and history" disabled={state.busy} variant="secondary" onPress={()=>void historyService.catchUp()}>Sync account history</ActionButton>
      <Body>{state.conflictCount} owner changes need review.</Body>
      <ActionButton accessibilityLabel="Review concurrent owner changes" disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewCorrections()}>Review competing changes</ActionButton>
    </>}
    {!state.historyEnabled&&!consenting&&<ActionButton accessibilityLabel="Choose history sync scope" disabled={state.busy} onPress={()=>setConsenting(true)}>Choose history sync</ActionButton>}
    {consenting&&!state.historyEnabled&&<>
      <Body>Store photo metadata including available precise locations and dates, your journeys, home areas, corrections, privacy choices and Replay selections in your private Travel Life account. The server can read these records to combine sources. Photo/video bytes and custom audio are a separate choice.</Body>
      <Body>Your local record is kept. This is private server storage with access controls, not end-to-end encryption. Account storage removal and device backups have different retention limits.</Body>
      <ActionButton accessibilityLabel="Enable private history sync" disabled={state.busy} onPress={()=>{void historyService.enable();setConsenting(false);}}>Enable history sync</ActionButton>
      <ActionButton accessibilityLabel="Keep history only on this device" disabled={state.busy} variant="secondary" onPress={()=>setConsenting(false)}>Keep local only</ActionButton>
    </>}
    {state.historyEnabled&&<ActionButton accessibilityLabel="Save this device history to account" disabled={state.busy} onPress={()=>void historyService.transfer()}>Save this device history</ActionButton>}
    {state.hasSnapshot&&<ActionButton accessibilityLabel="Restore account history separately" disabled={state.busy} onPress={()=>void historyService.restore()}>{state.restorePhase?'Restoring…':'Restore saved history'}</ActionButton>}
    {state.restorePhase&&<>
      <Body>{state.restorePhase}</Body>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={state.restorePhase} accessibilityValue={state.total>0?{min:0,max:state.total,now:state.done}:undefined}>
        {state.total>0?<>
          <View style={{height:5,backgroundColor:palette.sage,borderRadius:3,overflow:'hidden'}}>
            <View style={{height:5,backgroundColor:palette.limestone,width:`${Math.round(100*state.done/state.total)}%`}}/>
          </View>
          <Body>{state.done} of {state.total} pages downloaded · {Math.round(100*state.done/state.total)}%</Body>
        </>:<ActivityIndicator color={palette.sage}/>}
      </View>
    </>}
    {state.hasSnapshot&&<ActionButton accessibilityLabel="View restored account history" disabled={state.busy} variant="secondary" onPress={()=>{
      setOpenMessage(null);
      void recordContext.openAccount().then(
        ()=>openRoute(router,appRoutes.atlas,'replace'),
        ()=>setOpenMessage('Restore saved history on this phone first.'),
      );
    }}>View account history</ActionButton>}
    <ActionButton accessibilityLabel="Use this device local history" variant="secondary" onPress={()=>recordContext.local()}>Use this device history</ActionButton>
    {accountControlsEnabled&&<>
    {state.historyEnabled&&!stopping&&<ActionButton accessibilityLabel="Review stop account uploads" disabled={state.busy} variant="secondary" onPress={()=>setStopping(true)}>Stop account uploads</ActionButton>}
    {stopping&&state.historyEnabled&&<InsetPanel>
      <Body>Stop new history uploads and withdraw private media access. Saved history stays in your account; stored media copies await cleanup. Originals and this device history are kept. Already issued links can last five minutes and offline copies cannot be wiped immediately.</Body>
      <ActionButton accessibilityLabel="Confirm stop account uploads" disabled={state.busy} onPress={()=>{setStopping(false);void historyService.withdraw();}}>Stop uploads</ActionButton>
      <ActionButton accessibilityLabel="Cancel stop account uploads" variant="secondary" onPress={()=>setStopping(false)}>Keep current scope</ActionButton>
    </InsetPanel>}
    <ActionButton accessibilityLabel="View account sessions" disabled={state.busy} variant="secondary" onPress={()=>void historyService.sessions()}>Signed-in sessions</ActionButton>
    {state.sessions&&<InsetPanel>
      <Title>Signed-in sessions</Title>
      {state.sessions.sessions.map((session,index)=><InsetPanel key={session.sessionId}>
        <Body>{session.current?'This session':`Session ${state.sessions!.page*20+index+1}`}</Body>
        <Body>Signed in {new Date(session.createdAt).toLocaleString()} · Last refreshed {new Date(session.updatedAt).toLocaleString()}</Body>
        {!session.current&&<ActionButton accessibilityLabel={`Review revoke session ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>setRevokeKey(session.sessionId)}>Revoke session</ActionButton>}
      </InsetPanel>)}
      {revokeTarget&&<>
        <Body>Stop access and refresh for the session signed in {new Date(revokeTarget.createdAt).toLocaleString()}. Its offline history cannot be remotely wiped immediately.</Body>
        <ActionButton accessibilityLabel="Confirm revoke session" disabled={state.busy} onPress={()=>{setRevokeKey(null);void historyService.revokeSession(revokeTarget.sessionId);}}>Revoke access</ActionButton>
        <ActionButton accessibilityLabel="Cancel revoke session" variant="secondary" onPress={()=>setRevokeKey(null)}>Keep session</ActionButton>
      </>}
      {state.sessions.page>0&&<ActionButton accessibilityLabel="Previous sessions page" disabled={state.busy} variant="secondary" onPress={()=>{setRevokeKey(null);void historyService.sessions(state.sessions!.page-1);}}>Previous</ActionButton>}
      {state.sessions.page+1<state.sessions.pages&&<ActionButton accessibilityLabel="Next sessions page" disabled={state.busy} variant="secondary" onPress={()=>{setRevokeKey(null);void historyService.sessions(state.sessions!.page+1);}}>Next</ActionButton>}
      <ActionButton accessibilityLabel="Close account sessions" variant="secondary" onPress={()=>{setRevokeKey(null);historyService.closeSessions();}}>Close sessions</ActionButton>
    </InsetPanel>}
    </>}
    {openMessage&&<Body>{openMessage}</Body>}
    {state.sources.length>0&&<>
      <Title>Sources</Title>
      {state.sources.map((source,index)=><InsetPanel key={source.sourceId}>
        <Body>Device source {index+1} · {source.state}</Body>
        <Body>{source.lastUpdatedAt?`Last saved ${new Date(source.lastUpdatedAt).toLocaleDateString()}`:'No completed contribution yet.'}</Body>
        {source.coverage&&<>
          <Body>{source.coverage.acceptedMetadata} accepted metadata items · {source.coverage.observedStart??'No observed start'} – {source.coverage.observedEnd??'No observed end'}</Body>
          <Body>{source.coverage.acknowledgedMedia} private copies acknowledged · {source.coverage.pendingMedia} copies pending. Total library coverage is unknown.</Body>
        </>}
        {source.state!=='removed'&&<>
          {source.state!=='active'&&<ActionButton accessibilityLabel={`Resume source ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>void historyService.sourceControl(source.sourceId,'active')}>Resume reads</ActionButton>}
          {source.state==='active'&&<ActionButton accessibilityLabel={`Pause source ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>void historyService.sourceControl(source.sourceId,'paused')}>Pause reads</ActionButton>}
          {source.state!=='disconnected'&&<ActionButton accessibilityLabel={`Disconnect source ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>void historyService.sourceControl(source.sourceId,'disconnected')}>Disconnect</ActionButton>}
          <Body>Pause and disconnect stop new source reads. Retained account history stays available.</Body>
          {process.env.EXPO_PUBLIC_TRAVEL_LIFE_SOURCE_REMOVAL_ENABLED==='true'&&<ActionButton accessibilityLabel={`Preview removal of source ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>{setRemoveKey(null);void historyService.previewSourceRemoval(source.sourceId);}}>Review imported contributions</ActionButton>}
        </>}
        {source.state==='removed'&&<>
          <ActionButton accessibilityLabel={`Review retained facts from source ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewSource(source.sourceId)}>Review retained owner facts</ActionButton>
          <ActionButton accessibilityLabel={`View archived proposals from source ${index+1}`} disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewSource(source.sourceId,0,true)}>View archived proposals</ActionButton>
        </>}
      </InsetPanel>)}
      <ActionButton accessibilityLabel="Resume saved source action" disabled={state.busy} variant="secondary" onPress={()=>void historyService.resumeSourceAction()}>Resume pending source action</ActionButton>
    </>}
    {state.impact&&<InsetPanel>
      <Title>Remove imported contributions</Title>
      <Body>{state.impact.total} affected source records · Page {state.impact.page+1} of {state.impact.pages}</Body>
      {state.impact.records.map((row,index)=><InsetPanel key={`${row.kind}:${row.key}`}>
        {state.impactPreviews[index]?.uri&&<Image accessibilityLabel="Affected private memory" source={{uri:state.impactPreviews[index]!.uri!}} style={{width:'100%',height:160,borderRadius:12}}/>}
        <Body>{row.kind==='evidence'?`${row.value.media_type==='video'?'Video':'Photo'} · ${row.value.captured_day??'Unknown date'}`:ownerFactLabel(row)}</Body>
        {row.kind==='evidence'&&!state.impactPreviews[index]?.uri&&<Body>Preview unavailable. This source contribution is still included in removal.</Body>}
        {row.kind!=='evidence'&&ownerFactDetails(row).map((detail,detailIndex)=><Body key={detailIndex}>{detail}</Body>)}
      </InsetPanel>)}
      {state.impact.page>0&&<ActionButton accessibilityLabel="Previous affected contributions page" disabled={state.busy} variant="secondary" onPress={()=>void historyService.previewSourceRemoval(state.impact!.sourceId,state.impact!.page-1)}>Previous</ActionButton>}
      {state.impact.page+1<state.impact.pages&&<ActionButton accessibilityLabel="Next affected contributions page" disabled={state.busy} variant="secondary" onPress={()=>void historyService.previewSourceRemoval(state.impact!.sourceId,state.impact!.page+1)}>Next</ActionButton>}
      <Body>Remove evidence and private copies contributed by this source from account access. Independent owner trips and home areas remain; source-linked edits and privacy proposals may need review. Other surviving sources remain. Source originals are untouched. Existing signed links can work for five minutes; offline copied bytes cannot be remotely wiped.</Body>
      {removeKey!==impactKey?<ActionButton accessibilityLabel="Review removal confirmation" disabled={state.busy} onPress={()=>setRemoveKey(impactKey)}>Remove these imported contributions</ActionButton>:<>
        <Body>This removes all {state.impact.total} source records across every page under the retention rules above.</Body>
        <ActionButton accessibilityLabel="Confirm source contribution removal" disabled={state.busy} onPress={()=>void historyService.sourceControl(state.impact!.sourceId,'removed')}>Confirm removal</ActionButton>
      </>}
      <ActionButton accessibilityLabel="Cancel source contribution removal" variant="secondary" onPress={()=>{setRemoveKey(null);historyService.closeSourceRemoval();}}>Back</ActionButton>
    </InsetPanel>}
    {state.conflict&&<InsetPanel>
      <Title>Competing owner changes</Title><Body>Page {state.conflict.page+1} of {state.conflict.pages}</Body>
      {state.conflict.proposal?<>
        <Body>Neither timestamp nor inference chooses between these edits. Your choice creates a new version; both proposals remain in the private review record.</Body>
        {(['accepted','proposed'] as const).map(choice=><InsetPanel key={choice}>
          <Title>{choice==='accepted'?'Last accepted facts':'Competing proposal'}</Title>
          {state.conflict!.proposal![choice].rows.map((row,rowIndex)=><InsetPanel key={`${row.kind}:${row.key}`}>
            {(state.conflictPreviews?.[choice]?.[rowIndex]??[]).filter(preview=>preview.uri).map((preview,index)=><Image key={index} accessibilityLabel="Reviewed trip memory" source={{uri:preview.uri!}} style={{width:'100%',height:160,borderRadius:12}}/>)}
            {!state.conflictPreviews?.[choice]?.[rowIndex]?.some(preview=>preview.uri)&&['memory-correction','journey-correction','privacy','replay'].includes(row.kind)&&<Body>Media preview unavailable under the current account scope. Review the saved trip and owner values below.</Body>}
            <Body>{ownerFactLabel(row)}</Body>{ownerFactDetails(row).map((detail,index)=><Body key={index}>{detail}</Body>)}
          </InsetPanel>)}
          {state.conflict!.proposal![choice].deleted.map(row=><Body key={`${row.kind}:${row.key}`}>Remove {row.kind==='manual'?'the owner-entered trip':row.kind==='home'?'the home area':'the saved Replay choice'}.</Body>)}
          {!state.conflict!.proposal![choice].rows.length&&!state.conflict!.proposal![choice].deleted.length&&<Body>No owner fact at this target in that version.</Body>}
          <ActionButton accessibilityLabel={choice==='accepted'?'Keep last accepted owner facts':'Apply competing owner proposal'} disabled={state.busy} onPress={()=>void historyService.resolveCorrection(choice)}>{choice==='accepted'?'Keep accepted facts':'Use this proposal'}</ActionButton>
        </InsetPanel>)}
      </>:<Body>No competing owner changes remain.</Body>}
      {state.conflict.page>0&&<ActionButton accessibilityLabel="Previous competing change" disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewCorrections(state.conflict!.page-1)}>Previous</ActionButton>}
      {state.conflict.page+1<state.conflict.pages&&<ActionButton accessibilityLabel="Next competing change" disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewCorrections(state.conflict!.page+1)}>Next</ActionButton>}
      <ActionButton accessibilityLabel="Close competing owner changes" variant="secondary" onPress={()=>historyService.closeCorrections()}>Back</ActionButton>
    </InsetPanel>}
    {state.review&&<InsetPanel>
      <Title>{state.review.archived?'Archived owner proposals':'Retained owner facts'}</Title>
      <Body>Page {state.review.page+1} of {state.review.pages}</Body>
      {state.review.rows.map(row=><InsetPanel key={`${row.kind}:${row.key}`}>
        <Body>{ownerFactLabel(row)}</Body>
        {ownerFactDetails(row).map((detail,index)=><Body key={index}>{detail}</Body>)}
      </InsetPanel>)}
      {state.review.page>0&&<ActionButton accessibilityLabel="Previous owner facts page" disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewSource(state.review!.sourceId,state.review!.page-1,state.review!.archived)}>Previous</ActionButton>}
      {state.review.page+1<state.review.pages&&<ActionButton accessibilityLabel="Next owner facts page" disabled={state.busy} variant="secondary" onPress={()=>void historyService.reviewSource(state.review!.sourceId,state.review!.page+1,state.review!.archived)}>Next</ActionButton>}
      {!state.review.archived&&<>
        <Body>Keep independently entered trips, home areas and their privacy choices. Archive source-linked edits, inferred privacy scopes and Replay selections as inactive proposals. You can inspect the archived proposals later; they will not be reapplied automatically.</Body>
        {!archiving&&<ActionButton accessibilityLabel="Review archive source proposals" disabled={state.busy} onPress={()=>setArchiveKey(reviewKey)}>Archive source-linked proposals</ActionButton>}
        {archiving&&<>
          <Body>This applies to every page in this source review. Inferred privacy restrictions, source-linked edits and saved Replay selections will be kept in the archive and become inactive. Independent trips, home areas and their privacy choices are kept. Rebuilding can then use surviving sources.</Body>
          <ActionButton accessibilityLabel="Confirm archive source proposals" disabled={state.busy} onPress={()=>{setArchiveKey(null);void historyService.archiveSourceProposals();}}>Keep independent facts and archive proposals</ActionButton>
          <ActionButton accessibilityLabel="Cancel archive source proposals" variant="secondary" onPress={()=>setArchiveKey(null)}>Keep proposals pending</ActionButton>
        </>}
      </>}
      <ActionButton accessibilityLabel="Close owner facts review" variant="secondary" onPress={()=>{setArchiveKey(null);historyService.closeSourceReview();}}>Back</ActionButton>
    </InsetPanel>}
  </InsetPanel>;
}
