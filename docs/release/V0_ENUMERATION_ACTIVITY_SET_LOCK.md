# V0 Enumeration and Activity Set Lock

v0_scope_guard: boundary_doc

Status: active v0 release record.
Slice: S-V0-07 V0 Enumeration and Activity Set Lock.

## DEV NOTE: purpose

This record documents S-V0-07. The slice locks the active v0 enumeration and activity boundary so future sport or activity drift cannot enter through schema, manifest, test, registry, or bundle surfaces.

This slice does not add new activity support, new sport support, registry content, programme templates, product UI, or v1 expansion.

## Inspected canonical files

- docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json
- docs/v0/V0_ACTIVE_SCOPE_MANIFEST.md
- docs/v0/V0_ACTIVE_SCOPE_NEGATIVE_TESTS.json
- ci/scripts/run_v0_active_scope_guard.mjs
- ci/scripts/run_v0_active_scope_negative_tests.mjs
- docs/v0/phase1_declaration_surface.schema.json
- test/phase1_v0_truth_surface_drift_guard.test.mjs
- registries/activity/activity.registry.json
- registries/program/program.registry.json
- registries/registry_bundle.json

## Locked v0 enumeration boundary

Active v0 actor types:

- individual_user
- coach

Active v0 execution scopes:

- individual
- coach_managed

Active v0 activities:

- powerlifting
- rugby_union
- general_strength

No other actor type, execution scope, sport, or activity is active in v0.

## Rejected-value proof

S-V0-07 adds rejected-value fixtures for unsupported activity values that must not enter active v0:

- strongman
- bodybuilding
- combat_sports
- tactical
- weightlifting
- football_soccer

Unsupported values must fail predictably through the existing active scope negative test system or the S-V0-07 executable lock test. They must not be silently accepted, converted, aliased, defaulted, or treated as future support.

## Registry/domain invariant

The activity registry, program registry, and registry bundle must not contain active activity references outside:

- powerlifting
- rugby_union
- general_strength

Future roadmap documents may describe later activity expansion only as inactive future scope. They must not alter the active v0 manifest, Phase 1 schema, registry bundle, activity registry, program registry, or executable v0 tests.

## Completion condition

S-V0-07 is complete only when:

- active v0 enumeration files are located
- allowed values match the v0 release boundary
- unsupported activity values are covered by rejected-value tests
- registry/domain references do not exceed the active v0 activity boundary
- active scope guard passes
- active scope negative tests pass
- S-V0-07 executable lock test passes
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
