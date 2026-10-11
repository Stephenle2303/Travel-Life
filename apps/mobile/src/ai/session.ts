import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AnonymousSession = { accessToken: string; expiresAtMillis: number };
export type AnonymousSessionProvider = { getAnonymousSession(): Promise<AnonymousSession | null> };

export function createAnonymousSessionProvider(options: { url: string | undefined; publishableKey: string | undefined; client?: SupabaseClient }): AnonymousSessionProvider {
  const client = options.client ?? (options.url && options.publishableKey
    ? createClient(options.url, options.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : undefined);
  return {
    async getAnonymousSession() {
      if (!client) return null;
      const { data: existing, error: existingError } = await client.auth.getSession();
      if (existingError) return null;
      const active = existing.session;
      if (active?.user.is_anonymous && active.expires_at) return { accessToken: active.access_token, expiresAtMillis: active.expires_at * 1000 };
      const { data, error } = await client.auth.signInAnonymously();
      if (error || !data.session?.user.is_anonymous || !data.session.expires_at) return null;
      return { accessToken: data.session.access_token, expiresAtMillis: data.session.expires_at * 1000 };
    },
  };
}
