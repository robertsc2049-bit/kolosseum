# FOUNDER DEMO PATH

Document ID: founder_demo_path_contract  
Version: 1.0.0  
Status: Authoritative for demo contract only  
Rewrite Policy: Rewrite-only  
Scope Class: Closed-world  
Engine Compatibility: EB2-1.0.0

## Purpose

This document defines one canonical founder demo flow for the active v0 product slice.

The founder demo path exists to prove there is one repeatable, bounded, founder-safe live path from lawful declaration to visible Phase 6 execution output.

This document does not activate new engine behaviour.
This document does not create proof-layer scope.
This document does not create organisation-managed runtime scope.

## Invariant

There is exactly one canonical founder demo path for the active v0 slice.

Given the same fixture inputs and the same declared return decision, the same visible checkpoint sequence must be produced every time.

## Boundary Lock

The founder demo path is locked to all of the following:

- actor_type = coach
- execution_scope = coach_managed
- activity_id = powerlifting
- runtime_shape = single_athlete
- active_phases = 1, 2, 3, 4, 5, 6 only

The following are forbidden in this demo path:

- Phase 7
- Phase 8
- evidence envelope
- export
- organisation-managed runtime
- team runtime
- unit runtime
- dashboards
- analytics
- rankings
- advisory copy

## Canonical Fixture

Fixture path:

- fixtures/founder_demo/founder_demo_v0.fixture.json

This fixture is the single source of truth for the demo path contract.

## Required Surfaces

The following surfaces are contract-bound and must exist:

- docs/demo/FOUNDER_DEMO_PATH.md
- fixtures/founder_demo/founder_demo_v0.fixture.json
- test/founder_demo_path_contract.test.mjs

Missing referenced surface = fail.

## Canonical Founder Demo Flow

1. Coach-owned founder demo fixture is loaded.
2. Phase 1 declaration is accepted.
3. Phase 2 canonical hash is produced.
4. Phase 3 legality boundary is applied.
5. Phase 4 program assembly completes.
6. Phase 5 substitution-adjustment surface resolves without leaving v0 scope.
7. Phase 6 session starts.
8. A split-session event occurs.
9. Return decision gate is shown.
10. Canonical founder decision is selected: Continue where I left off.
11. Session resumes.
12. Session reaches a visible completed execution state.
13. Coach can view the factual execution artefact.
14. Optional coach note is present as non-binding commentary only.

## Canonical Visible Checkpoints

The visible founder demo checkpoints are:

1. Declaration accepted
2. Canonical hash locked
3. Legal path confirmed
4. Session compiled
5. Session started
6. Split recorded
7. Return decision required
8. Continue where I left off selected
9. Session resumed
10. Session completed
11. Coach artefact visible
12. Coach note saved as non-binding

No extra visible checkpoint is part of the contract.
No omitted visible checkpoint is permitted.

## Canonical Return Decision

Only one founder demo return decision is canonical for this path:

- continue_where_i_left_off

This contract does not define a founder demo path for skip-and-move-on.

## Acceptance Conditions

The founder demo path contract passes only if all of the following are true:

- all required surfaces exist
- the fixture remains inside v0 boundary
- the fixture declares active phases 1-6 only
- the fixture forbids proof-layer and org-runtime surfaces
- the same input produces the same visible checkpoint sequence every time
- a missing required surface fails validation
- the expected visible path exactly matches the canonical sequence in the fixture

## Final Rule

If this founder demo path cannot be reproduced exactly from the canonical fixture and required surfaces, the founder demo path does not exist.