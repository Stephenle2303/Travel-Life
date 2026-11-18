import { assertHistoryRow, HistoryContractError, type HistoryRow } from './history-contract';

export const HISTORY_TRANSFER_BYTES=67_108_864;
const partCharacters=16_384,maxParts=4096;
export class HistoryWireError extends Error{
 constructor(readonly code:'HISTORY_SCHEMA'|'HISTORY_QUOTA'){super('Private history wire data is unavailable.');this.name='HistoryWireError';}
}
const fail=():never=>{throw new HistoryWireError('HISTORY_SCHEMA');};
const quota=():never=>{throw new HistoryWireError('HISTORY_QUOTA');};
function utf8Bytes(value:string):number{
 if(value.length>HISTORY_TRANSFER_BYTES)quota();
 if(!/[^\x00-\x7f]/.test(value))return value.length;
 if(typeof TextEncoder!=='undefined'){
  const encoder=new TextEncoder();let bytes=0;
  for(let start=0;start<value.length;){
   let end=Math.min(value.length,start+65_536);
   const last=value.charCodeAt(end-1),next=value.charCodeAt(end);
   if(end<value.length&&last>=0xd800&&last<=0xdbff&&next>=0xdc00&&next<=0xdfff)end--;
   bytes+=encoder.encode(value.slice(start,end)).byteLength;
   if(bytes>HISTORY_TRANSFER_BYTES)quota();start=end;
  }
  return bytes;
 }
 let bytes=0;for(let index=0;index<value.length;index++){
  const code=value.charCodeAt(index);bytes+=code<0x80?1:code<0x800?2:3;
  if(code>=0xd800&&code<=0xdbff&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=0xdc00&&next<=0xdfff){bytes++;index++;}}
  if(bytes>HISTORY_TRANSFER_BYTES)quota();
 }return bytes;
}
export function historyWireBytes(value:string):number{return utf8Bytes(value);}
export function assertHistoryWireRow(value:unknown):asserts value is HistoryRow{
 if(value&&typeof value==='object'&&(value as HistoryRow).kind==='replay-fragment'){
  const row=value as HistoryRow,v=row.value;
  if(Object.keys(row).sort().join(',')!=='key,kind,value'||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='codec_version,committed_fragment,part_count,part_index,record_id,revision,updated_at_millis')fail();
  if(v.codec_version!==1||v.record_id!==1||![v.revision,v.updated_at_millis,v.part_index,v.part_count].every(item=>Number.isSafeInteger(item)&&Number(item)>=0)||Number(v.part_count)<1||Number(v.part_count)>maxParts||Number(v.part_index)>=Number(v.part_count)||row.key!==`1:${v.part_index}`||typeof v.committed_fragment!=='string'||v.committed_fragment.length<1||v.committed_fragment.length>partCharacters)fail();
  return;
 }
 try{assertHistoryRow(value);}catch(error){if(error instanceof HistoryContractError)fail();throw error;}
}
/** Transport only: immutable semantic rows remain the native digest authority. */
export function encodeHistoryRows(rows:readonly HistoryRow[]):HistoryRow[]{
 const output:HistoryRow[]=[];let total=0;
 const push=(row:HistoryRow)=>{total+=utf8Bytes(JSON.stringify(row))+1;if(total>HISTORY_TRANSFER_BYTES)quota();output.push(row);};
 for(const row of rows){
  assertHistoryRow(row);
  if(row.kind!=='replay'||JSON.stringify(row).length<=80_000){push(row);continue;}
  const value=String(row.value.committed_overrides_json);if(value.length>HISTORY_TRANSFER_BYTES)quota();utf8Bytes(value);
  const pieces:string[]=[];
  for(let start=0;start<value.length;){let end=Math.min(value.length,start+partCharacters);const code=value.charCodeAt(end-1);if(end<value.length&&code>=0xd800&&code<=0xdbff)end--;pieces.push(value.slice(start,end));if(pieces.length>maxParts)quota();start=end;}
  for(let index=0;index<pieces.length;index++)push({kind:'replay-fragment',key:`1:${index}`,value:{record_id:1,revision:row.value.revision,updated_at_millis:row.value.updated_at_millis,codec_version:1,part_index:index,part_count:pieces.length,committed_fragment:pieces[index]}});
 }return output;
}
/** Whole ordered transfer validation: never activate partial or mixed Replay. */
export function decodeHistoryRows(input:readonly unknown[]):HistoryRow[]{
 const output:HistoryRow[]=[];let total=0;let replaySeen=false;
 for(let index=0;index<input.length;index++){
  const row=input[index];assertHistoryWireRow(row);total+=utf8Bytes(JSON.stringify(row))+1;if(total>HISTORY_TRANSFER_BYTES)quota();
  if(row.kind!=='replay-fragment'){if(row.kind==='replay'){if(replaySeen)fail();replaySeen=true;}output.push(row);continue;}
  if(replaySeen||row.value.part_index!==0)fail();replaySeen=true;
  const count=Number(row.value.part_count),pieces:string[]=[];let decodedBytes=0;
  for(let part=0;part<count;part++){
   const next=part===0?row:input[++index];assertHistoryWireRow(next);
   if(next.kind!=='replay-fragment'||next.value.part_index!==part||next.value.part_count!==count||next.value.revision!==row.value.revision||next.value.updated_at_millis!==row.value.updated_at_millis)fail();
   const text=String(next.value.committed_fragment);decodedBytes+=utf8Bytes(text);if(decodedBytes>HISTORY_TRANSFER_BYTES)quota();pieces.push(text);
   if(part){total+=utf8Bytes(JSON.stringify(next))+1;if(total>HISTORY_TRANSFER_BYTES)quota();}
  }
  const complete={kind:'replay',key:'1',value:{record_id:1,revision:row.value.revision,updated_at_millis:row.value.updated_at_millis,committed_overrides_json:pieces.join('')}};
  assertHistoryRow(complete);output.push(complete);
 }return output;
}
