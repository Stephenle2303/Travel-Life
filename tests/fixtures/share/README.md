# Synthetic codec fixtures

These contain only a generated solid green 32×24 frame and a generated 440 Hz
tone; no owner media or private evidence is included. Generated locally with
FFmpeg 7.1 `lavfi color=c=green:s=32x24:r=10`, `sine=frequency=440`, a 0.4-second
H.264/AAC encode and the mobile metadata-removal flags. The pre-scrub MP4
intentionally includes FFmpeg's fixed `udta/meta` and compressor fields to prove
the scrubber is necessary. The JPEG is re-encoded synthetic color with APP/COM
metadata removed. Both sanitized outputs passed actual FFprobe inspection and
complete FFmpeg decode during 2026-10-27 host verification. This does not prove
phone encoding, container-image execution or deployed-service acceptance.
