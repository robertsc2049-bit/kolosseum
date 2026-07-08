# V0 Phase 1 Input Schema Closure

Status: active v0 release record.
Slice: S-V0-05 Phase 1 Input Schema Closure.

## DEV NOTE: purpose

This record documents S-V0-05. The slice closes Phase 1 input schema handling around explicit validation only.

Phase 1 validates declared input. It does not infer missing intent, repair invalid shape, default hidden values, or allow soft-warning pass-through.

## Inspected canonical files

- docs/v0/phase1_declaration_surface.schema.json
- docs/v0/PHASE1_DECLARATION_SURFACE_CONTRACT.md
- docs/v0/PHASE1_DECLARATION_SURFACE_CI_VALIDATION_NOTES.md
- docs/v0/phase1_declaration_surface_negative_tests.json
- ci/scripts/run_phase1_declaration_surface_negative_tests.mjs
- ci/scripts/run_phase1_acceptance_record_tests.mjs
- ci/schemas/phase1.input.schema.v1.0.0.json
- ci/scripts/schema_guard.mjs

## Boundary invariant

Phase 1 is the only lawful v0 engine entry point.

The accepted Phase 1 declaration payload must be closed-world:

- unknown top-level fields fail
- unknown nested fields fail
- missing required fields fail
- invalid enum values fail
- invalid registry/reference shape fails
- v1-only active fields must not enter the accepted v0 payload
- inert UI preference fields remain schema-controlled and engine-invisible

## Failure behaviour

The existing Phase 1 declaration negative-test runner is the execution authority for this slice. It must fail closed using stable failure tokens or JSON-schema keywords.

This slice must not create a duplicate Phase 1 guard. It strengthens the existing schema/test surface and keeps S-V0-05 bound to the current repo structure.

## Completion condition

S-V0-05 is complete only when:

- the Phase 1 declaration schema is closed at object levels
- required Phase 1 fields are schema-controlled
- negative tests cover unknown and missing field behaviour
- Phase 1 acceptance record tests pass
- Phase 1 declaration negative tests pass
- schema guard passes
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
