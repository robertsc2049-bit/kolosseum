# REG-FULL-08 — Copy, Instructions and Provenance Closure

## Goal

Close the source-control, provenance, commercial-use, review and exact-copy boundary for active registry content before the training dataset expands further.

## Governing authority

`copy_registry` is the sole final copy authority under REG-FULL-00 and remains final load position 25. Independent instruction/display-copy and copy/legal registries remain prohibited duplicate authorities.

REG-FULL-08 does not create another provenance registry. It materializes the canonical `copy_registry` as the cross-registry provenance authority.

## Current content-production vocabulary

The existing exercise reference-media contract already established the accepted provenance source vocabulary:

- `founder_original`
- `licensed_source`
- `canonical_project_document`

and the required control dimensions:

- source reference;
- licence status;
- commercial-use status;
- manual review status;
- legal review status;
- copy-boundary control.

REG-FULL-08 carries those dimensions into the canonical copy authority for registry content.

## Explicit active source set

Coverage is closed over the following 18 committed source files only:

1. `registries/activity/activity.registry.json`
2. `registries/sport_subdivision/sport_subdivision.registry.json`
3. `registries/sport_metric/sport_metric.registry.json`
4. `registries/sport_role/sport_role.registry.json`
5. `registries/movement/movement.registry.json`
6. `registries/exercise/exercise.registry.json`
7. `registries/exercise_token/exercise_token.registry.json`
8. `registries/equipment/equipment.registry.json`
9. `registries/metric_exercise_link/metric_exercise_link.registry.json`
10. `registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json`
11. `registries/exercise_activity_applicability/exercise_activity_applicability.registry.json`
12. `registries/program/program.registry.json`
13. `registries/program/sport_program_template.registry.json`
14. `registries/substitution/substitution.registry.json`
15. `copy/beta_copy_registry.json`
16. `copy/beta_16_app_path_phase1_6_copy.json`
17. `copy/beta_17_coach_managed_path_copy.json`
18. `copy/beta_20_phase7_projection_copy.json`

The compact programme registry is included because it remains an active compatibility runtime projection. Dormant threshold-marker content and retained-legacy substitution/warm-up registries are not active final content and are not promoted back into authority by this slice.

## Provenance record law

Every source record receives exactly one canonical provenance entry containing:

- canonical source registry ID;
- exact source record ID;
- exact source file path;
- source authority classification;
- Git blob SHA for the tracked source file;
- raw source-file SHA-256;
- exact record SHA-256 over deterministic canonical JSON;
- source/provenance classification;
- licence status;
- commercial-use status;
- manual review status;
- legal review status;
- exact-copy policy and per-field exact-copy hashes.

Current committed project content is classified as project-owned canonical repository content. REG-FULL-08 does not infer licensed content. Any future licensed content requires an explicit source/provenance decision before activation.

## Exact-copy control

Whole-record SHA-256 covers all values and structure, including numeric, boolean, array and relationship data.

Additionally, authored textual fields are detected by an explicit field-name policy and each exact UTF-8 string receives its own SHA-256 binding. This includes exercise instructions, display labels, descriptive copy, coaching cues/faults when present, boundary notes, conditions and active beta-copy text.

No fuzzy matching, semantic similarity, paraphrase acceptance or runtime inference is allowed. A one-character text change changes the exact-copy hash and requires regeneration/review.

## Fail-closed requirements

REG-FULL-08 fails if:

- any explicit active source file is missing;
- the beta copy subordinate source set changes silently;
- a source row has no provenance record;
- an extra provenance record appears;
- a source file, source record or exact-copy field hash drifts;
- commercial-use permission is not `permitted` for active content;
- manual review is not `approved`;
- legal status is not `project_owned_clear` for current project-owned content;
- licensed content is inferred without an explicit later override;
- another independent copy/provenance registry is introduced;
- generated provenance depends on fallback/discovery/runtime inference.

## Non-goals

REG-FULL-08 does not:

- rewrite exercise instructions or programme content;
- change exercise/equipment/applicability/substitution facts;
- alter the compact registry bundle/index;
- reactivate dormant or retained-legacy registries;
- create legal advice or claim external counsel review;
- infer third-party licences;
- expose protected formula/progression internals.

`legal_review_status = project_owned_clear` is the project content classification for repository-owned material and is not a representation that external legal counsel reviewed each row.

## Generated outputs

- `registries/copy/copy.registry.json`
- `ci/evidence/reg_full_08_copy_instructions_provenance_closure.v1.json`

## Acceptance

REG-FULL-08 is complete only when:

1. deterministic materialization reproduces byte-identical outputs;
2. direct mutation tests pass;
3. the independent closure guard passes;
4. REG-FULL-01 schema closure remains green after the copy schema extension;
5. REG-FULL-04, REG-FULL-06 and REG-FULL-07 dependency proofs remain green;
6. registry and evidence seals are current;
7. failure-token index and docs checksums are current;
8. authoritative exact-head GitHub CI is green.
