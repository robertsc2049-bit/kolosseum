# Phase 1 Declaration Surface Contract

Document ID: phase1_declaration_surface_contract  
Version: 1.0.0  
Status: authoritative  
Scope class: closed_world  
Rewrite policy: rewrite_only  
Release: Kolosseum v0 Deterministic Execution Alpha  
Engine compatibility: EB2-1.0.0  
Enum bundle compatibility: EB2-1.0.0  
S26 dependency: V0_ACTIVE_SCOPE_MANIFEST.json  

## 1. Purpose

This contract defines the only Phase 1 declaration surface active in Kolosseum v0.

Phase 1 is the only lawful engine entry point.

The Phase 1 declaration surface may collect or include only the fields listed in this contract.

Unknown fields fail.

Missing required fields fail.

Explicit null fails unless the field explicitly permits null. This contract permits no null values.

No inferred value, defaulted value, corrected value, hidden extra engine field, or undeclared value may enter the accepted Phase 1 declaration payload.

## 2. Authority

This contract is subordinate to:

1. Canonical Legal Master
2. Core Engine, Governance & Execution Law
3. Phase 1 Input Declaration & Consent Gate
4. S26 v0 Active Scope Manifest

If this contract conflicts with S26, S26 controls v0 active scope.

If this contract conflicts with Phase 1 law, Phase 1 law controls engine entry legality.

## 3. Active v0 limits

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

Active v0 phases:

- phase_1
- phase_2
- phase_3
- phase_4
- phase_5
- phase_6

No other actor, execution scope, activity, or phase is active in v0.

## 4. Field classes

Each Phase 1 declaration surface field belongs to exactly one class.

### Class A — Legal or admission prerequisite

Class A fields decide whether the declaration may be accepted.

Class A fields are hash-affecting.

Class A fields are not materialisation instructions.

### Class B — Engine entry input

Class B fields are engine-visible.

Class B fields are hash-affecting.

Class B fields may affect lawful materialisation only by being explicit declared inputs.

### Class C — Inert presentation declaration

Class C fields are not engine-visible.

Class C fields are not hash-affecting.

Class C fields must not affect engine output, legality, selection, substitution, progression, or runtime truth.

If engine output changes when only Class C fields change, CI must fail.

## 5. Declaration payload closure

The accepted declaration payload must conform exactly to phase1_declaration_surface.schema.json.

Rules:

- additionalProperties is false at every object level.
- Unknown top-level fields fail.
- Unknown nested fields fail.
- Missing required fields fail.
- Explicit null fails.
- Empty strings fail unless explicitly allowed. This contract does not allow empty strings.
- Arrays may be empty only where explicitly allowed.
- Free text is not accepted.
- All enum values are closed-world.
- All registry IDs must be literal IDs, not labels, aliases, or inferred values.

## 6. Required top-level fields

The accepted Phase 1 declaration payload must include:

- engine_version
- enum_bundle_version
- phase1_schema_version
- consent_granted
- age_declaration
- jurisdiction_acknowledged
- actor_type
- execution_scope
- activity_id
- location_type
- equipment_profile_id

Conditional required field:

- governing_authority_id is required when execution_scope is coach_managed.

Optional top-level fields:

- sport_role_id
- variant_id
- baseline_metrics
- personal_kit
- capability_constraints
- ui_preferences

## 7. Field register

