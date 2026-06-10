# V1 Export-Nothing v0 Guard

Document ID: v1_export_nothing_v0_guard
Status: Draft for enforcement
Scope: active v0 runtime/demo boundary only
Audience: Product / UI / API / CI / review

## Purpose

Explicitly prove v0 cannot leak proof-layer or export surfaces.

## Invariant

- v0 demo and sale boundary stays below v1 lawful proof or export scope
- no export UI is reachable in v0
- no evidence UI is reachable in v0
- no proof-layer route is reachable in v0
- no export-layer route is reachable in v0

## Guard scope

- runtime app surfaces only
- reachable UI and API roots only
- docs, tests, fixtures, dist, and non-runtime artefacts are excluded from reachability proof

## Forbidden runtime surface classes

- export route
- exports route
- evidence route
- proof route
- seal route
- envelope route
- export button or export action
- evidence button or evidence action
- download evidence action
- download export action

## Proof

- guard verifies no export or evidence UI or route is reachable in v0
- negative tests cover forbidden runtime surface markers
- any accidental reachability fails

## Final rule

If a runtime v0 surface exposes export, evidence, proof, seal, or envelope entry points, the v0 boundary has drifted.