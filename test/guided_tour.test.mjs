import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

// The engine runs against a real DOM: jsdom, with layout stubbed - an element
// marked data-box has a 200x40 box, everything else has none (as jsdom does).
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, getComputedStyle: window.getComputedStyle.bind(window), CustomEvent: window.CustomEvent });
window.matchMedia = (query) => ({ matches: /reduce/u.test(query), media: query, addEventListener() {}, removeEventListener() {} });
window.scrollBy = () => {};
window.HTMLElement.prototype.getBoundingClientRect = function () {
  const boxed = this.hasAttribute?.("data-box") || this.closest?.(".guided-tour-card");
  return boxed ? { top: 100, left: 100, right: 300, bottom: 140, width: 200, height: 40, x: 100, y: 100 } : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
};

const { startTour, tourSeen, markTourSeen, tourOpen } = await import(new URL("../public/app/guided_tour.js", import.meta.url).href);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function settled() {
  for (let i = 0; i < 60; i++) {
    const root = document.querySelector(".guided-tour");
    if (root && !root.classList.contains("guided-tour-busy")) return root;
    await wait(20);
  }
  throw new Error("tour step never settled");
}
const text = (root, selector) => root.querySelector(selector).textContent;

test("a new coach can step forward and back through the tour and finish it", async () => {
  document.body.innerHTML = `<div id="roster" data-box></div>`;
  const done = startTour({ steps: [
    { title: "Welcome", body: "Hello" },
    { target: "#roster", title: "Your roster", body: "Athletes" },
    { title: "You're set", body: "Go", doneLabel: "Get started" }
  ] });
  let root = await settled();
  assert.equal(text(root, ".guided-tour-progress"), "1 of 3");
  assert.equal(root.querySelector(".guided-tour-back").hidden, true, "no Back on the first step");
  assert.equal(root.querySelector(".guided-tour-spotlight").hidden, true, "no spotlight without a target");
  assert.equal(root.querySelector(".guided-tour-card").getAttribute("role"), "dialog");

  root.querySelector(".guided-tour-next").click();
  root = await settled();
  assert.equal(text(root, ".guided-tour-title"), "Your roster");
  assert.equal(root.querySelector(".guided-tour-spotlight").hidden, false, "the roster is spotlit");

  root.querySelector(".guided-tour-back").click();
  root = await settled();
  assert.equal(text(root, ".guided-tour-title"), "Welcome");

  root.querySelector(".guided-tour-next").click();
  root = await settled();
  root.querySelector(".guided-tour-next").click();
  root = await settled();
  assert.equal(text(root, ".guided-tour-next"), "Get started");
  assert.equal(root.querySelector(".guided-tour-skip").hidden, true, "nothing to skip on the last step");
  root.querySelector(".guided-tour-next").click();
  assert.deepEqual(await done, { finished: true, started: true });
  assert.equal(document.querySelector(".guided-tour"), null, "the overlay is removed");
  assert.equal(tourOpen(), false);
});

test("Escape skips the tour", async () => {
  document.body.innerHTML = "";
  const done = startTour({ steps: [{ title: "One", body: "" }, { title: "Two", body: "" }] });
  await settled();
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.deepEqual(await done, { finished: false, started: true });
  assert.equal(document.querySelector(".guided-tour"), null);
});

test("a self-coached athlete without a Kolosseum programme skips that step, and it drops out of the count", async () => {
  document.body.innerHTML = `<div id="training" data-box></div><div id="maxes" data-box></div>`;
  const done = startTour({ steps: [
    { target: "#training", title: "Build your training", body: "" },
    { target: "#kolosseum-programme", optional: true, title: "Your Kolosseum programme", body: "" },
    { target: "#maxes", title: "How your weights are set", body: "" }
  ] });
  let root = await settled();
  root.querySelector(".guided-tour-next").click();
  // The optional step waits for its target before giving up on it.
  await wait(2700);
  root = await settled();
  assert.equal(text(root, ".guided-tour-title"), "How your weights are set");
  assert.equal(text(root, ".guided-tour-progress"), "2 of 2");
  root.querySelector(".guided-tour-next").click();
  assert.equal((await done).finished, true);
});

