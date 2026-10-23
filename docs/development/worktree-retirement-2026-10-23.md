# Runtime comparison and worktree retirement

Audited local main `fc72600e99b7a57296c59958e5eb65f075c35c49`, including
`7820f5d`, `5200b71`, and `fc72600`. The mobile working source/configuration
has no diff from that commit. Metro's process points to this checkout's
`apps/mobile/node_modules/expo/bin/cli`; its status is running and its inspector
lists the Travel Life client on Xiaomi 2211133G.

The installed APK and local debug APK share SHA-256
`7b61a71479845a1cf51ae1832d6cf53791d29d6e5f4d32e1b26419d31a4336de`.
This verifies native package equality, not an immutable identity for the
JavaScript already loaded by the development client. The full Android Metro
source-map request did not complete and was interrupted; loaded-JavaScript
byte equality remains unverified. No app reload or storage mutation was used.

## Retirement disposition

All four secondary checkouts were clean immediately before retirement:

| Former worktree | Preserved commit | Disposition |
| --- | --- | --- |
| atlas-reference-cartography | 448ab96 | Already in main ancestry |
| destination-labels | 34c7564 | Already in main ancestry |
| dimensional-atlas | aac320e | Historical native-map implementation; superseded by later MapLibre work |
| local-operation-responsiveness | e904e4f (includes f4699c4) | Historical responsiveness implementation; superseded by later accepted main delivery |

Each exact commit is retained in an annotated local tag under
`retired/2026-10-23/<former-worktree>`. The six preservation/consolidation
branches were likewise converted into annotated tags in that namespace.
All active local branches except main were removed; only the primary worktree
remains registered. No remote branches or tags were changed.

Historical directories remain intact, including ignored dependencies and native
build files. Their `.git` pointer was renamed `.git.retired-2026-10-23`, a
`RETIRED-WORKTREE.txt` warning was added, and stale Git registrations were pruned.
All four directories were verified to reject Git worktree operations. Recovery
requires deliberate re-creation from an archive tag and a new authorized audit.
This prevents ordinary branch selection and accidental commits from those
checkouts; an explicit manual recovery remains possible.

Local screenshots, scratch review diffs, source maps, and Jest caches are ignored
so ordinary staging cannot include them. These artifacts remain on disk.
