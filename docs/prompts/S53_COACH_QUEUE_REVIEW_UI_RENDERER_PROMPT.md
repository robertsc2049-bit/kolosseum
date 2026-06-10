<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S53 — Coach Queue / Review Minimal UI Read Model Renderer Prompt

Build S53 as a narrow v0-safe fixture-backed renderer for the S49-S52 coach queue review surface.

Goal:
Create a minimal deterministic renderer that turns S52 expected route responses into safe HTML strings.

Hard boundaries:
- engine-inert
- renderer-only
- fixture-backed
- platform-only
- no live API
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
- pure TypeScript renderer
- Node renderer test file
- package script for targeted testing
- V0 surface index update

Acceptance:
- primary fixture renders deterministic HTML
- empty fixture renders empty state
- missing coach ID fixture renders refusal state
- rendered HTML contains no forbidden terms
- factual status labels render
- dynamic values are escaped
- renderer does not mutate input response
- renderer does not import or call S51 route handler
- renderer does not import filesystem, network, database, Express, or browser APIs
