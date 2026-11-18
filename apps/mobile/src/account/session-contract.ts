import { HistoryTransferError } from './history-transfer';
import { mediaKeys, mediaObject, mediaUuid } from '../../../../supabase/functions/_shared/private-media-protocol';

export type AccountSessionPage={page:number;pages:number;sessions:readonly {sessionId:string;createdAt:string;updatedAt:string;current:boolean}[]};
export function accountSessionPage(value:unknown,page:number):AccountSessionPage{
 const invalid=()=>{throw new HistoryTransferError('HISTORY_SCHEMA');};
 if(!mediaObject(value)||!mediaKeys(value,['status','page','pages','sessions'])||value.status!=='complete'||value.page!==page||!Number.isSafeInteger(value.pages)||Number(value.pages)<1||Number(value.pages)>10000||page<0||page>=Number(value.pages)||!Array.isArray(value.sessions)||value.sessions.length>20)return invalid();
 const ids=new Set<string>();
 for(const session of value.sessions){
  if(!mediaObject(session)||!mediaKeys(session,['sessionId','createdAt','updatedAt','current'])||!mediaUuid(session.sessionId)||ids.has(session.sessionId)||typeof session.current!=='boolean')return invalid();
  for(const time of [session.createdAt,session.updatedAt])if(typeof time!=='string'||time.length>64||!/^\d{4}-\d{2}-\d{2}T/.test(time)||!Number.isFinite(Date.parse(time)))return invalid();
  ids.add(session.sessionId);
 }
 return value as unknown as AccountSessionPage;
}
