<!-- DEV NOTE: Registry repair planning surface. This document records the source-of-truth repair order after S-REG-01A and S-REG-02 inspection. Canonical law remains in executable guards, active registry files, and accepted v1 contracts. -->

# S-REG-02B - Registry Source-of-Truth Repair Plan

## Status

Accepted as a repair plan once this slice is merged.

## Purpose

This document records the registry repair sequence after the S-REG-01A and S-REG-02 inspections proved that the current registry surface is still compact legacy registry state.

This plan does not add registry content.

This plan does not add active registry rows.

This plan does not change the deterministic engine.

This plan does not change runtime behaviour.

This plan does not change coach authority.

This plan does not widen launch or v1 scope.

## Inspection baseline

S-REG-01A and S-REG-02 inspected the active repo state on main.

The active registry proof still passes, but only as controlled-launch workability.

Current registry law proof reports:

- activity: 3
- movement: 4
- exercise: 19
- program: 3

S-V1-G-02 reports:

- status: CLOSED
- operational launch status: REGISTRY_WORKABILITY_PROVEN_FOR_CONTROLLED_LAUNCH

This is not full v1 registry completion.

## Current active registry surface

The active registry index currently contains 4 ordered registry names.

The generated registry bundle currently contains 4 registry keys.

Active compact registry files are:

- registries/activity/activity.registry.json
- registries/movement/movement.registry.json
- registries/exercise/exercise.registry.json
- registries/program/program.registry.json

Additional compact support files exist:

- registries/exercise/exercise_substitution_graph.json
- registries/exercise/exercise_warmup_mapping.registry.json
- registries/registry_surface_classification.json

## Generator path decision

The current bundle writer loads registry files using this convention:

- registry_index.order contains registry names
- each registry name loads from registries/<name>/<name>.registry.json
- registry_bundle.json is generated from that order

Therefore, the next active canonical registry implementation must not use a different path layout unless a dedicated generator migration slice changes the bundle writer, bundle guard, registry law guard, tests, and generated artefacts deliberately.

The S-REG-02 temporary classifier proposed paths such as:

- registries/activity/activity_registry_1.registry.json
- registries/equipment/equipment.registry.json

Those paths must be treated as planning suggestions only.

They are not accepted active implementation paths under the current bundle writer.

## Accepted active path rule for the next implementation slice

Unless a later generator-path migration slice replaces this decision, active canonical registry files must use the current bundle convention:

- registries/activity_registry_1/activity_registry_1.registry.json
- registries/sport_subdivision_registry_1a/sport_subdivision_registry_1a.registry.json
- registries/sport_metric_registry_1c/sport_metric_registry_1c.registry.json
- registries/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.registry.json
- registries/sport_role_registry_2/sport_role_registry_2.registry.json
- registries/movement_registry_3/movement_registry_3.registry.json
- registries/exercise_token_registry_3b/exercise_token_registry_3b.registry.json
- registries/exercise_registry_3a/exercise_registry_3a.registry.json
- registries/equipment_registry/equipment_registry.registry.json
- registries/exercise_activity_applicability_registry/exercise_activity_applicability_registry.registry.json
- registries/sport_program_profile_registry_5d/sport_program_profile_registry_5d.registry.json
- registries/sport_event_model_registry_5e/sport_event_model_registry_5e.registry.json
- registries/sport_program_template_registry_5f/sport_program_template_registry_5f.registry.json
- registries/substitution_registry/substitution_registry.registry.json

## Missing canonical registry surface

The canonical registry IDs missing from active source-of-truth are:

1. activity_registry_1
2. sport_subdivision_registry_1a
3. sport_metric_registry_1c
4. metric_exercise_link_registry_1c_a
5. sport_role_registry_2
6. movement_registry_3
7. exercise_token_registry_3b
8. exercise_registry_3a
9. equipment_registry
10. exercise_activity_applicability_registry
11. sport_program_profile_registry_5d
12. sport_event_model_registry_5e
13. sport_program_template_registry_5f
14. substitution_registry

## Non-negotiable repair rule

Do not add large exercise content first.

Do not add programme templates first.

Do not add substitution content first.

Do not add equipment content first.

The source-of-truth registry surface must be repaired before high-volume content expansion.

Reason: content expansion on the compact legacy surface creates churn, foreign-key drift, generator mismatch, and later migration risk.

## Empty active registry rule

Do not add empty active registries to registry_index unless the active registry law supports empty inert registries.

The current registry law expects active registries to have usable collection content.

Therefore S-REG-03 must either:

1. create canonical registries with the minimum factual accepted rows needed to pass active registry law, or
2. add inert canonical registry files outside registry_index and then activate them in a later migration slice, or
3. deliberately update registry law to support inert active skeleton registries with explicit inert status.

