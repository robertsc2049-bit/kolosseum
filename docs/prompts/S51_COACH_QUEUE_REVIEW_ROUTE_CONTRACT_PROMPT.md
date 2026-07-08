<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S51 — Coach Queue / Review Route Contract Prompt

Build S51 as a narrow v0-safe route/handler contract over the S50 Coach Queue / Review API Adapter.

Goal:
Create a stable handler-level request/response contract for the coach queue review surface using fake/in-memory source wiring only.

Hard boundaries:
- engine-inert
- platform-only
- no UI
- no Express app registration
- no production route exposure
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
- pure TypeScript route/handler contract
- Node test file
- package script for targeted testing
- V0 surface index update

Acceptance:
- GET with valid coach ID returns HTTP 200
- filters by coach ID via S50 adapter
- missing coach ID returns HTTP 400
- blank coach ID returns HTTP 400
- wrong method returns HTTP 405
- wrong path returns HTTP 404
- source failure returns HTTP 503
- blocked S49/S50 record returned without advice
- response contains no forbidden fields
- handler does not mutate source records
