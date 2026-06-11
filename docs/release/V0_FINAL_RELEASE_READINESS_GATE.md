# V0 Final Release Readiness Gate

Status: v0 final release readiness closure record.

Slice coverage: S-V0-19 Final Release Readiness Gate Inspection.

## Purpose

This record closes the v0 release-readiness inspection after the v0 completion, scope, registry, golden, runtime, API, and persistence closure slices were promoted to `main`.

This file does not create new engine law, registry law, product scope, or release scope. It binds the current v0 readiness decision to existing canonical documents, existing guard scripts, and clean-main proof commands.

## Canonical completion sources

The v0 completion decision is controlled by the existing completion and boundary documents:

- `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
- `docs/v0/V0_COMPLETION_GATE_MANIFEST.md`
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`
- `docs/V0_RELEASE_SPINE.md`
- `docs/V0_RELEASE_GAP_MATRIX.md`
- `docs/v0_REMAINING_BLOCKERS.md`
- `docs/v0_RUNTIME_PROOF_MATRIX.md`
- `docs/release/V0_GOLDEN_MANIFEST_OUTPUT_CLOSURE.md`

If these documents conflict, do not resolve the conflict by editing this closure record. Fix the canonical source document or the verifier that owns the relevant gate.

## Required readiness guards

S-V0-19 confirms that the final v0 readiness gate remains bound to existing executable checks, including:

- `node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs`
- `node ci/scripts/run_v0_active_scope_guard.mjs`
- `node ci/scripts/run_v0_active_scope_negative_tests.mjs`
- `node ci/guards/golden_manifest_guard.mjs`
- `node ci/guards/golden_outputs_guard.mjs`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/guards/engine_contract_guard.mjs`
- `node ci/guards/engine_exports_types_guard.mjs`
- `node ci/guards/run_v0_boundary_claim_consistency_guard.mjs`

These guards are authoritative as executable proof surfaces. This record is only the closing inspection note for S-V0-19.

## Required clean-main commands

The minimum local readiness proof for this slice is:

- `npm.cmd run build:fast`
- `node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs`
- `node ci/scripts/run_v0_active_scope_guard.mjs`
- `node ci/scripts/run_v0_active_scope_negative_tests.mjs`
- `node ci/guards/golden_manifest_guard.mjs`
- `node ci/guards/golden_outputs_guard.mjs`
- `npm.cmd run e2e:golden`
- `npm.cmd run test:v0`
- `npm.cmd run test:ci`
- `npm.cmd run test:full`

GitHub PR promotion must additionally show all required PR checks green before merge.

## S-V0-19 readiness assertions

S-V0-19 is complete only when all of the following are true:

1. The repo is on `main` before the slice branch is created.
2. The working tree is clean before the slice begins.
3. The final readiness record adds no new engine law, registry law, product scope, or release scope.
4. Existing v0 completion manifests and active-scope guards remain the source of completion proof.
5. Golden manifest and golden output guards pass without updating golden outputs.
6. The v0 test suite passes from the committed branch.
7. The full comprehensive suite passes from the committed branch.
8. GitHub PR checks pass before promotion.
9. The branch is merged only after green checks.
10. Local `main` is clean and synced after promotion.

## Explicit non-goals

S-V0-19 does not:

- add v1 product capability
- expand supported activities
- add organisation, gym, marketplace, messaging, billing, or coach-dashboard scope
- alter deterministic engine behaviour
- alter runtime event semantics
- alter registry data
- update golden outputs
- soften failing guards
- replace any canonical completion document

## Developer note

Use this file as the final S-V0-19 inspection record only. A future developer should read this as a pointer map to the existing v0 completion proof, not as a new source of truth.

Canonical docs define law. This record binds the final readiness inspection. Tests and CI prove behaviour.