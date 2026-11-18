import { HistoryTransferError, type HistoryStatus } from './history-transfer';
/** Schedule merge/pull without replacing an unrelated local record or dirty replica. */
export async function convergeAccountHistory(options:{current:()=>boolean;refresh:()=>Promise<HistoryStatus>;merge:()=>Promise<void>;replica:()=>Promise<{snapshot_id:string}|null>;dirty:()=>Promise<boolean>;restore:()=>Promise<void>;enabled:boolean;contributionChanged:boolean}){
 const check=()=>{if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');};
 let status=await options.refresh();check();
 if(!options.enabled||!status.historyConsent)return;
 if(options.contributionChanged||status.pendingMerge){await options.merge();check();status=await options.refresh();check();}
 const replica=await options.replica();check();
 const authority=status.activeAggregate??status.activeSnapshot;
 if(replica&&authority&&replica.snapshot_id!==authority){
  if(await options.dirty())throw new HistoryTransferError('HISTORY_REVIEW');check();
  await options.restore();check();
 }
}
