<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-25 registry content production system and points to executable proof. It is not registry content and must not be used as active registry rows. -->

# S-V1-25 - Registry Content Production System

## Status

Accepted as a v1 registry content-control slice.

## Purpose

S-V1-25 creates the controlled system for adding v1 registry content without source or IP contamination.

Content must be original or licensed.

Source status and manual review must be recorded.

No exact famous-coach programme copying is permitted.

No high-volume registry content is added by this slice.

## Boundary

This slice may add or update:

- docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md
- ci/fixtures/v1_registry_content_production_system_negative/s_v1_25_exact_famous_coach_copy_negative.json
- test/s_v1_25_registry_content_production_system.test.mjs
- ci/guards/s_v1_25_registry_content_production_system_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md
- ci/guards/v1_registry_content_production_contract_guard.mjs
- existing v1 registry contract docs from S-V1-21 to S-V1-24

This slice must not add:

- high-volume registry content
- active exercise registry rows
- active equipment registry rows
- active applicability registry rows
- active substitution edges
- active programme templates
- active source-control registry rows
- copied famous-coach programmes
- copied named-coach methods
- protected formulas
- hidden progression logic
- attribution to named coaches unless explicitly licensed
- UI screens
- database migrations
- billing behaviour
- organisations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, or gym access surfaces
- engine behaviour changes
- package version changes
- release tags

## Source-control register pattern

Every future active registry candidate must have exactly one matching source-control register entry.

Required source-control register fields:

- source_record_id
- slice_id
- registry_domain_id
- candidate_record_id
- candidate_record_type
- content_execution_status
- source_status
- source_type
- source_reference
- source_visibility
- licence_status
- commercial_use_status
- attribution_status
- exact_copy_risk_status
- famous_coach_reference_status
- derivative_risk_status
- formula_visibility_status
- manual_review_status
- legal_review_status
- reviewer_role
- reviewed_at
- decision
- decision_notes
- evidence_paths
- copy_boundary_flags

## Registry domains covered

The production system applies to:

- activity_registry
- movement_pattern_registry
- exercise_registry
- equipment_registry
- exercise_activity_applicability_registry
- exercise_equipment_compatibility_registry
- substitution_edge_registry
- programme_template_registry
- instruction_display_copy_registry
- copy_legal_claim_boundary_registry

## Source status values

Allowed source_status values:

- founder_original
- original_equivalent
- licensed_source
- canonical_project_document
- public_rule_or_standard
- implementation_fixture
- unlicensed_named_coach_source

Unlicensed named-coach sources must be blocked.

## Licence status values

Allowed licence_status values:

- not_required_original
- licensed
- public_domain_or_open_standard
- project_owned
- not_licensed

Active registry candidate or accepted content requires one of:

- not_required_original
- licensed
- public_domain_or_open_standard
- project_owned

## Commercial use status values

Allowed commercial_use_status values:

- permitted
- not_permitted
- review_required

Active registry candidate or accepted content requires:

- permitted

Unlicensed source material cannot be marked commercial-use permitted.

## Exact-copy risk values

Allowed exact_copy_risk_status values:

- none
- low_rewritten_original
- review_required
- exact_copy

exact_copy must be blocked.

## Famous-coach reference values

Allowed famous_coach_reference_status values:

- none
- generic_principle_only
- named_reference_review_required
- named_famous_coach_reference

named_famous_coach_reference must be blocked unless a future licensing slice explicitly changes the rule.

## Derivative risk values

Allowed derivative_risk_status values:

- none
- low_original_equivalent
- review_required
- near_copy

near_copy must be blocked unless a future licensing slice explicitly changes the rule.

## Formula visibility values

Allowed formula_visibility_status values:

- no_formula_present
- protected_formula_not_visible
- protected_formula_visible

protected formulas must not be visible.

protected_formula_visible must be blocked.

## Manual review values

Allowed manual_review_status values:

- not_reviewed
- reviewed
- approved
- blocked

Active registry candidate or accepted content requires:

