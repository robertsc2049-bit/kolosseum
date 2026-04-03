# P151 — Split/Return Demo Read Model Surface

Status: Proposed
Scope: v0 only
Mode: BUILD
Rewrite Policy: rewrite-only

## Target

Make split/return behaviour visible through one clean factual summary surface so a founder or operator can demo it without reading raw runtime event streams.

## Invariant

The demo path must read a deterministic summary surface rather than reconstructing behaviour from raw events.

The surfaced facts are limited to:

- split_entered
- split_return_decision
- execution_status
- partial completion facts
- completed or remaining counts
- dropped counts where lawfully present

No advisory, safety, recommendation, optimisation, or narrative language is permitted.

## Proof

One automated acceptance cluster must prove all of the following:

1. session-state read model remains the factual summary surface
2. split or return facts are surfaced through summary-oriented state, not only raw events
3. projection remains deterministic for identical inputs
4. partial outcome facts are visible without consuming event-stream detail directly
5. no advisory language appears in the read model or in the contract
6. no org, team, unit, dashboard, export, or proof-layer surfaces are required

## Explicit Exclusions

- raw event stream as required demo surface
- advisory copy
- recommendations
- readiness or scoring
- dashboards
- export
- org, team, unit, or gym reporting
- Phase 7 truth projection
- Phase 8 evidence sealing

## Completion Rule

This slice is complete only when split/return outcome facts can be shown from one deterministic factual summary surface without opening raw runtime events and without widening beyond the active v0 boundary.