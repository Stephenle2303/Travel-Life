type Key={sourceId:string;kind:string;localId:string};
type WireKey=Key&{localIdCodec?:'sha256-v1'};
/** Original structural identities remain domain authority. This namespace only
 * addresses SQL's bounded mapping index and cannot collide with literal keys. */
export async function historyIdentityRequests(keys:readonly Key[]):Promise<{original:Key;wire:WireKey}[]>{
 return Promise.all(keys.map(async original=>{
  if(original.localId.length<=1024)return {original,wire:original};
  const bytes=new TextEncoder().encode(original.localId);
  if(bytes.length>67_108_864)throw Object.assign(new Error('Private identity exceeds current transfer capacity.'),{code:'HISTORY_QUOTA'});
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const localId=Array.from(digest).map(value=>value.toString(16).padStart(2,'0')).join('');
  return {original,wire:{sourceId:original.sourceId,kind:original.kind,localId,localIdCodec:'sha256-v1' as const}};
 }));
}
export const historyIdentityKey=(key:WireKey)=>JSON.stringify([key.sourceId,key.kind,key.localId,key.localIdCodec??'literal']);
