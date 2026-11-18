import { createAccountMediaResolver } from '@/account/media-cache';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
jest.mock('@/diagnostics/app-diagnostics',()=>({createDiagnosticCorrelationId:()=> 'local-test',recordAppDiagnostic:jest.fn()}));
const manifest={contractVersion:'travel-life-private-media-v1' as const,kind:'photo' as const,mimeType:'image/jpeg' as const,byteLength:2,sha256:'a'.repeat(64),width:1,height:1,durationMillis:null};
it('replaces corrupt cached bytes and partitions entries by owner',async()=>{
 const keys:string[]=[];const remove=jest.fn(async()=>{});const download=jest.fn(async()=>new Uint8Array([1,2]));
 const resolve=createAccountMediaResolver({authorize:async()=>({artifactId:'80000000-0000-4000-8000-000000000001',revision:1,manifest,url:'https://synthetic.invalid/media'}),download,digest:async bytes=>bytes[0]===1?manifest.sha256:'b'.repeat(64),cache:{read:async()=>new Uint8Array([9,9]),remove,write:async key=>{keys.push(key);return 'file:///synthetic';}}});
 for(const owner of ['A','B'])await resolve({owner,evidenceId:'evidence',current:()=>true});
 expect(keys[0]).not.toBe(keys[1]);expect(remove).toHaveBeenCalledTimes(2);expect(download).toHaveBeenCalledTimes(2);
});
it('withholds late downloads after sign-out and emits no raw error',async()=>{
 let current=true;const write=jest.fn();const resolve=createAccountMediaResolver({authorize:async()=>({artifactId:'80000000-0000-4000-8000-000000000001',revision:1,manifest,url:'https://synthetic.invalid/media'}),download:async()=>{current=false;return new Uint8Array([1,2]);},digest:async()=>manifest.sha256,cache:{read:async()=>null,remove:async()=>{},write}});
 await expect(resolve({owner:'A',evidenceId:'evidence',current:()=>current})).rejects.toMatchObject({reason:'MEDIA_ACCESS',message:'Account media is unavailable.'});expect(write).not.toHaveBeenCalled();
});
it('classifies cache write failure once and redacts all content',async()=>{
 jest.mocked(recordAppDiagnostic).mockClear();
 const resolve=createAccountMediaResolver({authorize:async(_id,correlation)=>{expect(correlation).toBe('local-test');return {artifactId:'80000000-0000-4000-8000-000000000001',revision:1,manifest,url:'https://synthetic.invalid/private-sentinel'};},download:async()=>new Uint8Array([1,2]),digest:async()=>manifest.sha256,cache:{read:async()=>null,remove:async()=>{},write:async()=>{throw new Error('private-sentinel');}}});
 await expect(resolve({owner:'private-sentinel',evidenceId:'private-sentinel',current:()=>true})).rejects.toMatchObject({reason:'MEDIA_STORAGE'});
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);
 expect(events.filter(event=>event.reasonCode!=='START')).toEqual([{operation:'PRIVATE_MEDIA',stage:'MEDIA_CACHE',reasonCode:'MEDIA_STORAGE',retryable:true,durableOutcome:'unknown',correlationId:'local-test'}]);
 expect(JSON.stringify(events)).not.toContain('private-sentinel');
});
it('keeps a newer cache publication when a stale write is cleaned up',async()=>{
 let current=true;const remove=jest.fn(async()=>{});
 const resolve=createAccountMediaResolver({authorize:async()=>({artifactId:'80000000-0000-4000-8000-000000000001',revision:1,manifest,url:'https://synthetic.invalid/media'}),download:async()=>new Uint8Array([1,2]),digest:async()=>manifest.sha256,cache:{read:async()=>null,remove,write:async()=>{current=false;return 'file:///stale-write';}}});
 await expect(resolve({owner:'A',evidenceId:'evidence',current:()=>current})).rejects.toMatchObject({reason:'MEDIA_ACCESS'});
 expect(remove).toHaveBeenCalledWith(expect.any(String),'file:///stale-write');
});
