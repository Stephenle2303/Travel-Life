# Travel Life optional AI proxy

`travel-life-ai-proxy` is disabled unless the server-only `TRAVEL_LIFE_AI_ENABLED`
secret is exactly `true`. It requires the platform JWT verifier and a valid anonymous
Supabase session; configure anonymous-auth CAPTCHA/rate protection in the Supabase
dashboard before enabling the feature. The mobile app only needs the non-secret project
URL, publishable key, and proxy URL, and should leave the proxy URL unset until those
controls are verified.

Deploy the migration and function to project `fgmcnzxhbrtvjhtafort` with the
authenticated Supabase CLI. Set server-only `OPENAI_API_KEY` and `TRAVEL_LIFE_AI_ENABLED`;
Supabase injects its own `SUPABASE_*` runtime variables. Do not add server secrets to mobile
files. The function
uses `gpt-5.4-mini-2026-03-17`, `store:false`, strict schemas, a 2,000/800 input/output
cap, ten reservations per anonymous subject/day, and a USD 5 deployment-day reservation.

The proxy does not persist request or response bodies. `store:false` prevents Responses
API application-state storage but does not mean zero provider or infrastructure retention;
the product must disclose that limitation. It returns a typed skipped state for disabled,
unauthenticated, limited, unavailable, timed-out, refused, and invalid-result paths, so
the local reconstruction remains available. M2.2 returns proposals only; M2.3 owns any
owner review or application.

## M2.5 private operational attempt ledger

`private.ai_operational_attempts` is an RLS-protected, service-role-only operational
ledger. After the quota reservation succeeds, the Edge Function opens a sanitized attempt
and settles it with only outcome, nullable bounded input/output totals, null cost while
no pricing or invoice measurement exists, elapsed milliseconds, and frozen
contract/rule/model/prompt versions. It has no subject, request, response, provider error,
header, token, evidence, or opaque-reference columns, and is not available through the
Data API. Reservations are never refunded. A null token or cost measurement means unknown,
not zero; the reservation is a spend guardrail, not a provider invoice.

The kill switch remains `TRAVEL_LIFE_AI_ENABLED=false`. Enabling requires dashboard
CAPTCHA/rate protection and a separately authorized anonymous-session smoke test; this
repository change neither creates a session nor calls a provider.
