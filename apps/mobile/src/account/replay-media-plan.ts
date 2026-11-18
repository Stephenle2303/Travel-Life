import { planPrivateReplay } from '@/replay/selection';
import type { ReplayManifestInput } from '@/replay/types';
import { mediaUuid } from '../../../../supabase/functions/_shared/private-media-protocol';
import { AccountMediaError } from './media-cache';

/** Reuse committed Replay decisions. Working edits and unrelated album items are not consent scope. */
export function accountReplayMedia(input:ReplayManifestInput):{evidenceIds:string[];soundtrackRevision:string|null}{
 const included=input.includedGroupKeys?new Set(input.includedGroupKeys):null;
 const groups=input.groups.map(group=>({...group,eligible:group.eligible&&(!included||included.has(group.key))}));
 const plan=planPrivateReplay(groups,input.memories.map(memory=>({...memory,available:true})),undefined,input.direction??'oldest-first',input.autoGroupKeys);
 const selected=new Set(plan.memories.map(memory=>memory.key));const ids=new Set<string>();
 for(const [index,memory] of input.memories.entries()){
  if(!selected.has(memory.key))continue;
  const ref=input.previewSourceRefs?.[index];const id=ref?.startsWith('account:')?ref.slice(8):null;
  if(!mediaUuid(id))throw new AccountMediaError('MEDIA_UNAVAILABLE','MEDIA_REPLAY_SCOPE');
  ids.add(id);
 }
 return {evidenceIds:[...ids],soundtrackRevision:plan.groups.length&&input.soundtrack?.kind==='custom'?input.soundtrack.revision:null};
}
