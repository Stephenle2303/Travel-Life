import {HistoryTransferError} from './history-transfer';
import {AccountStorageError} from './storage';

export type DeletionTicket={owner:string;generation:number;mutationId:string;ticket:string};
export type DeletionStatus='pending'|'completed'|'unavailable';
type Options={current:()=>boolean;load:()=>Promise<DeletionTicket|null>;create:()=>DeletionTicket;save:(ticket:DeletionTicket)=>Promise<void>;send:(ticket:DeletionTicket)=>Promise<DeletionStatus>;status:(ticket:DeletionTicket)=>Promise<DeletionStatus>;accepted:()=>Promise<void>};
export async function runAccountDeletion(options:Options):Promise<DeletionStatus>{
 const check=()=>{if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');};
 let ticket:DeletionTicket|null;
 try{ticket=await options.load();}catch(error){if(error instanceof HistoryTransferError)throw error;throw new AccountStorageError('ACCOUNT_SECURE_READ');}check();
 if(ticket){const status=await options.status(ticket);check();if(status!=='unavailable'){await options.accepted();return status;}}
 else{ticket=options.create();try{await options.save(ticket);}catch{throw new AccountStorageError('ACCOUNT_SECURE_WRITE');}check();}
 let result:DeletionStatus;
 try{result=await options.send(ticket);}
 catch(error){
  if(error instanceof HistoryTransferError&&error.reason!=='HISTORY_NETWORK'&&error.reason!=='HISTORY_FENCED')throw error;
  result=await options.status(ticket);
  if(result==='unavailable')throw new HistoryTransferError('HISTORY_NETWORK');
 }
 check();if(result!=='pending'&&result!=='completed')throw new HistoryTransferError('HISTORY_NETWORK');
 await options.accepted();return result;
}
