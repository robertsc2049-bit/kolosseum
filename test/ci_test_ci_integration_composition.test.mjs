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
    "node test/api.blocks_compile_apply_unknown_maps_500.regression.test.mjs",
    "node test/ci_test_ci_integration_vertical_slice_cluster_manifest_file.test.mjs",
    "node test/ci_test_ci_integration_vertical_slice_cluster_manifest.test.mjs",
    "node test/smoke_vertical_slice_plan_start_state.test.mjs",
    "node test/vertical_slice.api_http_return_gate.e2e.test.mjs",
    "node test/vertical_slice.api_http_return_skip.e2e.test.mjs",
    "node test/vertical_slice.api_http_complete_step.e2e.test.mjs",
    "node test/vertical_slice.api_http_unknown_engine_error_500.e2e.test.mjs"
  ]);

  assert.equal(
    composeTestCiIntegrationCommandString(),
    commands.join(" && ")
  );
});