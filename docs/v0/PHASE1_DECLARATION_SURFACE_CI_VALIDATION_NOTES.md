<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# Phase 1 Declaration Surface CI Validation Notes

Document ID: phase1_declaration_surface_ci_validation_notes  
Version: 1.0.0  
Status: authoritative  
Scope class: closed_world  

## 1. Purpose

This document defines CI validation requirements for the active v0 Phase 1 declaration surface.

CI must prove that:

- schema and markdown contract align
- unknown fields fail
- missing required fields fail
- explicit null fails
- undeclared fields fail
- defaulted values do not enter Phase 1
- inferred values do not enter Phase 1
- hidden UI engine fields do not enter Phase 1
- Class A and Class B fields are hash-affecting
- Class C fields are engine-inert
- active v0 actor, scope, and activity values align with S26

## 2. Required CI checks

### 2.1 Schema validity check

Validate phase1_declaration_surface.schema.json as JSON.

Failure token:

- PHASE1_SCHEMA_JSON_INVALID

### 2.2 Schema closure check

Validate that additionalProperties: false exists on:

- root payload
- baseline metric items
- personal kit object
- capability constraint items
- UI preferences object

Failure token:

- PHASE1_SCHEMA_NOT_CLOSED

### 2.3 Contract/schema field alignment check

Extract all field IDs from:

- PHASE1_DECLARATION_SURFACE_CONTRACT.md
- phase1_declaration_surface.schema.json

CI must fail if the markdown contract lists a field not represented in schema.

CI must fail if the schema accepts a field not represented in markdown.

Failure token:

- PHASE1_CONTRACT_SCHEMA_MISMATCH

### 2.4 Required field check

CI must validate that every required field in the markdown field register appears in the schema required arrays.

Failure token:

- PHASE1_REQUIRED_FIELD_MISMATCH

### 2.5 Negative fixture check

CI must load phase1_declaration_surface_negative_tests.json.

CI must verify:

- the valid control payload passes
- every expected negative case fails
- every expected failure maps to a known failure token or JSON schema keyword

Failure token:

- PHASE1_NEGATIVE_FIXTURE_FAILED

### 2.6 S26 active scope alignment

CI must load V0_ACTIVE_SCOPE_MANIFEST.json.

CI must verify:

- schema actor_type enum equals S26 allowed_actor_types
- schema execution_scope enum equals S26 allowed_execution_scopes
- schema activity_id enum equals S26 allowed_activities

Failure token:

- PHASE1_S26_SCOPE_MISMATCH

### 2.7 Null rejection check

CI must mutate each accepted field to null and prove validation fails.

Failure token:

- PHASE1_NULL_ACCEPTED

### 2.8 Unknown field rejection check

CI must add unknown fields at every object level and prove validation fails.

Failure token:

- PHASE1_UNKNOWN_FIELD_ACCEPTED

### 2.9 Defaulted value rejection check

CI must prove that UI defaults are not inserted into the Phase 1 payload unless explicitly selected or declared.

Failure token:

- DEFAULTED_VALUE_ENTERED_PHASE1

### 2.10 Hidden field rejection check

CI must inspect UI submit payloads and prove no hidden engine fields are submitted.

Failure token:

- HIDDEN_ENGINE_FIELD_ENTERED_PHASE1

### 2.11 Hash inclusion check

CI must compute canonical Phase 1 hash over Class A and Class B fields.

Changing any Class A field must change the hash.

Changing any Class B field must change the hash.

Failure tokens:

- CLASS_A_HASH_MISSING
- CLASS_B_HASH_MISSING

### 2.12 Class C inertness check

CI must mutate only Class C fields and prove:

- engine materialisation output does not change
- legal admission result does not change, except schema validity
- runtime truth does not change
- selection does not change
- substitution does not change
- progression does not change

Failure token:

- CLASS_C_ENGINE_OUTPUT_LEAK

### 2.13 Registry reference check

CI must verify that registry-backed IDs resolve through active v0 registries.

Registry-backed fields:

- equipment_profile_id
- sport_role_id when present
- variant_id when present
- baseline_metrics[].metric_id when present
- baseline_metrics[].linked_exercise_token_id when present
- personal_kit.owned_item_ids[]
- personal_kit.present_item_ids[]
- capability_constraints[].target_token_id when present

Failure token:

- PHASE1_REGISTRY_REFERENCE_INVALID

### 2.14 Baseline metric legality check

CI must verify that each baseline metric:

- uses a known metric_id
- declares an activity_id matching top-level activity_id
- conforms to the metric value schema
- uses a valid linked exercise token if present
- uses a lawful metric-exercise link if linked_exercise_token_id is present
- does not include notes, estimates, derived values, or undeclared fields

Failure tokens:

- PHASE1_METRIC_UNKNOWN
- PHASE1_METRIC_ACTIVITY_MISMATCH
- PHASE1_METRIC_VALUE_INVALID
- PHASE1_METRIC_EXERCISE_LINK_INVALID
- PHASE1_METRIC_UNDECLARED_FIELD

### 2.15 Personal kit legality check

CI must verify:

- every owned item exists
- every present item exists
- every present item is also owned

Failure tokens:

- PHASE1_PERSONAL_KIT_UNKNOWN_ITEM
- PHASE1_PERSONAL_KIT_PRESENT_NOT_OWNED

## 3. Validation order

CI should run checks in this order:

1. JSON validity
2. Schema validity
3. S26 scope alignment
4. Contract/schema alignment
5. Negative fixture validation
6. Registry reference validation
7. Hash inclusion validation
8. Class C inertness validation
9. UI payload validation

## 4. UI validation rule

The UI must submit only declared fields.

The UI must not submit:

- hidden engine fields
- empty hidden fields
- defaults as declarations
- undeclared fields
- nulls
- free text
- prohibited fields

## 5. Failure rule

CI must hard fail on any violation.

No warnings.

No soft fail.

No automatic correction.

No default injection.

## 6. Final rule

The accepted Phase 1 payload is valid only if it is explicit, closed-world, version-pinned, schema-valid, S26-aligned, hashable, and free of undeclared values.
