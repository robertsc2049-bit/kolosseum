<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S49 — Coach Queue / Review Surface Prompt

Build S49 as a narrow v0-safe coach queue/review surface.

Goal:
Create a factual linked-coach queue surface that shows which athlete records require review, are available, or are blocked.

Hard boundaries:
- engine-inert
- platform-only
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
- neutral copy JSON
- pure TypeScript builder
- Node test file
- package script for targeted testing
- V0 surface index update

Acceptance:
- linked review-required athlete derives review_required
- linked non-review athlete derives available
- revoked or missing link derives blocked
- missing source refs derive blocked
- unknown field derives blocked
- unknown enum derives blocked
- deterministic sorting
- no input mutation
- no forbidden output keys
