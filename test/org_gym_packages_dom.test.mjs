// The gym owner's Packages: add one with what's included and who delivers
// it, edit it, and remove it. Runs the real org console (public/org/
// index.html + org.js) in jsdom with fetch answered here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

// jsdom never runs the page's own <script> tags (no runScripts option), so
// the real index.html loads as is; org.js is imported below.
const html = fs.readFileSync(new URL("../public/org/index.html", import.meta.url), "utf8");
const dom = new JSDOM(html, { url: "http://localhost/org/", pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, CustomEvent: window.CustomEvent, Event: window.Event, HTMLElement: window.HTMLElement });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};

const ORG = "org_gym_1";
const COACHES = [{ coach_user_id: "coach_1", display_name: "Chris Roberts" }];
let packages = [];
const sent = [];
const view = (body, id) => ({
  package_id: id, name: body.name, price: body.price, currency: body.currency, billing: body.billing, description: body.description || null,
  price_label: `£${body.price}`, includes: body.includes, includes_summary: body.includes.programming ? ["Programming"] : [],
  delivered_by: body.delivered_by.map((coachUserId) => ({ coach_user_id: coachUserId, display_name: "Chris Roberts" }))
});
globalThis.fetch = async (input, init = {}) => {
  const path = String(input);
  const method = init.method ?? "GET";
  const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
  if (path === "/org/sign-in") return reply({ ok: true, csrf_token: "csrf", org_owner: { user_id: "owner_1", display_name: "Forge Owner" } });
  if (path === "/org/organisations") return reply({ organisations: [{ org_id: ORG, org_name: "Forge", visibility_mode: "individual", org_state: "active", created_at: "2026-10-30T10:00:00.000Z" }] });
  if (path.endsWith("/gym-listing")) return reply({ ok: true, listing: { org_id: ORG, display_name: "Forge", area: "York", equipment: [], listing_status: "approved" }, athletes_label: "Fewer than 3 athletes chose this gym", options: [] });
  if (path.endsWith("/gym-coaches")) return reply({ ok: true, coaches: [] });
  const base = `/org/organisations/${ORG}/packages`;
  if (path === base && method === "GET") return reply({ ok: true, packages, coaches: COACHES });
  if (path === base && method === "POST") {
    const body = JSON.parse(init.body);
    sent.push({ method, path, body, csrf: init.headers["x-kolosseum-csrf"] });
    packages = [...packages, view(body, "pkg_1")];
    return reply({ ok: true, packages, coaches: COACHES }, 201);
  }
  if (path === `${base}/pkg_1` && method === "PUT") {
    const body = JSON.parse(init.body);
    sent.push({ method, path, body });
    packages = [view(body, "pkg_1")];
    return reply({ ok: true, packages, coaches: COACHES });
  }
  if (path === `${base}/pkg_1/archive` && method === "POST") {
    sent.push({ method, path });
    packages = [];
    return reply({ ok: true, packages, coaches: COACHES });
  }
  return reply({ unread_count: 0, notifications: [], exports: [], requests: [], reports: [] });
};

await import(new URL("../public/org/org.js", import.meta.url).href);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await wait(10); }
  throw new Error("timed out");
}
const $ = (id) => document.getElementById(id);

test("the gym owner adds a package delivered by a confirmed coach, edits it and removes it", async () => {
  $("orgSignInForm").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => document.querySelector(`[data-gym-listing="${ORG}"]`));
  document.querySelector(`[data-gym-listing="${ORG}"]`).click();
  await until(() => /No packages yet/u.test($("orgGymPackages").textContent));

  $("orgAddPackageButton").click();
  assert.equal($("orgGymPackageForm").hidden, false);
  $("orgPackageName").value = "PT block";
  $("orgPackagePrice").value = "120";
  $("orgPackageBilling").value = "one_off";
  $("orgPackageProgramming").checked = true;
  $("orgPackageInPerson").value = "4";
  $("orgPackageCoaches").querySelector("input[value='coach_1']").checked = true;
  $("orgGymPackageForm").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => sent.length === 1 && /PT block/u.test($("orgGymPackages").textContent));
  assert.deepEqual(sent[0].body, {
    name: "PT block", price: 120, currency: "GBP", billing: "one_off", description: "",
    includes: { programming: true, checkin_calls: 0, in_person_sessions: 4, session_reviews: "none", messaging: false },
    delivered_by: ["coach_1"]
  });
  assert.equal(sent[0].csrf, "csrf");
  assert.equal($("orgGymPackageForm").hidden, true);
  assert.match($("orgGymPackages").textContent, /With Chris Roberts/u);

  document.querySelector("[data-edit-package='pkg_1']").click();
  assert.equal($("orgPackageName").value, "PT block");
  assert.equal($("orgPackageInPerson").value, "4");
  assert.equal($("orgPackageCoaches").querySelector("input[value='coach_1']").checked, true);
  $("orgPackagePrice").value = "140";
  $("orgGymPackageForm").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => sent.length === 2);
  assert.deepEqual([sent[1].method, sent[1].path, sent[1].body.price], ["PUT", `/org/organisations/${ORG}/packages/pkg_1`, 140]);

  await until(() => document.querySelector("[data-archive-package='pkg_1']"));
  document.querySelector("[data-archive-package='pkg_1']").click();
  await until(() => sent.length === 3 && /No packages yet/u.test($("orgGymPackages").textContent));
  assert.equal(sent[2].path, `/org/organisations/${ORG}/packages/pkg_1/archive`);
});
