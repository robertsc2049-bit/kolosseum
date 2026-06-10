\# TICKET 003 — REGISTRY EXPANSION + SUBSTITUTION PROOF (v0)



\## Goal

Expand the exercise registry so substitution decisions can be proven to change deterministically under different emitted constraints.



\## Why this exists

Ticket 001 proved Phase 4 can emit `program.exercises\[]`.

Ticket 002 proved Phase 3 can emit constraints.

Now we must prove the substitution engine:

\- reads registry-backed candidates

\- excludes candidates based on constraints

\- deterministically selects the best remaining candidate



\## Inputs

\- Exercise registry entries (expanded)

\- Phase 3 constraints (at least `avoid\_joint\_stress\_tags`)

\- Program payload produced by Phase 4 for `activity\_id=powerlifting`



\## Registry changes (required)

Ensure exercise registry contains at least:

\- `bench\_press` (joint\_stress\_tags includes `shoulder\_high`)

\- `dumbbell\_bench\_press` (joint\_stress\_tags includes `shoulder\_medium`)

\- `machine\_chest\_press` (joint\_stress\_tags includes `shoulder\_low` or none)



All must include consistent fields used by scoring:

\- `pattern`

\- `stimulus\_intent`

\- `rom`

\- `stability`

\- `equipment`

\- `equipment\_tier`

\- `joint\_stress\_tags`



\## Proof requirements (tests)

Add tests that prove:

1\) With `avoid\_joint\_stress\_tags=\["shoulder\_high"]`

&nbsp;  - `bench\_press` is disqualified

&nbsp;  - `dumbbell\_bench\_press` is selected



2\) With `avoid\_joint\_stress\_tags=\["shoulder\_high","shoulder\_medium"]`

&nbsp;  - `bench\_press` and `dumbbell\_bench\_press` are disqualified

&nbsp;  - `machine\_chest\_press` is selected



These tests must be:

\- deterministic

\- registry-backed (no CLI demo injection)

\- asserting the final selected substitute id



\## Determinism requirements

\- Candidate iteration order must be stable (registry order or sorted by id).

\- No object key iteration reliance without sorting.



\## Files touched (expected)

\- `registries/exercise/exercise.registry.json`

\- tests:

&nbsp; - `test/ticket003\_registry\_expansion.test.mjs` (or equivalent)



\## Acceptance

\- `npm run lint` passes (including registry schema validation)

\- `npm test` passes

\- Running CLI with `phase1\_min.json` shows Phase 5 producing the expected substitution under Phase 3’s emitted constraints



