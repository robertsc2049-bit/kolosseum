import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const index = read("public/app/index.html");
const app = read("public/app/app.js");
const eventLifecycleUi = read("public/app/event_lifecycle_ui.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const routes = read("src/api/coach_workspace.routes.ts");
const handlers = read("src/api/coach_workspace.handlers.ts");
const eventService = read("src/api/beta19_coach_event_service.ts");
const store = read("src/api/beta_product_record_store.ts");
const journey = read("src/api/beta_product_journey_service.ts");
const blocks = read("src/api/blocks.handlers.ts");
const templates = read("src/api/beta18_programme_template_service.ts");

// DEV NOTE: the event library (metric counts + event card list) moved to
// React - see public/app-src/screens/coach/CoachEventsLibraryPanel.tsx.
// The create-event form and its live countdown/weeks preview stay legacy.
const coachEventsLibraryPanel = read("public/app-src/screens/coach/CoachEventsLibraryPanel.tsx");

test("events are a separate coach workspace section", () => {
  assert.match(index, /data-view="events"/u);
  assert.match(index, /id="view-events"/u);
  assert.match(index, /id="eventForm"/u);
  assert.match(index, /id="coach-events-list-root"/u);
  assert.match(index, /id="coach-events-metrics-root"/u);
  assert.doesNotMatch(index, /id="eventList"/u);
  assert.doesNotMatch(index, /class="nav-item coach-nav" data-view="assign"/u);
  // FULL-UI-12C: this section must actually render (not be permanently
  // display:none) - it hosts both the typed event_plan compiler and the
  // standalone-event binding picker, and neither is reachable if hidden.
  assert.match(index, /<section class="event-compiler-settings">/u);
});

test("athlete profile owns programme and event assignment", () => {
  assert.match(index, /id="athleteAssignmentForm"/u);
  assert.match(index, /id="athleteAssignmentEvent"/u);
  assert.match(index, /id="athleteAssignmentTemplate"/u);
  assert.match(index, /id="athleteEventLinks"/u);
  assert.match(app, /recordAthleteProfileAssignment/u);
  assert.match(app, /\/coach-workspace\/athlete-assignment/u);
});

test("the coach event library offers a real .ics calendar export link, mounted before the /events/:event_id param route", () => {
  assert.match(index, /id="exportEventsCalendarLink"/u);
  assert.match(index, /href="\/coach-workspace\/events\/calendar\.ics"/u);

  assert.match(routes, /"\/events\/calendar\.ics"/u);
  assert.match(handlers, /export async function getCoachEventsCalendar/u);
  assert.match(eventService, /export function buildCoachEventsCalendar/u);

  // If /events/calendar.ics were registered after /events/:event_id,
  // Express would route "calendar.ics" as an event_id instead.
  const calendarRouteIndex = routes.indexOf('"/events/calendar.ics"');
  const paramRouteIndex = routes.indexOf('"/events/:event_id"');
  assert.ok(calendarRouteIndex >= 0 && paramRouteIndex >= 0, "expected both routes to be present");
  assert.ok(calendarRouteIndex < paramRouteIndex, "calendar.ics must be registered before the /:event_id param route");
});

test("event_lifecycle_ui.js's fetch base path actually matches a mounted route - no unreachable /api prefix", () => {
  // Regression: event_lifecycle_ui.js previously built every request as
  // `/api/coach-workspace${path}`, but coach_workspace.routes.ts is
  // mounted at plain "/coach-workspace" (server.ts has no "/api" prefix
  // anywhere) - every call this module made (library load, event detail,
  // create, version, link/unlink, cancel/archive) 404'd silently, caught
  // and shown to the coach as "Event Action Failed". This module has no
  // other test coverage, so the drift went unnoticed.
  assert.match(routeBootstrap, /import\s+"\.\/event_lifecycle_ui\.js"/u);
  assert.match(eventLifecycleUi, /fetch\(`\/coach-workspace\$\{path\}`/u);
  assert.doesNotMatch(eventLifecycleUi, /\/api\/coach-workspace/u);
  assert.doesNotMatch(app, /\/api\/coach-workspace/u);
});

test("coach event routes persist separate event and link records", () => {
  assert.match(routes, /\/events/u);
  assert.match(routes, /\/athlete-event-links/u);
  assert.match(routes, /\/athlete-assignment/u);
  assert.match(handlers, /createCoachEventHandler/u);
  assert.match(eventService, /beta19_coach_event/u);
  assert.match(eventService, /beta19_event_athlete_link/u);
  assert.match(store, /"beta19_coach_event"/u);
  assert.match(store, /"beta19_event_athlete_link"/u);
});

test("standalone event binding reaches athlete compile output", () => {
  assert.match(journey, /loadEventBindingForAssignment/u);
  assert.match(blocks, /event_record_sha256/u);
  assert.match(blocks, /event_plan_override/u);
  assert.match(templates, /executionEventPlan/u);
  assert.match(templates, /event_record_sha256/u);
});

test("event workspace does not create team or organisation runtime", () => {
  assert.match(eventService, /creates_team_runtime: false/u);
  assert.match(eventService, /creates_organisation_runtime: false/u);
  assert.doesNotMatch(eventService, /recommend|readiness|safety|optimis/iu);
});

test("an event's timezone and notes are read back and rendered, not silently discarded", () => {
  // The manifest's event_metadata function ("Display location, timezone,
  // notes, activity and type") is marked implemented, but renderCoachEvents
  // used to build each card from event_name/event_type/event_date/location
  // only - timezone and notes were validated, persisted (beta19_coach_event_
  // service.ts) and returned unmodified through GET /coach-workspace/events,
  // but never appeared anywhere in the coach's own event list. Same bug
  // class as the test-account-reason and support-context fixes before it.
  // The renderer moved to React (CoachEventsLibraryPanel.tsx) - checked
  // there now instead of the removed app.js block.
  assert.match(coachEventsLibraryPanel, /plan\.timezone \? ` · \$\{String\(plan\.timezone\)\}` : ""/u);
  assert.match(coachEventsLibraryPanel, /plan\.notes \? <p className="coach-event-notes">\{String\(plan\.notes\)\}<\/p> : null/u);
});
