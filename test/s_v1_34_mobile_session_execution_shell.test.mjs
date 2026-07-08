import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  MOBILE_SESSION_EXECUTION_COPY_IDS,
  renderMobileSessionExecutionShell
} from "../src/mobileSessionExecutionShell.mjs";

const fixturePath = path.join(process.cwd(), "ci", "fixtures", "v1_mobile_session_execution_shell", "s_v1_34_mobile_session_execution_shell_cases.json");
const copyPath = path.join(process.cwd(), "copy", "mobile_session_execution_shell_copy.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function removePresentationOnlyFields(rendered) {
  const clone = deepClone(rendered);
  delete clone.layout;
  return clone;
}

test("S-V1-34 renders mobile shell from engine output without mutating supplied values", () => {
  const fixture = readJson(fixturePath);
  const testCase = fixture.cases.find((candidate) => candidate.case_id === "standard_shell_renders_engine_output");

  const engineBefore = deepClone(testCase.engine_output);
  const runtimeBefore = deepClone(testCase.runtime_state);

  const rendered = renderMobileSessionExecutionShell({
    engineOutput: testCase.engine_output,
    runtimeState: testCase.runtime_state,
    presentation: testCase.presentation
  });

  assert.equal(rendered.shell_id, "s_v1_34_mobile_session_execution_shell");
  assert.equal(rendered.source.session_id, "sess_s_v1_34_001");
  assert.equal(rendered.source.engine_status_value, "in_progress");
  assert.equal(rendered.display.current_work_item_id, "work_002");
  assert.equal(rendered.display.work_items.length, 2);
  assert.equal(rendered.display.work_items[0].state_value, "completed");
  assert.equal(rendered.display.work_items[1].state_value, "pending");
  assert.equal(rendered.mutation_contract.emits_runtime_event, false);
  assert.equal(rendered.mutation_contract.writes_storage, false);
  assert.equal(rendered.mutation_contract.imports_engine_module, false);
  assert.equal(rendered.mutation_contract.changes_engine_output, false);

  assert.deepEqual(testCase.engine_output, engineBefore);
  assert.deepEqual(testCase.runtime_state, runtimeBefore);
});

test("S-V1-34 low-input presentation changes layout only", () => {
  const fixture = readJson(fixturePath);
  const testCase = fixture.cases.find((candidate) => candidate.case_id === "low_input_changes_layout_only");

  const standard = renderMobileSessionExecutionShell({
    engineOutput: testCase.engine_output,
    runtimeState: testCase.runtime_state,
    presentation: { low_input_mode: false, nd_mode: false }
  });

  const reduced = renderMobileSessionExecutionShell({
    engineOutput: testCase.engine_output,
    runtimeState: testCase.runtime_state,
    presentation: { low_input_mode: true, nd_mode: true }
  });

  assert.equal(standard.layout.density, "standard");
  assert.equal(reduced.layout.density, "minimal");
  assert.deepEqual(removePresentationOnlyFields(standard), removePresentationOnlyFields(reduced));
});

test("S-V1-34 exposes return decision action intents as descriptors only", () => {
  const fixture = readJson(fixturePath);
  const testCase = fixture.cases.find((candidate) => candidate.case_id === "low_input_changes_layout_only");

  const rendered = renderMobileSessionExecutionShell({
    engineOutput: testCase.engine_output,
    runtimeState: testCase.runtime_state,
    presentation: testCase.presentation
  });

  assert.deepEqual(
    rendered.action_intents.map((action) => action.runtime_event_type),
    ["RETURN_CONTINUE", "RETURN_SKIP"]
  );

  assert.deepEqual(
    rendered.action_intents.map((action) => action.copy_id),
    [
      MOBILE_SESSION_EXECUTION_COPY_IDS.returnContinueAction,
      MOBILE_SESSION_EXECUTION_COPY_IDS.returnSkipAction
    ]
  );

  assert.equal(rendered.mutation_contract.emits_runtime_event, false);
});

test("S-V1-34 copy ids are backed by the mobile execution copy surface", () => {
  const copyEntries = readJson(copyPath);
  const registered = new Set(copyEntries.map((entry) => entry.copy_id));

  for (const copyId of Object.values(MOBILE_SESSION_EXECUTION_COPY_IDS)) {
    assert.equal(registered.has(copyId), true, `${copyId} missing from mobile session copy surface`);
  }

  for (const entry of copyEntries) {
    assert.equal(entry.surface_id, "mobile_session_execution_shell");
    assert.equal(typeof entry.text, "string");
    assert.equal(entry.text.length > 0, true);
  }
});
