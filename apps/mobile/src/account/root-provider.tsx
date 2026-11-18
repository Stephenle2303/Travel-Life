import { useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { PhotoAccessProvider } from '@/photo-access/provider';
import { getAccountService } from './service';
import { recordContext } from './record-context';
import { historyService } from './history-service';
import { privateMediaService } from './private-media-service';
import { accountSyncEnabled } from './history-sync-native';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

/** Remount all repository/display maps when ownership changes; local DB is retained. */
export function PrivateRecordProvider({children}:PropsWithChildren) {
  const binding=useSyncExternalStore(recordContext.subscribe,recordContext.getSnapshot,recordContext.getSnapshot);
  const [sourceReady,setSourceReady]=useState(!accountSyncEnabled);
  useEffect(()=>{
    if(!accountSyncEnabled)return;
    let active=true;
    void recordContext.restoreSelection().finally(()=>{if(active)setSourceReady(true);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!sourceReady)return;
    const consistent=binding.account===(binding.repositories!==null);
    recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:consistent?(binding.account?'HISTORY_PROVIDER_ACCOUNT':'HISTORY_PROVIDER_LOCAL'):'HISTORY_PROVIDER_BIND',reasonCode:consistent?'COMPLETE':'HISTORY_SCHEMA',retryable:false,durableOutcome:consistent?'complete':'blocked',correlationId:binding.correlationId});
  },[binding,sourceReady]);
  useEffect(()=>{
    const account=getAccountService();
    const unsubscribe=account.subscribe(()=>{
      recordContext.checkOwner();
      privateMediaService.checkOwner();
      if(!account.getSnapshot().signedIn)historyService.lock();
    });
    return unsubscribe;
  },[]);
  return sourceReady?<PhotoAccessProvider key={binding.revision} {...(binding.repositories??{})} bindingCorrelationId={binding.correlationId}>{children}</PhotoAccessProvider>:null;
}
