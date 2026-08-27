// DEV NOTE: FULL-UI-15C session execution static surface contract. The
// athlete Session view (create/start/complete/skip/pain/RPE/substitution/
// split/return/video-feedback/rest timer) moved from app.js/index.html to
// public/app-src/screens/athlete/AthleteSessionExecutionPanel.tsx and
// useAthleteSessionExecution.ts - see AthleteSessionExecutionPanel.test.tsx
// for the behavioral proof that replaces the source-text checks this file
// used to run against the now-removed app.js rendering/action-panel
// functions. Every backend-only assertion (schema/write-service/read-model/
// substitution service+registry/routes/handlers) is unchanged - the
// backend contract did not move.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

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

const client = read("public/app-src/api/athleteSessionClient.ts");
const hook = read("public/app-src/screens/athlete/useAthleteSessionExecution.ts");
const panel = read("public/app-src/screens/athlete/AthleteSessionExecutionPanel.tsx");

test("session view declares loading and error-recovery states", () => {
  assert.match(panel, /session\.error/u);
  assert.match(panel, /id="sessionRetryButton"[\s\S]{0,80}onClick=\{\(\) => session\.refresh\(\)\}/u);
  assert.match(panel, /Session could not be loaded/u);
  assert.match(hook, /catch \{\s*setState\(\(current\) => \(\{ \.\.\.current, loading: false, error: true \}\)\);/u);
});

test("skip exercise requires a factual reason from a closed enum", () => {
  for (const id of ["skipExerciseButton", "skipReasonSelect", "confirmSkipButton", "cancelSkipButton"]) {
    assert.match(panel, new RegExp(`id="${id}"`, "u"), `Expected ${id}`);
  }
  assert.match(panel, /className="skip-reason-panel"/u);

  for (const code of ["equipment_unavailable", "time_constraint", "pain_or_discomfort", "fatigue", "other"]) {
    assert.ok(panel.includes(`value="${code}"`), `Expected skip reason option ${code}`);
  }

  assert.match(writeService, /SKIP_REASON_CODES = Object\.freeze/u);
  assert.match(writeService, /phase6_runtime_skip_reason_invalid/u);
  assert.match(hook, /const confirmSkipWithReason = useCallback/u);
  assert.match(hook, /type: "SKIP_EXERCISE", exercise_id: exerciseId, reason_code: reasonCode/u);
});

test("pain input records only the permitted factual flag, never free text or scoring", () => {
  for (const id of ["reportPainButton", "painReportPanel", "confirmPainReportButton", "cancelPainReportButton"]) {
    assert.ok(panel.includes(`id="${id}"`) || panel.includes('className="pain-report-panel"'), `Expected ${id}`);
  }
  assert.match(panel, /id="reportPainButton"/u);
  assert.match(panel, /id="confirmPainReportButton"/u);
  assert.match(panel, /id="cancelPainReportButton"/u);

  assert.match(writeService, /PAIN_REPORT_ALLOWED_KEYS = new Set\(\["type", "exercise_id", "pain_reported", "client_request_id"\]\)/u);
  assert.match(writeService, /phase6_runtime_pain_report_invalid_shape/u);
  assert.match(writeService, /obj\.pain_reported !== true/u);

  // Guard against ever reintroducing a free-text or scoring field.
  assert.doesNotMatch(writeService, /pain_text|pain_severity|risk_score/u);

  assert.match(hook, /const confirmPainReport = useCallback/u);
  assert.match(hook, /type: "PAIN_REPORT", exercise_id: exerciseId, pain_reported: true/u);
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
    assert.match(panel, new RegExp(`(?:id="${id}"|className="${id === "substitutionPanel" ? "substitution-panel" : id === "substitutionResult" ? "substitution-result" : id}")`, "u"), `Expected ${id}`);
  }

  assert.match(hook, /const checkSubstitution = useCallback/u);
  assert.match(hook, /const applySubstitution = useCallback/u);
  assert.match(hook, /substituted_exercise_id: output\.target_exercise_id/u);
  assert.match(client, /export async function requestSessionSubstitution/u);
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

  assert.match(client, /export function newClientRequestId/u);
  assert.match(client, /client_request_id: clientRequestId/u);
});

