---
title: Supabase-only bounded synthetic full-decode probe
status: in-progress
created: 2026-10-28
---

# M7 media capability experiment

Owner explicitly chose existing Supabase only and bounded feasibility verification.
No external compute destination, user photo/video upload or public share enablement.
The probe accepts an empty POST only, requires a server-side random probe secret,
generates a fixed 64x64 one-second H.264 fixture and one JPEG in private WASM memory,
fully decodes both to null, then requires rejection of a truncated MP4. No original
media or external decoder provider is involved. No inference/accuracy claim.

Pinned upstream single-thread @ffmpeg/core 0.12.10 factory is copied unchanged for
the isolated experiment, SHA256 67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3.
WASM is fetched only from the fixed public jsDelivr package path and must match
SHA256 9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7,
32,232,419 bytes. No request-controlled URL, path, codec, command, payload or size.
Probe runs one fixed task/request; response is no-store with fixed pass/fail categories
and bounded durations/heap/fixture sizes. Vendor assets live only in ignored POC.

## Before-code diagnostic map

MEDIA_CAPABILITY_PROBE / PROBE_AUTH -> missing/wrong secret/body: ACCESS/blocked.
MEDIA_CAPABILITY_PROBE / ASSET_FETCH -> fixed asset unavailable/oversized: UNAVAILABLE/failed.
MEDIA_CAPABILITY_PROBE / ASSET_VERIFY -> mismatched bytes: VERIFY/blocked.
MEDIA_CAPABILITY_PROBE / DECODER_INIT -> runtime/heap failure: RUNTIME/unproven.
MEDIA_CAPABILITY_PROBE / SYNTHETIC_ENCODE -> missing fixture capability: CODEC/unproven.
MEDIA_CAPABILITY_PROBE / FULL_DECODE -> full decode fails: DECODE/unproven.
MEDIA_CAPABILITY_PROBE / NEGATIVE_CONTROL -> accepts corrupt bytes: VERIFY/unproven.
Each request has server-generated local correlation, closed reason/stage/outcome,
no request/secret/FFmpeg output/stack. Decoder print/printErr/progress callbacks discard
raw content; only fixed boundary logger emits events. One terminal event.

## Evidence

Next bounded local feasibility step: generate fixed 720p and 1080p synthetic
H.264 fixtures for two seconds at 24fps inside the pinned decoder, then fully
decode each with a five-second per-command timeout and fixed diagnostics. No
private media or request-supplied arguments. Report encode/decode result, byte
count, heap and timing only; failure means unproven, never silently reduce scope.
Local timings do not establish hosted CPU or memory acceptance.
The next local fixed case adds AAC audio to 720p H.264 and verifies all audio and
video tracks by full decode, then tests multiple truncated variants. Report fixed
outcomes and bounded metrics only; no user media.

Hosted bounded ladder: separate temporary secret-gated probe, empty request only,
fixed 720p two-second 24fps H.264/AAC synthesis, full decode of both tracks and
truncated-file rejection; stop at first failure and retain fixed failure stage.
Retire the temporary function and its isolated secret after measurement. This
measures a synthetic combined encode/decode workload and cannot establish media
limits, reliable performance or real-device acceptance.
The attempted deployment with gateway JWT verification disabled was rejected by
automatic approval review. No new function was deployed; the isolated probe secret
was removed. A separate JWT-gated path must verify a valid token at the gateway in
addition to the probe-only secret; it remains limited to synthetic empty requests.

The JWT-gated synthetic 720p encode/decode probe reached the hosted handler but
returned HTTP 422 at SYNTHETIC_ENCODE after 1,969 ms total; the fixed 1,500 ms
command timeout and opaque encoder output mean the cause is unknown. The function
and secret were removed. Next use a pre-encoded, public synthetic fixture with a
pinned SHA-256 inside the bounded probe, and measure only full decode and corrupt
rejection. Never treat encode failure as decode failure or expand the gate.

