# REG-FULL-07 — Programme Template Production

## Status

Implementation slice for the canonical `sport_program_template_registry_5f` programme inventory.

## Goal

Replace the three skeletal compact programme rows as programme-content authority with a real S-V1-26 registry-backed template inventory for the locked v1 activity set.

The compact `registries/program/program.registry.json` file remains byte-stable as the compatibility-only runtime projection declared by REG-FULL-01. It is not the final programme-template authority and is not expanded into eleven legacy rows in this slice.

## Canonical output

`registries/program/sport_program_template.registry.json`

Header:

- registry id: `sport_program_template_registry_5f`
- version: `1.0.0`
- contract version per template: `S-V1-26`
- assignment scope: `coach_athlete_assigned_execution`

## Required family inventory

The registry contains exactly eleven templates in this deterministic family order:

1. `powerlifting_novice`
2. `powerlifting_intermediate`
3. `powerlifting_maintenance`
4. `powerlifting_meet_prep`
5. `general_strength_novice`
6. `general_strength_intermediate`
7. `general_strength_low_equipment`
8. `rugby_union_off_season`
9. `rugby_union_pre_season`
10. `rugby_union_in_season`
11. `rugby_union_low_equipment`

This is 4 powerlifting, 3 general-strength and 4 rugby-union families.

## Production law

Every scheduled work item is materialised from explicit finished registry facts only.

For each work item REG-FULL-07 requires:

- the `exercise_id` exists in `registries/exercise/exercise.registry.json`;
- the exercise has `template_eligibility: eligible`;
- the exact `<exercise>__<activity>__training` applicability row exists;
- that row has `applicability_state: allowed` and `template_applicability: eligible`;
- `equipment_requirement_ids` exactly equal the REG-FULL-04 `compatibility_type: required` equipment rows for the exercise;
- `substitution_policy_id` is a concrete REG-FULL-06 substitution edge id;
- the substitution edge source is exactly the scheduled exercise;
- the edge explicitly contains the programme activity in `activity_applicability`;
- the substitution target exists in the finished exercise registry.

Alternative equipment is not promoted into a required-equipment assumption. No generic equipment fallback is permitted.

## Low-equipment boundary

The two low-equipment families are constrained to this explicit equipment set:

- `bench`
- `bodyweight`
- `box`
- `dumbbell`
- `kettlebell`
- `medicine_ball`
- `open_floor_space`
- `plate`
- `pull_up_bar`
- `resistance_band`

A low-equipment template cannot require a barbell, rack, cable machine, trap bar, sled, general machine, cardio machine, or another undeclared equipment id.

## Deterministic template structure

Templates use explicit block/week/day/session/work-item order indexes only. No ranking, nearest-template selection, inferred programme generation, or runtime content synthesis is introduced.

Each programme records fixed factual set/rep structure. `loading_reference` is an opaque factual reference from the closed set used by this slice:

- `coach_declared_load`
- `coach_declared_implement_load`
- `bodyweight`

No percentage formula, RPE resolver, progression formula, recommendation score, readiness score, safety score, effectiveness claim, marketplace authority or royalty field is part of the canonical records.

## Compatibility and legacy boundaries

REG-FULL-00/01 define `program` as a compatibility projection for canonical `sport_program_template_registry_5f`.

REG-FULL-07 therefore does not:

- mutate `registries/program/program.registry.json`;
- add the canonical 5F file to the compact `registry_index.json`;
- regenerate or expand `registries/registry_bundle.json`;
- change the current Phase 4 compatibility selector;
- reactivate `exercise_warmup_mapping_registry`.

The retained legacy warm-up mapping remains non-authoritative, non-runtime final-state content whose declared successor is `sport_program_template_registry_5f` and whose migration target is REG-FULL-07.

## Materialisation

Canonical content and slice evidence are produced by:

```text
node scripts/reg_full_07_materialize_programme_templates.mjs --write --write-evidence
```

Deterministic parity can be checked with:

```text
node scripts/reg_full_07_materialize_programme_templates.mjs --check
```

## Acceptance proof

Direct proof:

```text
node --test test/reg_full_07_programme_template_production.test.mjs
node ci/registry/reg_full_07_programme_template_production.mjs
```

The guard proves family completeness, exercise/applicability/equipment/substitution closure, deterministic ordering, low-equipment boundaries, compatibility-projection immutability, retained legacy warm-up status, materialiser parity and evidence parity.

## Explicit non-scope

REG-FULL-07 does not create hidden training logic, recommendation semantics, automatic progression, readiness/safety/effectiveness interpretation, marketplace publishing, coach-to-coach sharing, team/organisation runtime, billing behaviour, or a new substitution algorithm.