| field_id | label | data type | status | class | allowed values | validation rule | failure condition | hash-affecting | engine-visible |
|---|---|---:|---|---|---|---|---|---:|---:|
| engine_version | Engine version | string | required | Class A | EB2-1.0.0 | Must exactly equal active engine compatibility pin | missing, null, non-string, mismatch | true | false |
| enum_bundle_version | Enum bundle version | string | required | Class A | EB2-1.0.0 | Must exactly equal active enum bundle pin | missing, null, non-string, mismatch | true | false |
| phase1_schema_version | Phase 1 schema version | string | required | Class A | 1.0.0 | Must exactly equal this schema version | missing, null, non-string, mismatch | true | false |
| consent_granted | Consent granted | boolean | required | Class A | true | Must be true | missing, null, false, non-boolean | true | false |
| age_declaration | Age declaration | enum string | required | Class A | adult_18_or_over | Must be one allowed enum value | missing, null, unsupported value | true | false |
| jurisdiction_acknowledged | Jurisdiction acknowledged | boolean | required | Class A | true | Must be true | missing, null, false, non-boolean | true | false |
| actor_type | Actor type | enum string | required | Class B | individual_user, coach | Must match active v0 actor type | missing, null, unsupported value | true | true |
| execution_scope | Execution scope | enum string | required | Class B | individual, coach_managed | Must match active v0 execution scope | missing, null, unsupported value | true | true |
| governing_authority_id | Governing authority ID | string | required if coach_managed | Class A | platform ID | Required only when execution_scope is coach_managed | missing under coach_managed, null, empty, non-string | true | false |
| activity_id | Activity | enum string | required | Class B | powerlifting, rugby_union, general_strength | Must match active v0 activity | missing, null, unsupported value | true | true |
| sport_role_id | Sport role | string | optional | Class B | registry ID | If present, must be valid for activity_id | null, empty, invalid role, role/activity mismatch | true | true |
| variant_id | Activity variant | string | optional | Class B | registry ID | If present, must be valid for activity_id | null, empty, invalid variant, variant/activity mismatch | true | true |
| location_type | Location type | enum string | required | Class B | commercial_gym, home_gym, outdoor | Must be one allowed v0 location type | missing, null, unsupported value | true | true |
| equipment_profile_id | Equipment profile | string | required | Class B | registry ID | Must reference an allowed v0 equipment profile | missing, null, empty, unknown profile | true | true |
| baseline_metrics | Baseline metrics | array | optional | Class B | metric objects | If present, every item must pass metric schema and registry validation | null, invalid item, unknown metric, invalid value shape | true | true |
| personal_kit | Personal kit | object | optional | Class B | declared object | If present, item IDs must be registry-valid and present items must be owned | null, unknown item ID, present item not owned | true | true |
| capability_constraints | Capability constraints | array | optional | Class B | closed enum objects | If present, each entry must use closed mechanical values only | null, unknown constraint, free text, invalid target | true | true |
| ui_preferences | UI preferences | object | optional | Class C | declared object | If present, must match inert preference schema | null, unknown preference, unsupported enum | false | false |

## 8. Nested field register — baseline_metrics

baseline_metrics is optional.

If omitted, no baseline metrics exist.

If present, it must be an array.

Each item must include:

| field_id | label | data type | status | class | validation rule | failure condition | hash-affecting | engine-visible |
|---|---|---:|---|---|---|---|---:|---:|
| baseline_metrics[].metric_id | Metric ID | string | required | Class B | Must exist in metric registry | missing, null, empty, unknown metric | true | true |
| baseline_metrics[].activity_id | Metric activity | enum string | required | Class B | Must equal top-level activity_id and metric registry activity | missing, null, mismatch | true | true |
| baseline_metrics[].value | Metric value | object | required | Class B | Must conform exactly to metric declared value schema | missing, null, invalid shape, unsupported unit | true | true |
| baseline_metrics[].recorded_at | Recorded at | string | required | Class B | Must be ISO 8601 date or datetime | missing, null, empty, invalid date | true | true |
| baseline_metrics[].linked_exercise_token_id | Linked exercise token | string | optional | Class B | If present, must be valid registry token and lawful metric-exercise link | null, empty, unknown token, missing link | true | true |
| baseline_metrics[].source | Source | enum string | optional | Class B | Must be one allowed source | null, unsupported value | true | true |

Allowed source values:

- user_manual
- coach_entered
- imported

No metric notes are accepted by the v0 UI surface.

## 9. Nested field register — personal_kit

personal_kit is optional.

If omitted, no personal kit exists.

If present, it must include:

| field_id | label | data type | status | class | validation rule | failure condition | hash-affecting | engine-visible |
|---|---|---:|---|---|---|---|---:|---:|
| personal_kit.owned_item_ids | Owned item IDs | array of strings | required | Class B | Every item must exist in equipment registry | missing, null, unknown item | true | true |
| personal_kit.present_item_ids | Present item IDs | array of strings | required | Class B | Every present item must also appear in owned_item_ids | missing, null, item not owned | true | true |

