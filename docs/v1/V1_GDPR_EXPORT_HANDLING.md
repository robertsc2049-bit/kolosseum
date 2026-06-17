# S-V1-L-02 GDPR Export Handling

## Purpose

S-V1-L-02 implements GDPR export handling as a legal data access surface for controlled v1.

The surface prepares a deterministic JSON export for the requesting user's own data only.

## Boundary

Included:

- GDPR export request contract.
- Own-user permission check.
- Closed export envelope.
- Deterministic JSON serialisation.
- Neutral copy IDs.
- API adapter.
- Tests and CI guard.

Not included:

- proof-layer export.
- evidence envelope export.
- organisation export.
- analytics export.
- deletion-request handling.
- provider calls.
- engine mutation.

## Invariants

- GDPR export is legal data access only.
- Export is permission-scoped to the requesting user's own data.
- Export does not alter deterministic engine truth.
- Export does not create coaching, training-value, approval, or external attestation claims.
- Export does not include CI artefacts or sealed evidence artefacts.
- Export is not a broad data warehouse or organisation reporting surface.

## Export shape

The export contains:

- request metadata.
- permission boundary.
- export boundary flags.
- included category counts.
- subject data grouped by declared category.
- deterministic probe hash where supplied.
- export payload hash.
- copy IDs.

Allowed data categories:

- account.
- phase1_declarations.
- relationships.
- programme_assignments.
- session_records.
- runtime_events.
- coach_notes_authored.
- legal_document_acknowledgements.
- billing_records.

## Permission model

The only active permission model in this slice is own-user access.

A request is blocked if:

- actor_user_id differs from target_user_id.
- requested export type is not subject_data_access_json.
- actor_type is not athlete or coach.
- input includes an unknown top-level key.
- data_sources includes an unknown category.
- exported records declare another owner user.
- blocked proof, evidence, organisation, or analytics keys appear.

## Engine boundary

The implementation does not import engine code.

The deterministic probe is hashed only to prove pass-through invariance.

The export surface returns:

- engine_visible: false.
- engine_truth_changed: false.

## Standard proof sequence

Target proof:

- node --test test/s_v1_l_02_gdpr_export_handling.test.mjs
- node ci/guards/s_v1_l_02_gdpr_export_handling_guard.mjs

Generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/scripts/sha256_guard.mjs

Full proof:

- npm run lint:fast