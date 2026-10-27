import { withSupabase } from 'npm:@supabase/server@1';
import { handleShareCleanup } from '../_shared/share-cleanup.ts';
import { shareDiagnosticSink } from '../_shared/share-diagnostics.ts';
export default { fetch: withSupabase({ auth: 'none' }, (request, context) => handleShareCleanup(request, {
  backend: context.supabaseAdmin,
  secret: Deno.env.get('SHARE_CLEANUP_SECRET'),
  sink: shareDiagnosticSink,
})) };
