import { mediaInteger, mediaKeys, mediaObject, mediaUuid } from '../../../../supabase/functions/_shared/private-media-protocol';
import { AccountMediaError } from './media-cache';
export type MediaSelectionItem={id:string;sourceRef:string;kind:'photo'|'video';day:string|null;expectedRevision:number};
export type MediaSelectionPage={accountGeneration:number;sourceId:string;sourceGeneration:number;aggregateId:string;sourceSnapshotRevision:number;page:number;pages:number;total:number;items:readonly MediaSelectionItem[];soundtrack:{revision:string;expectedRevision:number}|null};
export function mediaSelectionPage(value:unknown):MediaSelectionPage{
 const fail=():never=>{throw new AccountMediaError('MEDIA_SCHEMA');};
 if(!mediaObject(value)||!mediaKeys(value,['status','accountGeneration','sourceId','sourceGeneration','aggregateId','sourceSnapshotRevision','page','pages','total','items','soundtrack'])||value.status!=='complete'||!mediaInteger(value.accountGeneration,1)||!mediaUuid(value.sourceId)||!mediaInteger(value.sourceGeneration,1)||!mediaUuid(value.aggregateId)||!mediaInteger(value.sourceSnapshotRevision,1)||!mediaInteger(value.page,0)||!mediaInteger(value.pages,1,10000)||value.page>=value.pages||!mediaInteger(value.total,0,240000)||value.pages!==Math.max(1,Math.ceil(value.total/24))||!Array.isArray(value.items)||value.items.length!==Math.min(24,Math.max(0,value.total-value.page*24)))fail();
 const result=value as unknown as MediaSelectionPage;const ids=new Set<string>();
 for(const item of result.items){
  if(!mediaObject(item)||!mediaKeys(item,['id','sourceRef','kind','day','expectedRevision'])||!mediaUuid(item.id)||ids.has(item.id)||typeof item.sourceRef!=='string'||!item.sourceRef||item.sourceRef.length>1024||!['photo','video'].includes(String(item.kind))||!mediaInteger(item.expectedRevision,0)||item.day!==null&&(typeof item.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.day)))fail();
  ids.add(item.id);
 }
 if(result.soundtrack!==null&&(!mediaObject(result.soundtrack)||!mediaKeys(result.soundtrack,['revision','expectedRevision'])||typeof result.soundtrack.revision!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.soundtrack.revision)||!mediaInteger(result.soundtrack.expectedRevision,0)))fail();
 return result;
}
export function mediaSelectionScope(page:MediaSelectionPage){return JSON.stringify([page.accountGeneration,page.sourceId,page.sourceGeneration,page.aggregateId,page.sourceSnapshotRevision]);}
