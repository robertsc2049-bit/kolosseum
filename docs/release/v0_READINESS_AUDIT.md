# V0 Readiness Audit

Document status: generated evidence record  
Slice: S-V0-32 V0 Readiness Audit Pack  
Generated at UTC: 1970-01-01T00:00:00.000Z  
Branch: main  
Commit: 42fde66 Add v0 active scope negative leakage probes  
Commit SHA: 42fde6664b81faa9dda13efa9130b7b0b3f313d3  
Readiness audit result: PASS

## Conclusion

All audit gates in this run passed. This audit records evidence that the current commit satisfies the checked v0 readiness gates.

This audit is a release-readiness evidence record only. It is not marketing copy, does not claim training outcomes, and does not add product scope.

## Evidence sources

| Source | SHA-256 |
|---|---:|
| docs/v0/V0_COMPLETION_GATE_MANIFEST.json | `d253a3471d4dece0fda74b06c43091b44bd396d48de149e88720875ee2cb5278` |
| docs/v0/V0_COMPLETION_GATE_MANIFEST.md | `b103b9aaa1a16e74886e88369376f57c53b07451ec458f2b705638953b990705` |
| docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json | `19e80b90e690bb34ff5f6bf8ed6c9de5c1dd2f82cd955019f677d68a681bf727` |
| docs/v0/V0_ACTIVE_SCOPE_MANIFEST.md | `56bac95384c6caac2983ce3f3a94b0f5344fafb558fc369e57395e12aeb9d201` |
| docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md | `8f52bf02a69d50d6bc0c2161b35cc8cfb235fb486e9f8b1153a3dc0a29935916` |
| docs/v0_REMAINING_BLOCKERS.md | `4cf480ecf2ac8f6ff121919d632197237cd800f8aa08d0cb11f0de768f990b05` |
| docs/v0_FINAL_DECISION_NOTE.md | `56b5c31fd441d29a2f52ab8d7c5271167596ae51939408bcac61ab2e57bdbfbf` |

## Gate evidence

| Gate | Command | Result | Evidence |
|---|---|---:|---|
| build | `npm.cmd run build` | PASS | exit_code=0 |
| test_v0 | `npm.cmd run test:v0` | PASS | exit_code=0; ok=true; suite=kolosseum_v0_test_suite |
| test_full | `npm.cmd run test:full` | PASS | exit_code=0; ok=true; suite=kolosseum_comprehensive_test_suite; failed_gate_count=0 |
| lint_fast | `npm.cmd run lint:fast` | PASS | exit_code=0 |
| green_ci | `npm.cmd run green:ci` | PASS | exit_code=0 |
| v0_completion_gate_manifest_verifier | `node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs` | PASS | exit_code=0; ok=true; manifest_id=v0_completion_gate_manifest |
| v0_active_scope_guard | `node ci/scripts/run_v0_active_scope_guard.mjs` | PASS | exit_code=0; ok=true; candidate_files_found=20; files_scanned=19 |
| v0_active_scope_negative_tests | `node ci/scripts/run_v0_active_scope_negative_tests.mjs` | PASS | exit_code=0; ok=true |
| s_v0_31_negative_fixture_runner | `node ci/scripts/run_s_v0_31_v0_active_scope_negative_fixture_runner.mjs` | PASS | exit_code=0; ok=true; cases_checked=7 |
| phase1_acceptance_record_tests | `node ci/scripts/run_phase1_acceptance_record_tests.mjs` | PASS | exit_code=0; ok=true; suite=phase1_acceptance_record_tests; passed=26; failed=0 |
| minimal_positive_replay_vector_guard | `node ci/scripts/run_s_v0_29_replay_vector_minimal_positive_guard.mjs` | PASS | exit_code=0; ok=true; path=replay/suite/v0_minimal_positive/envelope.json; sha256=6598f4373bab1a64306fcab079ebba3a06a5c0e4fcc01f5c9a2850bf90fe1e86 |
| sha256_guard | `node ci/scripts/sha256_guard.mjs` | PASS | exit_code=0 |

## Completion manifest evidence

Manifest id: v0_completion_gate_manifest  
Manifest version: 1.0.0  
Verifier result: PASS

- Required source documents: 15
- Required commands: 6
- Required guard presence entries: 16
- Required lint:fast entries: 5

## Runtime and deterministic evidence

- `npm.cmd run test:v0` result: PASS
- `npm.cmd run test:full` result: PASS
- Minimal positive replay vector: replay/suite/v0_minimal_positive/envelope.json
- Minimal positive replay SHA-256: 6598f4373bab1a64306fcab079ebba3a06a5c0e4fcc01f5c9a2850bf90fe1e86
- Minimal positive replay bytes: 1432
- Phase 1 acceptance tests: 26 passed / 0 failed / 26 total

## Active v0 scope boundary

The v0 active scope audit uses the current active-scope guard and manifest. It does not promote roadmap, v1, or post-v1 material into v0.

Active scope guard evidence:

- Mode: active
- Candidate files found: 20
- Files scanned: 19
- Failures: 0

Allowed v0 surfaces and scope remain narrow. Current manifest-derived allowed examples:

- Product surfaces: see docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json
- Engine phases: see docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json
- Execution scopes: see docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json

## Known exclusions

The following are not required v0 work and must not be treated as hidden v0 completion blockers:

- organisation/team/unit/gym/federation runtime
- marketplace
- messaging
- billing or subscription behaviour changing engine truth
- broad dashboards and analytics
- readiness, fatigue, risk, ranking, scoring, recommendation, optimisation, or advice semantics
- proof export and post-v0 evidence product surfaces
- auto progression and coach override as engine authority
- commercial launch features and sales dashboards

Manifest-derived forbidden examples remain controlled in docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json. Examples include:

- Product surfaces: see manifest
- Runtime semantics: see manifest
- Activity examples: see manifest

## Negative leakage evidence

S-V0-31 negative fixture runner result: PASS

Cases checked: 7

- post_v1_team_runtime_rejected: rejected=true; expected_token=V0_SCOPE_LEAK
- post_v1_organisation_dashboard_rejected: rejected=true; expected_token=V0_SCOPE_LEAK
- billing_driven_engine_behaviour_rejected: rejected=true; expected_token=V0_SCOPE_LEAK
- recommendation_language_rejected: rejected=true; expected_token=V0_SCOPE_LEAK
- proof_export_surface_rejected: rejected=true; expected_token=V0_FORBIDDEN_PRODUCT_SURFACE
- readiness_runtime_semantic_rejected: rejected=true; expected_token=V0_FORBIDDEN_RUNTIME_SEMANTIC
- auto_progression_surface_rejected: rejected=true; expected_token=V0_FORBIDDEN_PRODUCT_SURFACE

These are intentional negative probes only. They do not create active v1 or post-v1 product behaviour.

## Remaining blockers

No active required blocker marker found in docs/v0_REMAINING_BLOCKERS.md.

This audit does not reclassify optional, future, v1, or post-v0 work as required v0 work. If a later slice promotes any excluded surface into an active release boundary, that must be done through a separate explicit boundary-change slice with matching tests and docs.

## Fail-safe rule

If any gate in this audit fails, v0 readiness must be treated as failed for this audit run. The audit must not be used to mark v0 complete until the failing gate is fixed and rerun successfully.

Current failed gates: none
