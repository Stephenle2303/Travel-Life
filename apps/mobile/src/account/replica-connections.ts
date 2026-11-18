import { HistoryTransferError } from './history-transfer';

const handles=new Map<string,Set<{raw:object;pending:number;transaction:boolean;closed:boolean}>>();
const closedNames=new Set<string>();let selected:string|null=null;
export const accountReplicaName=(name:string)=>/^travel-life-account-[a-f0-9-]{36}\.db$/.test(name);
export function assertReplicaOpen(name:string){if(closedNames.has(name))throw new HistoryTransferError('HISTORY_FENCED');}
export function selectReplicaConnection(name:string|null){selected=name;}
export function trackReplicaConnection<T extends object>(name:string,raw:T):T{
 if(!accountReplicaName(name))return raw;
 assertReplicaOpen(name);const state={raw,pending:0,transaction:false,closed:false};const group=handles.get(name)??new Set();group.add(state);handles.set(name,group);
 return new Proxy(raw,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;
  return async(...args:unknown[])=>{
   if(state.closed||closedNames.has(name))throw new HistoryTransferError('HISTORY_FENCED');state.pending++;
   try{const result=await value.apply(target,args);
    if(key==='execAsync'&&typeof args[0]==='string'){
     if(/^\s*BEGIN\b/i.test(args[0]))state.transaction=true;
     if(/^\s*(COMMIT|ROLLBACK)\b/i.test(args[0]))state.transaction=false;
    }if(key==='closeAsync')state.closed=true;return result;
   }finally{state.pending--;}
  };
 }});
}
/** Called under the shared native writer turn, after the durable pointer check. */
export async function closeReplicaConnections(name:string):Promise<boolean>{
 if(!accountReplicaName(name)||selected===name)return false;
 const group=handles.get(name);
 if(group&&[...group].some(handle=>handle.pending||handle.transaction))return false;
 closedNames.add(name);
 try{for(const handle of group??[]){if(handle.closed)continue;const close=(handle.raw as {closeAsync?:()=>Promise<void>}).closeAsync;
   if(!close)throw new HistoryTransferError('HISTORY_STORAGE');await close.call(handle.raw);handle.closed=true;
  }handles.delete(name);return true;
 }catch(error){throw error instanceof HistoryTransferError?error:new HistoryTransferError('HISTORY_STORAGE');}
}
