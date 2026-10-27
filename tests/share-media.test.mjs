import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { scrubMp4Metadata, verifyDerivative } from '../supabase/functions/_shared/share-media.ts';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=(bytes,kind='video')=>({key:'synthetic_media',kind,mimeType:kind==='photo'?'image/jpeg':'video/mp4',width:32,height:24,durationMillis:kind==='photo'?null:400,byteLength:bytes.length,sha256:digest(bytes),caption:''});
const input=()=>readFile(new URL('./fixtures/share/synthetic-before-scrub.mp4',import.meta.url));
test('FFmpeg synthetic output must shed its metadata before structural verification',async()=>{
 const before=await input();assert.equal(await verifyDerivative(before,manifest(before)),false);
 const clean=Buffer.from(scrubMp4Metadata(before));assert.equal(await verifyDerivative(clean,manifest(clean)),true);
 assert.equal(clean.includes(Buffer.from('udta')),false);assert.equal(clean.includes(Buffer.from('meta')),false);
 const begin=before.indexOf(Buffer.from('mdat'))-4;const end=begin+before.readUInt32BE(begin);
 assert.deepEqual(clean.subarray(begin,end),before.subarray(begin,end),'encoded samples and absolute offsets stay unchanged');
 assert.deepEqual(Buffer.from(scrubMp4Metadata(clean)),clean,'scrub is idempotent');
});
test('checked media rejects external references, source timestamps, metadata and hash spoofing',async()=>{
 const clean=Buffer.from(scrubMp4Metadata(await input()));
 for(const type of ['tkhd','mdhd','mvhd']){const value=Buffer.from(clean);value[value.indexOf(Buffer.from(type))+11]=1;assert.equal(await verifyDerivative(value,manifest(value)),false,type);}
 const external=Buffer.from(clean);const url=external.indexOf(Buffer.from('url '));external.writeUInt32BE(0,url+4);assert.equal(await verifyDerivative(external,manifest(external)),false);
 assert.equal(await verifyDerivative(clean,{...manifest(clean),sha256:'0'.repeat(64)}),false);
 assert.equal(await verifyDerivative(clean.subarray(0,clean.length-1),manifest(clean.subarray(0,clean.length-1))),false);
});
test('metadata scrub refuses fast-start layouts rather than corrupting sample offsets',async()=>{
 const before=await input();const moov=before.indexOf(Buffer.from('moov'))-4;
 const invalid=Buffer.concat([before.subarray(moov),before.subarray(0,moov)]);
 assert.throws(()=>scrubMp4Metadata(invalid),/Invalid selected copy/);
});
test('synthetic sanitized JPEG is accepted without allowing appended payloads or false dimensions',async()=>{
 const jpeg=await readFile(new URL('./fixtures/share/synthetic-clean.jpg',import.meta.url));
 assert.equal(await verifyDerivative(jpeg,manifest(jpeg,'photo')),true);
 assert.equal(await verifyDerivative(jpeg,{...manifest(jpeg,'photo'),width:33}),false);
 const appended=Buffer.concat([jpeg,Buffer.from('PRIVATE_SENTINEL')]);assert.equal(await verifyDerivative(appended,manifest(appended,'photo')),false);
});
