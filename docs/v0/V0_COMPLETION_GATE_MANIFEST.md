# Kolosseum v0 Completion Gate Manifest

Document ID: v0_completion_gate_manifest
Version: 1.0.0
Status: authoritative
Release: v0 - Deterministic Execution Alpha

## Purpose

This document is the single v0 completion checklist.

v0 is complete only when every required gate passes from a clean tree using the recorded command or verifier.

This document does not create engine law, product scope, registry authority, copy authority, legal authority, or commercial authority. It consolidates completion evidence only.

## Required source documents

The machine-readable source is `docs/v0/V0_COMPLETION_GATE_MANIFEST.json`.

The required source documents are:

- `docs/product/P199_V0_COMPLETION_GATE.md`
- `docs/v0/V0_ACTIVE_SCOPE_MANIFEST.md`
- `docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json`
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`
- `docs/v0_RUNTIME_PROOF_MATRIX.md`
- `docs/v0_DECISION_SCORECARD.md`
- `docs/v0_FINAL_DECISION_NOTE.md`
- `docs/V0_G03_G04_PROOF_AUDIT.md`
- `docs/v0_READINESS_REBASELINE.md`
- `docs/V0_RELEASE_GAP_MATRIX.md`
- `docs/v0_REMAINING_BLOCKERS.md`
- `docs/product/v0_boundary_exclusions.json`
- `docs/product/v0_allowed_claims.json`
- `docs/GUARDS_INDEX.md`
- `docs/product/CURRENT_PROJECT_DOCS_STATUS.md`

## Required commands

The completion gate requires these checks to pass:

- `npm run build`
- `npm run lint`
- `node ci/scripts/run_v0_active_scope_guard.mjs`
- `node ci/scripts/run_v0_active_scope_negative_tests.mjs`
- `node ci/guards/run_v0_boundary_claim_consistency_guard.mjs`
- `node ci/scripts/run_phase1_acceptance_record_tests.mjs`

## Required lint-fast enforcement

The following commands must be present in `lint:fast`:

- `node ci/guards/run_v0_boundary_claim_consistency_guard.mjs`
- `node ci/scripts/run_v0_active_scope_guard.mjs`
- `node ci/scripts/run_v0_active_scope_negative_tests.mjs`
- `node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs`
- `node ci/scripts/run_phase1_acceptance_record_tests.mjs`

The completion manifest verifier must run after the active v0 scope guard and before the Phase 1 acceptance record tests.

## Completion assertions

- Completion checks must run from a clean working tree.
- Active v0 scope guard must be enforced in `lint:fast`.
- Active v0 scope negative tests must be enforced in `lint:fast`.
- This completion manifest verifier must be enforced in `lint:fast`.
- Phase 1 acceptance record tests must be enforced in `lint:fast`.
- This manifest verifies completion evidence only and does not create new engine behaviour.

## Not completion claims

Passing this gate does not make post-v1 features active.

Passing this gate does not admit organisation, team, unit, gym, federation, marketplace, messaging, broad analytics, proof export, or live commercial dashboards into v0.

Passing this gate does not override canonical engine, registry, runtime, copy, legal, or commercial law.

## Final rule

If a required source document is missing, the v0 completion gate fails.

If a required guard or runner is missing, the v0 completion gate fails.

If a required `lint:fast` entry is missing or out of order, the v0 completion gate fails.

If the manifest attempts to create new engine law, product scope, or release scope, the v0 completion gate fails.
