# 0012 — Dimensional Atlas and minimal journey list

Date: 2026-10-15 (Asia/Bangkok).
Status: accepted design direction; development plan prepared, implementation not authorized by this planning request.

## Context

The owner supplied a map with an adjacent trip list as composition reference, requested a more vibrant and professional 3D effect, then clarified that mountains, valleys and terrain realism are unnecessary. The list must be simple, minimal, intuitive, visually clear and uncluttered.

## Decision

Extend Living Atlas with restrained visual depth through richer geographic color, subtle perspective, dimensional markers, layered preview cards and responsive motion. Keep its matte interface and core palette. Use flat, quiet journey rows with safe title, observed dates and compact worded state; preserve map/list synchronization and in-place preview.

Do not pursue terrain, buildings, globe mode or decorative routes for this change. Earlier exploratory terrain/globe ideas were not accepted requirements. Exact geographic hues, pitch and motion values remain working implementation defaults, not approved pixel specifications.

## Consequences

The [development contract](../../_bmad-output/specs/spec-atlas-dimensional-polish/SPEC.md) defines five work packages and 18 acceptance cases. It follows the prior refinement without rewriting its historical completion record. MapLibre, coarse/opaque data boundaries, uncertainty, local media handling, correction return and accessible Timeline fallback remain required.

Production basemap selection remains unresolved. This direction authorizes no provider purchase, account setup or private data upload. Native API/style feasibility and physical-device visual/gesture evidence are delivery gates.

Revisit if the owner requests terrain/globe capabilities or native feasibility requires a material change to the agreed effect.
