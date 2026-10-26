# Replay accepted snapshot and worktree retirement

The owner confirmed the Android edit, trip exclusion, custom-audio Done and
Update/new-video flow with "ok het roi do" on 2026-10-26, then requested that
accepted working Replay work be committed and superseded variants retired.
This is normal-flow Android acceptance, not measured performance, iOS
acceptance or completion of every fault-recovery/UX item in the larger spec.

## Canonical checkout

Use only `C:\Users\vothi\Desktop\Travel Life` on `main`. Its existing history
already contains `cbbf141fc5e091bcb87bf69d486b6ef08daf632b` (gallery),
`fa0d450` (cache before optional editor hydration), and `790a1fd` (streamed
reusable trip chapters). The new accepted snapshot retains those changes plus
the verified draft persistence, audio ownership, scheduler and thumbnail fixes.

## Audited variants and recoverable preservation

| Former worktree | Historical HEAD | Tracked-WIP snapshot | Disposition |
| --- | --- | --- | --- |
| replay-edit-cache-integration | cbbf141fc5e091bcb87bf69d486b6ef08daf632b | 3dff350153dd65b69ef4b8de5b3a3805972e6ed4 | WIP cache-opening UI/test is already represented by later primary code. |
| replay-performance-v2 | 0fa1b8591f2c8ebbfb1118079f9f0fc7597e9d36 | 49dbc9d6d7c61c9cb6540dd74364e8eaa83890a4 | Chapter reuse, generation-independent identity and first-trip callbacks are superseded by primary streaming/finalization handling. |
| replay-render-performance | 7d24870331a3b78de6210c32cf0de6d6c57ad8e4 | 60c59e990e63c69beac0c1675c74fd4568e99732 | Earlier cache experiments/docs and party memlog; obsolete editor surface is not a merge candidate. |

Each HEAD and snapshot has an annotated local tag:
`retired/2026-10-26/<worktree-name>/head` and
`retired/2026-10-26/<worktree-name>/working-snapshot`.
Snapshots were created with `git stash create` without resetting, checking out
or changing the old working files. No untracked source files were present in
these three variants. Their ignored dependencies/build outputs remain on disk.

The exact `.git` pointer in each checkout was renamed to
`.git.retired-2026-10-26`, and `RETIRED-WORKTREE.txt` explains recovery. The
three stale registrations were pruned after a dry run identified exactly those
three pointers. Git now registers only primary main. The four worktrees retired
on 2026-10-23 remain retired; they were not built, reattached or integrated.
No remote refs were changed. Recovery requires explicit authorization and a new
semantic audit, using these tags rather than copying an old checkout into main.

## Archived helper

The untracked `apps/mobile/scripts/build-android-device.ps1` was not part of
the accepted app runtime. Its default passes `newArchEnabled=false`, which the
installed React Native Gradle plugin explicitly says is unsupported since
0.82. Preserve its exact contents as
`retired/build-android-device-2026-10-26.ps1.txt`; it is not an executable build
entry point or a verified delivery tool. Use the package's maintained Expo
Android command instead when a native rebuild is actually required.

## Excluded next-ticket work

All selected-share M4.5 spec/review files remain outside this commit, including
their sections in `docs/project-state.md` and
`docs/development/error-playbook.md`. These files stay in the working tree;
they are not retired and are not a Replay delivery dependency.

## Remaining scope

Canonical S7/G5 still requires iOS, lifecycle/privacy/restart/share checks,
accessibility and measured cold-path responsiveness. Separate known scope gaps
are retained automatic preferences for exclude/re-include, overview inclusion
and Selected shortcuts, bounded selected-task/final-commit recovery, and explicit
native connection/quarantine recovery. None was established by the owner's
normal-flow test. Do not label the full canonical contract or both-platform
release complete on the strength of this consolidation commit.
