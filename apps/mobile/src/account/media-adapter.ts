import type { PhotoAccessAdapter, OwnerPreview } from '@/photo-access/types';
import type { ReplaySoundtrack } from '@/replay/types';
import { AccountMediaError } from './media-cache';
import { mediaUuid, type PrivateMediaTarget } from '../../../../supabase/functions/_shared/private-media-protocol';
import type { HistoryStatus } from './history-transfer';

export function currentAccountMediaScope(status:HistoryStatus,snapshotId:string){
 return status.status==='active'&&status.historyConsent&&status.mediaConsent&&(status.activeAggregate??status.activeSnapshot)===snapshotId;
}

/** Replica source references are canonical account IDs, never native-library handles. */
export function createAccountMediaAdapter(options:{current:()=>boolean;authorized:()=>Promise<boolean>;resolve:(target:PrivateMediaTarget)=>Promise<{uri:string;kind:'photo'|'video'|'audio'}>}):PhotoAccessAdapter{
 const authorized=async()=>options.current()&&await options.authorized()&&options.current();
 return {
  inspect:async()=>null,request:async()=>null,accountAuthorized:authorized,
  readPage:async()=>0,readMetadataPage:async()=>[],readSelectedMetadata:async()=>[],manageLimited:async()=>{},select:async()=>({canceled:true}),
  async resolveOwnerPreviews(refs,limit,onResolved){
   const selected=refs.slice(0,Math.max(0,limit));
   const result:OwnerPreview[]=[];
   let next=0;
   let published=0;
   const load=async()=>{
    while(next<selected.length){
     if(!options.current())throw new AccountMediaError('MEDIA_ACCESS');
     const index=next++;
     const ref=selected[index];
     let preview:OwnerPreview={uri:null,availability:'unavailable',kind:'photo'};
     const id=ref?.startsWith('account:')?ref.slice(8):null;
     if(mediaUuid(id)){
      try{
       const media=await options.resolve({kind:'evidence',id});
       if(media.kind!=='audio')preview={uri:media.uri,availability:'available',kind:media.kind};
      }catch{/* Resolver records one closed terminal event; unavailable stays explicit. */}
     }
     if(!options.current())throw new AccountMediaError('MEDIA_ACCESS');
     result[index]=preview;
     while(result[published]){
      if(!options.current())throw new AccountMediaError('MEDIA_ACCESS');
      const indexToPublish=published++;
      onResolved?.(result[indexToPublish]!,indexToPublish);
     }
    }
   };
   await Promise.all(Array.from({length:Math.min(3,selected.length)},load));
   if(!options.current())throw new AccountMediaError('MEDIA_ACCESS');
   return result;
  },
  async resolveReplaySoundtrack(track:ReplaySoundtrack){
   if(!await authorized())throw new AccountMediaError('MEDIA_ACCESS');
   if(track.kind==='bundled')return track;
   const media=await options.resolve({kind:'soundtrack',revision:track.revision});
   if(!options.current()||media.kind!=='audio')throw new AccountMediaError('MEDIA_ACCESS');
   return {...track,localUri:media.uri};
  },
 };
}
