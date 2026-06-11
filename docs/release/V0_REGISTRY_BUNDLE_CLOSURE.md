# V0 Registry Bundle Closure

v0_scope_guard: boundary_doc

Status: active v0 release record.
Slice: S-V0-10 Registry Bundle Closure.

## DEV NOTE: purpose

This record documents S-V0-10. The slice proves that active v0 registry bundles are present, schema-valid, generated from the active registry index, and closed under required foreign keys.

This slice does not add registry content, new activities, future-scope registry domains, scoring behaviour, product UI, or v1 expansion.

## Inspected implementation seam

- ci/guards/registry_schema_presence_guard.mjs
- ci/guards/registry_bundle_guard.mjs
- ci/guards/registry_law_guard.mjs
- scripts/bundle_writer.cjs
- test_support/registry_law_guard_harness.mjs
- registries/registry_index.json
- registries/registry_bundle.json
- registries/activity/activity.registry.json
- registries/movement/movement.registry.json
- registries/exercise/exercise.registry.json
- registries/program/program.registry.json

## Active v0 registry domains

The active v0 registry index order is locked to:

- activity
- movement
- exercise
- program

The generated registry bundle must contain exactly those domains. Registry files and schema files must exist for every active index entry.

## Locked behaviour

S-V0-10 proves:

- registry_index.order is the active bundle source
- active registry files are present
- matching active schema files are present
- registry_bundle.json matches generated output
- exercise.pattern resolves to movement registry IDs
- exercise.stimulus_intent resolves to activity stimulus_intents
- movement-scoped equipment and joint tag references remain closed by registry law
- active v0 activity registry IDs and program registry IDs resolve back to the v0 activity set
- missing active registry index entries fail through schema and bundle guards
- broken exercise FK targets, including movement pattern and activity stimulus references, fail through registry law guard
- registry schema presence, bundle, and law guards are wired into lint:fast

## Completion condition

S-V0-10 is complete only when:

- registry bundle scripts and fixtures are located
- schema presence guard passes
- registry bundle guard passes
- registry law guard passes
- missing registry entry and broken FK reference tests pass
- registry law is enforced in CI
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
