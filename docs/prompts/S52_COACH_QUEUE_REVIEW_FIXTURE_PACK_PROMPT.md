<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S52 — Coach Queue / Review Read Model Fixture Pack Prompt

Build S52 as a narrow v0-safe fixture/read-model hardening slice for the S49-S51 coach queue review surface.

Goal:
Create stable fake source records and expected route responses so future API/UI work can build against known product states before rendering or production route wiring.

Hard boundaries:
- engine-inert
- fixture-only
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
- fixture contract doc
- fake source records JSON
- expected route responses JSON
- Node fixture validation test
- package script for targeted testing
- V0 surface index update

Acceptance:
- fixture source records match expected successful route output
- deterministic queue order
- other-coach records are filtered out
- empty queue fixture is stable
- missing coach ID fixture is stable
- expected outputs contain no forbidden fields
- source records are not mutated
- fixture JSON is valid and readable