- approved manual_review_status
- reviewer_role
- reviewed_at

## Legal review values

Allowed legal_review_status values:

- not_required_original
- not_reviewed
- reviewed
- approved
- blocked

Active registry candidate or accepted content requires either:

- not_required_original
- approved

## Decision values

Allowed decision values:

- draft_only
- approved_for_active_registry_candidate
- approved_for_active_registry_accepted
- blocked

Blocked source states must not be promoted to active content.

## Review checklist

Before any future registry content can be promoted to active registry candidate or active registry accepted, the reviewer must confirm:

1. The content is founder_original, original_equivalent, licensed_source, canonical_project_document, public_rule_or_standard, or implementation_fixture.
2. The source-control register entry exists.
3. The source-control register entry is complete.
4. The candidate record has exactly one matching source-control register entry.
5. The source_reference is recorded without exposing protected formulas.
6. The licence_status permits the intended use or is not required because the work is original.
7. The commercial_use_status is permitted.
8. The manual_review_status is approved.
9. The reviewer_role is recorded.
10. The reviewed_at timestamp is recorded.
11. The legal_review_status is approved or not_required_original.
12. exact_copy_risk_status is not exact_copy.
13. famous_coach_reference_status is not named_famous_coach_reference.
14. derivative_risk_status is not near_copy.
15. formula_visibility_status is not protected_formula_visible.
16. attribution_status does not imply named-coach endorsement.
17. copy_boundary_flags include no_famous_coach_copy or equivalent.
18. evidence_paths point only to reviewable project-controlled files.
19. candidate_record_id matches the source-control register entry.
20. registry_domain_id matches the source-control register entry.

## Famous-coach copying rule

No exact famous-coach programme copying.

No exact famous-coach program copying.

No public attribution such as named-coach style, named-coach method, official, or inspired-by wording is permitted unless a future licensing slice explicitly records permission.

No protected formula visibility is permitted.

No athlete, coach, organisation, or marketplace surface may expose protected formulas or progression logic.

## Negative fixture

The negative fixture is:

- ci/fixtures/v1_registry_content_production_system_negative/s_v1_25_exact_famous_coach_copy_negative.json

The fixture intentionally marks a candidate as:

- source_status: unlicensed_named_coach_source
- licence_status: not_licensed
- commercial_use_status: not_permitted
- exact_copy_risk_status: exact_copy
- famous_coach_reference_status: named_famous_coach_reference
- derivative_risk_status: near_copy
- manual_review_status: not_reviewed
- legal_review_status: not_reviewed
- decision: blocked

The expected failure code is:

- v1_registry_content_production_system_exact_famous_coach_copy_refused

## Required proof

The required proof is:

- node --test test/s_v1_25_registry_content_production_system.test.mjs
- node ci/guards/s_v1_25_registry_content_production_system_guard.mjs
- node ci/guards/v1_registry_content_production_contract_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/guards/no_bom_guard.mjs
- node ci/guards/no_crlf_guard.mjs
- node ci/guards/no_mojibake_guard.mjs
- node ci/guards/ascii_only_ci_guards_guard.mjs
- npm.cmd run lint:fast

## Acceptance criteria

S-V1-25 is accepted when:

- the v1 production system doc exists
- the negative exact famous-coach copy fixture exists
- the S-V1-25 test exists and passes
- the S-V1-25 guard exists and passes
- the guard emits CI_V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM
- the failure-token index includes CI_V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- source-control register fields are locked
- source status is recorded
- licence status is recorded
- commercial-use status is recorded
- manual review status is recorded
- legal review status is recorded
- no exact famous-coach copying is accepted
- protected formula visibility is refused
- unlicensed commercial use is refused
- active registry candidates require approved manual review
- active registry candidates require legal approval or original-source exemption
- active registry candidates require permitted commercial use
- no high-volume registry content is added
- no active registry rows are added
- no package version is changed
- no release tag is created

## Guard anchor phrases

- source-control register pattern
- review checklist
