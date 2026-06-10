# v1 Coach Session Decision Summary Projection Contract

Status: draft  
Owner: docs / lane 1 reporting  
Phase: v1  
Depends on:
- `docs/V1_PHASE_OBJECTIVE_AND_FIRST_LANES.md`
- `docs/V1_LANE1_REPORTING_READ_MODEL_TARGET.md`
- `docs/contracts/v1_coach_session_decision_summary_contract.md`

## Purpose

Freeze the first projection / read contract that turns closed v0 runtime truth into the coach-readable session decision summary surface.

This document does **not** define UI.
It defines the projection boundary, source truth, replay expectations, freshness rules, and failure/idempotency constraints for the first read-side implementation.

## Why this slice exists

The summary contract defines **what** a coach must be able to read.

The missing next step is to define **how runtime truth becomes that readable summary without ambiguity**.

Without this projection contract, different implementations could:
- read from different sources
- collapse ordering differently
- hide replay or correction behaviour
- disagree on freshness or staleness
- produce summaries that look similar but are not audit-safe

## Goal

Define the authoritative read/projection contract for the first coach session decision summary so implementation can begin without inventing semantics later.

## Non-goals

This slice does not:
- define final UI layout
- define dashboards beyond the single summary surface
- add new runtime truth fields
- change v0 engine/runtime semantics
- define export/reporting bundles beyond this summary projection
- introduce caching policy beyond what is needed to preserve contract truth

## Projection scope

The projection covers one coach-readable session decision summary for a single compiled / executed session lineage.

It must answer, at minimum:

1. what the engine decided
2. why it decided it
3. what source inputs materially drove the decision
4. whether the result is current, stale, superseded, or incomplete
5. whether the summary reflects replay-safe truth rather than guessed presentation state

## Source of truth

The projection must be derived from authoritative runtime truth only.

Allowed source classes:
- persisted compile/runtime decision records
- persisted terminal lifecycle state
- persisted lineage identifiers needed to resolve current/superseded truth
- persisted inputs that are explicitly part of the decision summary contract

Disallowed source classes:
- inferred UI-only state
- client-local temporary state
- presentation-layer defaults
- hand-built summary text not reproducible from stored truth

## Projection identity

The projection key must identify the decision summary unambiguously.

Minimum identity requirements:
- athlete or subject identity key
- session identity key
- compile/run identity key
- lineage/currentness marker where applicable
- terminal/superseded marker where applicable

If the projection cannot distinguish current vs superseded truth, it is invalid.

## Required invariants

### Invariant P1 - Truth derived only from authoritative persisted runtime state

Every rendered summary field must be reproducible from persisted runtime truth.

### Invariant P2 - Replay/order safe

The same authoritative truth must produce the same summary regardless of harmless read timing differences.

### Invariant P3 - Currentness is explicit

The projection must explicitly represent whether the summary is:
- current
- superseded
- terminal
- incomplete / unavailable

### Invariant P4 - No resurrection

A superseded or terminal-invalid summary must not silently reappear as current.

### Invariant P5 - Missing truth is visible

If required truth is absent, delayed, or inconsistent, the projection must expose that condition instead of inventing a clean summary.

## Minimum field groups

The projection must expose field groups for:

1. identity
   - session id
   - compile/run id
   - athlete/subject id
   - lineage/currentness markers

2. decision outcome
   - selected outcome / action
   - final decision class
   - resulting state marker

3. decision drivers
   - material constraints or facts that changed the outcome
   - ordered or prioritised reasons where required by the upstream contract

4. timeline / status
   - created / resolved / terminal timestamps where available
   - stale / current / superseded indicators

5. audit references
   - stable references back to authoritative runtime truth needed for audit or drill-down

## Ordering rules

If upstream truth has an authoritative order, the projection must preserve it.

If upstream truth does not guarantee order, the projection must:
- define a deterministic sort order
- apply it consistently
- document it explicitly

No consumer may assume accidental storage or transport order.

## Freshness / staleness contract

The projection must represent freshness explicitly.

Minimum states:
- current
- stale
- rebuilding
- unavailable

A consumer must never have to guess whether a summary is safe to trust.

## Update semantics

The projection may be rebuilt from source truth repeatedly.

Required behaviour:
- rebuilds are idempotent
- rebuilds do not create duplicate current summaries
- superseding truth replaces prior current truth deterministically
- partial rebuild failure does not mark bad data as current

## Failure semantics

If projection materialization fails, the system must prefer:
- visible incomplete/unavailable state
over
- silently wrong summary output

Wrong-but-polished is a contract failure.

## Read contract boundary

Consumers of this projection may:
- read a stable summary object
- inspect explicit freshness/currentness markers
- follow audit references to source truth

Consumers may not:
- infer missing business truth from absent optional fields
- treat stale data as current without checking markers
- reconstruct hidden decision semantics outside the projection contract

## Test implications

Implementation of this contract should be backed by tests that prove:

1. deterministic projection for same persisted truth
2. current vs superseded resolution is stable
3. terminal/no-resurrection rules hold
4. stale/incomplete states are explicit
5. projection output can be traced back to authoritative runtime truth

## Exit criteria for this slice

This slice is complete when:

1. the projection contract is frozen in docs
2. identity/currentness/freshness rules are explicit
3. source-of-truth boundary is explicit
4. idempotency/failure semantics are explicit
5. downstream implementation can proceed without inventing read semantics

## Next likely downstream slice

After this contract, the next most likely slice is one of:

1. the concrete summary object schema / example payload contract
2. the projection builder / query path contract
3. the first coach-facing read endpoint contract

That choice should only happen after this projection boundary is accepted.