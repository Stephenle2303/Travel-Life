import { applyOwnerChanges, ownerChanges, historyRowsJson } from '@/account/correction-journal';
const manual=(title:string)=>({kind:'manual',key:'manual-one',value:{manual_id:'manual-one',command_key:'command',owner_label:title,owner_context:'Synthetic place',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',latitude:0,longitude:0,created_at_millis:1}});
it('preserves exact canonical owner identities and captures only changed semantic rows',()=>{
 const baseline=[manual('Before')];const changed=[manual('After')];const delta=ownerChanges(baseline,changed);
 expect(delta).toEqual({rows:changed,deleted:[]});expect(applyOwnerChanges(baseline,delta)).toEqual(changed);
 expect(ownerChanges(changed,[{...changed[0]!,value:{...changed[0]!.value}}])).toEqual({rows:[],deleted:[]});
});
it('records manual removal explicitly but refuses evidence or immutable-privacy deletion',()=>{
 expect(ownerChanges([manual('Before')],[]).deleted).toEqual([{kind:'manual',key:'manual-one'}]);
 expect(()=>applyOwnerChanges([],{rows:[],deleted:[{kind:'privacy',key:'1'}]})).toThrow();
 expect(()=>applyOwnerChanges([],{rows:[{kind:'unknown',key:'PRIVATE_SENTINEL',value:{}}],deleted:[]})).toThrow();
});
it('serializes arbitrary semantic IDs and recursive keys without locale-sensitive comparison',()=>{
 const rows=['ä','Z','a','A'].map(id=>({...manual(id),key:id,value:{...manual(id).value,manual_id:id}}));
 const expected=historyRowsJson(rows);const spy=jest.spyOn(String.prototype,'localeCompare').mockImplementation(()=>{throw new Error('Locale comparator must not define wire digest');});
 try{expect(historyRowsJson([...rows].reverse())).toBe(expected);expect(JSON.parse(expected).map((row:{key:string})=>row.key)).toEqual(['A','Z','a','ä']);}finally{spy.mockRestore();}
});
