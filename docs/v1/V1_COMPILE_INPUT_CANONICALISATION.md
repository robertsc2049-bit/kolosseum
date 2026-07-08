<!-- DEV NOTE: V1 compile input canonicalisation contract. This document records the S-V1-30 boundary for canonical v1 compile input projection and hash proof. It must not add billing, notes, UI, copy, auth, relationship, dashboard, database, route, proof, registry-content, or engine phase behaviour. -->

# S-V1-30 - v1 Compile Input Canonicalisation

## Status

Accepted as a v1 compile-input contract implementation slice.

## Purpose

S-V1-30 defines the v1 compile input canonicalisation boundary.

Engine input canonicalisation is stable.

Non-engine fields are rejected.

Hashes are reproducible.

Engine-visible fields are explicit.

## Boundary

This slice may add:

- docs/v1/V1_COMPILE_INPUT_CANONICALISATION.md
- src/v1CompileInputCanonicalisation.mjs
- ci/fixtures/v1_compile_input_canonicalisation/s_v1_30_compile_input_cases.json
- ci/fixtures/v1_compile_input_canonicalisation_negative/s_v1_30_unknown_field_negative.json
- test/s_v1_30_compile_input_canonicalisation.test.mjs
- ci/guards/s_v1_30_compile_input_canonicalisation_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- S-V1-18 declaration compile gate
- S-V1-28 programme assignment contract
- S-V1-29 assignment visibility
- docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md
- docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md

This slice must not add:

- real /blocks/compile route mutation
- engine phase rewrites
- database persistence
- billing
- payment
- coach notes
- UI state
- copy as engine input
- relationship state as engine input
- auth state as engine input
- broad dashboards
- team dashboards
- organisation dashboards
- organization dashboards
- marketplace scope
- proof implementation
- registry content rows
- release tags
- package version changes

## Compile input rule

A v1 compile input candidate must be a closed object.

The accepted root keys are:

- accepted_declaration
- activity_id
- engine_visible_fields
- programme_assignment
- programme_template
- registry_bundle

Unknown root fields fail closed.

Unknown nested fields fail closed.

Forbidden non-engine fields fail closed.

## Explicit engine-visible fields

The canonical compile input contains only these engine-visible fields:

- activity_id
- compile_input_status
- compile_input_version
- engine_visible_fields
- phase1_declaration_payload
- phase1_declaration_payload_sha256
- programme_assignment_hash
- programme_assignment_id
- registry_bundle_hash
- registry_bundle_version
- template_contract_version
- template_coverage_contract_version
- template_id
- template_registry_version

The candidate input must provide this field list explicitly.

The canonical output sorts this field list before hashing.

## Rejected non-engine fields

The following categories must not enter compile input:

- billing
- payment
- subscription
- coach notes
- UI state
- presentation state
- copy ids or copy acknowledgements
- auth state
- account state
- relationship state
- coach identity
- athlete identity
- marketplace state
- commercial state
- support state

These records may exist elsewhere in the product where scoped, but they must not become deterministic engine input, canonical hashes, replay truth, proof truth, registry authority, or deterministic output.

## Canonical JSON rule

Canonical JSON uses:

- stable sorted object keys
- UTF-8 string hashing
- SHA256
- explicit closed fields only

Equivalent object key orderings must produce:

- identical canonical_json
- identical canonical_hash

Unsupported values fail closed.

Non-finite numbers fail closed.

## Hash rule

The canonical hash is:

- sha256(canonical_json)

The hash metadata is:

- algorithm = sha256
- canonical_json = stable_sorted_keys
- hash_field = canonical_hash

## Relationship to S-V1-18

S-V1-18 admits only a current valid accepted declaration to compile.

S-V1-30 does not replace S-V1-18.

S-V1-30 projects the already accepted declaration payload into canonical compile input.

S-V1-30 does not validate legal consent beyond the accepted declaration field projection.

## Relationship to S-V1-28

S-V1-28 creates programme assignment product/auth state.

S-V1-30 does not create assignments.

S-V1-30 projects only assignment id and assignment hash into canonical compile input.

Coach id, athlete id, relationship id, and assignment visibility records must not enter canonical compile input.

## Relationship to S-V1-29

S-V1-29 controls assignment visibility.

S-V1-30 does not use visibility state as compile input.

Visibility state does not alter compile input hashes.

## Failure token

Stable guard token:

- CI_V1_COMPILE_INPUT_CANONICALISATION

Stable failure code:

- v1_compile_input_canonicalisation_failure

Stable copy id:

- V1_COMPILE_INPUT_CANONICALISATION_REJECTED

## Proof

Executable proof:

- node --test test/s_v1_30_compile_input_canonicalisation.test.mjs
- node ci/guards/s_v1_30_compile_input_canonicalisation_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- npm run lint:fast
- npm run test:full

## Final rule

If two semantically identical v1 compile input candidates differ only by object key order or engine_visible_fields array order, they must produce the same canonical JSON and hash.

If billing, coach notes, UI state, copy, relationship state, auth state, account state, marketplace state, commercial state, coach identity, or athlete identity can alter canonical compile input or hash, this slice is invalid.
