// DEV NOTE: coach per-athlete profile section-tabs contract. Pure
// infrastructure - not a new user-facing capability area, so no FULL-UI
// slice number or product/ui/function_manifest.json entry is claimed (same
// carve-out as the athlete-facing precedent, full_ui_history_section_tabs_
// surface.test.mjs). Part 1 locks the real markup shape; part 2 exercises
// the shared, generic tab-toggle function's real behavior; part 3 proves
// this tab group and the athlete History page's own tab group (both present
// in the same document at once, since nothing in this app is ever
// unmounted) don't cross-interfere.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";

import { initSectionTabs } from "../public/app/section_tabs_bootstrap.js";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");

const GROUPS = {
  "training-log": [
    "athlete-history-assignment-root",
    "athlete-history-strength-root",
    "athlete-history-bodyweight-root",
    "athlete-history-event-link-root",
    "athlete-history-session-root"
  ],
  "notes-messages": [
    "athlete-coach-notes-root",
    "coach-athlete-message-root",
    "athlete-org-messages-root"
  ],
  "wellbeing": [
    "athlete-progress-insights-root",
    "athlete-progress-photos-root",
    "athlete-body-metrics-root",
    "athlete-nutrition-root",
    "athlete-habits-root",
    "athlete-goals-root",
    "athlete-weekly-checkins-root",
    "athlete-device-sync-root"
  ]
};

function captureTabPanelSlice(panelId) {
  const pattern = new RegExp(
    `data-tab-group="athlete-detail" data-tab-panel="${panelId}"[^>]*>([\\s\\S]*?)\\n {14}</div>`,
    "u"
  );
  const match = html.match(pattern);
  assert.ok(match, `expected a captured athlete-detail tab-panel slice for "${panelId}"`);
  return match[1];
}

test("index.html declares the athlete-detail tab strip with all three tabs", () => {
  assert.match(html, /<div class="section-tabs" role="tablist" aria-label="Athlete detail sections" data-tab-group="athlete-detail">/u);
  assert.match(html, /<button type="button" role="tab" class="section-tab active" aria-selected="true" data-tab-target="training-log">Training log<\/button>/u);
  assert.match(html, /<button type="button" role="tab" class="section-tab" aria-selected="false" data-tab-target="notes-messages">Notes &amp; messages<\/button>/u);
  assert.match(html, /<button type="button" role="tab" class="section-tab" aria-selected="false" data-tab-target="wellbeing">Wellbeing<\/button>/u);
});

for (const [panelId, expectedIds] of Object.entries(GROUPS)) {
  test(`index.html groups the ${panelId} panels under the ${panelId} tab panel`, () => {
    const slice = captureTabPanelSlice(panelId);
    for (const id of expectedIds) {
      assert.match(slice, new RegExp(`id="${id}"`, "u"), `expected ${id} inside the ${panelId} tab panel`);
    }
  });
}

test("only the training-log tab panel is visible by default, and all three keep the grid layout class", () => {
  assert.match(html, /<div class="athlete-detail-history-grid" data-tab-group="athlete-detail" data-tab-panel="training-log">/u);
  assert.match(html, /<div class="athlete-detail-history-grid" data-tab-group="athlete-detail" data-tab-panel="notes-messages" hidden>/u);
  assert.match(html, /<div class="athlete-detail-history-grid" data-tab-group="athlete-detail" data-tab-panel="wellbeing" hidden>/u);
});

function buildFixtureDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div class="section-tabs" role="tablist" data-tab-group="athlete-detail">
      <button type="button" class="section-tab active" data-tab-target="training-log">Training log</button>
      <button type="button" class="section-tab" data-tab-target="notes-messages">Notes &amp; messages</button>
      <button type="button" class="section-tab" data-tab-target="wellbeing">Wellbeing</button>
    </div>
    <div data-tab-group="athlete-detail" data-tab-panel="training-log">
      <div id="athlete-history-assignment-root"></div>
    </div>
    <div data-tab-group="athlete-detail" data-tab-panel="notes-messages" hidden>
      <div id="athlete-coach-notes-root"></div>
    </div>
    <div data-tab-group="athlete-detail" data-tab-panel="wellbeing" hidden>
      <div id="athlete-progress-insights-root"></div>
    </div>
  </body></html>`);
  return dom.window.document;
}

function panelState(document, target) {
  return {
    hidden: document.querySelector(`[data-tab-panel="${target}"]`).hidden,
    active: document.querySelector(`[data-tab-target="${target}"]`).classList.contains("active"),
    ariaSelected: document.querySelector(`[data-tab-target="${target}"]`).getAttribute("aria-selected")
  };
}

test("clicking through all three athlete-detail tabs shows exactly one panel at a time", () => {
  const document = buildFixtureDom();
  initSectionTabs(document);

  document.querySelector('[data-tab-target="notes-messages"]').click();
  assert.deepEqual(panelState(document, "training-log"), { hidden: true, active: false, ariaSelected: "false" });
  assert.deepEqual(panelState(document, "notes-messages"), { hidden: false, active: true, ariaSelected: "true" });
  assert.equal(document.querySelector('[data-tab-panel="wellbeing"]').hidden, true);

  document.querySelector('[data-tab-target="wellbeing"]').click();
  assert.deepEqual(panelState(document, "notes-messages"), { hidden: true, active: false, ariaSelected: "false" });
  assert.deepEqual(panelState(document, "wellbeing"), { hidden: false, active: true, ariaSelected: "true" });

  document.querySelector('[data-tab-target="training-log"]').click();
  assert.deepEqual(panelState(document, "training-log"), { hidden: false, active: true, ariaSelected: "true" });
  assert.equal(document.querySelector('[data-tab-panel="notes-messages"]').hidden, true);
  assert.equal(document.querySelector('[data-tab-panel="wellbeing"]').hidden, true);
});

test("the athlete-detail tab group and the athlete History page's own tab group don't cross-interfere", () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div class="section-tabs" role="tablist" data-tab-group="history">
      <button type="button" class="section-tab active" data-tab-target="record">History</button>
      <button type="button" class="section-tab" data-tab-target="wellbeing">Wellbeing</button>
    </div>
    <div data-tab-group="history" data-tab-panel="record">
      <div id="athlete-history-root"></div>
    </div>
    <div data-tab-group="history" data-tab-panel="wellbeing" hidden>
      <div id="athlete-self-progress-insights-root"></div>
    </div>

    <div class="section-tabs" role="tablist" data-tab-group="athlete-detail">
      <button type="button" class="section-tab active" data-tab-target="training-log">Training log</button>
      <button type="button" class="section-tab" data-tab-target="wellbeing">Wellbeing</button>
    </div>
    <div data-tab-group="athlete-detail" data-tab-panel="training-log">
      <div id="athlete-history-assignment-root"></div>
    </div>
    <div data-tab-group="athlete-detail" data-tab-panel="wellbeing" hidden>
      <div id="athlete-progress-insights-root"></div>
    </div>
  </body></html>`);
  const document = dom.window.document;
  initSectionTabs(document);

  const historyWellbeingBefore = document.querySelector('[data-tab-group="history"][data-tab-panel="wellbeing"]').hidden;

  // Click the "Wellbeing" tab inside the athlete-detail group only.
  document.querySelectorAll('[data-tab-target="wellbeing"]')[1].click();

  assert.equal(
    document.querySelector('[data-tab-group="history"][data-tab-panel="wellbeing"]').hidden,
    historyWellbeingBefore,
    "clicking the athlete-detail group's Wellbeing tab must not affect the history group's panels"
  );
  assert.equal(document.querySelector('[data-tab-group="athlete-detail"][data-tab-panel="wellbeing"]').hidden, false);
  assert.equal(document.querySelector('[data-tab-group="athlete-detail"][data-tab-panel="training-log"]').hidden, true);

  // Now click the "History" group's own record tab and confirm athlete-detail is untouched.
  document.querySelector('[data-tab-group="history"] [data-tab-target="record"]').click();

  assert.equal(
    document.querySelector('[data-tab-group="athlete-detail"][data-tab-panel="training-log"]').hidden,
    true,
    "clicking the history group's own tab must not reset the athlete-detail group's state"
  );
  assert.equal(document.querySelector('[data-tab-group="history"][data-tab-panel="record"]').hidden, false);
});
