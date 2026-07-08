<!-- DEV NOTE: S-V1-08 CI master gate definition surface. This document defines the v1 release-gate map without adding product, engine, registry, runtime, workflow, commercial, auth, proof, or UI behaviour. -->

# V1 CI Master Gate

Status: active v1 CI gate-definition document.
Slice: S-V1-08.
Manifest: `docs/v1/V1_CI_MASTER_GATE.json`.

## Purpose

Define the v1 CI master gate without adding broad duplicate workflows.

This document names the gate categories and the existing checks that must remain green before v1 can be called complete.

It is a release-gate map, not a new product specification.

## Authority rule

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

This document does not create product law, engine law, registry law, copy authority, auth implementation, proof implementation, workflow authority, commercial authority, legal authority, or release approval.

If this document conflicts with active release law, engine contracts, registry law, copy guards, proof guards, or executable CI checks, the active authority wins and this document must be corrected.

## Master gate rule

V1 completion is blocked unless every required gate category is complete, green, and mapped to an existing check or a deliberately sliced future check.

No manual assumption, partial completion language, hidden approval, or founder-memory shortcut may satisfy the v1 master gate.

## No duplicate CI rule

The v1 master gate reuses existing guard and workflow surfaces first.

Do not create expensive duplicate CI.

Do not add broad workflows unless a later named slice proves a gap that cannot be covered by existing guard runner patterns.

## Required gate categories

### 1. v0 closure

Purpose: v1 cannot be declared complete while required v0 closure gates are missing or failing.

Required existing checks and records:

- `node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs`
- `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
- `docs/v0/V0_COMPLETION_GATE_MANIFEST.json`
- `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`

### 2. v1 boundary

Purpose: v1 work must remain inside the active release boundary and not-in-scope records.

Required existing checks and records:

- `node ci/guards/v1_boundary_guard_scaffolding_guard.mjs`
- `node ci/guards/s_v1_01_active_boundary_confirmation_guard.mjs`
- `node ci/guards/s_v1_02b_non_scope_guard_hardening_guard.mjs`
- `node ci/guards/s_v1_03_repository_top_level_folder_contract_guard.mjs`
- `node ci/guards/s_v1_04_app_engine_boundary_contract_guard.mjs`
- `node ci/guards/s_v1_05_slice_template_enforcement_guard.mjs`
- `node ci/guards/s_v1_06_adr_system_start_guard.mjs`
- `node ci/guards/s_v1_07_developer_entry_pack_guard.mjs`
- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/v1/V1_DOC_AUTHORITY_MAP.md`

### 3. registry

Purpose: registry schema, domain, content-production contract, bundle, and law checks must remain green.

Required existing checks and records:

- `node ci/guards/v1_registry_schema_target_guard.mjs`
- `node ci/guards/v1_registry_domain_scaffold_guard.mjs`
- `node ci/guards/v1_registry_content_production_contract_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/scripts/run_registry_seal_gate.mjs`
- `docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md`

### 4. copy and claims

Purpose: user-facing and commercial-facing copy must stay factual, registered, and claim-safe.

Required existing checks and records:

- `node ci/scripts/lint_sales_claims.mjs`
- `node ci/scripts/run_commercial_artefact_registry_guard.mjs`
- `node ci/guards/run_v0_boundary_claim_consistency_guard.mjs`
- `docs/dev/CI_FAILURE_GUIDE.md`
- `docs/dev/FAILURE_TOKEN_INDEX.md`

### 5. auth and permissions

Purpose: auth and permission checks must gate product access only and must not alter engine truth.

Required existing checks and records:

- `node ci/guards/s_v1_04_app_engine_boundary_contract_guard.mjs`
- `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`

Future required checks when later implementation slices add the surfaces:

- relationship permission guards
- assigned-only coach visibility guards
- athlete self-visibility guards
- auth provider integration guards if a later slice adds provider implementation

### 6. proof, replay, and export

Purpose: proof-aware artefacts, replay, evidence, and export boundaries must be explicit and green before v1 completion.

Required existing checks and records:

- `node ci/guards/golden_manifest_guard.mjs`
- `node ci/guards/golden_outputs_guard.mjs`
- `node ci/guards/evidence_seal_guard.mjs`
- `node ci/scripts/run_s_v0_29_replay_vector_minimal_positive_guard.mjs`
- `node ci/scripts/sha256_guard.mjs`
- `docs/v1/V1_ACCEPTANCE_GATE.md`

Future required checks when later implementation slices add the surfaces:

- v1 replay boundary guard
- v1 evidence envelope guard
- v1 proof artefact view guard
- v1 export boundary guard

### 7. no-coupling and engine truth

Purpose: engine truth must not depend on UI, auth, billing, notes, copy, legal, commercial, analytics, or presentation state.

Required existing checks and records:

- `node ci/guards/engine_contract_guard.mjs`
- `node ci/guards/engine_exports_types_guard.mjs`
- `node ci/scripts/run_v0_no_coupling_engine_boundary_guard.mjs`
- `node ci/guards/ban_engine_src_imports_in_api_guard.mjs`
- `node ci/guards/s_v1_04_app_engine_boundary_contract_guard.mjs`
- `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`

## Current primary local gate

Primary local gate:

    npm.cmd run lint:fast

This command is the current fast local gate. It does not replace later full release gates.

## Generated-file owners

Generated files must be refreshed only through owning generators:

- `docs/GUARDS_INDEX.md` -> `npm.cmd run guard:index`
- `docs/dev/FAILURE_TOKEN_INDEX.md` -> `node ci/scripts/run_failure_token_index_guard.mjs --write`
- `docs/checksums.sha256` -> `npm.cmd run hash:write`

Do not manually patch generated indexes or checksums.

## What this slice does not do

S-V1-08 does not:

- change runtime behaviour
- change engine behaviour
- change app implementation
- change registry content
- change payment/auth/UI implementation
- create a broad duplicate workflow
- create v1 release approval
- declare v1 complete
- manually edit generated files

## Final rule

V1 is not complete until the v1 CI master gate categories are all satisfied by current checks or by deliberately sliced future checks.

The gate is complete only when the manifest, acceptance gate, release boundary, executable checks, generated indexes, and checksums agree.
