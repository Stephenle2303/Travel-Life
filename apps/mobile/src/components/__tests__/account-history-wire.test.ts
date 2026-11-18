import { TextEncoder as NodeTextEncoder } from 'node:util';
import { decodeHistoryRows,encodeHistoryRows,historyWireBytes,HISTORY_TRANSFER_BYTES } from '@/account/history-wire';
import { createTransferJob,fetchHistorySnapshot } from '@/account/history-transfer';
import { historyLayouts,portableReplayJson,type HistoryRow } from '@/account/history-contract';
import { projectCanonicalHistory } from '@/reconstruction/canonical-projection';
import type { EvidenceRow } from '@/reconstruction/canonical-core';
it('counts large ASCII references without allocating encoded copies',()=>{
 const original=globalThis.TextEncoder;
 const encode=jest.fn(()=>{throw new Error('ENCODED_COPY');});
 try{
  Object.defineProperty(globalThis,'TextEncoder',{configurable:true,writable:true,value:class {encode=encode;}});
  expect(historyWireBytes('synthetic-reference'.repeat(100_000))).toBe(1_900_000);
  expect(encode).not.toHaveBeenCalled();
 }finally{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,writable:true,value:original});}
});
it('counts exact UTF-8 bytes with native encoding and the native-free fallback',()=>{
 const original=globalThis.TextEncoder;
 const samples=['','ASCII','Tiếng Việt','😀','\ud800','\udc00','x'.repeat(65_535)+'😀é','x'.repeat(65_535)+'\ud800z'];
 try{
  for(const encoder of [NodeTextEncoder,undefined]){
   Object.defineProperty(globalThis,'TextEncoder',{configurable:true,writable:true,value:encoder});
   for(const text of samples)expect(historyWireBytes(text)).toBe(Buffer.byteLength(text,'utf8'));
   expect(historyWireBytes('é'.repeat(HISTORY_TRANSFER_BYTES/2))).toBe(HISTORY_TRANSFER_BYTES);
   expect(()=>historyWireBytes('é'.repeat(HISTORY_TRANSFER_BYTES/2+1))).toThrow('wire data');
  }
 }finally{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,writable:true,value:original});}
});
function evidence(index:number):HistoryRow{
 const value=Object.fromEntries(Object.entries(historyLayouts.evidence.fields).map(([key,type])=>[key,type.endsWith('?')?null:type==='number'?0:'']));
 Object.assign(value,{evidence_id:`synthetic-evidence-${String(index).padStart(20,'0')}`,source_ref:`fixture-${index}`,media_type:'image',availability:'available',has_precise_offset:1,captured_at_millis:Date.parse('2024-01-01T00:00:00Z')+index*300000,captured_day:index<288?'2024-01-01':'2024-01-02',latitude:13.7,longitude:100.5,reported_accuracy_meters:10});
 return {kind:'evidence',key:String(value.evidence_id),value};
}
async function actualComposition(){
 const rows=Array.from({length:500},(_,index)=>evidence(index));
 const projection=await projectCanonicalHistory({rows:rows.map(row=>row.value as unknown as EvidenceRow),excluded:new Set(),privateFilter:{excluded:new Set()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]});
 const journey=projection.graph.journeys[0].id;expect(journey.length).toBeGreaterThan(10000);
 const refs=[2,0,1].map(index=>JSON.stringify([journey,rows[index].key]));
 const composition={keptMemoryRefs:refs,orderedMemoryRefs:refs,excludedMemoryRefs:[JSON.stringify([journey,rows[3].key])],excludedGroupJourneyIds:[],autoGroupJourneyIds:[journey],direction:'newest-first',directionPreferenceVersion:1,soundtrack:{kind:'custom',revision:'synthetic-score',localUri:'file:///PRIVATE_AUDIO'}};
 const replay={kind:'replay',key:'1',value:{record_id:1,revision:7,updated_at_millis:1,committed_overrides_json:portableReplayJson(JSON.stringify(composition))}};
 return {rows:[...rows,replay],replay,projection};
}
it('losslessly transfers actual engine long journey references through immutable pages and restore',async()=>{
 const {rows,replay}=await actualComposition();expect(String(replay.value.committed_overrides_json).length).toBeGreaterThan(100000);
 let sequence=0;const job=createTransferJob({ownerId:'owner',generation:1,sourceId:'source',sourceGeneration:1,rows,uuid:()=>String(++sequence)});
 const pages=job.requests.filter(request=>request.action==='page');expect(pages.flatMap(page=>page.input.records as HistoryRow[]).some(row=>row.kind==='replay-fragment')).toBe(true);
 expect(decodeHistoryRows(pages.flatMap(page=>page.input.records as HistoryRow[]))).toEqual(rows);
 const restored=await fetchHistorySnapshot(job.snapshotId,async request=>({snapshotId:job.snapshotId,page:request.input.page,pages:pages.length,schemaVersion:37,records:pages[Number(request.input.page)].input.records}),()=>true);
 expect(restored).toEqual(rows);expect(JSON.stringify(restored)).not.toContain('PRIVATE_AUDIO');
});
it('rejects duplicate/missing/reordered/mixed-revision/foreign fragments before restore',async()=>{
 const {replay}=await actualComposition();const parts=encodeHistoryRows([replay]);expect(parts.length).toBeGreaterThan(2);
 for(const altered of [[parts[0],parts[0],...parts.slice(2)],parts.slice(1),[parts[1],parts[0],...parts.slice(2)],[parts[0],{...parts[1],value:{...parts[1].value,revision:8}},...parts.slice(2)],[...parts,replay],[...parts,parts[0]]])expect(()=>decodeHistoryRows(altered)).toThrow();
});
it('keeps Unicode scalar boundaries and rejects hostile fragment grammar',()=>{
 const replay={kind:'replay',key:'1',value:{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify({orderedMemoryRefs:['😀'.repeat(9000)]})}};
 const parts=encodeHistoryRows([replay]);expect(decodeHistoryRows(parts)).toEqual([replay]);
 expect(()=>decodeHistoryRows([{...parts[0],value:{...parts[0].value,part_count:4097}}])).toThrow();
});