Empty arrays are valid and mean no declared items.

Ownership does not imply presence.

Presence cannot exist without ownership.

## 10. Nested field register — capability_constraints

capability_constraints is optional.

If omitted, no declared capability constraints exist.

If present, it must be an array.

Each item must include:

| field_id | label | data type | status | class | validation rule | failure condition | hash-affecting | engine-visible |
|---|---|---:|---|---|---|---|---:|---:|
| capability_constraints[].constraint_id | Constraint ID | enum string | required | Class B | Must be one allowed mechanical constraint | missing, null, unsupported value | true | true |
| capability_constraints[].target_token_id | Target token ID | string | optional | Class B | If present, must be valid registry token | null, empty, unknown token | true | true |

Allowed constraint_id values:

- reduced_range_position
- loaded_position_instability
- setup_modification_required
- position_unavailable

No cause, diagnosis, injury description, pain description, explanation, or free text is accepted.

## 11. Nested field register — ui_preferences

ui_preferences is optional.

If omitted, no UI preferences exist.

If present, it may include:

| field_id | label | data type | status | class | allowed values | validation rule | failure condition | hash-affecting | engine-visible |
|---|---|---:|---|---|---|---|---|---:|---:|
| ui_preferences.instruction_density | Instruction density | enum string | optional | Class C | low, medium, high | Must be one allowed value | null, unsupported value | false | false |
| ui_preferences.presentation_density | Presentation density | enum string | optional | Class C | compact, standard, expanded | Must be one allowed value | null, unsupported value | false | false |
| ui_preferences.nd_mode | ND mode | boolean | optional | Class C | true, false | Must be boolean if present | null, non-boolean | false | false |

Class C fields must never change engine output.

## 12. Prohibited fields

The following fields must fail if present:

- readiness
- readiness_score
- safety
- safety_score
- risk
- injury
- pain
- diagnosis
- medical
- rehab
- suitability
- optimisation
- recommendation
- goal
- performance_target
- coach_instruction
- coach_override
- inferred_equipment
- estimated_metric
- derived_metric
- payment_status
- subscription_tier
- org_id
- team_id
- unit_id
- gym_id
- dashboard_config
- messaging_enabled
- evidence_export

This list is not exhaustive. Any undeclared field fails.

## 13. Hashing rule

The Phase 1 declaration hash must include:

- all Class A fields
- all Class B fields
- canonical field ordering
- canonical serialisation

The hash must exclude:

- all Class C fields

If a Class A or Class B value changes, the Phase 1 hash must change.

If only Class C values change, engine output and Phase 1 engine hash must not change.

## 14. UI rule

The UI must render only fields declared by this contract.

The UI must not submit hidden engine fields.

The UI must not submit empty hidden fields.

The UI must not submit default values as if declared by the user.

The UI must not accept free-text fields.

The UI must not ask adaptive follow-up questions that create undeclared engine values.

## 15. Failure modes

The following must fail immediately:

- unknown top-level field
- unknown nested field
- missing required field
- explicit null
- empty required string
- unsupported enum value
- actor type outside active v0
- execution scope outside active v0
- activity outside active v0
- coach_managed without governing_authority_id
- invalid registry reference
- metric/activity mismatch
- present kit item not owned
- Class C field changing engine output
- UI-submitted hidden engine value
- any inferred, defaulted, corrected, or undeclared value

## 16. Acceptance criteria

A declaration is acceptable only if:

- it conforms to phase1_declaration_surface.schema.json
- every required Class A field is valid
- every required Class B field is valid
- every optional field, if present, is valid
- no unknown fields exist
- no explicit null exists
- no hidden UI field exists
- no prohibited field exists
- all registry references resolve
- all Class C fields are engine-inert

## 17. Final rule

If a field is not declared in this contract, it is not part of the active v0 Phase 1 declaration surface.

If it is not declared in Phase 1, it does not exist to the engine.