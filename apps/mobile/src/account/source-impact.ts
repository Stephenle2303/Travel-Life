import { assertHistoryRow, type HistoryRow } from './history-contract';
import { HistoryTransferError } from './history-transfer';
import { mediaInteger, mediaKeys, mediaObject, mediaUuid } from '../../../../supabase/functions/_shared/private-media-protocol';
export type SourceImpact={sourceId:string;sourceGeneration:number;sourceSnapshotRevision:number;accountGeneration:number;accountRevision:number;aggregateId:string|null;page:number;pages:number;total:number;records:readonly HistoryRow[];media:readonly {localKey:string;evidenceId:string}[]};
export function sourceImpact(value:unknown):SourceImpact{
 const fail=():never=>{throw new HistoryTransferError('HISTORY_SCHEMA');};
 if(!mediaObject(value)||!mediaKeys(value,['status','sourceId','sourceGeneration','sourceSnapshotRevision','accountGeneration','accountRevision','aggregateId','page','pages','total','records','media'])||value.status!=='complete'||!mediaUuid(value.sourceId)||!mediaInteger(value.sourceGeneration,1)||!mediaInteger(value.sourceSnapshotRevision,1)||!mediaInteger(value.accountGeneration,1)||!mediaInteger(value.accountRevision,0)||value.aggregateId!==null&&!mediaUuid(value.aggregateId)||!mediaInteger(value.page,0)||!mediaInteger(value.pages,1,10000)||value.page>=value.pages||!mediaInteger(value.total,0,240000)||value.pages!==Math.max(1,Math.ceil(value.total/24))||!Array.isArray(value.records)||value.records.length!==Math.min(24,value.total-value.page*24)||!Array.isArray(value.media)||value.media.length>24)fail();
 const result=value as unknown as SourceImpact;const ids=new Set<string>();
 for(const row of result.records){assertHistoryRow(row);const key=JSON.stringify([row.kind,row.key]);if(ids.has(key))fail();ids.add(key);}
 const mediaIds=new Set<string>();for(const item of result.media){if(!mediaObject(item)||!mediaKeys(item,['localKey','evidenceId'])||typeof item.localKey!=='string'||!mediaUuid(item.evidenceId)||mediaIds.has(item.localKey)||!result.records.some(row=>row.kind==='evidence'&&row.key===item.localKey))fail();mediaIds.add(item.localKey);}
 return result;
}
export function sourceImpactScope(value:SourceImpact){return JSON.stringify([value.sourceId,value.sourceGeneration,value.sourceSnapshotRevision,value.accountGeneration,value.accountRevision,value.aggregateId]);}
