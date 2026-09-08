// DEV NOTE: History-page section-tabs contract. Pure infrastructure - not a
// new user-facing capability area, so no FULL-UI slice number or
// product/ui/function_manifest.json entry is claimed (see the plan's Context
// section). Part 1 locks the real markup shape; part 2 exercises the
// generic tab-toggle function's real behavior against a hand-written
// fixture DOM, not the real markup - drift between the two is impossible
// since part 1 already pins the real markup exactly.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";

import { initSectionTabs } from "../public/app/section_tabs_bootstrap.js";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");

const WELLBEING_PANEL_IDS = [
  "athlete-self-progress-insights-root",
  "athlete-self-progress-photos-root",
  "athlete-self-body-metrics-root",
  "athlete-self-nutrition-root",
  "athlete-self-habits-root",
  "athlete-self-goals-root",
  "athlete-self-weekly-checkins-root",
  "athlete-self-device-sync-root"
];

test("index.html declares the History-page tab strip with both tabs", () => {
  assert.match(html, /<div class="section-tabs" role="tablist" aria-label="History sections" data-tab-group="history">/u);
  assert.match(html, /<button type="button" role="tab" class="section-tab active" aria-selected="true" data-tab-target="record">History<\/button>/u);
  assert.match(html, /<button type="button" role="tab" class="section-tab" aria-selected="false" data-tab-target="wellbeing">Wellbeing<\/button>/u);
});

test("index.html groups the session-history root under the record tab panel", () => {
  const recordPanel = /<div data-tab-group="history" data-tab-panel="record">\s*<div id="athlete-history-root"><\/div>\s*<\/div>/u;
  assert.match(html, recordPanel);
});

test("index.html groups every wellbeing panel under the wellbeing tab panel, hidden by default", () => {
  const wellbeingSectionMatch = html.match(/<div data-tab-group="history" data-tab-panel="wellbeing" hidden>([\s\S]*?)\n {10}<\/div>/u);
  assert.ok(wellbeingSectionMatch, "expected a wellbeing tab-panel wrapper");

  const wellbeingSection = wellbeingSectionMatch[1];
  for (const id of WELLBEING_PANEL_IDS) {
    assert.match(wellbeingSection, new RegExp(`<div id="${id}"></div>`, "u"), `expected ${id} inside the wellbeing tab panel`);
  }
});

test("index.html loads the section-tabs bootstrap module alongside the existing app scripts", () => {
  assert.match(html, /<script type="module" src="\/app\/pwa_bootstrap\.js"><\/script>\s*<script type="module" src="\/app\/section_tabs_bootstrap\.js"><\/script>/u);
});

function buildFixtureDom() {
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
  </body></html>`);
  return dom.window.document;
}

test("clicking the Wellbeing tab reveals the wellbeing panel and hides the record panel", () => {
  const document = buildFixtureDom();
  initSectionTabs(document);

  document.querySelector('[data-tab-target="wellbeing"]').click();

  assert.equal(document.querySelector('[data-tab-panel="record"]').hidden, true);
  assert.equal(document.querySelector('[data-tab-panel="wellbeing"]').hidden, false);
  assert.equal(document.querySelector('[data-tab-target="wellbeing"]').getAttribute("aria-selected"), "true");
  assert.equal(document.querySelector('[data-tab-target="record"]').getAttribute("aria-selected"), "false");
  assert.equal(document.querySelector('[data-tab-target="wellbeing"]').classList.contains("active"), true);
  assert.equal(document.querySelector('[data-tab-target="record"]').classList.contains("active"), false);
});

test("clicking back to the History tab reverses the toggle", () => {
  const document = buildFixtureDom();
  initSectionTabs(document);

  document.querySelector('[data-tab-target="wellbeing"]').click();
  document.querySelector('[data-tab-target="record"]').click();

  assert.equal(document.querySelector('[data-tab-panel="record"]').hidden, false);
  assert.equal(document.querySelector('[data-tab-panel="wellbeing"]').hidden, true);
  assert.equal(document.querySelector('[data-tab-target="record"]').getAttribute("aria-selected"), "true");
});
