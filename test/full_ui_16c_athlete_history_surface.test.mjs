// DEV NOTE: FULL-UI-16C athlete history static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const historyPanel = read("public/app-src/screens/athlete/AthleteHistoryPanel.tsx");
const historyHook = read("public/app-src/screens/athlete/useTrainingHistory.ts");
const historyService = read("src/api/athlete_history_service.ts");
const historyExportService = read("src/api/athlete_history_export_service.ts");
const sessionsRoutes = read("src/api/sessions.routes.ts");
const sessionsHandlers = read("src/api/sessions.handlers.ts");
const gdprContract = read("src/v1GdprExportHandling.mjs");
const gdprApi = read("src/api/v1GdprExportHandlingApi.mjs");

test("history list and detail routes are mounted and delegate to the history service", () => {
  assert.match(sessionsRoutes, /"\/beta-athlete-history"/u);
  assert.match(sessionsRoutes, /"\/beta-athlete-history-detail"/u);
  assert.match(sessionsRoutes, /"\/beta-athlete-history-export"/u);

  assert.match(sessionsHandlers, /export async function getBetaAthleteHistory/u);
  assert.match(sessionsHandlers, /export async function getAthleteHistoryDetail/u);
  assert.match(sessionsHandlers, /export async function getAthleteHistoryExport/u);
  assert.match(sessionsHandlers, /buildAthleteHistoryListResult/u);
  assert.match(sessionsHandlers, /buildAthleteHistoryDetailResult/u);
  assert.match(sessionsHandlers, /buildAthleteHistoryExportResult/u);
});

test("history filters cover status, date range, activity, programme and event without mutating the underlying record", () => {
  assert.match(historyPanel, /draft\.status/u);
  assert.match(historyPanel, /draft\.dateFrom/u);
  assert.match(historyPanel, /draft\.dateTo/u);
  assert.match(historyPanel, /draft\.activityId/u);
  assert.match(historyPanel, /draft\.templateId/u);
  assert.match(historyPanel, /draft\.eventId/u);
  assert.match(historyPanel, />Apply filters</u);
  assert.match(historyPanel, />Clear filters</u);

  assert.match(historyHook, /applyFilters = useCallback/u);
  assert.match(historyHook, /clearFilters = useCallback/u);

  assert.match(historyService, /export type AthleteHistoryFilters/u);
  assert.match(historyService, /function matchesFilters/u);
  // Filtering narrows an already-computed array - it must never write to the
  // database.
  assert.doesNotMatch(historyService, /matchesFilters[\s\S]{0,400}pool\.query/u);
});

test("history detail has a stable, entity-keyed route distinct from the live session route", () => {
  assert.match(routeBootstrap, /route_id: "athlete_history_detail"[\s\S]{0,40}pattern: "#\/athlete\/history\/:session_id"/u);
  assert.match(routeBootstrap, /view === "history" && entity\.session_id[\s\S]{0,60}athlete_history_detail/u);
  assert.match(routeBootstrap, /route\.route_id === "athlete_history_detail"/u);
  assert.match(routeBootstrap, /data-history-detail-id/u);

  // The React card keeps the same data-history-detail-id attribute, which
  // route_bootstrap.js's global (not per-render) click delegation still
  // picks up unchanged to keep the URL in sync - see useTrainingHistory.ts's
  // DEV NOTE for why no manual pushState/replaceState is needed here.
  assert.match(historyPanel, /data-history-detail-id=/u);
  assert.match(historyHook, /openDetail = useCallback/u);
  assert.match(historyHook, /addEventListener\(DETAIL_ROUTE_EVENT/u);
  assert.match(historyHook, /const DETAIL_ROUTE_EVENT = "kolosseum:history-detail-route"/u);
});

test("history detail rejects access to another athlete's session", () => {
  assert.match(historyService, /athlete_history_detail_forbidden/u);
  assert.match(historyService, /beta_subject_user_id\) !== athleteUserId/u);
});

