import { assertHistoryRow, historyLayouts, portableReplayJson } from '@/account/history-contract';

describe('separately consented history DTO',()=>{
  const manual={kind:'manual',key:'manual-1',value:{manual_id:'manual-1',command_key:'command',owner_label:'Synthetic place',owner_context:'Synthetic',latitude:10,longitude:20,date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-03',created_at_millis:1}};
  it('accepts complete explicit semantic rows and rejects arbitrary fields',()=>{
    expect(()=>assertHistoryRow(manual)).not.toThrow();
    expect(()=>assertHistoryRow({...manual,value:{...manual.value,sql:'DROP'}})).toThrow('compatible transfer');
    expect(()=>assertHistoryRow({...manual,value:{...manual.value,latitude:100}})).toThrow();
    expect(()=>assertHistoryRow({...manual,kind:'__proto__'})).toThrow();
  });
  it('requires every declared field, not merely a record kind',()=>{
    expect(()=>assertHistoryRow({kind:'evidence',key:'1',value:{evidence_id:'1'}})).toThrow();
    expect(Object.keys(historyLayouts)).toContain('memory-correction');
  });
  it('validates a portable Replay with one parse and rechecks changed input',()=>{
    const body=JSON.stringify({orderedMemoryRefs:[JSON.stringify(['journey','evidence'])],soundtrack:{kind:'custom',revision:'score',localUri:''}});
    const replay={kind:'replay',key:'1',value:{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:body}};
    const parse=jest.spyOn(JSON,'parse');
    try {
      assertHistoryRow(replay);
      assertHistoryRow(replay);
      expect(parse.mock.calls.filter(call=>call[0]===body)).toHaveLength(1);
      replay.value.revision=NaN;
      expect(()=>assertHistoryRow(replay)).toThrow();
      replay.value.revision=1;
      expect(()=>assertHistoryRow({...replay,value:{...replay.value,extra:'invalid'}})).toThrow();
      replay.value.committed_overrides_json=JSON.stringify({soundtrack:{kind:'custom',revision:'score',localUri:'PRIVATE_SENTINEL'}});
      expect(()=>assertHistoryRow(replay)).toThrow();
      expect(()=>assertHistoryRow(replay)).toThrow();
      replay.value.committed_overrides_json=body;
      expect(()=>assertHistoryRow(replay)).not.toThrow();
    } finally { parse.mockRestore(); }
  });
  it('matches SQL privacy target and array guards before transport',()=>{
    const privacy={kind:'privacy',key:'1',value:{policy_id:'policy',command_key:'command',action:'hide',target_kind:'inferred',reviewed_evidence_json:'[]',reviewed_family_json:'[]',reviewed_label:'Synthetic place',manual_id:null as string|null,revision:1,source_run_id:1,created_at_millis:1}};
    expect(()=>assertHistoryRow(privacy)).not.toThrow();
    for(const fields of [{reviewed_family_json:'{}'},{reviewed_evidence_json:'{}'},{manual_id:'manual'},{target_kind:'manual'},{target_kind:'manual',manual_id:'manual',action:'exclude'}])expect(()=>assertHistoryRow({...privacy,value:{...privacy.value,...fields}})).toThrow('compatible transfer');
    expect(()=>assertHistoryRow({...privacy,value:{...privacy.value,target_kind:'manual',manual_id:'manual'}})).not.toThrow();
  });
  it('retains committed choices without copying private artifact or local audio URI',()=>{
    const value=JSON.parse(portableReplayJson(JSON.stringify({keptMemoryRefs:['pair'],excludedGroupJourneyIds:['trip'],soundtrack:{kind:'custom',revision:'sound',localUri:'file:///PRIVATE'},preparedArtifact:{fileKey:'PRIVATE'}})));
    expect(value).toEqual({keptMemoryRefs:['pair'],excludedGroupJourneyIds:['trip'],soundtrack:{kind:'custom',revision:'sound',localUri:''}});
  });
  it('rejects incoming replay local handles and impossible semantic values',()=>{
    const replay=(value:unknown)=>({kind:'replay',key:'1',value:{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify(value)}});
    expect(()=>assertHistoryRow(replay({preparedArtifact:{fileKey:'PRIVATE'}}))).toThrow();
    expect(()=>assertHistoryRow(replay({soundtrack:{kind:'custom',revision:'x',localUri:'file:///private'}}))).toThrow();
    expect(()=>assertHistoryRow({...manual,value:{...manual.value,date_kind:'inferred'}})).toThrow();
    expect(()=>assertHistoryRow({...manual,value:{...manual.value,date_start:'2020-02-31'}})).toThrow();
    expect(()=>assertHistoryRow({...manual,value:{...manual.value,date_start:'2020-99-99'}})).toThrow('compatible transfer');
  });
});
