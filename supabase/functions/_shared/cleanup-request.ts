/** pg_net sends {}. Scheduler capabilities authorize no caller-provided scope. */
export async function emptyCleanupRequest(request:Request):Promise<boolean>{
 if(!request.body)return true;
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 try{
  while(true){
   const chunk=await reader.read();if(chunk.done)break;
   length+=chunk.value.byteLength;
   if(length>64){await reader.cancel();return false;}
   chunks.push(chunk.value);
  }
  if(length===0)return true;
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0;
 }catch{return false;}finally{reader.releaseLock();}
}
