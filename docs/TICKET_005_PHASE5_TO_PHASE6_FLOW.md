\# TICKET 005 — PHASE 5 → PHASE 6 FLOW (minimal wiring + determinism)



\## Goal

Ensure Phase 6 consumes the Phase 4 program (and Phase 5 adjustments where applicable) using a stable, explicit flow, and produce a session output that reflects substitutions deterministically.



\## Why this exists

Right now, we can:

\- emit a registry-backed `program.exercises\[]` (Phase 4)

\- produce a substitution adjustment (Phase 5)

\- map program exercises into session exercises (Phase 6)



But we must define the canonical wiring:

\- What does Phase 5 output mean?

\- How does Phase 6 apply it?

\- What is “applied” vs “no-op”?

\- How do we ensure deterministic results?



\## Definitions

\### Program (v0 minimal shape)

A “substitutable program shape” exists when:

\- `program.exercises` is an array

\- each entry includes `exercise\_id`

\- and may include other signature fields used for substitution



\### Phase 5 Adjustment (v0)

Adjustment object:

\- `adjustment\_id: "SUBSTITUTE\_EXERCISE"`

\- `applied: boolean`

\- `reason: "substitution\_engine\_pick" | ...`

\- `details` includes:

&nbsp; - `target\_exercise\_id`

&nbsp; - `substitute\_exercise\_id`

&nbsp; - `score`

&nbsp; - `reasons\[]`



\## Phase 5 → Phase 6 application rules (v0)

Phase 6 must:

1\) Start from Phase 4 program exercises in order

2\) Apply Phase 5 substitutions if present:

&nbsp;  - For each `SUBSTITUTE\_EXERCISE` with `applied: true`

&nbsp;    - replace the first matching `exercise\_id === target\_exercise\_id` with `substitute\_exercise\_id`

&nbsp;    - preserve position (do not reorder)

3\) Emit the final `session.exercises\[]` based on the post-adjustment program list



If Phase 5 adjustments are absent or not applicable:

\- Phase 6 mapping falls back to Ticket 004 behavior.



\## Conflict handling (deterministic)

If multiple substitutions target the same exercise:

\- Apply in list order of `adjustments\[]` (stable)

\- Each substitution operates on the current program state (sequential)



If target is not found:

\- Ignore the adjustment (no crash), emit a note.



\## Determinism requirements

\- No randomness.

\- Apply adjustments in a stable order.

\- Replace-first-match only (stable and minimal).



\## Tests (must exist)

\- Given a program with `bench\_press` and Phase 5 adjustment substituting it:

&nbsp; - Phase 6 output must contain the substitute id, in the same position.

\- Given no adjustments:

&nbsp; - Phase 6 output equals direct mapping.



\## Files touched (expected)

\- `engine/src/phases/phase6.ts`

\- possibly a small helper (optional): `engine/src/adjustments/applyAdjustments.ts`

\- tests:

&nbsp; - `test/phase6.test.mjs` (expanded)



\## Acceptance

\- `npm run lint` passes

\- `npm test` passes

\- CLI run (powerlifting) shows Phase 5 substitution and Phase 6 session reflecting the substituted exercise id



