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
  for (const id of [
    "historyFilterStatus", "historyFilterDateFrom", "historyFilterDateTo",
    "historyFilterActivity", "historyFilterProgramme", "historyFilterEvent",
    "applyHistoryFiltersButton", "clearHistoryFiltersButton"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /async function applyHistoryFilters/u);
  assert.match(js, /function clearHistoryFilters/u);

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

  assert.match(js, /async function openHistoryDetail/u);
  assert.match(js, /addEventListener\("kolosseum:history-detail-route"/u);
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

  assert.match(js, /function renderHistoryDetail/u);
  assert.match(js, /exercise\.recorded_state/u);
  assert.match(js, /exercise\.skip_reason/u);
  assert.match(js, /split_return_events/u);
});

test("programme, assignment and event provenance are derived from immutable stored records, not inferred", () => {
  assert.match(historyService, /beta17_assignment_trigger/u);
  assert.match(historyService, /beta18_programme_template|loadExecutableCoachTemplateById/u);
  assert.match(historyService, /beta19_event_athlete_link/u);
  assert.match(historyService, /beta19_coach_event/u);

  assert.match(js, /provenance\?\.programme/u);
  assert.match(js, /provenance\?\.assignment/u);
  assert.match(js, /provenance\?\.event/u);
});

test("history export is server-generated through the existing GDPR export boundary, not a browser-only CSV from cache", () => {
  assert.match(historyExportService, /from "\.\.\/v1GdprExportHandling\.mjs"/u);
  assert.match(historyExportService, /createGdprExportHandling/u);

  // The export boundary contract itself must remain untouched by this slice.
  assert.match(gdprContract, /own_user_data_only: true/u);
  assert.match(gdprApi, /handleGdprExportHandlingApiRequest/u);

  assert.match(js, /async function exportHistory/u);
  assert.match(js, /beta-athlete-history-export/u);
  assert.doesNotMatch(js, /exportHistory[\s\S]{0,600}\.csv/u);
});

test("history exposes explicit loading, error/unavailable and empty states", () => {
  for (const id of ["historyLoading", "historyServiceUnavailable", "historyRetryButton"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /async function refreshHistory/u);
  assert.match(js, /elements\.historyServiceUnavailable\.hidden = false/u);
  assert.match(js, /No sessions recorded/u);
});

test("every new interactive history control is a real focusable button/select, not a div handler (keyboard reachability)", () => {
  for (const id of [
    "applyHistoryFiltersButton", "clearHistoryFiltersButton", "exportHistoryButton",
    "refreshHistoryButton", "historyRetryButton"
  ]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(html, re, `${id} must be a real <button type="button">`);
  }

  for (const id of ["historyFilterStatus", "historyFilterActivity", "historyFilterProgramme", "historyFilterEvent"]) {
    assert.match(html, new RegExp(`<select id="${id}">`, "u"));
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
