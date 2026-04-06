# Guards Index

This file is **auto-generated** from `ci/guards/`.

## Legend
- **@law**: what rule family the guard enforces
- **@severity**: low | medium | high
- **@scope**: repo | engine | registry | docs | ci | ... (free-form but consistent)
- **@desc**: (optional) short human description; if missing, the generator may fall back to the first top comment

## Guards

| Guard | @law | @severity | @scope | Description |
|---|---|---|---|---|
| `ci/guards/artefacts_map_guard.mjs` | Repo Hygiene | high | ci/guards + ci/artefacts |  |
| `ci/guards/ascii_only_ci_guards_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/ban_direct_node_e_ref_guard.mjs` | Repo Governance | medium | repo | Policy: Invoke-NodeE is the ONLY allowed interface for ad-hoc Node from PowerShell. |
| `ci/guards/ban_engine_src_imports_in_api_guard.mjs` | Runtime Boundary | high | engine |  |
| `ci/guards/ban_engine_status_guard.mjs` | Runtime Boundary | high | engine |  |
| `ci/guards/ban_set_content_utf8_guard.mjs` | Encoding Hygiene | high | repo |  |
| `ci/guards/clean_tree_guard.mjs` | Repo Hygiene | high | repo | We forbid: |
| `ci/guards/diff_line_endings_guard.mjs` | Encoding Hygiene | high | repo |  |
| `ci/guards/engine_contract_guard.mjs` | Runtime Boundary | high | engine | Content sanity: keeps accidental replacements from passing even if hash disabled later |
| `ci/guards/engine_exports_types_guard.mjs` | Runtime Boundary | high | engine |  |
| `ci/guards/evidence_seal_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/golden_manifest_guard.mjs` | Determinism | high | repo | IMPORTANT: This MUST be a 64-hex string. If this is empty, you previously broke the guard. |
| `ci/guards/golden_outputs_guard.mjs` | Determinism | high | repo |  |
| `ci/guards/green_ci_parity_guard.mjs` | CI Integrity | high | repo |  |
| `ci/guards/green_contract_installer_sync_guard.mjs` | CI Integrity | high | repo |  |
| `ci/guards/green_entrypoint_guard.mjs` | CI Integrity | high | repo | Guard: prevent ad-hoc partial runs that can hide implicit writes. |
| `ci/guards/guards_entrypoint_coverage_guard.mjs` | CI Integrity | high | repo |  |
| `ci/guards/guards_index_guard.mjs` | Repo Governance | medium | repo | Locale-independent ASCII comparator. |
| `ci/guards/lockfile_note_guard.mjs` | LOCKFILE_NOTE | ERROR | REPO |  |
| `ci/guards/no_bom_guard.mjs` | Encoding Hygiene | high | repo |  |
| `ci/guards/no_crlf_guard.mjs` | Encoding Hygiene | high | repo |  |
| `ci/guards/no_legacy_constraints.mjs` | Repo Governance | medium | repo | Only allow legacy keys in these explicit negative test fixtures. |
| `ci/guards/no_legacy_constraints.sh` | Repo Governance | medium | repo | !/usr/bin/env bash |
| `ci/guards/no_mojibake_guard.mjs` | Encoding Hygiene | high | repo | Detect common UTF-8->legacy decode artifacts by searching for *byte sequences*. |
| `ci/guards/node_version_guard.mjs` | Build Integrity | high | repo |  |
| `ci/guards/nonempty_critical_ci_files_guard.mjs` | Repo Hygiene | high | ci/guards | @rationale: |
| `ci/guards/postv1_packaging_surface_registry_guard.mjs` | Release Packaging Integrity | high | repo |  |
| `ci/guards/readme_validation_contract_guard.mjs` | Contracts | high | repo | Policy: README must not instruct humans to run internal green entrypoints. |
| `ci/guards/registry_bundle_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/registry_law_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/registry_schema_presence_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/repo_contract.mjs` | Contracts | high | repo | --- package.json contract --- |
| `ci/guards/run_pipeline_contract_version_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/run_v0_boundary_claim_consistency_guard.mjs` | V0 Boundary Pack | high | repo |  |
| `ci/guards/runtime-boundary.guard.ps1` | Repo Governance | medium | repo |  |
| `ci/guards/tag_version_guard.mjs` | Build Integrity | high | repo | Not a tag build -> no-op |
| `ci/guards/workflow_policy_header_guard.mjs` | Repo Governance | medium | repo |  |
