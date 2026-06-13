<!-- DEV NOTE: Developer documentation surface. This document points to active release-boundary records. It does not create new product, engine, registry, or commercial scope. -->

# Active Release Boundary

Status: pointer document for developer handover.

Purpose: give a future developer one place to find the current release-boundary records without relying on founder memory.

This document is not a new authority layer. If a listed source and this pointer disagree, the listed source wins.

## Current active release lane

Current working lane: v0 closure and v1 preparation guardrails.

The v0 engine and completion boundary remains governed by the v0 release records and executable guards until v0 closure is explicitly complete.

The v1 lane is scope-locked for planning through the v1 boundary documents listed below.

Do not treat this pointer as permission to add v1 product implementation. V1 implementation still requires a named slice, declared authority source, acceptance item, non-scope check, and proof gate.

## Source-of-truth records

Read these for the current boundary:

1. `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
2. `docs/v0/V0_COMPLETION_GATE_MANIFEST.json`
3. `docs/release/V0_FINAL_RELEASE_READINESS_GATE.md`
4. `docs/release/V0_ENGINE_PUBLIC_CONTRACT_FREEZE.md`
5. `docs/release/V0_SCOPE_GUARD_HARDENING_RECORD.md`
6. `docs/release/V0_REGISTRY_BUNDLE_CLOSURE.md`
7. `docs/release/V0_REGISTRY_LAW_DOCUMENTATION_BINDING.md`
8. `docs/release/V0_COMMERCIAL_ARTEFACT_REGISTRY_CLOSURE.md`
9. `REPO_BOUNDARY_MAP.md`
10. `docs/dev/AUTHORITY_CHAIN.md`
11. `docs/v1/V1_RELEASE_BOUNDARY.md`
12. `docs/v1/V1_ACCEPTANCE_GATE.md`
13. `docs/v1/V1_NOT_IN_SCOPE.md`
14. `docs/v1/V1_DOC_AUTHORITY_MAP.md`

## Current v0 rule

v0 closure work may add guards, documentation, boundary checks, and proof records.

v0 closure work must not add new product capability unless a current release record explicitly permits it.

## Current v1 rule

v1 work may proceed only as named slices that map to:

- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/v1/V1_DOC_AUTHORITY_MAP.md`

V1 slices must state boundary, proof, and non-scope.

## Explicitly not added by this document

This document does not add:

- billing or subscription flows beyond a deliberately sliced controlled-launch payment path
- sales dashboards
- coach marketplace
- athlete marketplace
- new UI screens without a v1 acceptance item
- new registry content records without a registry slice
- new programme templates without a registry/template slice
- database migrations without a data-model slice
- org/team/unit/gym runtime capability
- live coach intervention
- claim, outcome, advisory, or interpretation language
- new engine public exports
- package version changes
- release tags
- Metric Threshold Marker Engine implementation

## Boundary check

Before changing code or docs, answer:

1. Which current boundary source permits this change?
2. Which acceptance gate item does this advance?
3. Which not-in-scope item does this avoid?
4. Which guard proves it?
5. Which files must remain untouched?
6. Does this change alter engine truth?
7. Does this change make docs, UI, payment, notes, metrics, proof, or copy appear more authoritative than engine contracts?

If the answer is unclear, inspect the relevant guard and source-of-truth record before editing.

## Completion references

v0 completion is not declared by this file.

Use the completion manifest and its verifier:

    node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs

Use full local gate from a clean tree:

    npm run verify

V1 completion is not declared by this file.

Use the v1 acceptance gate and any matching v1 release gate:

    docs/v1/V1_ACCEPTANCE_GATE.md
    node ci/scripts/run_v1_release_gate.mjs

<!-- S-V1-01:ACTIVE-V1-BOUNDARY-CONFIRMATION:START -->
## S-V1-01 Active v1 Boundary Confirmation

Status: active boundary confirmed

The active v1 boundary is confirmed by:

- docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.md
- docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json
- ci/guards/s_v1_01_active_boundary_confirmation_guard.mjs

This confirmation does not reopen v0 scope and does not add engine runtime behaviour.
<!-- S-V1-01:ACTIVE-V1-BOUNDARY-CONFIRMATION:END -->
