import { mediaInteger, mediaObject } from '../../../../supabase/functions/_shared/private-media-protocol';

/** SQL activation receipt and the existing active-state recovery contract. */
export function privateMediaActivationReceipt(value:unknown,artifactId:string,expectedRevision:number):boolean{
 if(!mediaObject(value)||value.artifactId!==artifactId)return false;
 if(value.status==='active')return true;
 return value.status==='complete'&&mediaInteger(value.revision,1)&&value.revision===expectedRevision+1;
}