Option 1 is preferred for activity, movement, exercise, and program migration.

Option 2 is acceptable only if S-REG-03 is explicitly an inert skeleton slice and does not claim active source-of-truth completion.

Option 3 requires a dedicated guard-law change and must not be hidden inside content work.

## Repair sequence

### S-REG-03 - Canonical Registry Surface and Loader Plan

Purpose:

- Create or update the active canonical registry surface in the path format accepted by the current bundle writer.
- Decide whether compact legacy registries remain temporarily parallel or are migrated directly.
- Keep records minimal and factual.
- Do not expand broad content.

Allowed files:

- registries/registry_index.json
- registries/registry_bundle.json generated only through the existing generator
- canonical registry files under registries/<registry_id>/<registry_id>.registry.json
- docs/checksums.sha256 generated only through the checksum writer

Forbidden files:

- engine behaviour
- runtime behaviour
- UI
- copy
- database migrations
- commercial surfaces
- launch decision records

### S-REG-04 - Legacy-to-Canonical Registry Migration

Purpose:

- Move current compact records into canonical registry IDs without changing their meaning.
- Preserve locked v1 activity set: powerlifting, general_strength, rugby_union.
- Preserve factual exercise metadata already used by compile/session paths.
- Preserve deterministic ordering.

Required migration sources:

- activity -> activity_registry_1
- movement -> movement_registry_3
- exercise -> exercise_registry_3a
- program -> programme-related canonical registry records, if structurally valid

### S-REG-05 - Equipment Registry Foundation

Purpose:

- Create active equipment_registry records needed by existing exercise records.
- Close equipment references explicitly.
- Keep equipment factual and not operational inventory.

Minimum equipment coverage comes from the existing S-V1-22 contract, including:

- barbell
- rack
- bench
- plate
- dumbbell
- kettlebell
- cable_machine
- resistance_band
- bodyweight
- pull_up_bar
- trap_bar
- medicine_ball
- sled
- box
- machine_general
- cardio_machine_general
- open_floor_space

### S-REG-06 - Exercise Applicability Registry Foundation

Purpose:

- Create factual applicability records for exercise-to-activity pairs.
- Use only locked v1 activities.
- Use explicit contexts: training, testing, competition.
- Do not infer recommendation, capability, ranking, or suitability.

### S-REG-07 - Substitution Registry Foundation

Purpose:

- Convert compact substitution graph support into declared substitution registry records.
- Require source exercise, target exercise, movement, equipment, and applicability closure.
- Keep substitution authority inside registry law only.

### S-REG-08 - Programme Template Canonical Foundation

Purpose:

- Separate current compact program entries from future active programme template records.
- Add only registry-bound factual template structures accepted by the programme template contract.
- Keep formula payloads and progression internals absent.

### S-REG-09 - Registry Acceptance Tightening

Purpose:

- Add or tighten guards so compact launch-only registry state can no longer be mistaken for full v1 registry completion.
- Make CI distinguish controlled-launch workability from complete canonical v1 registry source-of-truth.
- Preserve existing launch evidence without relabelling it as full registry completion.

## Guard and generator ownership

Registry bundle generation is owned by:

- scripts/bundle_writer.cjs
- ci/guards/registry_bundle_guard.mjs

Registry law proof is owned by:

- ci/guards/registry_law_guard.mjs

Load order and FK closure is owned by:

- ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs

Content production governance is owned by:

- ci/guards/s_v1_25_registry_content_production_system_guard.mjs

Generated checksum records are owned by:

- npm.cmd run hash:write

Do not manually edit generated checksum records.

Do not manually patch generated indexes unless the generator itself is the slice target.

## V1 scope lock

Registry repair remains limited to:

- powerlifting
- general_strength
- rugby_union

Registry repair must not add active support for:

- strongman
- bodybuilding
- weightlifting
- combat sport
- tactical pack
- rehabilitation pack
- youth pack
- organisation runtime
- team runtime
- gym runtime
- federation runtime
- marketplace
- messaging
- EPOS
- gym access
- broad analytics

## Copy and claim boundary

Registry repair must remain factual.

Registry repair must not create claims about:

- safety
- readiness
- suitability
- medical status
- injury prevention
- optimisation
- recommendations
- coaching advice
- programme effectiveness
- proof sealing
- deployment status

## Acceptance for this plan

S-REG-02B is accepted when:

- this document exists
- it records the compact legacy registry state
- it records the canonical registry gaps
- it records the bundle-writer path decision
- it records that classifier paths are not implementation authority
- it records the repair sequence
- it records that broad content expansion must not happen first
- it records the generated-file ownership boundary
- checksum records are regenerated through the checksum writer
- lint:fast passes
- repository status is clean after commit