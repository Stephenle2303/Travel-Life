# Selected derivative verification package

This Node service is a reviewable app-owned deployment package. It receives only
the selected sanitized derivative after explicit Publish, never originals or AI
provider requests. It is **not connected or deployed**. Automatic approval review
rejected adding configurable remote media transfer without authorization for the
specific payload and destination. The Edge function therefore hard-denies media
publication/uploads. Choose and authorize the app-owned compute host before any
transfer adapter is added.

Run `node --test tests/share-validator.test.mjs` from the repository root for
synthetic byte-binding, metadata, track and decode-fault tests. Those inject the
subprocess runner; actual FFmpeg/container execution remains unverified here.

The service requires Node 24 and FFmpeg/ffprobe. Build its Dockerfile with an
explicit reviewed `FFMPEG_DEBIAN_VERSION` from the selected Debian repository;
record that exact package and final image digest. No unpinned package version is
silently accepted. Configure a random 256-bit `SHARE_VALIDATOR_SECRET`, HTTPS at
the chosen host, one concurrent worker, 256 MiB or greater bounded memory,
read-only root filesystem and ephemeral private `/tmp`. Disable access/body/header
logging at the ingress and hosting layer. Accept only app-server network traffic.
The single POST `/verify` endpoint requires its secret and streams at most 50 MiB;
request bodies, provider errors, names, paths and probe output are never logged.
Container CPU/memory/time limits are mandatory in addition to subprocess timeout.

Before enablement verify actual JPEG/MP4 native fixtures on both platforms,
metadata-free bytes, corrupt/truncated/polyglot rejection, decoder sandbox and
network egress denial, exact hash-bound attestation, temp cleanup after faults,
and deployed ingress log redaction. The Edge transfer adapter must validate every
attestation field and preserve the structural validator as defense in depth.
The current package is not evidence that a deployed decoder or codec is accepted.
