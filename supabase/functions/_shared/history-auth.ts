type VerifiedUser = { id: string; is_anonymous?: boolean; email_confirmed_at?: string };
type Lookup = (token: string) => Promise<{ data: { user: VerifiedUser | null }; error: unknown }>;
/** Only decode session identity after Auth verifies the exact bearer token. */
export async function authenticateHistoryToken(token: string, lookup: Lookup): Promise<{owner:string;session:string}|null> {
  const {data,error}=await lookup(token);
  if(error || !data.user || data.user.is_anonymous!==false || !data.user.email_confirmed_at) return null;
  try {
    const claims=JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/')));
    return claims.sub===data.user.id && claims.is_anonymous===false && typeof claims.session_id==='string'
      ? {owner:data.user.id,session:claims.session_id}:null;
  } catch { return null; }
}
