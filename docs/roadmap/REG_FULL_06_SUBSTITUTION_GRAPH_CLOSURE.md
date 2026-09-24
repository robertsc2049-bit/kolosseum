# REG-FULL-06 — Substitution Graph Closure

## Goal

Materialise the final explicit `substitution_registry` from the completed 215-exercise universe without introducing a closest-exercise algorithm, similarity resolver, fallback row or runtime relationship inference.

## Final authority

`registries/substitution/substitution.registry.json` is the final substitution-edge authority required by the REG-FULL-00 registry surface architecture at final load position 24.

It depends only on already-authoritative factual inputs:

- `registries/exercise/exercise.registry.json` — exercise identity, movement FK, stimulus intent, difficulty, joint-stress metadata and exercise-level substitution eligibility;
- `registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json` — explicit required/alternative exercise→equipment truth from REG-FULL-04;
- `registries/exercise_activity_applicability/exercise_activity_applicability.registry.json` — explicit exercise→activity/context truth from REG-FULL-03/04;
- `registries/equipment/equipment.registry.json` — equipment IDs used by the closed REG-FULL-06 direction policy.

The historical `registries/exercise/exercise_substitution_graph.json` remains byte-semantically the three-edge retained legacy graph. REG-FULL-06 does not add content to it. REG-FULL-00 already declares it non-authoritative, non-runtime, closed to new content and superseded by `substitution_registry`.

## Lawful edge policy

The materialiser exhaustively evaluates every ordered source/target pair in the 215-exercise universe. A row is written only when all of the following are true:

1. source and target are different registered exercises;
2. target exercise-level `substitution_eligibility` is `eligible`;
3. source and target have the exact same `movement_pattern_id`;
4. source and target have the exact same `stimulus_intent`;
5. target difficulty is the same as or lower than source difficulty;
6. every target joint-stress tag is already present on the source;
7. source and target share at least one explicit allowed training activity and the target is explicitly substitution-eligible in that activity;
8. source and target both have explicit REG-FULL-04 `required` equipment relations;
9. target required-equipment burden is lateral or lower under the fixed REG-FULL-06 equipment-direction table.

A `restricted` exercise may be an explicit source. It is never made an implicit candidate and may not be used as a target unless later authority explicitly changes its eligibility.

## Explicit equipment direction

REG-FULL-06 uses a fixed authoring-time equipment-level table. Runtime code must not derive these levels from equipment names or classes.

Level 0:
- `bodyweight`
- `open_floor_space`

Level 1:
- `resistance_band`
- `dumbbell`
- `kettlebell`
- `medicine_ball`
- `plate`

Level 2:
- `barbell`
- `rack`
- `bench`
- `cable_machine`
- `pull_up_bar`
- `trap_bar`
- `sled`
- `box`
- `machine_general`
- `cardio_machine_general`

Each edge records exactly one `equipment_change_type`:

- `same_required_equipment` — required equipment sets are identical;
- `lateral` — sets differ but their maximum equipment level is equal;
- `downgrade` — target maximum equipment level is lower.

Equipment upgrades are not lawful substitution edges in this slice.

## Deterministic ordering

Every row is keyed as:

`<source_exercise_id>__to__<target_exercise_id>`

Every row carries:

`<source>|<equipment-priority>|<difficulty-drop>|<target>`

where equipment priority is:

1. `00` — same required equipment;
2. `01` — lateral;
3. `02` — downgrade.

Rows are materialised in ascending ordering-key order. This ordering is factual registry data; runtime code does not calculate a nearest or best exercise.

## Runtime boundary

REG-FULL-06 expressly prohibits:

- a closest-exercise or similarity algorithm;
- runtime construction of unregistered source/target relationships;
- movement-only substitution inference;
- equipment inference from embedded exercise fields or movement vocabularies;
- default, generic, unknown, catch-all or fallback substitution edges;
- reactivation of `exercise_substitution_graph.json` as runtime authority.

A runtime consumer may filter the explicit rows by current factual context such as activity or available equipment. It may not invent additional edges.

## Materialisation

Controlled writer:

`node scripts/reg_full_06_materialize_substitution_registry.mjs --write`

Evidence writer after the registry exists:

`node scripts/reg_full_06_materialize_substitution_registry.mjs --write-evidence`

The materialiser does not know or freeze an expected edge count in source code. The lawful count is a deterministic consequence of the finished authority inputs and is recorded only after generation.

## CI proof

`ci/registry/reg_full_06_substitution_graph_closure.mjs` independently recomputes the entire lawful candidate set and requires exact set equality with the committed registry. It also enforces FKs, movement/stimulus closure, activity closure, target eligibility, joint-stress and difficulty constraints, explicit equipment direction, deterministic ordering, legacy-graph retirement and evidence hashes.

`test/reg_full_06_substitution_graph_closure.test.mjs` includes positive reproduction proof and direct negative proofs for missing FKs, self/cross-movement edges, activity drift, ineligible targets, equipment upgrades/direction drift, harder targets, additional joint stress, ordering drift, missing lawful candidates, fallback identifiers, legacy graph mutation and legacy reactivation.

The REG-FULL-06 test is indexed in the registry-law positive CI cluster once the generated registry and evidence are committed.
