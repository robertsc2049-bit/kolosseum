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
| `ci/guards/artefacts_map_guard.mjs` | Repo Hygiene | high | ci/guards + ci/artefacts | DEV NOTE: Artefacts map guard. This script validates ci/artefacts/artefacts.json so |
| `ci/guards/ascii_only_ci_guards_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: ASCII-only CI guard source guard. This script protects ci/guards/*.mjs |
| `ci/guards/ban_direct_node_e_ref_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: Direct Node-from-PowerShell guard. This script protects repo patching |
| `ci/guards/ban_engine_src_imports_in_api_guard.mjs` | Runtime Boundary | high | engine | DEV NOTE: API-to-engine source import guard. This script protects the runtime |
| `ci/guards/ban_engine_status_guard.mjs` | Runtime Boundary | high | engine | DEV NOTE: Engine status footgun guard. This script bans the legacy |
| `ci/guards/ban_set_content_utf8_guard.mjs` | Encoding Hygiene | high | repo | DEV NOTE: PowerShell encoding footgun guard. This script blocks repo-owned |
| `ci/guards/clean_tree_guard.mjs` | Repo Hygiene | high | repo | DEV NOTE: Clean-tree guard. This script protects release, promotion, and CI |
| `ci/guards/dev_function_note_policy_guard.mjs` | Repo Governance | medium | repo | @law dev_function_note_policy |
| `ci/guards/dev_note_comment_policy_guard.mjs` | Repo Governance | medium | repo | @law dev_note_comment_policy |
| `ci/guards/developer_operating_conventions_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/diff_line_endings_guard.mjs` | Encoding Hygiene | high | repo | DEV NOTE: Diff line-ending guard. This script checks changed text files between |
| `ci/guards/engine_contract_guard.mjs` | Runtime Boundary | high | engine | DEV NOTE: Engine contract pin guard. This script protects ENGINE_CONTRACT.md |
| `ci/guards/engine_exports_types_guard.mjs` | Runtime Boundary | high | engine | DEV NOTE: Engine exports/types guard. This script protects the public engine |
| `ci/guards/evidence_seal_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: Evidence seal wrapper guard. This script keeps the CI guard entrypoint |
| `ci/guards/golden_manifest_guard.mjs` | Determinism | high | repo | DEV NOTE: Golden manifest pin guard. This script protects the deterministic |
| `ci/guards/golden_outputs_guard.mjs` | Determinism | high | repo | DEV NOTE: Golden outputs pin guard. This script protects deterministic golden |
| `ci/guards/green_ci_parity_guard.mjs` | CI Integrity | high | repo | DEV NOTE: Green/CI parity guard. This script protects the local-to-CI contract |
| `ci/guards/green_contract_installer_sync_guard.mjs` | CI Integrity | high | repo | DEV NOTE: Green contract installer sync guard. This script protects the installer |
| `ci/guards/green_entrypoint_guard.mjs` | CI Integrity | high | repo | DEV NOTE: Green entrypoint guard. This script protects CI and local validation |
| `ci/guards/guards_entrypoint_coverage_guard.mjs` | CI Integrity | high | repo | DEV NOTE: Guard entrypoint coverage guard. This script protects CI integrity by |
| `ci/guards/guards_index_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: Guards index guard. This script protects guard documentation and |
| `ci/guards/lockfile_note_guard.mjs` | LOCKFILE_NOTE | ERROR | REPO | DEV NOTE: Lockfile note guard. This script protects dependency-change review by |
| `ci/guards/no_bom_guard.mjs` | Encoding Hygiene | high | repo | DEV NOTE: No-BOM guard. This script protects byte-stable repo hygiene by |
| `ci/guards/no_crlf_guard.mjs` | Encoding Hygiene | high | repo | DEV NOTE: No-CRLF guard. This script protects byte-stable repo hygiene by |
| `ci/guards/no_legacy_constraints.mjs` | Repo Governance | medium | repo | DEV NOTE: Legacy constraint key guard. This script protects the canonical |
| `ci/guards/no_legacy_constraints.sh` | Repo Governance | medium | repo | DEV NOTE: Legacy constraint shell guard. This Bash entrypoint blocks deprecated |
| `ci/guards/no_mojibake_guard.mjs` | Encoding Hygiene | high | repo | DEV NOTE: Mojibake guard. This script protects repo text from common |
| `ci/guards/node_version_guard.mjs` | Build Integrity | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/nonempty_critical_ci_files_guard.mjs` | Repo Hygiene | high | ci/guards | @rationale: |
| `ci/guards/postv1_packaging_surface_registry_guard.mjs` | Release Packaging Integrity | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/readme_validation_contract_guard.mjs` | Contracts | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/registry_bundle_guard.mjs` | Registry Law | high | registry | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/registry_law_guard.mjs` | Registry Law | high | registry | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/registry_schema_presence_guard.mjs` | Registry Law | high | registry | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/repo_contract.mjs` | Contracts | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/run_pipeline_contract_version_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/run_v0_boundary_claim_consistency_guard.mjs` | V0 Boundary Pack | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/runtime-boundary.guard.ps1` | Repo Governance | medium | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/s_v1_01_active_boundary_confirmation_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_02b_non_scope_guard_hardening_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_03_repository_top_level_folder_contract_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_04_app_engine_boundary_contract_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_05_slice_template_enforcement_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_06_adr_system_start_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_07_developer_entry_pack_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_08_ci_master_gate_definition_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_09_failure_token_closure_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_11_account_model_boundary_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_12_coach_registration_provisioning_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/tag_version_guard.mjs` | Build Integrity | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/v1_boundary_guard_scaffolding_guard.mjs` | Repo Governance | medium | repo | @law v1_boundary_guard_scaffolding |
| `ci/guards/v1_locked_activity_set_guard.mjs` | Repo Governance | medium | repo | @law v1_locked_activity_set |
| `ci/guards/v1_registry_content_production_contract_guard.mjs` | Registry Law | high | registry | @law v1_registry_content_production_contract |
| `ci/guards/v1_registry_domain_scaffold_guard.mjs` | Registry Law | high | registry | @law v1_registry_domain_scaffold |
| `ci/guards/v1_registry_schema_target_guard.mjs` | Registry Law | high | registry | @law v1_registry_schema_target |
| `ci/guards/workflow_policy_header_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
