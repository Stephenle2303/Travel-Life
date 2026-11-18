import { convergeAccountHistory } from '@/account/history-convergence';
const base={status:'active' as const,generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:null,activeAggregate:'old',sources:[]};
it('merges changed contributions and pulls the new revision only into an explicitly restored clean replica',async()=>{
 const events:string[]=[];let merged=false;
 await convergeAccountHistory({current:()=>true,enabled:true,contributionChanged:true,refresh:async()=>{events.push('refresh');return {...base,activeAggregate:merged?'new':'old'};},merge:async()=>{events.push('merge');merged=true;},replica:async()=>({snapshot_id:'old'}),dirty:async()=>false,restore:async()=>{events.push('restore');}});
 expect(events).toEqual(['refresh','merge','refresh','restore']);
});
it('keeps unsent account corrections and never implicitly restores into a local-only phone',async()=>{
 const restore=jest.fn();const options={current:()=>true,enabled:true,contributionChanged:false,refresh:async()=>({...base,activeAggregate:'new'}),merge:async()=>{},replica:async()=>({snapshot_id:'old'}),dirty:async()=>true,restore};
 await expect(convergeAccountHistory(options)).rejects.toMatchObject({reason:'HISTORY_REVIEW'});expect(restore).not.toHaveBeenCalled();
 await convergeAccountHistory({...options,replica:async()=>null});expect(restore).not.toHaveBeenCalled();
});
it('fences a held merge completion after signout before any pull',async()=>{
 let current=true;const replica=jest.fn();
 await expect(convergeAccountHistory({current:()=>current,enabled:true,contributionChanged:true,refresh:async()=>base,merge:async()=>{current=false;},replica,dirty:async()=>false,restore:async()=>{}})).rejects.toMatchObject({reason:'HISTORY_FENCED'});expect(replica).not.toHaveBeenCalled();
});