test("only one tour runs at a time", async () => {
  document.body.innerHTML = "";
  const first = startTour({ steps: [{ title: "First", body: "" }] });
  assert.deepEqual(await startTour({ steps: [{ title: "Second", body: "" }] }), { finished: false, started: false });
  const root = await settled();
  assert.equal(text(root, ".guided-tour-title"), "First");
  root.querySelector(".guided-tour-next").click();
  await first;
});

test("a tour is remembered as seen per account", () => {
  assert.equal(tourSeen("coach", "coach_a"), false);
  markTourSeen("coach", "coach_a");
  assert.equal(tourSeen("coach", "coach_a"), true);
  assert.equal(tourSeen("coach", "coach_b"), false, "another coach on the same browser still gets it");
  assert.equal(tourSeen("athlete_self", "coach_a"), false);
});

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const appSrc = fs.readdirSync(new URL("../public/app-src/screens/", import.meta.url), { recursive: true })
  .filter((file) => String(file).endsWith(".tsx"))
  .map((file) => read(`public/app-src/screens/${String(file).replace(/\\/gu, "/")}`))
  .join("\n");

function targetsOf(source) {
  const targets = [];
  for (const match of source.matchAll(/target: (\[[^\]]*\]|"(?:[^"\\]|\\.)*")/gu)) {
    for (const selector of match[1].matchAll(/"((?:[^"\\]|\\.)*)"/gu)) targets.push(selector[1].replace(/\\"/gu, "\""));
  }
  return targets;
}

test("every screen the main-app tours point at still exists", () => {
  const html = read("public/app/index.html");
  const tours = read("public/app/guided_tours.js");
  for (const tour of ["coachSteps", "coachedAthleteSteps", "selfCoachedAthleteSteps"]) assert.match(tours, new RegExp(`function ${tour}\\(`, "u"));
  for (const selector of targetsOf(tours)) {
    for (const [, id] of selector.matchAll(/#([A-Za-z][\w-]*)/gu)) assert.ok(html.includes(`id="${id}"`), `index.html still has #${id} (${selector})`);
    for (const [, testId] of selector.matchAll(/data-testid="([\w-]+)"/gu)) assert.ok(appSrc.includes(`data-testid="${testId}"`), `a screen still renders data-testid="${testId}"`);
  }
  for (const [, view] of tours.matchAll(/openView\("([\w-]+)"\)/gu)) assert.ok(html.includes(`data-view="${view}"`), `the nav still has data-view="${view}"`);
  assert.ok(html.includes('id="athleteOnboardingNav"'));
  assert.ok(html.includes('id="showMeAroundButton"'), "Account has a Show me around button");
  assert.ok(html.includes('src="/app/guided_tours.js"'));
});

test("every part of the organisation app the tours point at still exists", () => {
  const html = read("public/org/index.html");
  const tours = read("public/org/org_tours.js");
  const orgJs = read("public/org/org.js");
  for (const [, id] of tours.matchAll(/target: "#([A-Za-z][\w-]*)"/gu)) assert.ok(html.includes(`id="${id}"`), `org index.html still has #${id}`);
  for (const [, attribute] of tours.matchAll(/button\("(data-[\w-]+)"/gu)) assert.ok(orgJs.includes(`${attribute}="`), `org.js still renders ${attribute} buttons`);
  assert.ok(orgJs.includes("data-manage-roster=\""), "the org card is found through its roster button");
  assert.ok(orgJs.includes("kolosseum:org-workspace-shown") && orgJs.includes("kolosseum:org-organisations-rendered"), "org.js announces the workspace and the organisations list");
  assert.doesNotMatch(orgJs, /^import /mu, "org.js still imports nothing");
  assert.ok(html.includes('id="orgShowMeAroundButton"'));
  assert.ok(html.includes('src="/org/org_tours.js"'));
});
