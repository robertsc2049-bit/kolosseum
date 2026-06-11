# V0 Scope Guard Hardening Record

Status: active v0 release record.
Slice: S-V0-02 Scope Guard Hardening.
Recorded UTC: 2026-06-11T08:43:38Z
Commit inspected: 1eed605

## DEV NOTE: purpose

This record documents the active v0 scope boundary after the S-V0-02 hardening pass.

It does not weaken executable guard scripts. It tells a future developer which files enforce the boundary, which terms were checked, and why future/v1 material can exist only when it remains outside active v0 runtime.

## DEV NOTE: active guard files

The active v0 scope guard files are:

- ci/scripts/run_v0_active_scope_guard.mjs
- ci/scripts/run_v0_active_scope_negative_tests.mjs

The v0 completion manifest is:

- docs/release/V0_COMPLETION_GATE_MANIFEST.md

Do not use or create a fake path such as ci/scripts/v0_scope_guard.mjs. The active guard path is the run_v0_active_scope_guard script.

## DEV NOTE: boundary invariant

Active v0 is the Deterministic Execution Alpha.

Active v0 remains limited to individual and coach-managed execution, powerlifting, rugby_union, general_strength, Phase 1 through Phase 6, factual runtime state, split/return/continue/skip/stop/partial completion, non-binding coach notes, and CI-enforced deterministic boundaries.

The following must not become active v0 runtime scope: organisation, organization, team, unit, gym runtime, gym access, marketplace, messaging, subscription/billing implementation, broad dashboard surfaces, AI recommendation surfaces, optimisation/optimization logic, readiness labels, fatigue labels, risk labels, medical claims, rehab claims, Phase 7 release capability, Phase 8 evidence sealing, and exportable proof artefacts.

## DEV NOTE: future documents

Future/v1 documents may exist in the repo if they are not active v0 runtime code and do not make v0 completion depend on post-v0 capability.

Do not delete valid future documents merely because they describe later roadmap scope. The hard boundary is active reachability, active runtime import, active product surface, and active completion criteria.

## DEV NOTE: failure behaviour

If active v0 code imports, executes, exposes, or requires post-v0 scope, the scope guard or negative-scope tests must fail.

Do not bypass that failure by renaming the post-v0 feature, hiding it in a loosely named file, or treating a future feature as runtime scaffolding.

If valid future documentation fails an active runtime guard, update the allowance precisely so future documentation remains dormant and active runtime remains closed.

## Guard coverage check

| Term | Active Guard Contains | Negative Tests Contain | Manifest Boundary Contains |
|---|---:|---:|---:|
| organisation | True | True | True |
| organization | True | True | False |
| team | True | True | True |
| unit | True | True | True |
| gym | True | True | True |
| marketplace | False | False | True |
| messaging | False | False | True |
| subscription | True | True | True |
| dashboard | True | True | True |
| AI | True | True | True |
| recommendation | True | True | False |
| optimisation | True | False | True |
| optimization | False | False | False |
| readiness | True | True | True |
| fatigue | False | False | False |
| risk | True | True | False |
| medical | True | True | True |
| rehab | True | True | False |
| Phase 7 | False | False | True |
| Phase 8 | False | False | True |

## S-V0-02 completion condition

S-V0-02 is complete only when:

- active guard files exist
- negative-scope tests exist
- the active boundary explicitly accounts for organisation, organization, team, unit, gym, marketplace, messaging, subscription, dashboard, AI recommendation, optimisation, optimization, readiness, fatigue, risk, medical, rehab, Phase 7, and Phase 8 scope
- all required repo gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
