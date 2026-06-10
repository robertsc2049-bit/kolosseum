# TICKET 001 — Registry v1: ExerciseSignature enforcement + Phase 4 emits program.exercises[]
VERSION: v0
GOAL: Remove CLI demo dependency by making Phase 4 emit a substitutable program shape.

## Why this exists
Phase 5 substitution logic is real and tested, but runEngine() never feeds it a program with exercises[] because Phase 4 is still a stub.
This ticket makes Phase 4 output a minimal real program shape built from registries.

## Scope (hard)
IN SCOPE:
- Define registry schema for exercise registry entries that matches ExerciseSignature.
- Validate exercise registry at load time (fail-fast).
- Populate a minimal exercise registry (powerlifting horizontal_push set).
- Update Phase 4 to output:
  program = { program_id, version, blocks: [], exercises: ExerciseSignature[], target_exercise_id? }
- Add end-to-end test that runEngine() produces Phase 5 substitution without CLI demo.

OUT OF SCOPE:
- UI
- scheduling
- payments
- workout progression logic
- fatigue models
- multi-session planning

## Required files / outputs

### A) Add schema: ci/schemas/exercise.registry.schema.v1.0.0.json
- JSON Schema draft 2020-12
- Validates:
  - registry_id = "exercise"
  - version = "1.0.0"
  - entries is an object keyed by exercise_id
  - each entry matches ExerciseSignature shape

### B) Update schema_guard to load and validate this schema
- ci/scripts/schema_guard.mjs should validate all registry files against their schemas
- Fail token must be deterministic and specific (e.g., CI_SCHEMA_INVALID_EXERCISE_REGISTRY)

### C) Populate registries/exercise/exercise.registry.json entries (minimum)
Must include at least these entries:
- bench_press
- incline_bench_press
- dumbbell_bench_press
- push_up

Each entry must include:
- exercise_id (must equal key)
- pattern: "horizontal_push"
- stimulus_intent: "strength"
- rom: "full"
- stability: stable or semi_stable
- equipment: array
- equipment_tier: TIER_1..TIER_4
- joint_stress_tags: array

### D) Update Phase 4 to emit exercises[]
Phase 4 must:
- load registries (already done in Phase 3; acceptable to load again in Phase 4 for now, but must remain deterministic)
- for activity_id = "powerlifting", select a minimal exercise list:
  - target: bench_press
  - candidates include dumbbell_bench_press at minimum
- output program that includes exercises[] and target_exercise_id = "bench_press"

### E) Add/Update tests
Add test: test/e2e_phase4_phase5_substitution.test.mjs
- Call runEngine() with examples/phase1_min.json input
- Assert:
  - res.ok === true
  - res.phase4 exists and includes exercises[]
  - res.phase5.adjustments contains SUBSTITUTE_EXERCISE
  - substitute_exercise_id === "dumbbell_bench_press" when constraints avoid shoulder_high are applied by Phase 4 for demo purposes

## Acceptance criteria
- `npm test` passes
- `npm run run:cli -- examples\phase1_min.json` (no demo flag) produces Phase 5 substitution adjustment
- CI guards still pass (spine/checksums/schema)

## Notes
- Determinism required: no randomness, stable ordering, stable tie-breaks.
- Any failure must return a specific failure_token (no generic errors).
