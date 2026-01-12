\# TICKET 004 — PHASE 6 SESSION MAPPING (v1 minimal)



\## Goal

Phase 6 must map program exercises into a session output structure deterministically, without inventing new logic or requiring extra athlete inputs.



\## Inputs

\- Program output from Phase 4 + Phase 5 adjustments (as currently shaped)

\- Canonical input (for future use; currently may be unused)



\## Output (contract)

Phase 6 returns:

\- `ok: true`

\- `session`:

&nbsp; - `session\_id: string`

&nbsp; - `status: "ready"`

&nbsp; - `exercises: Phase6SessionExercise\[]`

\- `notes: string\[]`



Define `Phase6SessionExercise` (v1):

\- `exercise\_id: string`

\- `source: "program"`



\## Mapping rule (v1)

If program has the minimal substitutable shape:

\- `program.exercises` is an array of objects with `exercise\_id`

Then Phase 6 emits:

\- `session.exercises = program.exercises.map(e => ({ exercise\_id: e.exercise\_id, source: "program" }))`



If program is stub/non-substitutable:

\- Emit empty exercises array.



\## Determinism requirements

\- Preserve the order of `program.exercises`.

\- Do not sort or re-rank.

\- No timestamps, randomness, or OS-dependent ordering.



\## Tests (must exist)

\- Baseline test: empty program → empty session exercises

\- v1 test: program.exercises includes ids → session.exercises contains the mapped ids in same order



\## Files touched (expected)

\- `engine/src/phases/phase6.ts`

\- `test/phase6.test.mjs`



\## Acceptance

\- `npm run lint` passes

\- `npm test` passes

\- CLI output shows Phase 6 exercises array populated when Phase 4 emits exercises



