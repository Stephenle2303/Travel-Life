import { sourceImpact } from '@/account/source-impact';
import { historyStatus } from '@/account/history-transfer';
const id='80000000-0000-4000-8000-000000000001';
const record={kind:'manual',key:'manual',value:{manual_id:'manual',command_key:'command',owner_label:'Synthetic trip',owner_context:'Synthetic place',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',latitude:0,longitude:0,created_at_millis:1}};
const impact={status:'complete',sourceId:id,sourceGeneration:1,sourceSnapshotRevision:1,accountGeneration:1,accountRevision:1,aggregateId:null,page:0,pages:1,total:1,records:[record],media:[]};
it('decodes actual owner facts and exact preview revision without accepting unscoped media',()=>{
 expect(sourceImpact(impact).records[0]?.value.owner_label).toBe('Synthetic trip');
 for(const changed of [{...impact,media:[{localKey:'unknown',evidenceId:id}]},{...impact,total:2},{...impact,page:1},{...impact,extra:'PRIVATE_SENTINEL'}])expect(()=>sourceImpact(changed)).toThrow('Private history transfer did not finish.');
});
it('separates observed metadata coverage from acknowledged/pending derivative counts',()=>{
 const status={status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,sources:[{sourceId:id,generation:1,state:'paused',lastUpdatedAt:null,coverage:{acceptedMetadata:4,observedStart:'2024-01-01',observedEnd:'2024-01-02',acknowledgedMedia:2,pendingMedia:1}}]};
 expect(historyStatus(status).sources[0]?.coverage).toMatchObject({acceptedMetadata:4,acknowledgedMedia:2,pendingMedia:1});
 expect(()=>historyStatus({...status,sources:[{...status.sources[0],coverage:{...status.sources[0]!.coverage,pendingMedia:'PRIVATE_SENTINEL'}}]})).toThrow('Private history transfer did not finish.');
});
