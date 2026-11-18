import { assertHistoryRow, type HistoryRow } from './history-contract';
import { HistoryTransferError } from './history-transfer';

export type OwnerRowDeletion=Readonly<{kind:string;key:string}>;
export type OwnerChanges=Readonly<{rows:readonly HistoryRow[];deleted:readonly OwnerRowDeletion[]}>;
export const ownerRowKinds=new Set(['overlay','journey-correction','memory-correction','privacy','home','manual','replay']);
const key=(row:{kind:string;key:string})=>JSON.stringify([row.kind,row.key]);
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
function stable(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
 return `{${Object.entries(value).sort(([a],[b])=>compare(a,b)).map(([name,item])=>`${JSON.stringify(name)}:${stable(item)}`).join(',')}}`;
}
/** Object and row ordering from JSONB/native SQLite is not identity. */
export function historyRowsJson(rows:readonly HistoryRow[]):string{return stable([...rows].sort((a,b)=>compare(key(a),key(b))));}
export function ownerChanges(baseline:readonly HistoryRow[],current:readonly HistoryRow[]):OwnerChanges{
 const old=new Map<string,HistoryRow>();const next=new Map<string,HistoryRow>();
 for(const [rows,map] of [[baseline,old],[current,next]] as const)for(const row of rows){assertHistoryRow(row);if(map.has(key(row)))throw new HistoryTransferError('HISTORY_SCHEMA');map.set(key(row),row);}
 // An account edit cannot silently mutate imported evidence authority.
 for(const row of current.filter(row=>row.kind==='evidence'))if(!old.has(key(row))||stable(old.get(key(row)))!==stable(row))throw new HistoryTransferError('HISTORY_FENCED');
 for(const row of baseline.filter(row=>row.kind==='evidence'))if(!next.has(key(row)))throw new HistoryTransferError('HISTORY_FENCED');
 const rows=current.filter(row=>ownerRowKinds.has(row.kind)&&stable(old.get(key(row)))!==stable(row));
 const deleted=baseline.filter(row=>ownerRowKinds.has(row.kind)&&!next.has(key(row))).map(row=>({kind:row.kind,key:row.key}));
 if(deleted.some(row=>['privacy','journey-correction','memory-correction','overlay'].includes(row.kind)))throw new HistoryTransferError('HISTORY_REVIEW');
 if(rows.length+deleted.length>100)throw new HistoryTransferError('HISTORY_QUOTA');
 return {rows,deleted};
}
/** Canonical account identities stay canonical; never normalize them as a new source. */
export function applyOwnerChanges(input:readonly HistoryRow[],changes:OwnerChanges):HistoryRow[]{
 const rows=new Map(input.map(row=>[key(row),row]));
 const seen=new Set<string>();
 for(const row of changes.rows){assertHistoryRow(row);if(!ownerRowKinds.has(row.kind)||seen.has(key(row)))throw new HistoryTransferError('HISTORY_SCHEMA');seen.add(key(row));rows.set(key(row),row);}
 for(const row of changes.deleted){if(!['manual','home','replay'].includes(row.kind)||seen.has(key(row)))throw new HistoryTransferError('HISTORY_SCHEMA');seen.add(key(row));rows.delete(key(row));}
 return [...rows.values()].sort((a,b)=>compare(key(a),key(b)));
}
