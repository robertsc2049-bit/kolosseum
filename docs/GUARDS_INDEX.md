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
| `ci/guards/beta_11_phase4_enumeration_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: BETA-11 static, fixture-integrity, and compiled-runtime contract guard. |
| `ci/guards/beta_12_phase5_materialisation_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: BETA-12 deterministic Phase 5 materialisation contract guard. |
| `ci/guards/beta_13_phase6_event_schema_guard.mjs` | Repo Governance | high | engine | DEV NOTE: BETA-13 closed-world Phase 6 runtime event schema guard. |
| `ci/guards/beta_14_phase6_runtime_reducer_guard.mjs` | Repo Governance | high | engine | DEV NOTE: BETA-14 deterministic Phase 6 factual runtime reducer guard. |
| `ci/guards/beta_15_phase6_negative_gates_guard.mjs` | Repo Governance | high | engine | DEV NOTE: BETA-15 closed Phase 6 invalid-runtime failure guard. |
| `ci/guards/beta_16_app_path_phase1_6_guard.mjs` | Repo Governance | high | app | DEV NOTE: BETA-16 app path, Copy Registry and Phase 1-6 integration guard. |
| `ci/guards/beta_17_coach_managed_path_guard.mjs` | Repo Governance | high | app | DEV NOTE: BETA-17 coach-managed permission, note isolation and Copy Registry guard. |
| `ci/guards/beta_18_phase7_schema_binding_guard.mjs` | Repo Governance | high | engine | DEV NOTE: BETA-18 Phase 7 schema, binding, isolation, and exact v0 exclusion guard. |
| `ci/guards/beta_19_phase7_factual_projection_guard.mjs` | Repo Governance | high | engine | DEV NOTE: BETA-19 factual Phase 7 projection and source-isolation guard. |
| `ci/guards/beta_20_phase7_hash_copy_guard.mjs` | Repo Governance | high | engine | DEV NOTE: BETA-20 Phase 7 rendered-byte, Copy Registry, and render-stack guard. |
| `ci/guards/beta_21_replay_vector_envelope_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-21 replay-vector envelope, byte, schema, pin, and non-mutation guard. |
| `ci/guards/beta_22_replay_verify_runner_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-22 verify-only Phase 1-7 replay, byte, repeat, and CI immutability guard. |
| `ci/guards/beta_23_runner_verdict_contract_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-23 RunnerVerdict shape, checksum, scope honesty, and Phase 8 dependency guard. |
| `ci/guards/beta_24_phase8_evidence_schema_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-24 closed-world Phase 8 EvidenceEnvelope schema guard. |
| `ci/guards/beta_25_phase8_chain_seal_gates_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-25 Phase 8 chain and seal-authorisation guard. |
| `ci/guards/beta_26_evidence_immutability_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-26 sealed evidence immutability guard. |
| `ci/guards/beta_27_projection_evidence_export_guard.mjs` | Repo Governance | high | replay | DEV NOTE: BETA-27 byte-identical projection and evidence export guard. |
| `ci/guards/beta_28_auth_rls_security_pass_guard.mjs` | Repo Governance | high | security | DEV NOTE: BETA-28 auth, RLS and sensitive-resource security guard. |
| `ci/guards/beta_29_production_beta_rehearsal_guard.mjs` | Repo Governance | high | release | DEV NOTE: BETA-29 production beta rehearsal composition guard. |
| `ci/guards/beta_fix_01_copy_registry_reconciliation_guard.mjs` | Beta Copy Registry Authority | high | beta-copy | DEV NOTE: BETA-FIX-01 authoritative beta copy registry reconciliation guard. |
| `ci/guards/clean_tree_guard.mjs` | Repo Hygiene | high | repo | DEV NOTE: Clean-tree guard. This script protects release, promotion, and CI |
| `ci/guards/dev_function_note_policy_guard.mjs` | Repo Governance | medium | repo | @law dev_function_note_policy |
| `ci/guards/dev_note_comment_policy_guard.mjs` | Repo Governance | medium | repo | @law dev_note_comment_policy |
| `ci/guards/developer_operating_conventions_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/diff_line_endings_guard.mjs` | Encoding Hygiene | high | repo | DEV NOTE: Diff line-ending guard. This script checks changed text files between |
| `ci/guards/engine_contract_guard.mjs` | Runtime Boundary | high | engine | DEV NOTE: Engine contract pin guard. This script protects ENGINE_CONTRACT.md |
| `ci/guards/engine_exports_types_guard.mjs` | Runtime Boundary | high | engine | DEV NOTE: Engine exports/types guard. This script protects the public engine |
| `ci/guards/evidence_seal_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: Evidence seal wrapper guard. This script keeps the CI guard entrypoint |
| `ci/guards/full_ui_completion_guard.mjs` | Product UI Completion | high | product-ui |  |
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
| `ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_08_exercise_equipment_fk_closure_candidate_update_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_09_exercise_activity_applicability_candidate_seeds_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_10_sport_context_candidate_seeds_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_11_sport_metric_candidate_seeds_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_12_metric_exercise_link_candidate_seeds_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_14_registry_build_readiness_start_gate_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_15_candidate_exercise_registry_content_batch_1_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_16_candidate_equipment_registry_content_batch_1_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_17_exercise_equipment_candidate_fk_closure_expansion_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_18_exercise_activity_applicability_candidate_expansion_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_19_sport_metric_candidate_expansion_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_reg_21_threshold_marker_candidate_records_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_reg_22_candidate_registry_build_review_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_23_registry_activation_hold_decision_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_reg_24_registry_activation_contract_design_guard.mjs` | Registry Law | high | registry |  |
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
| `ci/guards/s_v1_13_athlete_registration_invitation_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_14_coach_athlete_relationship_acceptance_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_15_relationship_permission_guards_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_16_phase_1_declaration_surface_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_17_declaration_acceptance_record_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_18_declaration_compile_gate_guard.mjs` | Repo Governance | high | repo |  |
| `ci/guards/s_v1_19_onboarding_start_gate_guard.mjs` | Repo Governance | high | repo |  |
| `ci/guards/s_v1_20_supported_activity_set_lock_guard.mjs` | v1 Supported Activity Boundary | high | v1-boundary | DEV NOTE: S-V1-20 boundary guard. This guard closes the v1 supported |
| `ci/guards/s_v1_21_exercise_registry_contract_guard.mjs` | v1 Exercise Registry Contract | high | v1-registry | DEV NOTE: S-V1-21 boundary guard. This guard proves the exercise registry |
| `ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs` | v1 Equipment Registry Coverage Contract | high | v1-registry | DEV NOTE: S-V1-22 boundary guard. This guard proves the equipment registry |
| `ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs` | v1 Exercise Activity Applicability Coverage Contract | high | v1-registry | DEV NOTE: S-V1-23 boundary guard. This guard proves the exercise activity |
| `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs` | v1 Registry Load Order and FK Closure | high | v1-registry | DEV NOTE: S-V1-24 boundary guard. This guard hardens deterministic registry |
| `ci/guards/s_v1_25_registry_content_production_system_guard.mjs` | v1 Registry Content Production System | high | v1-registry | DEV NOTE: S-V1-25 boundary guard. This guard proves the registry content |
| `ci/guards/s_v1_26_programme_template_contract_guard.mjs` | v1 Programme Template Contract | high | v1-registry | DEV NOTE: S-V1-26 contract guard. This guard proves the programme template |
| `ci/guards/s_v1_27_template_registry_coverage_guard.mjs` | v1 Template Registry Coverage | high | v1-registry | DEV NOTE: S-V1-27 coverage guard. This guard proves explicit declared |
| `ci/guards/s_v1_28_programme_assignment_contract_guard.mjs` | v1 Programme Assignment Contract | high | v1-product-auth | DEV NOTE: S-V1-28 guard. This verifies the bounded programme assignment |
| `ci/guards/s_v1_29_assignment_visibility_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_30_compile_input_canonicalisation_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_31_compile_output_contract_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_32_substitution_engine_contract_guard.mjs` | Runtime Boundary | high | engine |  |
| `ci/guards/s_v1_33_substitution_registry_closure_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_v1_34_mobile_session_execution_shell_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_35_session_start_flow_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_36_runtime_event_reducer_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_37_split_return_flow_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_38_stop_skip_partial_completion_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_39_session_state_events_readback_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_40_athlete_factual_history_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_41_coach_factual_artefact_view_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_42_coach_notes_engine_invisible_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_43_live_session_status_read_only_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_44_replay_boundary_contract_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_45_evidence_envelope_contract_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_46_proof_artefact_view_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_47_export_boundary_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_01_founder_test_pack_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_02_v1_acceptance_gate_runner_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_03_controlled_launch_readiness_record_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_04_v1_release_tag_preparation_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_05_v1_final_ship_decision_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_08_release_evidence_snapshot_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_f_12_controlled_launch_go_no_go_record_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_g_02_registry_workability_audit_launch_hold_guard.mjs` | Registry Law | high | registry |  |
| `ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_l_02_gdpr_export_handling_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_l_03_gdpr_delete_queue_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_l_04_cookie_consent_surface_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_o_01_status_page_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_o_02_error_reporting_initialisation_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_o_03_backup_restore_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_o_04_runbook_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_p_01_payment_boundary_contract_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_p_03_seat_entitlement_guard_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_p_04_billing_management_surface_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_r_01_factual_session_reminder_notification_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_r_02_factual_weekly_summary_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_r_03_retention_access_window_policy_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_u_01_athlete_dashboard_shell_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_u_02_coach_dashboard_shell_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_u_03_coach_review_queue_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_u_04_template_assignment_ui_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/s_v1_u_05_session_execution_polish_guard.mjs` | Repo Governance | medium | repo |  |
| `ci/guards/tag_version_guard.mjs` | Build Integrity | high | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
| `ci/guards/v1_boundary_guard_scaffolding_guard.mjs` | Repo Governance | medium | repo | @law v1_boundary_guard_scaffolding |
| `ci/guards/v1_locked_activity_set_guard.mjs` | Repo Governance | medium | repo | @law v1_locked_activity_set |
| `ci/guards/v1_registry_content_production_contract_guard.mjs` | Registry Law | high | registry | @law v1_registry_content_production_contract |
| `ci/guards/v1_registry_domain_scaffold_guard.mjs` | Registry Law | high | registry | @law v1_registry_domain_scaffold |
| `ci/guards/v1_registry_schema_target_guard.mjs` | Registry Law | high | registry | @law v1_registry_schema_target |
| `ci/guards/workflow_policy_header_guard.mjs` | Repo Governance | medium | repo | DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with |
