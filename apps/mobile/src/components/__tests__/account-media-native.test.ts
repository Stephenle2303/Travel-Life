import { createNativeAccountMedia } from '@/account/media-native';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

const mockFiles=new Map<string,Uint8Array>();
const mockDirectories=new Set<string>();
let mockReadFailure=false;let mockWriteFailure=false;let mockDeleteFailure=false;let mockNext=0;
let mockOnWrite:(()=>void)|null=null;
const owner='80000000-0000-4000-8000-000000000001';
const snapshot='80000000-0000-4000-8000-000000000002';
const mockAccount={getLocalOwner:()=>owner,getVerifiedSession:async()=>({ownerId:owner,accessToken:'synthetic-token'}),invalidateSession:jest.fn(async()=>{})};
const mockStatus=jest.fn();
const mockAuthorize=jest.fn();const mockDownload=jest.fn();
jest.mock('@/account/service',()=>({getAccountService:()=>mockAccount}));
jest.mock('@/account/history-transfer',()=>({...jest.requireActual('@/account/history-transfer'),createHistoryTransport:()=>mockStatus}));
jest.mock('@/account/media-transport',()=>({createMediaTransport:()=>({authorize:mockAuthorize,download:mockDownload})}));
jest.mock('@/diagnostics/app-diagnostics',()=>({createDiagnosticCorrelationId:()=> 'local_test',recordAppDiagnostic:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`90000000-0000-4000-8000-${String(++mockNext).padStart(12,'0')}`,CryptoDigestAlgorithm:{SHA256:'SHA256'},digest:async(_algorithm:unknown,bytes:ArrayBuffer)=>new Uint8Array(32).fill(new Uint8Array(bytes)[0]===1?170:187).buffer}));
jest.mock('expo-file-system',()=>{
 const join=(parts:(string|{uri:string})[])=>parts.map(part=>typeof part==='string'?part:part.uri).join('/');
 class Directory{
  uri:string;constructor(...parts:(string|{uri:string})[]){this.uri=join(parts);}
  get name(){return this.uri.split('/').pop();}get exists(){return mockDirectories.has(this.uri);}
  create(){mockDirectories.add(this.uri);}
  list(){return [...mockDirectories].filter(path=>path.startsWith(this.uri+'/')&&!path.slice(this.uri.length+1).includes('/')).map(path=>new Directory(path));}
  delete(){if(mockDeleteFailure)throw new Error('private-sentinel');for(const path of mockFiles.keys())if(path.startsWith(this.uri+'/'))mockFiles.delete(path);mockDirectories.delete(this.uri);}
 }
 class File{
  uri:string;constructor(...parts:(string|{uri:string})[]){this.uri=join(parts);}get exists(){return mockFiles.has(this.uri);}
  create(){mockFiles.set(this.uri,new Uint8Array());}write(bytes:Uint8Array){if(mockWriteFailure)throw new Error('private-sentinel');mockFiles.set(this.uri,Uint8Array.from(bytes));mockOnWrite?.();}
  async bytes(){if(mockReadFailure)throw new Error('private-sentinel');return mockFiles.get(this.uri);}
  delete(){if(mockDeleteFailure)throw new Error('private-sentinel');mockFiles.delete(this.uri);}
 }
 return {Directory,File,Paths:{cache:'file:///synthetic-cache'}};
});
beforeEach(()=>{
 mockFiles.clear();mockDirectories.clear();mockReadFailure=false;mockWriteFailure=false;mockDeleteFailure=false;mockOnWrite=null;
 jest.mocked(recordAppDiagnostic).mockClear();mockDownload.mockReset().mockResolvedValue(new Uint8Array([1,2]));
 mockAuthorize.mockReset().mockResolvedValue({artifactId:owner,revision:1,manifest:{contractVersion:'travel-life-private-media-v1',kind:'photo',mimeType:'image/jpeg',byteLength:2,sha256:'aa'.repeat(32),width:1,height:1,durationMillis:null},url:'https://synthetic.invalid/private'});
 mockStatus.mockReset().mockResolvedValue({status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:true,activeSnapshot:snapshot,sources:[]});
});
const previews=(media:ReturnType<typeof createNativeAccountMedia>)=>media.adapter.resolveOwnerPreviews!([`account:${owner}`],1);
it('uses verified native cache bytes, replaces corruption and deletes only its private context',async()=>{
 const media=createNativeAccountMedia(owner,snapshot,()=>true);
 expect((await previews(media))[0]?.availability).toBe('available');
 expect((await previews(media))[0]?.availability).toBe('available');expect(mockDownload).toHaveBeenCalledTimes(1);
 const uri=[...mockFiles.keys()][0]!;expect(uri).not.toContain(owner);
 mockFiles.set(uri,new Uint8Array([9,9]));expect((await previews(media))[0]?.availability).toBe('available');expect(mockDownload).toHaveBeenCalledTimes(2);
 media.dispose();expect(mockFiles.size).toBe(0);expect(await media.adapter.accountAuthorized!()).toBe(false);
});
it.each(['read','write'] as const)('classifies native %s failure at cache without serializing content',async kind=>{
 const media=createNativeAccountMedia(owner,snapshot,()=>true);
 if(kind==='read'){await previews(media);mockReadFailure=true;}else mockWriteFailure=true;
 jest.mocked(recordAppDiagnostic).mockClear();expect((await previews(media))[0]?.availability).toBe('unavailable');
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);
 expect(events.filter(event=>event.reasonCode!=='START')).toEqual([expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_CACHE',reasonCode:'MEDIA_STORAGE',durableOutcome:'unknown'})]);
 expect(JSON.stringify(events)).not.toContain('private-sentinel');media.dispose();
});
it('fences a native cache write that completes after owner context changes',async()=>{
 let current=true;const media=createNativeAccountMedia(owner,snapshot,()=>current);mockOnWrite=()=>{current=false;};
 await expect(previews(media)).rejects.toMatchObject({reason:'MEDIA_ACCESS'});expect(mockFiles.size).toBe(0);media.dispose();
});
it('keeps a failed cache deletion explicit and denies cached media authority after consent withdrawal',async()=>{
 const media=createNativeAccountMedia(owner,snapshot,()=>true);await previews(media);mockStatus.mockResolvedValue({status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:false,activeSnapshot:snapshot,sources:[]});
 expect(await media.adapter.accountAuthorized!()).toBe(false);mockDeleteFailure=true;media.dispose();
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_CACHE',reasonCode:'MEDIA_STORAGE',durableOutcome:'unknown'}));
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('private-sentinel');
});

it.each([
 {patch:{status:'deleted'},reason:'MEDIA_ACCESS'},
 {patch:{historyConsent:false},reason:'HISTORY_CONSENT'},
 {patch:{mediaConsent:false},reason:'MEDIA_CONSENT'},
 {patch:{activeSnapshot:'80000000-0000-4000-8000-000000000003'},reason:'MEDIA_SCOPE'},
])('identifies account media authorization denial as $reason without exposing status',async({patch,reason})=>{
 const media=createNativeAccountMedia(owner,snapshot,()=>true);
 mockStatus.mockResolvedValue({status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:true,activeSnapshot:snapshot,sources:[],privateContent:'private-sentinel',...patch});
 expect(await media.adapter.accountAuthorized!()).toBe(false);
 const events=jest.mocked(recordAppDiagnostic).mock.calls.map(call=>call[0]);
 expect(events).toEqual([
  expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_AUTH',reasonCode:'START'}),
  expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_AUTH',reasonCode:reason,durableOutcome:'skipped'}),
 ]);
 expect(events[0]!.correlationId).toBe(events[1]!.correlationId);
 const serialized=JSON.stringify(events);
 for(const privateValue of ['private-sentinel',owner,snapshot])expect(serialized).not.toContain(privateValue);
 expect(mockAuthorize).not.toHaveBeenCalled();expect(mockDownload).not.toHaveBeenCalled();
 media.dispose();
});

it('identifies a context lost during authorization and keeps the result fenced',async()=>{
 let current=true;const media=createNativeAccountMedia(owner,snapshot,()=>current);
 mockStatus.mockImplementation(async()=>{current=false;return {status:'active',generation:1,revision:1,historyConsent:true,mediaConsent:true,activeSnapshot:snapshot,sources:[]};});
 expect(await media.adapter.accountAuthorized!()).toBe(false);
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_AUTH',reasonCode:'HISTORY_FENCED',durableOutcome:'skipped'}));
 media.dispose();
});
