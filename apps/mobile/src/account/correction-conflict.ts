import { assertHistoryRow } from './history-contract';
import { type OwnerChanges, ownerRowKinds } from './correction-journal';
import { HistoryTransferError } from './history-transfer';
import { mediaInteger, mediaKeys, mediaObject, mediaUuid } from '../../../../supabase/functions/_shared/private-media-protocol';
import type { HistoryRow } from './history-contract';
export type CorrectionConflictPage={page:number;pages:number;ownerRevision:number;accountGeneration:number;aggregateId:string|null;proposal:{mutationId:string;proposed:OwnerChanges;accepted:OwnerChanges}|null};
function changes(value:unknown):asserts value is OwnerChanges{
 if(!mediaObject(value)||!mediaKeys(value,['rows','deleted'])||!Array.isArray(value.rows)||!Array.isArray(value.deleted)||value.rows.length+value.deleted.length>100)throw new HistoryTransferError('HISTORY_SCHEMA');
 const seen=new Set<string>();
 for(const row of value.rows){assertHistoryRow(row);if(!ownerRowKinds.has(row.kind)||seen.has(JSON.stringify([row.kind,row.key])))throw new HistoryTransferError('HISTORY_SCHEMA');seen.add(JSON.stringify([row.kind,row.key]));}
 for(const row of value.deleted){if(!mediaObject(row)||!mediaKeys(row,['kind','key'])||!['manual','home','replay'].includes(String(row.kind))||typeof row.key!=='string'||!row.key||seen.has(JSON.stringify([row.kind,row.key])))throw new HistoryTransferError('HISTORY_SCHEMA');seen.add(JSON.stringify([row.kind,row.key]));}
}
export function correctionConflictPage(value:unknown):CorrectionConflictPage{
 if(!mediaObject(value)||!mediaKeys(value,['status','page','pages','ownerRevision','accountGeneration','aggregateId','proposal'])||value.status!=='complete'||!mediaInteger(value.page,0)||!mediaInteger(value.pages,1,10000)||value.page>=value.pages||!mediaInteger(value.ownerRevision,0)||!mediaInteger(value.accountGeneration,1)||value.aggregateId!==null&&!mediaUuid(value.aggregateId))throw new HistoryTransferError('HISTORY_SCHEMA');
 if(value.proposal!==null){if(!mediaObject(value.proposal)||!mediaKeys(value.proposal,['mutationId','proposed','accepted'])||!mediaUuid(value.proposal.mutationId))throw new HistoryTransferError('HISTORY_SCHEMA');changes(value.proposal.proposed);changes(value.proposal.accepted);}
 return value as unknown as CorrectionConflictPage;
}
export function correctionPreviewRefs(row:HistoryRow):string[]{
 const ids=new Set<string>();const add=(value:unknown)=>{if(mediaUuid(value))ids.add(value);};
 add(row.value.source_evidence_id);
 for(const field of ['reviewed_evidence_json','reviewed_support_json']){
  const value=row.value[field];if(typeof value!=='string')continue;
  try{const entries:unknown=JSON.parse(value);if(Array.isArray(entries))for(const item of entries){if(typeof item==='string')add(item.startsWith('E:')?item.slice(2):item);}}catch{/* Invalid row JSON is rejected by the contract; no guessed preview. */}
 }
 return [...ids].slice(0,4).map(id=>`account:${id}`);
}