Hosted decode-only result: fixed pre-encoded 720p H.264/AAC fixture, 2 seconds,
1,588,323 bytes, SHA-256 9b3f7ec0b4c171821515fe9dc14cdd173833a17265764a06bfed6e1a8f041215.
The JWT-gated probe reported HTTP 200, full video/audio decode true, truncated
input rejected, WASM heap 33,554,432 bytes and elapsed 942 ms including asset fetch
and initialization. Probe function and secret were removed. Anonymous project JWT
plus separate probe secret is synthetic endpoint access, not verified user-session
acceptance. Duration, size, concurrency, hostile inputs, cache and full limits remain
unproven; media sync is not enabled.

Next fixed hosted rung: pre-encoded synthetic 1080p H.264 video, 2 seconds at
24fps, SHA-256 checked before full-video decode and a truncation negative control.
The JWT gate and random probe secret remain required. No caller media accepted;
retire function and secret after measurement. This does not test audio, limits or
concurrency at 1080p and cannot activate private media.
Hosted result: HTTP 200, fixed 2-second 1080p H.264 fixture (3,135,109 bytes,
SHA-256 1d396cab33acee9fcc8a522806c9f91a497884b5ce31514f08d2728d762f31bf)
fully decoded and truncated variant rejected. Reported elapsed 1,208 ms including
setup and 33,554,432-byte WASM heap. Function and secret removed. No audio was
present in this rung; no real-media, multi-request or long-duration conclusion.

Local Node v24 synthetic probe passed: JPEG/H264 decode true, truncated reject true,
WASM heap 33,554,432 bytes, observed elapsed about 134 ms. This is local feasibility,
not Edge CPU/memory evidence. Probe load initially required explicit self/location
compatibility shims; no private content was involved.

Hosted synthetic measurement on the existing project passed: JPEG and one-second
64x64 H.264 fully decoded, truncated MP4 was rejected, reported WASM heap was
33,554,432 bytes and observed elapsed time was 516 ms. The experiment function
and its dedicated secret were removed after measurement. This is not a realistic
media envelope or authorization to enable media transfer.

Local fixed two-second 24fps H.264 ladder: 720p encoded/decoded in 615/106 ms
(1,569,190 bytes); 1080p in 1,103/164 ms (3,135,109 bytes). A 720p H.264/AAC
case decoded both tracks in 83 ms, and 10%, 50% and 90% truncated files were
rejected. Peak reported WASM heap after these sequential cases was 69,730,304
bytes. These are synthetic local Node measurements and establish neither Edge
resource limits nor acceptance of original media.

## Completion gates

2026-10-29 hosted incident map before change: synthetic JPEG PUT reached
PRIVATE_MEDIA/MEDIA_DECODE START, then Edge platform reported memory-limit
shutdown (HTTP 546); allocation attribution remains unknown. The loader holds
download chunks, a concatenated WASM copy and an extra SHA-256 copy. Reduce
these provable copies without changing digest, trusted full decode, bounds,
authorization or fail-closed handling. MEDIA_DECODE/MEDIA_UNAVAILABLE covers
fetch/factory failures, MEDIA_VERIFY covers size/hash rejection, MEDIA_STORAGE
at MEDIA_CLEANUP covers unlink; platform termination remains unknown outcome.
Collect matching worker's closed PRIVATE_MEDIA events by action correlation and
the platform shutdown category only, with synthetic JPEG. Host tests must cover
chunk bounds, corruption, decoding and redaction; repeat hosted validation before
claiming the memory incident repaired.

Run the empty secret-authenticated probe on the approved existing project. Record
function version, status, resource-limit failures and actual decoder results; remove
or disable experimental ingress after measurement. A tiny pass does not enable
private media sync. A later limit ladder must cover realistic dimensions/duration,
concurrency, audio, corrupt data, timeout/cleanup and token/redaction behavior before
accepting M7.5/M7.6. Original 100MiB/2GiB defaults remain unproven.
