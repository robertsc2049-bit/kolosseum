// DEV NOTE: FULL-UI-15C session execution static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const writeService = read("src/api/session_state_write_service.ts");
const readModel = read("src/api/session_state_read_model.ts");
const substitutionRegistry = read("src/api/session_substitution_registry.ts");
const substitutionService = read("src/api/session_substitution_service.ts");
const sessionsRoutes = read("src/api/sessions.routes.ts");
const sessionsHandlers = read("src/api/sessions.handlers.ts");
const schema = read("schema.sql");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("session view declares loading and error-recovery states", () => {
  for (const id of ["sessionLoading", "sessionServiceUnavailable", "sessionRetryButton"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /async function loadSessionState\(/u);
  assert.match(js, /elements\.sessionServiceUnavailable\.hidden = false/u);
  assert.match(js, /elements\.sessionRetryButton\.addEventListener\("click", \(\) => loadSessionState\(\)/u);
});

test("skip exercise requires a factual reason from a closed enum", () => {
  for (const id of ["skipExerciseButton", "skipReasonPanel", "skipReasonSelect", "confirmSkipButton", "cancelSkipButton"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  for (const code of ["equipment_unavailable", "time_constraint", "pain_or_discomfort", "fatigue", "other"]) {
    assert.ok(html.includes(`value="${code}"`), `Expected skip reason option ${code}`);
  }

  assert.match(writeService, /SKIP_REASON_CODES = Object\.freeze/u);
  assert.match(writeService, /phase6_runtime_skip_reason_invalid/u);
  assert.match(js, /async function confirmSkipWithReason/u);
  assert.match(js, /type: "SKIP_EXERCISE"[\s\S]{0,80}reason_code: reasonCode/u);
});

test("pain input records only the permitted factual flag, never free text or scoring", () => {
  for (const id of ["reportPainButton", "painReportPanel", "confirmPainReportButton", "cancelPainReportButton"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(writeService, /PAIN_REPORT_ALLOWED_KEYS = new Set\(\["type", "exercise_id", "pain_reported", "client_request_id"\]\)/u);
  assert.match(writeService, /phase6_runtime_pain_report_invalid_shape/u);
  assert.match(writeService, /obj\.pain_reported !== true/u);

  // Guard against ever reintroducing a free-text or scoring field.
  assert.doesNotMatch(writeService, /pain_text|pain_severity|risk_score/u);

  assert.match(js, /async function confirmPainReport/u);
  assert.match(js, /type: "PAIN_REPORT"[\s\S]{0,80}pain_reported: true/u);
});

test("substitution uses the existing v1 substitution contract and a closed registry, never an improvised exercise", () => {
  assert.match(substitutionService, /from "\.\.\/v1SubstitutionEngineContract\.mjs"/u);
  assert.match(substitutionService, /tryBuildV1SubstitutionResult/u);

  assert.doesNotMatch(
    substitutionRegistry,
    /(?:import|require|readFileSync|readFile)[\s\S]{0,120}exercise_substitution_graph\.json/u
  );

  assert.match(sessionsRoutes, /"\/:session_id\/substitution-request"/u);
  assert.match(sessionsHandlers, /export async function postSessionSubstitutionRequest/u);

  assert.match(writeService, /findSubstitutionRegistryEdge/u);
  assert.match(writeService, /phase6_runtime_substitution_tag_unlawful/u);

  for (const id of ["requestSubstitutionButton", "substitutionPanel", "checkSubstitutionButton", "cancelSubstitutionButton", "substitutionResult"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /async function checkSubstitution/u);
  assert.match(js, /async function applySubstitution/u);
  assert.match(js, /substituted_exercise_id: outcome\.result\.substitution_output\.target_exercise_id/u);
});

test("planned_items and exercise_id remain authoritative through substitution and skip annotations", () => {
  // The tag validator only accepts substitution facts alongside the existing
  // COMPLETE_EXERCISE/SKIP_EXERCISE exercise_id - it never rewrites it.
  assert.match(writeService, /function ensureSubstitutionTagValid/u);
  assert.match(writeService, /isExerciseProgressEventType\(t\)/u);
  assert.doesNotMatch(writeService, /event\.exercise_id\s*=\s*(?:obj\.)?substituted_exercise_id/u);
});

test("idempotent retry: client_request_id dedupes without creating a duplicate runtime event", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS session_event_requests/u);
  assert.match(schema, /PRIMARY KEY \(session_id, client_request_id\)/u);

  assert.match(writeService, /function findCachedEventRequest/u);
  assert.match(writeService, /function recordEventRequest/u);
  assert.match(writeService, /phase6_runtime_request_id_conflict/u);
  assert.match(writeService, /replayed: true/u);

  assert.match(js, /function newClientRequestId/u);
  assert.match(js, /client_request_id: clientRequestId/u);
});

test("terminal sessions reject further events instead of being resurrected", () => {
  assert.match(writeService, /function ensureTerminalSessionEventRejected/u);
  assert.match(writeService, /phase6_runtime_terminal_session_event_rejected/u);
  assert.match(writeService, /ensureTerminalSessionEventRejected\(workingSummary, event\)/u);
});

test("completion summary is a genuine dedicated artefact beyond the badge and counts", () => {
  assert.ok(html.includes('id="sessionCompletionSummary"'));
  assert.ok(html.includes('id="sessionCompletionHeading"'));
  assert.ok(html.includes('id="sessionCompletionBody"'));
  assert.ok(html.includes('id="sessionCompletionCompletedCount"'));
  assert.ok(html.includes('id="sessionCompletionDroppedCount"'));

  assert.match(js, /function renderSessionCompletionSummary/u);
  assert.match(js, /executionStatus === "completed" \|\| executionStatus === "partial"/u);

  assert.match(readModel, /execution_status/u);
});

test("rest timer counts down prescribed rest with a completion cue, entirely client-side", () => {
  for (const id of ["restTimerPanel", "restTimerRemaining", "skipRestButton"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(html, /<button[^>]*id="skipRestButton"[^>]*type="button"/u);

  for (const fnName of ["formatRestClock", "playRestCompleteCue", "stopRestTimer", "startRestTimer", "maybeStartRestTimer"]) {
    assert.match(js, new RegExp(`function ${fnName}\\(`, "u"), `Expected function ${fnName}`);
  }

  assert.match(js, /state\.activeSessionState\?\.current_step\?\.exercise\?\.rest_seconds/u);

  // Started before COMPLETE_STEP, and before the COMPLETE_EXERCISE branch of
  // applySubstitution - never on skip, and never gated on a backend event.
  assert.match(js, /maybeStartRestTimer\(\);\s*\n\s*postSessionEvent\(\{ type: "COMPLETE_STEP" \}\)/u);
  assert.match(js, /if \(eventType === "COMPLETE_EXERCISE"\) maybeStartRestTimer\(\);/u);

  assert.match(js, /elements\.skipRestButton\.addEventListener\("click", stopRestTimer\)/u);

  // Never touched by the shared panel-reset paths - a timer started by the
  // same click that triggers a re-render must survive it.
  assert.doesNotMatch(
    /function hideAllActionPanels\(\) \{[\s\S]*?\n\}/u.exec(js)?.[0] ?? "",
    /restTimerPanel/u
  );
  assert.doesNotMatch(
    /function renderExerciseFocus\(step, classification\) \{[\s\S]*?\n\n {2}if \(!step\)/u.exec(js)?.[0] ?? "",
    /restTimer/u
  );
});

test("the session_rest_timer manifest function is client-only, with no backend route or integration test", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "session_execution");
  const fn = area?.functions.find((entry) => entry.function_id === "session_rest_timer");
  assert.ok(fn, "expected a session_rest_timer function in session_execution");
  assert.equal(fn.state, "implemented");
  assert.deepEqual(fn.api_routes, []);
  assert.equal(fn.integration_test, null);
  assert.deepEqual(fn.actors, ["athlete"]);
});

test("every new interactive control is a real focusable button/select, not a div handler (keyboard reachability)", () => {
  for (const id of [
    "skipExerciseButton", "confirmSkipButton", "cancelSkipButton",
    "reportPainButton", "confirmPainReportButton", "cancelPainReportButton",
    "requestSubstitutionButton", "checkSubstitutionButton", "cancelSubstitutionButton",
    "sessionRetryButton", "skipRestButton"
  ]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(html, re, `${id} must be a real <button type="button">`);
  }

  assert.match(html, /<select id="skipReasonSelect">/u);
});

test("new session execution markup does not get hidden on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of [
      "skip-reason-panel",
      "pain-report-panel",
      "substitution-panel",
      "substitution-result",
      "session-completion-summary",
      "rest-timer-panel"
    ]) {
      assert.doesNotMatch(
        block,
        new RegExp(`\\.${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }

  assert.match(css, /\.skip-reason-panel\b/u);
  assert.match(css, /\.substitution-panel\b/u);
  assert.match(css, /\.session-completion-summary\b/u);
  assert.match(css, /\.rest-timer-panel\b/u);
});
