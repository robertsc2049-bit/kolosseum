# V1 Declaration Error UX Contract

Document ID: v1_declaration_error_ux_contract
Status: Draft for enforcement
Scope: active v0 declaration and onboarding error surfaces only
Audience: Product / UI / API / CI / review

## Purpose

Define the exact v0 rendering contract for legal refusal and declaration-related technical failure without advisory language.

## Invariant

- legal refusal stays legal refusal
- technical failure stays technical failure
- rendering is token-driven and copy-registry-backed
- no advisory, coaching, safety, or benefit language is permitted

## Legal refusal surface

Pinned output:
- `Execution not permitted.`

No additional reason, advice, warning, or benefit framing is permitted on the legal refusal surface.

## Technical declaration failure surface

Pinned rendering domain:
- unknown_field
- missing_required_field
- type_mismatch
- invalid_format
- unknown_enum_value
- explicit_null_law_violated
- consent_not_granted
- version_mismatch
- invalid_actor_type
- missing_governing_authority
- invalid_activity_id
- missing_sport_role
- invalid_sport_role
- role_generalisation_violation
- invalid_location_type
- invalid_equipment_profile
- invalid_presentation_flag
- invalid_movement_blacklist
- role_goal_without_role
- forbidden_primary_goal
- missing_record_target

## Prohibited wording

- safe / safer / safety
- suitable / appropriate / right for you
- recommend / best / ideal
- improve / optimize / fix / correct
- protect / prevent / recover / rehab
- readiness / fatigue / performance / adherence
- you should / try again with / we suggest

## Final rule

If declaration error rendering implies advice, benefit, safety, or coaching meaning beyond the legal refusal string or the pinned technical token mapping, the error UX surface has drifted.