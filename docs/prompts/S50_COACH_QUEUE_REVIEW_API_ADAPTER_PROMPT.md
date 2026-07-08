<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S50 — Coach Queue / Review API Adapter Prompt

Build S50 as a narrow v0-safe API-style adapter over the S49 Coach Queue / Review Surface.

Goal:
Expose the S49 pure builder through a stable adapter response shape using fake/in-memory source data only.

Hard boundaries:
- engine-inert
- platform-only
- no UI
- no Express route yet
- no database
- no network
- no current time
- no randomness
- no medical meaning
- no safety claims
- no readiness certification
- no score
- no ranking
- no performance prediction
- no organisation/team/gym runtime
- no evidence sealing
- no exportable proof
- no training advice
- no autonomous coach authority

Required outputs:
- implementation contract doc
- pure TypeScript adapter
- in-memory source helper
- Node test file
- package script for targeted testing
- V0 surface index update

Acceptance:
- missing coach ID refused
- blank coach ID refused
- filters records by coach ID
- delegates derivation to S49 builder
- deterministic order preserved
- blocked records returned without advice
- source failure returns source_unavailable
- output contains no forbidden fields
- in-memory source returns copies
- adapter does not mutate source records
