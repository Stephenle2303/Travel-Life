import { shareDiagnosticSink } from './share-diagnostics.ts';
import { safeHistoryCorrelation } from './history-diagnostics.ts';
const stages=new Set(['MEDIA_CONFIG','MEDIA_AUTH','MEDIA_SCHEMA','MEDIA_ELIGIBILITY','MEDIA_STAGE','MEDIA_VERIFY','MEDIA_DECODE','MEDIA_UPLOAD','MEDIA_ACK','MEDIA_ACTIVATE','MEDIA_FETCH','MEDIA_CACHE','MEDIA_CLEANUP']);
export const privateMediaReasons=new Set(['START','COMPLETE','ACCOUNT_SESSION','HISTORY_FENCED','MEDIA_UNAVAILABLE','MEDIA_SCHEMA','MEDIA_QUOTA','MEDIA_CONSENT','MEDIA_SCOPE','MEDIA_CONFLICT','MEDIA_VERIFY','MEDIA_DECODE','MEDIA_BUSY','MEDIA_STORAGE','MEDIA_NETWORK','MEDIA_CANCELLED','UNKNOWN']);
const outcomes=new Set(['unchanged','complete','blocked','skipped','failed','unknown']);
export function createPrivateMediaDiagnostic(sink:(event:Record<string,unknown>)=>void){
  return (input:Record<string,unknown>)=>{
    const reasonCode=privateMediaReasons.has(String(input.reasonCode))?input.reasonCode:'UNKNOWN';
    const event={operation:'PRIVATE_MEDIA',stage:stages.has(String(input.stage))?input.stage:'MEDIA_SCHEMA',reasonCode,retryable:reasonCode==='MEDIA_NETWORK'||reasonCode==='MEDIA_STORAGE'||reasonCode==='MEDIA_BUSY'||reasonCode==='UNKNOWN',durableOutcome:outcomes.has(String(input.durableOutcome))?input.durableOutcome:'unknown',correlationId:safeHistoryCorrelation(input.correlationId)};
    try{sink(event);}catch{/* Logging cannot change durable acknowledgement. */}
  };
}
export const privateMediaDiagnosticSink=(event:Record<string,unknown>)=>createPrivateMediaDiagnostic(shareDiagnosticSink)(event);
