# V0 Active Scope Manifest CI Guard Specification

Document ID: v0_active_scope_manifest_ci_guard
Version: 1.0.0
Status: authoritative
Scope class: closed_world

## 1. Purpose

The v0 active scope manifest CI guard prevents active v0 scope leakage across app, web, admin, server, shared code, docs, copy, marketing, emails, tests, and fixtures.

The guard consumes V0_ACTIVE_SCOPE_MANIFEST.json.

The guard emits a CI failure if scanned content contains forbidden v0 scope values or unknown scope values in manifest-controlled domains.

## 2. Scan roots

The guard scans app, web, admin, server, shared, docs, marketing, emails, tests, and fixtures.

## 3. Excluded paths

The guard excludes node_modules, dist, build, .next, .git, and coverage.

## 4. File extensions

The guard scans .js, .jsx, .ts, .tsx, .mjs, .cjs, .json, .md, .html, .css, .yml, and .yaml.

## 5. Controlled domains

The guard checks actor types, execution scopes, activities, engine phases, product surfaces, claim classes, runtime events, runtime semantics, and coach authority.

## 6. Forbidden exact-token checks

The guard must fail if exact forbidden values appear in scanned surfaces.

Examples include org_managed, team_managed, gym_managed, phase_7, phase_8, evidence_export, coach_override, readiness_dashboard, and program_optimisation.

## 7. Forbidden semantic checks

The guard must fail on prose variants of organisation runtime, evidence export, readiness, suitability, safety, medical, rehab, optimisation, recommendation, coach override, registry mutation, and payment affecting engine behaviour.

## 8. Allowed-context exceptions

Forbidden terms are allowed only inside files explicitly marked as negative tests.

Allowed negative-test paths are tests/negative, fixtures/negative, and __tests__/negative.

Even in negative tests, the file must include v0_scope_negative_test: true.

## 9. Unknown value handling

For structured files, if the guard finds a controlled key with a value not in the corresponding allowed list, CI fails.

Controlled keys include actor_type, actorType, execution_scope, executionScope, activity_id, activityId, phase, engine_phase, enginePhase, product_surface, productSurface, claim_class, claimClass, runtime_event, runtimeEvent, runtime_semantic, runtimeSemantic, coach_authority, and coachAuthority.

## 10. CI report format

The guard outputs one JSON report with ok and failures.

Failure objects include token, domain, value, file, line, column, excerpt, and details.

## 11. Failure tokens

The guard may emit V0_SCOPE_LEAK, V0_UNKNOWN_SCOPE_VALUE, V0_FORBIDDEN_ACTOR_TYPE, V0_FORBIDDEN_EXECUTION_SCOPE, V0_FORBIDDEN_ACTIVITY, V0_FORBIDDEN_PHASE, V0_FORBIDDEN_PRODUCT_SURFACE, V0_FORBIDDEN_CLAIM_CLASS, V0_FORBIDDEN_RUNTIME_SEMANTIC, and V0_FORBIDDEN_COACH_AUTHORITY.

## 12. Acceptance criteria

The guard passes only if no forbidden scope value appears, no forbidden semantic pattern appears, no unknown controlled value appears, no active v0 file references Phase 7 or Phase 8, no active v0 file references evidence, export, readiness, optimisation, safety, medical, coach override, or org/team/unit/gym runtime, and negative tests are isolated and explicitly marked.

## 13. Final rule

The guard fails closed.

If a value is unknown, ambiguous, or outside the manifest, CI must fail.