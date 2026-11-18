import * as FileSystem from 'expo-file-system/legacy';
import { nativePhotoAccess } from '@/photo-access/native-adapter';
import { prepareSelectedDerivative } from '@/share/derivative';
import { preparePrivateMedia, privatePreparedBytes } from '@/account/media-preparation';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execute, getMediaInformation } from 'munim-ffmpeg';

const mockBytes=Uint8Array.from(readFileSync(resolve(process.cwd(),'../../tests/fixtures/share/synthetic-clean.jpg')));
const mockSha=createHash('sha256').update(mockBytes).digest('hex');
jest.mock('expo-file-system/legacy',()=>({cacheDirectory:'file:///private-cache/',EncodingType:{Base64:'base64'},getInfoAsync:jest.fn(),copyAsync:jest.fn(async()=>{}),deleteAsync:jest.fn(async()=>{}),readAsStringAsync:jest.fn(),writeAsStringAsync:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '90000000-0000-4000-8000-000000000001'}));
jest.mock('@/photo-access/native-adapter',()=>({nativePhotoAccess:{inspect:jest.fn(),resolveOwnerPreviews:jest.fn()}}));
jest.mock('@/share/derivative',()=>({prepareSelectedDerivative:jest.fn()}));
jest.mock('@/diagnostics/app-diagnostics',()=>({recordAppDiagnostic:jest.fn()}));
jest.mock('munim-ffmpeg',()=>({execute:jest.fn(),getMediaInformation:jest.fn()}));
beforeEach(()=>{
 jest.clearAllMocks();jest.mocked(nativePhotoAccess.inspect).mockResolvedValue({scope:'limited',canAskAgain:false});
 jest.mocked(nativePhotoAccess.resolveOwnerPreviews!).mockResolvedValue([{uri:'file:///selected-original',kind:'photo',availability:'available'}]);
 jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({exists:true,uri:'file:///synthetic',size:mockBytes.length,isDirectory:false,modificationTime:0});
 jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(Buffer.from(mockBytes).toString('base64'));
 jest.mocked(prepareSelectedDerivative).mockResolvedValue({uri:'file:///private-cache/share-derivative.jpg',manifest:{key:'synthetic',kind:'photo',mimeType:'image/jpeg',byteLength:mockBytes.length,sha256:mockSha,width:32,height:24,durationMillis:null,caption:''}});
});
const input={kind:'photo' as const,sourceRef:'selected-source',current:()=>true,consented:async()=>true,correlationId:'local_test'};
it('prepares only the exact selected native asset and verifies a clean private derivative',async()=>{
 const result=await preparePrivateMedia(input);
 expect(result.manifest).toMatchObject({kind:'photo',sha256:mockSha,contractVersion:'travel-life-private-media-v1'});
 expect(nativePhotoAccess.resolveOwnerPreviews).toHaveBeenCalledWith(['selected-source'],1);
 expect(result.uri).toBe('file:///private-cache/private-selected-90000000-0000-4000-8000-000000000001.jpg');
 expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///private-cache/share-derivative.jpg',{idempotent:true});
});
it('sends no preparation through denied media consent or native permission',async()=>{
 await expect(preparePrivateMedia({...input,consented:async()=>false})).rejects.toMatchObject({reason:'MEDIA_CONSENT'});
 expect(nativePhotoAccess.inspect).not.toHaveBeenCalled();
 jest.mocked(nativePhotoAccess.inspect).mockResolvedValue({scope:'denied',canAskAgain:false});
 await expect(preparePrivateMedia(input)).rejects.toMatchObject({reason:'MEDIA_ACCESS'});
 expect(prepareSelectedDerivative).not.toHaveBeenCalled();
});
it('rejects late owner changes and opaque decode failures without leaking content',async()=>{
 jest.mocked(prepareSelectedDerivative).mockRejectedValue({reason:'SHARE_DECODE',message:'PRIVATE_SENTINEL'});
 await expect(preparePrivateMedia(input)).rejects.toMatchObject({reason:'MEDIA_DECODE'});
 expect(JSON.stringify(jest.mocked(recordAppDiagnostic).mock.calls)).not.toContain('PRIVATE_SENTINEL');
 let current=true;jest.mocked(nativePhotoAccess.resolveOwnerPreviews!).mockImplementation(async()=>{current=false;return [{uri:'file:///private',kind:'photo',availability:'available'}];});
 await expect(preparePrivateMedia({...input,current:()=>current})).rejects.toMatchObject({reason:'MEDIA_ACCESS'});
});
it('never reads arbitrary queued local paths as prepared upload content',async()=>{
 await expect(privatePreparedBytes('file:///private-owner-record')).rejects.toMatchObject({reason:'MEDIA_SCHEMA'});
 expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
});
it('prepares custom audio as a single metadata-free AAC stream and classifies encode failure',async()=>{
 jest.mocked(getMediaInformation).mockResolvedValue({streams:[{codec_type:'audio',codec_name:'mp3'}],format:{duration:'2'}} as Awaited<ReturnType<typeof getMediaInformation>>);
 jest.mocked(execute).mockResolvedValue({success:false} as Awaited<ReturnType<typeof execute>>);
 await expect(preparePrivateMedia({kind:'audio',localUri:'file:///permitted-track',current:()=>true,consented:async()=>true,correlationId:'local_test'})).rejects.toMatchObject({reason:'MEDIA_ENCODE',boundary:'MEDIA_ENCODE'});
 expect(execute).toHaveBeenCalledWith(expect.arrayContaining(['-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1','-map_chapters','-c:a','aac']));
 expect(recordAppDiagnostic).toHaveBeenLastCalledWith(expect.objectContaining({operation:'PRIVATE_MEDIA',stage:'MEDIA_ENCODE',reasonCode:'MEDIA_ENCODE',durableOutcome:'blocked'}));
});
