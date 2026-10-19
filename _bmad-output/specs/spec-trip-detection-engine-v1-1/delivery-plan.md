# Implementation sequence and readiness

One delivery contract: SPEC.md and its listed companions. Six capabilities,
64 acceptance cases, five ordered work packages. No further algorithm-selection
spike or product brainstorming is needed to start. Thresholds are specified policy
defaults; changing them is a versioned correction with updated fixtures/log.

## W1: Native normalization and baseline regression

Targets: `photo-access/native-adapter.ts`, `import-record/types.ts`, import schema,
new small local native module, native adapter tests. Preserve catalog pagination,
permissions and previews. Implement the selected local-only bridge, field guards
and legacy metadata refresh. Keep V1 as a baseline and write the original fifteen
synthetic policy fixtures before replacing its production role.

Exit: AC16-25,43-48,61 pass in adapter/pure tests; compile both native modules;
no-network synthetic cloud test and Android permission tests verified on targets
when devices/simulators exist. If a platform is unavailable, record exactly which
native checks remain unrun. Do not replace the bridge contract with blind EXIF calls.

## W2: Pure context, episode and qualification engine

Targets: new reconstruction modules under the existing feature, existing engine
reference retained. Implement algorithm.md in order, including leave-one-candidate-
out context, explicit uncertainty/status decisions, score/profile paths, destination
corroboration and memberships. Maintain synthetic debug traces in test output only.

Exit: all pure AC01-47,49,61-64 pass; reversed/enumerated/chunked final inputs agree;
every output has version, gate reasons, score signals and matched path. Test
transition conditions at each exact threshold. No DB/UI/provider calls in pure rules.

## W3: Versioned persistence and correction-safe generations

Targets: import migrations, reconstruction repository/controller, correction
applications, maintenance reconciliation and repository tests. Implement tables,
indexes, input-revision CAS, identity lineage, pinned owner snapshots, query view,
manual preservation and dry-run manifest. Retain current corrections exactly.

Exit: AC13-15,49-58 pass with repository-level query assertions, migration from
current28 and older fixture schemas, concurrent foreground/background transactions,
late lifecycle completion and crash recovery. Background scheduling remains
platform-controlled; generation progress is resumable and publication atomic.

## W4: Automatic reveal and rare review

Targets: `reveal/types.ts`, `reveal/projection.ts`, provider, Atlas/detail/review
components and tests; preserve approved design system and map/gallery context.
Use qualified query boundary everywhere. Show worded Detected/Reviewed by you
status with details on demand, not generic inferred-draft rows. Questions: base
era first, protected correction conflict, probable trip ambiguity, then optional
merge, ordered by affected qualified-trip count then earliest observed time.

Question key = type+canonical scope+decision revision. Show at most3; a quiet entry
shows actual total optional questions. Dismissal holds unless material support,
configured base or contradiction state changes AND30days have passed; explicit
owner re-entry always works. Resolved questions never reappear for identical input.
Do not generate questions for known routines, screenshots or low-score noise.
Review is reachable, dismissible and does not gate viewing qualified trips.

Exit: AC56-62 plus existing Atlas/gallery/correction-return regressions pass.
On Android and iOS, inspect automatic map/list/count consistency, real local media,
return context, reduced motion/accessibility and sparse/restricted states with
synthetic device libraries. Clean logs cannot substitute for visual verification.

## W5: Comparative evidence and controlled legacy adoption

Run retained V1, exact supplied score baseline and selected V1.1 production policy
on the same authorized local snapshot. Report reasons for removed/added/split/merged
trips, protected scopes and runtime. Keep private IDs inside the local manifest.
Acquire explicit approval before activating the legacy manifest. Exercise rollback
with a subsequent owner edit, then verify the latest decision remains effective.

Evaluation uses acceptance.md's frozen labels/denominators. Meet the numeric product
goals on the agreed available labeled delivery sample, report uncertainty and slices,
and retain manual/permission fallbacks. If labels are unavailable, implementation
can be software-verified but product quality stays not_measured; do not call it
release-validated or apply a live quality claim. If targets fail, record failure
modes and revise the policy version rather than hiding results/adding review chores.

## Required verification and performance evidence

Root `npm run check`; mobile package's actual typecheck/lint/test check; pure rules,
native bridge, migration/repository/correction/publication integration; `git diff
--check`; Android and iOS build/device evidence. Consult error playbook first and
record incidents. Verify correct working directory for similarly named root/mobile
scripts; missing build tools or unavailable devices are not passing checks.

Batch <=100 metadata records/<=8 native reads, yield at2seconds; index time/area
lookups and cache context by snapshot+excluded-support digest. Never compare every
photo to every other photo globally. Measure cold/warm elapsed time, peak memory,
cancellation response and100k-unit synthetic input. Release performance budget is
selected here: foreground JS/UI yield<=100ms between chunks; native batch<=2s
before progress publication; background must checkpoint before task expiration.
Overall import time is reported by device/library size, not promised universally.
The 2-second budget yields between reads, never force-kills native callbacks.

## Handoff/report contract

Report root causes/code pointers; pipeline changes; detector/context/metadata
versions; changed files/migrations; exact gates/score/profile decisions/query
predicate; actual tests/build/device outcomes; precision/recall/action counts or
not_measured; limitations; concrete dry-run manifest and approval status; rollback
exercise. Foundation/synthetic passes establish software behavior, not accuracy.

## Planning validation (2026-10-16)

Coherence and source-preservation checks performed while deriving this contract.
No unresolved classifier, boundary, evidence fallback, persistence or rollback
choice is delegated to an unspecified later spike. Source-policy extensions and
default thresholds are explicit assumptions; private labels/device availability
are execution dependencies. Application implementation and live legacy changes
are not part of this planning turn.

Validation evidence: six unique capability IDs; 64 unique sequential acceptance
IDs; all companion/local Markdown links and new-file whitespace passed. Source
score examples70/45 and profile examples55/50 were checked. Root `npm run check`
passed framework integrity (44 skills/four runtime trees),20 foundation tests and
evaluation smoke; `git diff --check` passed. No mobile/native build, engine test,
device run or private quality evaluation was performed for this document-only task.
