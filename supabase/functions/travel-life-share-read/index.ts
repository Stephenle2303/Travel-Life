import { withSupabase } from 'npm:@supabase/server@1';
import { handleProtocol } from '../_shared/share-runtime.ts';
import { shareDiagnosticSink } from '../_shared/share-diagnostics.ts';
export default { fetch: withSupabase({ auth: 'none' }, (request, context) => handleProtocol(request, {
  backend: context.supabaseAdmin,
  recipient: true,
  allowedOrigins: (Deno.env.get('SHARE_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean),
  sink: shareDiagnosticSink,
})) };
