- source_spec: `_bmad-output/implementation-artifacts/spec-m2-2-build-protected-ai-proxy.md`
  summary: Exercise the deployed JWT wrapper with a real anonymous session after CAPTCHA/rate controls are configured.
  evidence: Function status verifies JWT enforcement and the wrapper type-checks, but no CAPTCHA-aware anonymous-session smoke test has established runtime claim/context mapping.
- source_spec: `_bmad-output/implementation-artifacts/spec-m2-2-build-protected-ai-proxy.md`
  summary: Add a disposable Supabase/Postgres integration test for quota RPC permissions, ten-request enforcement, and concurrent global budget reservation.
  evidence: Remote migrations applied and the security advisor is clean, but current contract tests mock reservation outcomes rather than exercising database locking and privileges.
- source_spec: `_bmad-output/implementation-artifacts/spec-m2-4-add-small-engine-regression-suite.md`
  summary: Model and test the Decision 0007 50 km date-scoped usual-area classification boundary.
  evidence: The current reconstruction input receives only a resolved `usualAreaContext` flag; it has no owner-area center or effective-range data, so the pre-existing distance classification cannot be exercised by the engine suite.
- source_spec: `_bmad-output/implementation-artifacts/spec-m2-5-bound-processing-cost-and-recover-gracefully.md`
  summary: Add a local Supabase/Postgres migration integration check for the private AI operational ledger's RLS, grants, and service-role-only writer functions.
  evidence: Current Deno tests mock all RPCs; a configured local database runner is required to apply the migration and prove real access control.
