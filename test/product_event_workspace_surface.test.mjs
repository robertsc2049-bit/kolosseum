import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const index = read("public/app/index.html");
const app = read("public/app/app.js");
const routes = read("src/api/coach_workspace.routes.ts");
const handlers = read("src/api/coach_workspace.handlers.ts");
const eventService = read("src/api/beta19_coach_event_service.ts");
const store = read("src/api/beta_product_record_store.ts");
const journey = read("src/api/beta_product_journey_service.ts");
const blocks = read("src/api/blocks.handlers.ts");
const templates = read("src/api/beta18_programme_template_service.ts");

test("events are a separate coach workspace section", () => {
  assert.match(index, /data-view="events"/u);
  assert.match(index, /id="view-events"/u);
  assert.match(index, /id="eventForm"/u);
  assert.match(index, /id="eventList"/u);
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
