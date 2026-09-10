// DEV NOTE: FULL-UI-81 wire up the neutral session summary, static surface
// contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const routes = read("src/api/sessions.routes.ts");
const adapters = read("src/api/sessions.summary.adapters.ts");
const readModel = read("src/api/session_summary_read_model.ts");
const handlers = read("src/api/sessions.summary.handlers.ts");
const contractDoc = read("docs/contracts/v1_neutral_session_summary_api_contract.md");
const client = read("public/app-src/api/sessionSummaryClient.ts");
const trainingHistoryHook = read("public/app-src/screens/athlete/useTrainingHistory.ts");
const athletePanel = read("public/app-src/screens/athlete/AthleteHistoryPanel.tsx");
const coachPanel = read("public/app-src/screens/coach/CoachReviewPanel.tsx");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("the neutral session summary route is mounted at exactly GET /:sessionId/summary in sessions.routes.ts", () => {
  assert.match(routes, /sessionsRouter\.get\(\s*\n\s*"\/:sessionId\/summary",/u);
  assert.doesNotMatch(routes, /"\/:session_id\/summary"/u);
});

test("the ownership/identity check runs before the handler, and rejects anyone who is neither the session's athlete nor its coach", () => {
  const accessFn = routes.match(/async function requireSessionSummaryAccess[\s\S]*?\n\}\n/u)?.[0] ?? "";
  assert.ok(accessFn, "expected to isolate requireSessionSummaryAccess");
  assert.match(accessFn, /loadSessionOwnership\(sessionId\)/u);
  assert.match(accessFn, /callerUserId !== ownership\.beta_subject_user_id/u);
  assert.match(accessFn, /callerUserId !== ownership\.beta_coach_user_id/u);
  assert.match(accessFn, /throw forbidden\(/u);
  assert.match(accessFn, /throw notFound\(/u);
  assert.match(accessFn, /throw unauthorized\(/u);

  const accessCallIndex = routes.indexOf("await requireSessionSummaryAccess(request, sessionId);");
  const handlerCreateIndex = routes.indexOf("createGetNeutralSessionSummaryHandler({");
  assert.ok(accessCallIndex >= 0 && handlerCreateIndex >= 0 && accessCallIndex < handlerCreateIndex, "expected the ownership check to run before the handler is created/invoked");

  assert.match(adapters, /SELECT beta_subject_user_id, beta_coach_user_id/u);
});

test("run_id is derived as session_id (no fabricated engine-run identity), matching the pinned contract doc's derivation rule", () => {
  assert.match(adapters, /run_id: String\(statePayload\.session_id\)/u);
  assert.match(contractDoc, /`run_id` = `session_id`/u);
});

test("the read model enforces the doc's projected_*/estimated_* wildcard bans, not just documents them", () => {
  assert.match(contractDoc, /projected_\*/u);
  assert.match(contractDoc, /estimated_\*/u);
  assert.match(readModel, /key\.startsWith\("projected_"\)/u);
  assert.match(readModel, /key\.startsWith\("estimated_"\)/u);
});

test("the extra-work event count accepts this codebase's real runtime event type names, not just placeholder ones", () => {
  assert.match(readModel, /EXTRA_SET_REPORT/u);
  assert.match(readModel, /EXTRA_EXERCISE_REPORT/u);
});

test("the store adapters are thin translators - no re-derivation of trace/execution-status logic, just mapping", () => {
  assert.match(adapters, /getSessionStateQuery\(sessionId\)/u);
  assert.match(adapters, /listRuntimeEventsQuery\(sessionId\)/u);
  assert.doesNotMatch(adapters, /deriveTrace|projectSessionStatePayload|normalizeSummary/u);
});

test("the handler's own broken .js-less import is fixed, so the compiled dist output actually resolves at runtime", () => {
  assert.match(handlers, /from "\.\/session_summary_read_model\.js"/u);
});

test("loadSessionSummary exists once, shared by both the athlete history and coach review surfaces", () => {
  assert.match(client, /export function loadSessionSummary\(sessionId: string\)/u);
  assert.match(client, /\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/summary/u);

  assert.match(trainingHistoryHook, /loadSessionSummary\(sessionId\)/u);
  assert.match(coachPanel, /loadSessionSummary\(selectedSessionIdForSummary\)/u);
});

test("both the athlete history and coach review panels read every new summary field - no phantom fields", () => {
  const summaryFields = [
    "prescribed_items_completed",
    "prescribed_items_skipped",
    "prescribed_items_remaining",
    "split_event_count",
    "return_continue_count",
    "return_skip_count"
  ];

  for (const field of summaryFields) {
    assert.match(athletePanel, new RegExp(`detailSummary\\.${field}`, "u"), `expected AthleteHistoryPanel.tsx to read detailSummary.${field}`);
    assert.match(coachPanel, new RegExp(`summary\\.${field}`, "u"), `expected CoachReviewPanel.tsx to read summary.${field}`);
  }
});

test("the FULL-UI-81 manifest functions are declared as implemented inside the existing athlete_history/coach_review areas, and the route is in the api_route_catalog exactly once", () => {
  const athleteArea = manifest.product_areas.find((entry) => entry.area_id === "athlete_history");
  const coachArea = manifest.product_areas.find((entry) => entry.area_id === "coach_review");
  assert.ok(athleteArea, "expected the existing athlete_history product area");
  assert.ok(coachArea, "expected the existing coach_review product area");

  const historyFn = athleteArea.functions.find((entry) => entry.function_id === "history_session_summary");
  const reviewFn = coachArea.functions.find((entry) => entry.function_id === "review_session_summary");
  assert.ok(historyFn, "expected a history_session_summary function");
  assert.ok(reviewFn, "expected a review_session_summary function");
  assert.equal(historyFn.state, "implemented");
  assert.equal(reviewFn.state, "implemented");
  assert.notEqual(historyFn.persistence, "localStorage_only");
  assert.notEqual(reviewFn.persistence, "localStorage_only");

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-81" && slice.state === "implemented"));

  const matches = manifest.api_route_catalog.filter(
    (entry) => entry.method === "GET" && entry.path === "/sessions/:sessionId/summary"
  );
  assert.equal(matches.length, 1, "expected exactly one api_route_catalog entry for GET /sessions/:sessionId/summary");
});
