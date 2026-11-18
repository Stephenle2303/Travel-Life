import { createSimpleAccountSync } from '@/account/simple-sync';
import { AccountSyncStepError } from '@/account/sync-step-error';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';

function harness(){
 let owner:string|null='synthetic-owner';const calls:string[]=[];const events:AppDiagnosticEvent[]=[];
 const deps={owner:()=>owner,correlation:()=> 'runtime-simple-1',emit:(event:AppDiagnosticEvent)=>events.push(event),wait:jest.fn(async()=>{calls.push('wait');}),consent:jest.fn(async()=>{calls.push('consent');}),history:jest.fn(async()=>{calls.push('history');}),media:jest.fn(async(_correlation:string,progress:(done:number,total:number,message:string)=>void)=>{calls.push('media');progress(1,2,'Saving Replay memories…');}),open:jest.fn(async()=>{calls.push('open');})};
 return {deps,calls,events,flow:createSimpleAccountSync(deps),owner:(value:string|null)=>{owner=value;}};
}
it('has no side effects until explicit consent and performs one ordered task before account navigation is allowed',async()=>{
 const h=harness();expect(h.calls).toEqual([]);expect(await h.flow.sync()).toBe(false);expect(h.calls).toEqual([]);
 expect(h.events).toEqual([expect.objectContaining({stage:'ACCOUNT_SYNC_CONSENT',reasonCode:'MEDIA_CONSENT',durableOutcome:'blocked'})]);h.events.length=0;
 expect(await h.flow.sync(true)).toBe(true);expect(h.calls).toEqual(['wait','consent','history','media','open']);
 for(const step of [h.deps.consent,h.deps.history,h.deps.open])expect(step).toHaveBeenCalledWith('runtime-simple-1');
 expect(h.flow.getSnapshot()).toMatchObject({phase:'ready',busy:false});expect(h.events.at(-1)).toMatchObject({stage:'ACCOUNT_SYNC_OPEN',reasonCode:'COMPLETE'});
 expect(new Set(h.events.map(event=>event.correlationId))).toEqual(new Set(['runtime-simple-1']));
});
it('retains accurate progress, prevents overlapping taps and never completes before media acknowledgement',async()=>{
 const h=harness();let release!:()=>void;
 h.deps.media.mockImplementationOnce(async(_corr,progress)=>{progress(1,3,'Saving Replay memories…');await new Promise<void>(resolve=>{release=resolve;});});
 const running=h.flow.sync(true);for(let n=0;n<8;n++)await Promise.resolve();
 expect(h.flow.getSnapshot()).toMatchObject({phase:'media',done:1,total:3,busy:true});expect(h.deps.open).not.toHaveBeenCalled();
 expect(await h.flow.sync(true)).toBe(false);expect(h.deps.media).toHaveBeenCalledTimes(1);release();expect(await running).toBe(true);
});
it('preserves exact child failure classification without duplicate failure logs or a misleading success',async()=>{
 const h=harness();h.deps.media.mockRejectedValueOnce(new AccountSyncStepError('MEDIA_NETWORK','MEDIA_ACK',true));
 expect(await h.flow.sync(true)).toBe(false);expect(h.deps.open).not.toHaveBeenCalled();
 expect(h.flow.getSnapshot()).toMatchObject({phase:'error',busy:false});expect(h.events.some(event=>event.reasonCode==='UNKNOWN'||event.reasonCode==='COMPLETE')).toBe(false);
});
it('stops at owner loss and redacts raw synthetic failures at their known phase',async()=>{
 const h=harness();h.deps.history.mockImplementationOnce(async()=>{h.owner(null);});
 expect(await h.flow.sync(true)).toBe(false);expect(h.deps.media).not.toHaveBeenCalled();expect(h.events.at(-1)).toMatchObject({reasonCode:'ACCOUNT_SESSION',stage:'ACCOUNT_SYNC_HISTORY'});
 const next=harness();next.deps.media.mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_SENTINEL'));
 await next.flow.sync(true);expect(next.events.at(-1)).toMatchObject({reasonCode:'UNKNOWN',stage:'ACCOUNT_SYNC_MEDIA'});
 expect(JSON.stringify([next.events,next.flow.getSnapshot()])).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
});
