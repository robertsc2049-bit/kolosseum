# DEMO FIXTURE PACK

Document ID: demo_fixture_pack_contract
Version: 1.0.0
Status: Authoritative for fixture-pack contract only
Rewrite Policy: Rewrite-only
Scope Class: Closed-world
Engine Compatibility: EB2-1.0.0

## Purpose

This document defines the minimal v0 demo fixture pack.

The pack exists to ensure every v0-supported activity has one explicit known-good demo fixture entry.

This document does not create new engine behaviour.
This document does not widen v0 scope.
This document does not activate Phase 7 or Phase 8.

## Invariant

Every v0-supported activity has exactly one canonical fixture in the demo fixture pack.

The pack is closed to:
- powerlifting
- rugby_union
- general_strength

No unsupported activity may enter the pack.

## Boundary Lock

The demo fixture pack is locked to all of the following:

- engine_compatibility = EB2-1.0.0
- release_scope = v0
- active_phases = 1, 2, 3, 4, 5, 6 only
- actor_type in current pack = athlete
- execution_scope in current pack = individual

The following are forbidden in this pack:

- phase7
- phase8
- evidence_envelope
- export
- org_managed
- unit_managed
- state_managed
- dashboards
- analytics
- rankings
- unsupported_activity_id

## Canonical Registry

Registry path:
- fixtures/demo_pack/DEMO_FIXTURE_PACK_REGISTRY.json

This registry is the single source of truth for fixture-pack membership.

## Canonical Members

The pack contains exactly these three fixtures:

- fixtures/demo_pack/powerlifting.demo.fixture.json
- fixtures/demo_pack/rugby_union.demo.fixture.json
- fixtures/demo_pack/general_strength.demo.fixture.json

No additional member is permitted.

## Contract Requirements

The fixture pack passes only if all of the following are true:

- the registry exists
- exactly three members exist
- each member activity_id is unique
- each member activity_id is in the v0 locked set
- no unsupported activity appears in the registry
- each referenced fixture file exists
- each fixture declares release_scope = v0
- each fixture declares active_phases = [1,2,3,4,5,6]

## Proof Boundary

This slice proves pack closure, explicit membership, and v0 activity coverage.

It does not by itself prove real engine compile/execute.

Real compile/execute proof requires binding these fixtures to an existing repo compile/runtime entrypoint.

## Final Rule

If a fixture is not explicitly listed in the registry, it is not in the pack.
If an activity is outside the v0 locked set, it must not enter the pack.