test("terminal sessions reject further events instead of being resurrected", () => {
  assert.match(writeService, /function ensureTerminalSessionEventRejected/u);
  assert.match(writeService, /phase6_runtime_terminal_session_event_rejected/u);
  assert.match(writeService, /ensureTerminalSessionEventRejected\(workingSummary, event\)/u);
});

test("completion summary is a genuine dedicated artefact beyond the badge and counts", () => {
  assert.match(panel, /id="sessionCompletionSummary"/u);
  assert.match(panel, /Session ended/u);
  assert.match(panel, /executionStatus === "completed" \? "Session complete" : "Session partially completed"/u);
  assert.match(panel, /const isEnded = executionStatus === "completed" \|\| executionStatus === "partial";/u);

  assert.match(readModel, /execution_status/u);
});

test("rest timer counts down prescribed rest with a completion cue, entirely client-side", () => {
  assert.match(panel, /className=\{`rest-timer-panel/u);
  assert.match(panel, /id="skipRestButton"/u);
  assert.match(panel, /<button\s+id="skipRestButton"[^>]*type="button"/u);

  for (const fnName of ["formatRestClock", "playRestCompleteCue", "stopRestTimer", "startRestTimer", "maybeStartRestTimer"]) {
    assert.match(`${hook}\n${panel}`, new RegExp(`(?:function ${fnName}|const ${fnName} = useCallback)`, "u"), `Expected ${fnName}`);
  }

  assert.match(hook, /const restSeconds = Number\(exercise\?\.rest_seconds\);/u);

  // Started before COMPLETE_STEP, and before the COMPLETE_EXERCISE branch of
  // applySubstitution - never on skip, and never gated on a backend event.
  assert.match(hook, /maybeStartRestTimer\(state\.sessionState\);\s*\n\s*return runMutation\(async \(sessionId, csrfToken\) => \{\s*\n\s*await postAthleteSessionEvent\(sessionId, \{ type: "COMPLETE_STEP" \}/u);
  assert.match(hook, /if \(eventType === "COMPLETE_EXERCISE"\) maybeStartRestTimer\(state\.sessionState\);/u);

  assert.match(panel, /onClick=\{\(\) => session\.stopRestTimer\(\)\}/u);

  // Never touched by the action-panel-close path or by a session refresh -
  // a timer started by the same click that triggers a re-render must
  // survive it (rest timer state is fully independent of sessionState/
  // actionPanel in useAthleteSessionExecution.ts's state shape).
  const closeActionPanelSource = /const closeActionPanel = useCallback\([\s\S]*?\n {2}\}, \[\]\);/u.exec(hook)?.[0] ?? "";
  assert.doesNotMatch(closeActionPanelSource, /restRemainingSeconds|restDone|restIntervalRef/u);
  const refreshSource = /const refresh = useCallback\([\s\S]*?\n {2}\}, \[\]\);/u.exec(hook)?.[0] ?? "";
  assert.doesNotMatch(refreshSource, /restRemainingSeconds|restDone|restIntervalRef/u);
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
    const re = new RegExp(`<button\\s+id="${id}"[^>]*type="button"`, "u");
    assert.match(panel, re, `${id} must be a real <button type="button">`);
  }

  assert.match(panel, /<select id="skipReasonSelect"/u);
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

test("the athlete-session-mutated bridge keeps legacy's local session cache and history in sync after every React-side mutation", () => {
  assert.match(js, /document\.addEventListener\("kolosseum:athlete-session-mutated", \(event\) => \{/u);
  assert.match(js, /upsertLocalSession\(sessionId, \{\s*\n\s*runtime_event_count: Number\(local\?\.runtime_event_count \?\? 0\) \+ 1/u);
  assert.match(js, /loadSessionState\(\)\.catch\(handleError\);/u);
  assert.match(js, /if \(shouldRefreshHistory\) refreshHistory\(\{ quiet: true \}\)\.catch\(handleError\);/u);

  assert.match(hook, /const SESSION_MUTATED_EVENT = "kolosseum:athlete-session-mutated";/u);
  assert.match(hook, /notifyMutated\(sessionId, refreshHistory\);/u);
});
