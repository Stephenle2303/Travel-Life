# Decision 0002: Build an MVP and learn through rollout

Date: 2026-10-06
Status: delivery strategy accepted by the user's explicit instruction.
Implementation defaults below are agent-selected working decisions, not claims of validation.

## Direction

The user rejected the discovery-first Epic 1 because time does not permit a market
research/interview programme before a working MVP. Build using available analysis,
reasonable assumptions and existing tools. Collect real usage evidence after rollout.
The user explicitly selected **both iOS and Android** for initial testers.

This supersedes the prior G0 market-validation prerequisite. Interviews, recruitment,
comparative library studies and a large labeled benchmark are not launch requirements.
Source-access tests, privacy/correction checks and small engine regressions remain
implementation work; they are not a separate discovery phase.

## Working implementation decisions

| Area | Default | Reason / known limitation |
| --- | --- | --- |
| Audience | Frequent leisure travellers with existing smartphone photos; English UI, no geography-specific feature | Available context supports this starting hypothesis; actual fit is unknown |
| Platforms | iOS + Android, shared Expo / React Native / TypeScript app | User chose both; test platform-specific import behavior, do not assume parity |
| First source | Native device photo library / supported selection flow | Avoid unproven historical cloud API access; show accessed scope |
| Local state | SQLite evidence/history/correction tables; originals remain at their source | Simple durable representation; no graph database or cloud history sync needed |
| Map | react-native-maps; native Apple/Google map providers with required configuration | Map service behavior is separate from local data storage; history list works if maps fail |
| Country resolution | Bundled Natural Earth country geometry with documented dataset version | Country lookup works without uploading exact evidence coordinates; border ambiguity stays unknown |
| City labels | Best-effort known label or neutral place label; user can rename | Do not add paid geocoding or an LLM location guess as a mandatory dependency |
| Inference | Local metadata baseline, then bounded optional AI grouping/label proposals | AI can improve interpretation; neither component proves physical presence |
| Model | OpenAI Responses API, initial snapshot gpt-5.4-mini-2026-03-17, configurable | Supports structured outputs; no Travel Life performance benchmark exists |
| Backend | Small TypeScript Supabase Edge Function; anonymous protected session only for online functions | Keeps provider keys out of the app; no email/login wall for local history |
| AI inputs | Existing place IDs/coarse labels, relative day offsets, counts and evidence categories | No originals, thumbnails, names, filenames, exact GPS or absolute travel dates |
| AI data policy | Explicit opt-in; store:false; no request-body logging; disclose provider retention | store:false is not a promise of zero provider retention |
| Sharing | Selected static card as P1; public web profiles deferred | Test sharing cheaply without a public-location service |
| Updating | Explicit foreground rescan that preserves edits | Always-on background maintenance is later |
| Evals | Small reviewed synthetic/internal regression set before beta; grow real-case evals after rollout | Engineering confidence is possible now; population accuracy remains unmeasured |
| Delivery | One working MVP, instrumented limited rollout, then targeted improvements | Demand validation happens in use, not as a permission gate before building |

No provider account, paid plan, upload, backend deployment or app publication was
performed by making these decisions. Service access and signing credentials are
operational delivery tasks. Selected services are replaceable if actual integration
reveals a blocker; record the replacement rather than silently expanding scope.

## Initial operational limits

Set a hard maximum of 2,000 input tokens and 800 output tokens per AI request,
ten AI requests per anonymous installation/day, and a deployment-wide daily
reservation budget of USD 5 at the configured model rates. These are chosen spend
controls, not measured requirements or promises of accuracy/latency.
Enforce quota reservations atomically server-side, account for retries, and fail
to the local baseline when a limit is reached. Rate-limit anonymous-session creation
as well as AI requests; rotating identities must not bypass the global budget.
Check actual rates and account access during implementation.

## Consequences

- The backlog starts with app/import delivery. There is no pre-launch market-research epic.
- Product semantics and technical defaults are recorded now in the working MVP spec.
- Small evals and objective checks travel with engine implementation.
- Raw case collection and subjective judge calibration are conditional on actual
  opted-in data and an observed need.
- We accept unvalidated demand, imperfect reconstruction and missing-photo coverage.
  The product exposes uncertainty and gives owners durable correction controls.
- A release still needs a runnable signed build, configured services, applicable
  privacy/data controls and verification on both platforms.
- Formal PRD/UX/architecture elaboration may occur inside implementation as needed;
  it does not recreate the retired discovery programme.

## Official sources checked for technical defaults

- [Expo MediaLibrary](https://docs.expo.dev/versions/latest/sdk/media-library/):
  iOS/Android access and metadata capabilities depend on permissions; Android
  location metadata requires ACCESS_MEDIA_LOCATION.
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) and
  [iOS build process](https://docs.expo.dev/build-reference/ios-builds/):
  local storage and the iOS build route; accounts/device signing still need setup.
- [react-native-maps](https://github.com/react-native-maps/react-native-maps):
  cross-platform map component, with native-provider configuration.
- [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/):
  public-domain map data; select/version the actual geometry at implementation.
- [OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini):
  chosen snapshot and structured-output capability. Selection is a starting hypothesis.
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data):
  provider abuse-monitoring retention may still apply when application-state storage
  is disabled; do not claim zero retention from store:false.
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) and
  [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous):
  backend/auth building blocks; anonymous access needs abuse prevention.

These checks are narrow implementation preparation, not a market-research workstream.

## Supersession note — 2026-10-07

Decision 0004 supersedes the foreground-only/default-deferred background maintenance choice. Background maintenance is now required P0 in the MVP on both platforms. Other defaults remain unless superseded by a later decision.

Decision 0005 also supersedes deferring hosted sharing: interactive journey links
are now P0. Decision 0009 supersedes the optional short trip-video scope: the
private lifetime replay and selected-highlight sharing are MLP P0; full cinematic
replay remains outside the core. Selected sharing copies may be stored remotely.

Decision 0006 supersedes interpreting the three-day gap as a complete journey rule.
Photo membership, visit support and owner confirmation are distinct; the numeric
clustering and usual-area values remain provisional inputs to reviewable drafts.
Decision 0007 fixes the first version of those numeric inputs and deterministic
tie-breaks before implementation. They remain adjustable in later versioned releases.

Decision 0008 supersedes this document's Minimum Viable Product release framing.
The current goal is Minimum Lovable Product; the existing story scope needs an
experience and acceptance review before it is treated as the build contract.
