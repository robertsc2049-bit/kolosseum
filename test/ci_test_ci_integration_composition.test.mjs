
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import test from "node:test";
import pkg from "../package.json" with { type: "json" };
import {
  composeTestCiIntegrationCommandString,
  composeTestCiIntegrationCommands
} from "../ci/scripts/compose_test_ci_integration_from_index.mjs";

test("package.json test:ci:integration is single-owner and resolves from deterministic composition index", () => {
  assert.equal(
    pkg.scripts["test:ci:integration"],
    "node ci/scripts/run_test_ci_integration_from_index.mjs"
  );

  const commands = composeTestCiIntegrationCommands();
  assert.deepEqual(commands, [
    "node test/ci_test_ci_integration_api_regression_cluster_manifest_file.test.mjs",
    "node test/ci_test_ci_integration_api_regression_cluster_manifest.test.mjs",
    "node test/api.return_gate.regression.test.mjs",
    "node test/api.return_skip.regression.test.mjs",
    "node test/api.return_skip.persisted_replay.regression.test.mjs",
    "node test/api.runtime_events_state_parity.regression.test.mjs",
    "node test/api.events_append_only_history.regression.test.mjs",
    "node test/api.complete_step_events_state_parity.regression.test.mjs",
    "node test/api.return_continue_append_only_history.regression.test.mjs",
    "node test/api.state_replay_projection_after_split_decisions.regression.test.mjs",
    "node test/api.split_decision_idempotent_rejected.regression.test.mjs",
    "node test/api.blocks_compile_apply_unknown_maps_500.regression.test.mjs",
    "node test/api.return_continue_idempotent_after_ungate_wrapper.test.mjs",
    "node test/ci_test_ci_integration_vertical_slice_cluster_manifest_file.test.mjs",
    "node test/ci_test_ci_integration_vertical_slice_cluster_manifest.test.mjs",
    "node test/smoke_vertical_slice_plan_start_state.test.mjs",
    "node test/vertical_slice.api_http_return_gate.e2e.test.mjs",
    "node test/vertical_slice.api_http_return_skip.e2e.test.mjs",
    "node test/vertical_slice.api_http_complete_step.e2e.test.mjs",
    "node test/vertical_slice.api_http_unknown_engine_error_500.e2e.test.mjs",
    "node test/beta_e2e_01_closure_evidence.test.mjs",
    "node test/beta_e2e_01_persistent_http_product_journey_restart.integration.test.mjs",
    "node test/full_ui_02c_identity_account_persistent_http.integration.test.mjs",
    "node test/full_ui_03c_athlete_onboarding_persistent_http.integration.test.mjs",
    "node test/full_ui_04c_coach_commercial_persistent_http.integration.test.mjs",
    "node test/full_ui_04c_coach_commercial_webhook.test.mjs",
    "node test/beta_18_template_builder.integration.test.mjs",
    "node test/event_programme_compiler_service.test.mjs",
    "node test/beta19_coach_event_service.test.mjs",
    "node test/beta19_coach_event_assignment.integration.test.mjs",
    "node test/full_ui_08c_strength_reference_lifecycle_persistent.integration.test.mjs"
  ]);

  assert.equal(
    composeTestCiIntegrationCommandString(),
    commands.join(" && ")
  );
});
