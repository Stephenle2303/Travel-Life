import { accountReplayMedia } from '@/account/replay-media-plan';
import type { ReplayManifestInput } from '@/replay/types';

const first='80000000-0000-4000-8000-000000000001';
const second='80000000-0000-4000-8000-000000000002';
const input:ReplayManifestInput={snapshotToken:1,privacyRevision:0,includedGroupKeys:['trip'],autoGroupKeys:[],groups:[{key:'trip',label:'Synthetic trip',eligible:true,inferred:false,orderCertain:true}],memories:[{key:'kept',groupKey:'trip',kind:'photo',eligible:true,available:false,intent:'keep'},{key:'excluded',groupKey:'trip',kind:'photo',eligible:true,available:true,intent:'exclude'}],previewSourceRefs:[`account:${first}`,`account:${second}`]};
it('uses committed Replay choices, not a new gallery selection or working draft',()=>{
 const plan=accountReplayMedia({...input,workingDraft:{revision:1,baseRevision:0,soundtrack:{kind:'bundled',revision:'happy-moments-1.4'},memoryKeys:['excluded'],includedGroupKeys:['trip'],autoGroupKeys:[],direction:'oldest-first'}});
 expect(plan.evidenceIds).toEqual([first]);expect(plan.soundtrackRevision).toBeNull();
});
it('deduplicates canonical media and excludes trips outside committed scope',()=>{
 expect(accountReplayMedia({...input,memories:[input.memories[0],{...input.memories[0],key:'duplicate'}],previewSourceRefs:[`account:${first}`,`account:${first}`]}).evidenceIds).toEqual([first]);
 expect(accountReplayMedia({...input,includedGroupKeys:[]}).evidenceIds).toEqual([]);
});
it('rejects local references and identifies unavailable committed account media without exposing it',()=>{
 for(const refs of [['SYNTHETIC_PRIVATE_NATIVE_REF',null],[null,null]]){
  try{accountReplayMedia({...input,previewSourceRefs:refs});throw new Error('expected rejection');}
  catch(error){expect(error).toMatchObject({reason:'MEDIA_UNAVAILABLE'});expect(JSON.stringify(error)).not.toContain('SYNTHETIC_PRIVATE_NATIVE_REF');}
 }
});
