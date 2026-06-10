\# TICKET 014 — Substitution scoring robustness (partial signatures + deterministic fallback)



\## Problem

Substitution unit tests and registry-backed substitution tests failed because candidate exercise signatures in fixtures/registries did not always include richer fields (e.g., stimulus/pattern/equipment metadata). That created tie/near-tie conditions where the scorer drifted to an undesired candidate (e.g., `push\_up`) despite bench-family variants being available.



\## Root Cause

Scoring relied too heavily on richer signature fields that were not guaranteed to be present in all candidates. When those fields were missing, the scorer’s ranking degraded and tie-breaking was not aligned with expected domain intent.



\## Decision

Introduce a robustness fallback in the substitution scoring layer:

\- Maintain safety and disqualification rules as first-order gates.

\- When richer fields are missing or insufficient to separate candidates, apply a deterministic fallback using exercise\_id token similarity / family matching (e.g., bench-family beats generic push patterns).

\- Enforce deterministic ordering/tie-breaks.



\## Non-negotiable invariants preserved

\- Safety filters remain dominant (avoid\_joint\_stress\_tags, banned\_equipment).

\- Determinism: same inputs → same pick.

\- Ticket 011 rule remains: if target is eligible under constraints, Phase 5 produces a no-op.



\## Scope of change

\- Updated substitution scoring to be robust to partial signatures and preserve expected winner ordering under ties.



\## Tests

\- Substitution scoring unit tests now pass (expected winners: incline bench, dumbbell bench, machine chest press).

\- T003 registry-backed substitution tests now pass.

\- E2E tests remain green and deterministic.



\## Outcome

Substitution selection matches expected intent under partial metadata while preserving safety-first filtering and determinism.



