# Kolosseum v0 Test Suite Brief

Status: Developer implementation brief
Scope: v0 Deterministic Execution Alpha
Purpose: define the required automated tests for the current v0 boundary without activating dormant v1, proof-layer, organisation, team, unit, gym, or evidence features.

## 1. Release boundary under test

Kolosseum v0 is the Deterministic Execution Alpha.

The active v0 ship boundary is limited to:

- actors: individual user / athlete and coach only
- execution scopes: individual and coach-managed only
- activities: powerlifting, rugby_union, general_strength only
- phases: Phase 1 through Phase 6 only
- product surface: onboarding declarations, deterministic compilation, session execution, split/return, partial completion, factual history, coach assignment, factual artefact viewing, and non-binding coach notes
- engine model: pure deterministic library, canonical JSON in and canonical JSON out
- CI model: hard fail, no soft warnings, no fallback behaviour

The following are out of v0 and must remain absent or unreachable from the active shipping path:

- Phase 7 truth projection
- Phase 8 evidence sealing
- evidence envelopes
- exportable proof artefacts
- organisation, unit, team, gym, state-managed runtime paths
- dashboards, rankings, messaging, broad analytics, readiness scoring, outcome evaluation
- medical, safety, suitability, optimisation, or coaching-advice claims

## 2. Required automated gates

The v0 suite must run the following gates.

### Gate A: v0 scope guard

Purpose: prevent post-v0 features from leaking into active production code.

Required assertions:

- active production code must not expose org-managed, unit-managed, team-managed, gym-managed, or state-managed runtime paths
- active production code must not emit or construct evidence envelopes
- active production code must not activate Phase 7 or Phase 8 output paths
- active production code must not contain payment, tier, or organisation branching that changes engine behaviour
- active production code must not expose dashboards, ranking, readiness, recommendations, or outcome evaluation as v0 behaviour

Failure token family:

- CI_SCOPE_V0_VIOLATION
- CI_PRODUCT_BEHAVIOUR_LEAK
- CI_PAYMENT_SIDE_EFFECT

### Gate B: Phase 1 schema closure

Purpose: prove that Phase 1 remains the only lawful truth entry point.

Required assertions:

- Phase 1 schema exists
- additionalProperties is false
- actor_type is closed to the active v0 actor set where declared
- execution_scope is closed to individual and coach_managed where declared
- consent, version pins, activity_id, and presentation flags are schema-controlled where present
- baseline_metrics, if present, are closed-world and FK-bound
- unknown fields hard fail
- missing required fields hard fail

Failure token family:

- unknown_field
- missing_required_field
- type_mismatch
- invalid_format
- version_mismatch
- invalid_actor_type
- missing_governing_authority
- invalid_activity_id
- invalid_presentation_flag

### Gate C: registry integrity guard

Purpose: prove registry loading is deterministic, closed-world, and FK-safe.

Required assertions:

- registry payload directory or manifest exists
- canonical registry order is preserved
- no duplicate registry IDs
- no unknown registry IDs in active v0 manifests
- no placeholder checksum in sealed ship mode
- all registry references resolve
- runtime registry mutation is absent
- no best-effort registry loading exists
- partial registry loading is forbidden

Failure token family:

- CI_REGISTRY_LOAD_ORDER_INVALID
- CI_REGISTRY_STRUCTURE_INVALID
- CI_FOREIGN_KEY_FAILURE
- CI_REGISTRY_ID_UNKNOWN
- CI_REGISTRY_MUTATION
- CI_MANIFEST_MISMATCH
- CI_CHECKSUM_PLACEHOLDER

### Gate D: copy and representation lint

Purpose: prevent claim leakage and inline user-facing copy.

Required assertions:

- production UI, server messages, email, marketing, and surfaced copy do not contain forbidden claim language
- copy uses the Copy Registry where the repo has a copy registry boundary
- no presentation string implies safety, benefit, optimisation, suitability, prevention, recovery, or recommendation
- tests and fixtures may contain banned words only where used to prove failures

