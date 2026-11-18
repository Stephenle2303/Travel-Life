# Private media decoder feasibility

Research date: 2026-10-28. Scope: M7.5/M7.6, existing approved Supabase project
`fgmcnzxhbrtvjhtafort` only. Root verified its region as `ap-south-1` through the
project API. This research did not deploy code, create infrastructure, install a
dependency, invoke a decoder or upload private media. Public sharing stays disabled.

## Finding

JPEG decoding has a documented Supabase-only WASM route. The current Node/native
FFmpeg validator is not a drop-in hosted Edge Function. Full bounded MP4 decoding
within the planned 100 MiB envelope has no verified implementation on this project's
hosted Edge runtime. This is an unproven runtime/operational fit, not a claim that all
video decoding with WASM is impossible. Do not remove trusted full decode or label
structural parsing as equivalent just to enable private media.

The smallest predictable full-video path is the existing native validator in an
app-owned bounded container service. That requires a specifically chosen compute
destination and authorization beyond the existing Supabase project. A constrained
Supabase-only WASM prototype could test another path, but cannot honestly be counted
as complete production media delivery before its full-decode budget is demonstrated.

## What already exists

- `apps/share-validator/validator.mjs` invokes ffprobe and FFmpeg via Node execFile.
  It binds output to digest/length/dimensions/duration and decodes selected video/audio
  streams completely with failure-on-decode-error. Temp files are removed in finally.
- `apps/share-validator/server.mjs` exposes one authenticated verification request,
  one concurrent worker and a 50 MiB input cap. Its README says it is not connected
  or deployed; the synthetic tests inject the subprocess runner, so they do not prove
  a real container/codec works.
- Its Dockerfile uses Node 24 and requires an explicit FFmpeg Debian version.
  A reviewed final image digest, sandbox/egress constraints and real decoder tests
  are still required. M7 plans 100 MiB video, so this 50 MiB package needs explicit
  adaptation and load tests rather than being reused under an incompatible cap.
- `supabase/functions/_shared/share-media.ts` verifies structure, allowed metadata,
  digest and manifest bounds. It explicitly requires trusted codec decode in addition.
  `VERIFIED_MEDIA_PUBLICATION = false` in share-runtime.ts remains untouched.

## Existing Supabase hosted runtime

