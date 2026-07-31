// DEV NOTE: FULL-UI-12C event-calendar binding static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const js = read("public/app/app.js");
const templateService = read("src/api/beta18_programme_template_service.ts");
const templateRoutes = read("src/api/templates.routes.ts");
const templateHandlers = read("src/api/templates.handlers.ts");

test("programme builder exposes an event-selector bound to the standalone event library", () => {
  for (const id of [
    "templateEventBindingSelect",
    "bindTemplateEventButton",
    "templateEventBindingStatus"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  // The event-compiler section must actually render (not be permanently
  // display:none) for the selector to be reachable at all.
  assert.match(html, /<section class="event-compiler-settings">/u);
  assert.doesNotMatch(html, /<section class="event-compiler-settings" hidden>/u);

  assert.match(js, /loadStandaloneEventLibraryForBuilder/u);
  assert.match(js, /\/coach-workspace\/events\/library/u);
  assert.match(js, /renderEventBindingPicker/u);
  assert.match(js, /bindSelectedEventToTemplate/u);
});

test("template event binding is a server-authoritative, sha-pinned reference", () => {
  assert.match(templateService, /bound_event_id/u);
  assert.match(templateService, /bound_event_record_sha256/u);
  assert.match(templateService, /export async function bindStandaloneEventToProgrammeTemplate/u);
  assert.match(templateService, /export async function loadTemplateEventBindingStatus/u);
  assert.match(templateService, /template_event_binding_immutable_via_save/u);
  assert.match(templateService, /allowEventBindingChange/u);
  assert.match(templateService, /event_binding_activity_mismatch/u);
  assert.match(templateService, /event_binding_reference_invalid/u);
});

test("activation fails closed on a changed, cancelled, archived or inaccessible bound event", () => {
  assert.match(templateService, /event_binding_stale_requires_rebind/u);
  assert.match(templateService, /event_binding_event_cancelled/u);
  assert.match(templateService, /event_binding_event_archived/u);
  assert.match(templateService, /event_binding_inaccessible/u);
  assert.match(templateService, /event_binding_not_found/u);

  // The gate must compare against the *live* event record, not the pinned
  // snapshot, to detect a version change since binding.
  assert.match(templateService, /latestOwnedStandaloneEvent/u);
  assert.match(templateService, /liveEvent\.record_sha256/u);
  assert.match(templateService, /existing\.bound_event_record_sha256/u);
});

test("bind-event and event-binding routes are mounted on the template surface", () => {
  assert.match(templateRoutes, /"\/:template_id\/bind-event"/u);
  assert.match(templateRoutes, /"\/:template_id\/event-binding"/u);
  assert.match(templateHandlers, /bindStandaloneEventToProgrammeTemplate/u);
  assert.match(templateHandlers, /loadTemplateEventBindingStatus/u);
});

test("the bound event is a read-only display, never a second independently-editable date", () => {
  // Once bound, the typed event fields become disabled - editing them cannot
  // silently move the programme calendar away from the bound event.
  assert.match(js, /field\.disabled = bound/u);
  assert.match(js, /elements\.templateEventEnabled\.disabled = bound/u);

  // Ordinary content saves must echo the existing binding rather than
  // supplying a fresh one.
  assert.match(js, /bound_event_id: draft\.bound_event_id \|\| ""/u);
  assert.match(js, /bound_event_record_sha256: draft\.bound_event_record_sha256 \|\| ""/u);

  // The server enforces this: a plain save may only preserve an existing
  // binding unchanged, never create or move one.
  assert.match(templateService, /!options\.allowEventBindingChange/u);
  assert.match(templateService, /template_event_binding_immutable_via_save/u);
});

test("event binding performs only the existing deterministic allocation operation, never a recommendation", () => {
  assert.doesNotMatch(
    templateService,
    /recommend|optimal_fit|best_fit|suggested_allocation/iu
  );
  assert.doesNotMatch(
    js,
    /autoFitBlock|suggestAllocation|recommendBlock|optimiseCalendar/iu
  );

  // The one allocation-adjustment action is the existing deterministic
  // resize, reused unchanged for a bound event.
  assert.match(js, /function fitFinalBlockToEvent/u);
  assert.match(js, /function resizeBlockWeeks/u);
});
