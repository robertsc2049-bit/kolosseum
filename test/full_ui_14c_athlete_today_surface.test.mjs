// DEV NOTE: FULL-UI-14C athlete Today static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const todayPanel = read("public/app-src/screens/athlete/AthleteTodayPanel.tsx");
const format = read("public/app-src/utils/format.ts");
const todayService = read("src/api/athlete_today_service.ts");
const todayNotesService = read("src/api/athlete_today_notes_service.ts");
const sessionsRoutes = read("src/api/sessions.routes.ts");
const sessionsHandlers = read("src/api/sessions.handlers.ts");

test("Today exposes current programme, exact assignment version and block/week context", () => {
  assert.ok(html.includes('id="athlete-today-session-root"'));

  assert.match(todayPanel, /assignment\.template_version/u);
  assert.match(todayPanel, /assignment\.template_name/u);
  assert.match(todayPanel, /function todaySessionLabel/u);

  assert.match(todayService, /template_name:\s*cleanString\(template\.template_name\)/u);
  assert.match(todayService, /template_version:\s*Number\(template\.template_version/u);
});

test("Today exposes the coach's session-level note for the upcoming session", () => {
  assert.match(todayPanel, /const sessionNotes = session\?\.template_session_coaching_notes/u);
  assert.match(todayPanel, /sessionNotes \? <p className="muted">\{String\(sessionNotes\)\}<\/p> : null/u);

  assert.match(
    todayService,
    /template_session_coaching_notes:\s*cleanString\(execution\.template_session_coaching_notes\)/u
  );
});

test("Today exposes the resolved load and its exact source reference", () => {
  assert.match(todayPanel, /className="today-resolved-load"/u);
  assert.match(todayPanel, /className="today-resolved-load-value"/u);
  assert.match(todayPanel, /resolvedLoad\.value/u);
  assert.match(todayPanel, /resolvedLoadSource\.source_type/u);
  assert.match(todayPanel, /formatDate\(resolvedLoadSource\.effective_date\)/u);

  assert.match(todayService, /planned_items:\s*Array\.isArray\(materialised\.planned_items\)/u);
  assert.match(todayService, /resolvePercentageLoad|materialiseNextCoachTemplateProgram/u);
});

test("Today displays visible coach notes without letting them bind anything", () => {
  assert.match(todayPanel, /className="today-notes"/u);
  assert.match(todayPanel, /className="today-notes-list"/u);
  assert.match(todayPanel, /notes\.map\(\(note\) =>/u);

  assert.match(todayNotesService, /visibility = 'athlete_visible'/u);
  assert.match(todayNotesService, /non_binding: true/u);
  assert.doesNotMatch(
    todayNotesService,
    /note_text[\s\S]{0,200}(resolved_load|template_session_index|exercise_id)/u
  );

  // Kept in its own file, deliberately isolated from anything that reads
  // engine/session truth, so a message from the coach can never be wired
  // into what decides the current exercise, load, order, or session.
  assert.doesNotMatch(todayNotesService, /session_state_write_service|session_state_query_service|block_compile_write_service|engine_runner_service/u);
});

test("every declared empty/unavailable state has distinct copy and the correct lawful action", () => {
  const declaredStates = [
    "no_session",
    "programme_complete",
    "no_current_assignment",
    "missing_strength_reference",
    "relationship_ended",
    "session_already_complete"
  ];

  for (const stateName of declaredStates) {
    assert.match(todayPanel, new RegExp(`${stateName}:\\s*\\{`, "u"), `Expected copy for ${stateName}`);
    assert.match(todayService, new RegExp(`"${stateName}"`, "u"), `Expected server state ${stateName}`);
  }

  // service_unavailable is a client-only state (no server response to be
  // unavailable about) and event_unavailable is scoped to the event card,
  // not the primary route state - both still need their own explicit UI.
  assert.match(todayPanel, /Today is unavailable right now/u);
  assert.match(todayPanel, /stateKey === "service_unavailable"/u);
  assert.match(todayService, /status: "unavailable"/u);
  assert.match(todayService, /reason: "event_cancelled"|event_archived|event_not_found/u);

  assert.match(todayPanel, /stateKey === "no_session"\) return "Start session"/u);
  assert.match(todayPanel, /stateKey === "session_already_complete"\) return "Start next session"/u);
  assert.match(todayPanel, /function continueToSession/u);
});

test("Today uses server state after refresh and never lets stale local cache pick the session", () => {
  assert.match(js, /async function loadAthleteToday/u);
  assert.match(js, /\/sessions\/beta-athlete-today/u);

  // The old anti-pattern - falling back to the last locally-cached history
  // entry to decide "what session is current" - must be gone from the boot
  // path.
  assert.doesNotMatch(
    js,
    /state\.history\[state\.history\.length - 1\][\s\S]{0,120}state\.activeSessionId =/u
  );

  assert.match(js, /await loadAthleteToday\(\);/u);
  assert.match(
    js,
    /if \(state\.activeSessionId !== serverSessionId\)[\s\S]{0,80}state\.activeSessionId = serverSessionId/u
  );
  assert.match(js, /state\.activeSessionId = null;\s*\n\s*state\.activeSessionState = null;/u);

  // Refresh (navigating to the view) must re-fetch, not just render whatever
  // was last cached.
  assert.match(js, /view === "today"[\s\S]{0,80}loadAthleteToday\(\)/u);
});

test("beta-athlete-today route and its handler are mounted", () => {
  assert.match(sessionsRoutes, /"\/beta-athlete-today"/u);
  assert.match(sessionsRoutes, /getAthleteTodayView/u);
  assert.match(sessionsHandlers, /export async function getAthleteTodayView/u);
  assert.match(sessionsHandlers, /loadAthleteTodayView/u);
});

test("Today's new markup does not get hidden on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of [
      "today-resolved-load",
      "today-programme-summary",
      "today-notes"
    ]) {
      assert.doesNotMatch(
        block,
        new RegExp(`\\.${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }

  assert.match(css, /\.today-resolved-load\b/u);
  assert.match(css, /\.today-notes\b/u);
});
