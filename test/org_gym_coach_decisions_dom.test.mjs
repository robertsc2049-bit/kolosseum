// The gym owner's Coaches list: Confirm / Decline / Remove actually send the
// decision. Runs the real org console (public/org/index.html + org.js) in
// jsdom with fetch answered here.
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
let coaches = [{ coach_gym_id: "cgym_1", display_name: "Chris Roberts", business_name: "Old Tyme Strength", link_status: "pending" }];
const decisions = [];
globalThis.fetch = async (input, init = {}) => {
  const path = String(input);
  const method = init.method ?? "GET";
  const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
  if (path === "/org/sign-in") return reply({ ok: true, csrf_token: "csrf", org_owner: { user_id: "owner_1", display_name: "Forge Owner" } });
  if (path === "/org/organisations") return reply({ organisations: [{ org_id: ORG, org_name: "Forge", visibility_mode: "individual", org_state: "active", created_at: "2026-10-30T10:00:00.000Z" }] });
  if (path.endsWith("/gym-listing")) return reply({ ok: true, listing: { org_id: ORG, display_name: "Forge", area: "York", equipment: [], listing_status: "approved" }, athletes_label: "Fewer than 3 athletes chose this gym", options: [] });
  if (path.endsWith("/gym-coaches")) return reply({ ok: true, coaches });
  if (path.endsWith("/decision") && method === "POST") {
    const { decision } = JSON.parse(init.body);
    decisions.push({ path, decision, csrf: init.headers["x-kolosseum-csrf"] });
    coaches = coaches.map((c) => ({ ...c, link_status: decision === "confirm" ? "confirmed" : "declined" })).filter((c) => c.link_status !== "declined");
    return reply({ ok: true, coaches });
  }
  return reply({ unread_count: 0, notifications: [], exports: [], requests: [], reports: [] });
};

await import(new URL("../public/org/org.js", import.meta.url).href);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await wait(10); }
  throw new Error("timed out");
}

test("the gym owner confirms a coach, then removes them, from the Coaches list", async () => {
  document.getElementById("orgSignInForm").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => document.querySelector(`[data-gym-listing="${ORG}"]`));
  document.querySelector(`[data-gym-listing="${ORG}"]`).click();
  await until(() => document.querySelector("[data-gym-coach][data-decision='confirm']"));

  document.querySelector("[data-gym-coach][data-decision='confirm']").click();
  await until(() => decisions.length === 1 && document.querySelector("[data-decision='remove']"));
  assert.deepEqual(decisions[0], { path: `/org/organisations/${ORG}/gym-coaches/cgym_1/decision`, decision: "confirm", csrf: "csrf" });
  assert.match(document.getElementById("orgGymCoaches").textContent, /Confirmed/u);

  document.querySelector("[data-decision='remove']").click();
  await until(() => decisions.length === 2);
  assert.equal(decisions[1].decision, "remove");
  await until(() => /No coaches have linked/u.test(document.getElementById("orgGymCoaches").textContent));
});
