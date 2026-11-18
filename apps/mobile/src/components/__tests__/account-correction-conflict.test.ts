import { correctionConflictPage, correctionPreviewRefs } from '@/account/correction-conflict';

const mutation='88000000-0000-4000-8000-000000000001';
const evidence='18000000-0000-4000-8000-000000000001';
const manual={kind:'manual',key:'trip',value:{manual_id:'trip',command_key:'command',owner_label:'Synthetic accepted trip',owner_context:'Synthetic place',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',latitude:0,longitude:0,created_at_millis:1}};
const page=()=>({status:'complete',page:0,pages:1,ownerRevision:2,accountGeneration:1,aggregateId:null,proposal:{mutationId:mutation,accepted:{rows:[manual],deleted:[]},proposed:{rows:[],deleted:[{kind:'manual',key:'trip'}]}}});

it('keeps recognizable accepted facts and a competing deletion without selecting either',()=>{
 const result=correctionConflictPage(page());
 expect(result.proposal?.accepted.rows[0].value.owner_label).toBe('Synthetic accepted trip');
 expect(result.proposal?.proposed.deleted).toEqual([{kind:'manual',key:'trip'}]);
 expect(correctionConflictPage({...page(),proposal:null}).proposal).toBeNull();
});

it('rejects repeated deletion targets and row/deletion collisions in the same proposal',()=>{
 const value=page();value.proposal.proposed.deleted.push({kind:'manual',key:'trip'});
 expect(()=>correctionConflictPage(value)).toThrow('Private history transfer');
 expect(()=>correctionConflictPage({...page(),proposal:{...page().proposal,proposed:{rows:[manual],deleted:[{kind:'manual',key:'trip'}]}}})).toThrow('Private history transfer');
});

it('rejects malformed page bounds, forbidden privacy deletion and hostile payload keys without echoing content',()=>{
 for(const value of [
  {...page(),page:1},
  {...page(),ownerRevision:-1},
  {...page(),aggregateId:'PRIVATE_TOKEN'},
  {...page(),proposal:{...page().proposal,proposed:{rows:[],deleted:[{kind:'privacy',key:'PRIVATE_LOCATION'}]}}},
  {...page(),proposal:{...page().proposal,private:'PRIVATE_CONTENT'}},
 ]){
  try{correctionConflictPage(value);throw new Error('unexpected acceptance');}
  catch(error){expect(error).toMatchObject({reason:'HISTORY_SCHEMA'});expect(JSON.stringify(error)).not.toMatch(/PRIVATE_TOKEN|PRIVATE_LOCATION|PRIVATE_CONTENT/);}
 }
});

it('resolves only bounded canonical evidence references and never guesses from malformed JSON',()=>{
 const row={kind:'privacy',key:'1',value:{source_evidence_id:evidence,reviewed_evidence_json:JSON.stringify([evidence,`E:${evidence}`,'file:///PRIVATE','F:family']),reviewed_support_json:'{bad'}};
 expect(correctionPreviewRefs(row)).toEqual([`account:${evidence}`]);
 const ids=Array.from({length:7},(_,index)=>`18000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`);
 expect(correctionPreviewRefs({kind:'privacy',key:'1',value:{reviewed_evidence_json:JSON.stringify(ids)}})).toHaveLength(4);
});
