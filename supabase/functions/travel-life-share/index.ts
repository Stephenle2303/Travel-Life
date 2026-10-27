import { withSupabase } from 'npm:@supabase/server@1';
import { handleProtocol } from '../_shared/share-runtime.ts';
import { shareDiagnosticSink } from '../_shared/share-diagnostics.ts';
export const handleShareRequest = handleProtocol;
export default { fetch: withSupabase({ auth: 'user' }, (request, context) => handleProtocol(request, {
  backend: context.supabaseAdmin,
  owner: context.jwtClaims?.is_anonymous === true ? context.userClaims?.id : undefined,
  allowedOrigins: (Deno.env.get('SHARE_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean),
  sink: shareDiagnosticSink,
})) };