Failure token family:

- CI_LINT_FORBIDDEN_LANGUAGE_FOUND
- CI_LINT_FORBIDDEN_CLAIM_SEMANTIC
- CI_LINT_COPY_INLINE_STRING
- CI_LINT_COPY_ID_UNKNOWN
- CI_LINT_COPY_PARAM_MISMATCH

### Gate E: developer behaviour grep

Purpose: prevent hidden soft-failure behaviour.

Required assertions:

- no fallback, best effort, approximate, closest match, or heuristic behaviour in engine/server/shared production paths
- no constraint relaxation
- no make-it-work branches
- no default-to-bodyweight fallback
- no retry or recovery path that mutates canonical input
- no comment or function note suggests behaviour that canonical law forbids

Failure token family:

- CI_SOFTENED_FAILURE
- CI_FALLBACK_BEHAVIOUR
- CI_TOOLING_BYPASS
- CI_PHASE_OVERRIDE_ATTEMPT

### Gate F: Phase 6 hard-wall guard

Purpose: ensure runtime execution records facts only.

Required assertions:

- Phase 6 cannot mutate Phase 1
- Phase 6 cannot add equipment
- Phase 6 cannot re-enumerate legality
- Phase 6 cannot recompute constraints
- Phase 6 cannot trigger live coach override
- Phase 6 cannot change future engine decisions based on deviation events

Failure token family:

- CI_PHASE_OVERRIDE_ATTEMPT
- CI_REGISTRY_MUTATION
- CI_NON_DETERMINISTIC_OUTPUT

### Gate G: presentation-inert guard

Purpose: prove ND mode and UI flags do not change engine truth.

Required assertions:

- engine code must not branch on nd_mode, presentation_density, instruction_density, exposure_prompt_density, or bias_mode
- presentation flags can be passed through as metadata only
- changing only Class C / presentation fields must not change engine output

Failure token family:

- CI_PRESENTATION_ENGINE_IMPACT
- CI_NON_DETERMINISTIC_OUTPUT

### Gate H: replay and vector integrity

Purpose: prove deterministic verification within the declared v0 replay scope.

Required assertions:

- replay/vector directory exists once replay is activated
- vector envelope manifests are valid JSON
- expected_ci_verdict is PASS or FAIL
- FAIL vectors include expected_failure_token and expected_failure_phase
- replay runner scope does not silently activate Phase 7 or Phase 8 for v0
- byte-exact input and output comparison is required
- update mode must not run in CI

Failure token family:

- CI_REPLAY_VECTOR_INVALID
- CI_REPLAY_DIVERGENCE
- CI_NON_DETERMINISTIC_OUTPUT
- canonical_json_mismatch
- canonical_hash_mismatch
- nondeterminism_detected

### Gate I: package and CI wiring guard

Purpose: ensure the test suite is actually executable.

Required assertions:

- package.json contains a v0 test-suite script
- GitHub Actions contains a v0 test-suite workflow
- runner emits a single JSON report
- failure report includes token, file, line, and details where applicable
- CI exits non-zero on failure

Failure token family:

- CI_TEST_WIRING_MISSING
- CI_TOOLING_BYPASS

## 3. Required local commands

Primary command:

npm run test:v0

JSON report command:

npm run test:v0:json

The runner must be deterministic and must not depend on network access, wall-clock output, mutable external services, or GitHub state.

## 4. Required report shape

The runner must print one JSON report:

{
  "ok": false,
  "failures": [
    {
      "token": "CI_SCOPE_V0_VIOLATION",
      "gate": "v0_scope_guard",
      "file": "engine/example.ts",
      "line": 10,
      "details": "Phase 8 evidence path is reachable from active production code."
    }
  ]
}

## 5. Acceptance standard

v0 test-suite readiness requires:

- test runner exists
- package scripts exist
- GitHub workflow exists
- all gates execute
- failures emit stable tokens
- no dormant v1 feature is treated as v0 acceptance
- no passing result is possible if active production code violates v0 scope