test("planned versus recorded state, split/return record and partial/skip record are all surfaced in detail", () => {
  assert.match(historyService, /recorded_state/u);
  assert.match(historyService, /split_return_events/u);
  assert.match(historyService, /skip_reason/u);
  assert.match(historyService, /pain_reported/u);
  assert.match(historyService, /substitution/u);

  assert.match(historyPanel, /exercise\.recorded_state/u);
  assert.match(historyPanel, /exercise\.skip_reason/u);
  assert.match(historyPanel, /splitReturnEvents/u);
});

test("the athlete's own recorded RPE report is surfaced back on their session history detail - not silently discarded", () => {
  // RPE_REPORT events are validated and persisted by
  // session_state_write_service.ts's ensureRpeReportShapeValid exactly like
  // SKIP_EXERCISE/PAIN_REPORT above it, but athlete_history_service.ts never
  // read the rpe_value back out - not even to the athlete who submitted it.
  assert.match(historyService, /rpe_reported/u);
  assert.match(historyService, /RPE_REPORT/u);

  assert.match(historyPanel, /exercise\.rpe_reported/u);
});

test("the athlete's own recorded Borg and CR10 reports are surfaced back on their session history detail - not silently discarded", () => {
  // BORG_REPORT/CR10_REPORT events are validated and persisted by
  // session_state_write_service.ts's ensureBorgReportShapeValid/
  // ensureCr10ReportShapeValid exactly like RPE_REPORT above, but
  // athlete_history_service.ts must actually read the values back out - not
  // even to the athlete who submitted them.
  assert.match(historyService, /borg_reported/u);
  assert.match(historyService, /BORG_REPORT/u);
  assert.match(historyService, /cr10_reported/u);
  assert.match(historyService, /CR10_REPORT/u);

  assert.match(historyPanel, /exercise\.borg_reported/u);
  assert.match(historyPanel, /exercise\.cr10_reported/u);
});

test("programme, assignment and event provenance are derived from immutable stored records, not inferred", () => {
  assert.match(historyService, /beta17_assignment_trigger/u);
  assert.match(historyService, /beta18_programme_template|loadExecutableCoachTemplateById/u);
  assert.match(historyService, /beta19_event_athlete_link/u);
  assert.match(historyService, /beta19_coach_event/u);

  assert.match(historyPanel, /provenance\?\.programme/u);
  assert.match(historyPanel, /detail\.provenance as JsonRecord\)\.assignment/u);
  assert.match(historyPanel, /provenance\?\.event/u);
});

test("history export is server-generated through the existing GDPR export boundary, not a browser-only CSV from cache", () => {
  assert.match(historyExportService, /from "\.\.\/v1GdprExportHandling\.mjs"/u);
  assert.match(historyExportService, /createGdprExportHandling/u);

  // The export boundary contract itself must remain untouched by this slice.
  assert.match(gdprContract, /own_user_data_only: true/u);
  assert.match(gdprApi, /handleGdprExportHandlingApiRequest/u);

  // exportHistory() and its exportHistoryButton stay legacy - a
  // self-contained action unrelated to the React-owned list/filter/detail
  // state, so it's untouched by this migration.
  assert.match(js, /async function exportHistory/u);
  assert.match(js, /beta-athlete-history-export/u);
  assert.doesNotMatch(js, /exportHistory[\s\S]{0,600}\.csv/u);
});

test("history exposes explicit loading, error/unavailable and empty states", () => {
  assert.match(historyPanel, /Loading history…/u);
  assert.match(historyPanel, /History could not be loaded/u);
  assert.match(historyPanel, />Retry</u);

  assert.match(historyHook, /refresh = useCallback/u);
  assert.match(historyPanel, /No sessions recorded/u);
});

test("every history filter control is a real focusable select, not a div handler (keyboard reachability)", () => {
  for (const label of ["Status", "Activity", "Programme", "Event"]) {
    assert.match(historyPanel, new RegExp(`<span>${label}</span>\\s*<select`, "u"));
  }
});

test("history markup does not get hidden on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of ["history-filters", "history-detail-panel", "history-facts", "history-exercise-row"]) {
      assert.doesNotMatch(
        block,
        new RegExp(`\\.${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }

  assert.match(css, /\.history-filters\b/u);
  assert.match(css, /\.history-detail-panel\b/u);
});