The published hosted Edge limits are 256 MB memory, two seconds active CPU per
request, wall-clock lifetime of 150 seconds free / 400 seconds paid and 150 seconds
idle timeout. Function bundles have different CLI/server bundling ceilings. Web
Workers and libraries needing native multithreading are unsupported. These limits
apply to background work too; waitUntil does not grant a longer CPU budget.
[Limits](https://supabase.com/docs/guides/functions/limits),
[Background tasks](https://supabase.com/docs/guides/functions/background-tasks).

The official runtime source's default UserWorker permissions omit subprocess/FFI
allowances; unlike its internal main worker, it is not an unrestricted Linux
execution environment. A normal hosted function cannot be treated as a place to
install/spawn the existing ffmpeg binary. This source check is supporting evidence,
not proof that a specific hosted build has been probed.
[Runtime permissions](https://github.com/supabase/edge-runtime/blob/main/crates/base/src/runtime/permissions.rs).

Supabase documents WASM support and an ImageMagick WASM image-processing example.
It cautions that complex processing and images above 5 MB may exceed resources;
the spec's 20 MiB image maximum is consequently an upper admission policy, not a
proven decode capacity. Bound width, height and decoded pixels as well as compressed
bytes; validate actual JPEG decode and clean re-encode on synthetic corrupt/oversize
samples before activation. A narrowly scoped JPEG decoder is another candidate, but
must be pinned, reviewed and benchmarked before claiming support.
[WASM](https://supabase.com/docs/guides/functions/wasm),
[Image processing](https://supabase.com/docs/guides/functions/examples/image-manipulation).

Storage image transformations can resize private-bucket images using signed requests,
but are a Pro-and-above feature and do not provide the app's complete JPEG/MP4
attestation contract. They are not a full-video validator.
[Storage transformations](https://supabase.com/docs/guides/storage/serving/image-transformations).

## MP4 alternatives

| Option | Concrete feasibility | Limit / remaining work |
| --- | --- | --- |
| Existing native FFmpeg package in hosted Edge | Incompatible execution model as written | Node child process/native executable assumptions require another runtime |
| Standard ffmpeg.wasm package | Full decoder technology exists, but browser wrapper uses a Web Worker even with a single-thread core | Not drop-in where Worker is absent; custom direct-core integration and runtime-budget evidence required |
| Custom single-thread H.264/AAC WASM decoder | Potentially supports very small bounded clips | No inspected implementation proves all planned files fit CPU/memory; pin codec/profiles and decode every frame/sample, reject resource failures; do not promise 100 MiB support |
| Incremental server decode jobs | Possible engineering investigation if decoder state/checkpoints are robust | Arbitrary byte chunks are not independent MP4 frames/GOPs; cannot declare full decode from a few samples, first frame or metadata probe |
| App-owned Linux container | Reuses actual FFmpeg/ffprobe implementation with OS limits | Specific host, billing/region, secret/log policy and acceptance required |
| Supabase Compute | Full Linux/Docker runtime could host native decoder | Current private alpha is evaluation-only and us-west-2-only; existing ap-south-1 project is not eligible under documented limits |

The ffmpeg.wasm project's own overview describes its Worker wrapper and supports
custom cores. Its playground loads approximately 32 MB of assets. A purpose-built
decoder may differ; neither bundle size nor video CPU should be guessed from those
examples. [ffmpeg.wasm architecture](https://ffmpegwasm.netlify.app/docs/overview/),
[Official playground source](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/src/pages/playground.md).

Supabase Compute was announced on 2026-10-27. During alpha it has full Linux services
but only in us-west-2, requires access, is not for production, can restart at any time,
has no persistent disk and gives services project secrets. Moving or creating a
project in another region is not covered by existing-project-only authorization.
Compute therefore does not resolve this project's present production requirement.
[Official Compute announcement](https://supabase.com/blog/supabase-compute-private-alpha).

## Recommended smallest path

Continue independent authorized account/history/correction work and private-media
staging/access/deletion contracts. Keep unverified media inactive. Build/test the
container and transport using synthetic fixtures locally while preserving the disabled
public gate. Do not upload private bytes to a new destination during preparation.

For the full-video enablement decision, propose an app-owned Cloud Run service in
`asia-south1` (Mumbai), close to the existing project's region, using the reviewed
Node/FFmpeg container. Cloud Run supports the needed container/memory envelope and
request timeouts beyond the current decoder's two-minute bound. Initial engineering
limits: one CPU, 1 GiB memory, concurrency one, max one instance, min zero, 180-second
HTTP timeout, bounded temp use and byte/duration/pixel/track caps. These are proposed
settings, not measured capacity or an approved paid deployment.
[Cloud Run regions](https://cloud.google.com/run/docs/locations),
[Request timeout](https://cloud.google.com/run/docs/configuring/request-timeout),
[Memory limits](https://cloud.google.com/run/docs/configuring/services/memory-limits).

The proposal needs a named GCP project/service URL, billing authorization, explicit
sanitized JPEG/MP4/audio derivative processing scope, ephemeral retention, access/body
log exclusions and a server-to-server authentication design before deployment. It adds
a provider and cross-provider transfer cost; no cost estimate is invented here. A
request timeout is not proof a container stopped; worker timeout, lease fencing and
idempotent attestations must remain enforced. An equivalent already-authorized Linux
host could avoid opening a new provider account if the owner has one.

Before media activation: run real JPEG/MP4 full decode with exact versions, corrupt
streams, hidden/extra tracks, metadata, resource exhaustion and deletion races;
attestation must bind exact immutable staged bytes and current consent/account/source
generation. Validate ingress logs and cleanup. Only then authorize active-object access
and actual two-device Replay acceptance. Images-only delivery is a partial milestone,
not acceptance of the agreed full media/Replay scope.
