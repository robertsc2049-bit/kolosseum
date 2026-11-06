// The gym owner's message safety: under a message an athlete sent, Report
// (with a reason and the 999 line) and Block (after a confirm); the blocked
// athlete appears under Account, Blocked people and can be unblocked; a
// removed message offers neither; a blocked recipient's error is in plain
// words; and the bell tells the owner why their message was removed. Runs
// the real org console (public/org/index.html + org.js) in jsdom with fetch
// answered here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const html = fs.readFileSync(new URL("../public/org/index.html", import.meta.url), "utf8");
const dom = new JSDOM(html, { url: "http://localhost/org/", pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, CustomEvent: window.CustomEvent, Event: window.Event, HTMLElement: window.HTMLElement });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};

const ORG = "org_iron_1";
const RHYS = "athlete_rhys";
let blocks = [];
const posts = [];
const messages = [
  { message_id: "msg_owner", thread_id: "thr_1", sender_user_id: "owner_1", sender_role: "org_owner", body_text: "Your membership renews on the 1st.", created_at_iso8601: "2026-11-06T09:00:00.000Z", attachment: null },
  { message_id: "msg_abuse", thread_id: "thr_1", sender_user_id: RHYS, sender_role: "athlete", body_text: "Your staff are idiots.", created_at_iso8601: "2026-11-06T09:05:00.000Z", attachment: null },
  { message_id: "msg_gone", thread_id: "thr_1", sender_user_id: RHYS, sender_role: "athlete", body_text: "This message was removed by Kolosseum for breaking the Terms of Service.", removed: true, created_at_iso8601: "2026-11-06T09:06:00.000Z", attachment: null }
];
globalThis.fetch = async (input, init = {}) => {
  const path = String(input);
  const method = init.method ?? "GET";
  const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
  const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  if (path === "/org/sign-in") return reply({ ok: true, csrf_token: "csrf", org_owner: { user_id: "owner_1", display_name: "Iron Works" } });
  if (path === "/org/organisations") return reply({ organisations: [{ org_id: ORG, org_name: "Iron Works Gym", visibility_mode: "shared", org_state: "active", created_at: "2026-10-30T10:00:00.000Z" }] });
  if (path.endsWith("/roster")) return reply({ roster: [] });
  if (path.endsWith("/messages/threads")) return reply({ threads: [] });
  if (path.endsWith("/athlete-messages/threads")) return reply({ threads: [{ thread_id: "thr_1", athlete_user_id: RHYS, updated_at_iso8601: "2026-11-06T09:06:00.000Z", unread_count: 1 }] });
  if (path.endsWith("/athlete-messages/threads/thr_1")) return reply({ ok: true, messages });
  if (path.endsWith("/athlete-visibility")) return reply({ visibility: { visibility_mode: "shared", coaches: [{ athletes: [{ athlete_user_id: RHYS, display_name: "Rhys", relationship_state: "accepted" }] }] } });
  if (path.endsWith(`/athlete-messages/athletes/${RHYS}/send`)) return reply({ error: "message_recipient_unavailable" }, 403);
  if (path === "/org/messages/safety/blocks" && method === "GET") return reply({ ok: true, blocks });
  if (path === "/org/messages/safety/reports" && method === "POST") {
    posts.push({ path, body, csrf: init.headers["x-kolosseum-csrf"] });
    return reply({ ok: true, report_id: "r1", status: "open" }, 201);
  }
  if (path === "/org/messages/safety/blocks" && method === "POST") {
    posts.push({ path, body, csrf: init.headers["x-kolosseum-csrf"] });
    blocks = [{ user_id: body.user_id, display_name: "Rhys", blocked_at_iso8601: "2026-11-06T09:10:00.000Z" }];
    return reply({ ok: true, blocks });
  }
  if (path === `/org/messages/safety/blocks/${RHYS}/remove`) {
    posts.push({ path, body, csrf: init.headers["x-kolosseum-csrf"] });
    blocks = [];
    return reply({ ok: true, blocks });
  }
  if (path === "/org/notifications") {
    return reply({ notifications: [
      { notification_type: "message_removed", notification_payload: { reason: "Sales messages need consent.", org_id: ORG, org_name: "Iron Works Gym" } },
      { notification_type: "message_report_outcome", notification_payload: { outcome: "removed", org_id: ORG, org_name: "Iron Works Gym" } }
    ] });
  }
  return reply({ unread_count: 0, notifications: [], exports: [], requests: [], reports: [] });
};

await import(new URL("../public/org/org.js", import.meta.url).href);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label = "condition") {
  for (let i = 0; i < 200; i++) { if (check()) return; await wait(10); }
  throw new Error(`timed out waiting for ${label}`);
}
const list = () => document.getElementById("orgThreadMessageList");
const button = (text, root = list()) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const cards = () => [...list().querySelectorAll(".record-card")];

test("the gym owner reports an athlete's abusive message, blocks him, sees him under Blocked people and unblocks him", async () => {
  document.getElementById("orgSignInForm").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => document.querySelector(`[data-view-messages="${ORG}"]`), "the gym list");
  assert.match(document.getElementById("orgBlockedPeopleList").textContent, /You haven't blocked anyone/u);
  document.querySelector(`[data-view-messages="${ORG}"]`).click();
  await until(() => document.querySelector("#orgAthleteThreadList [data-open-counterpart]"), "the athlete thread");
  document.querySelector("#orgAthleteThreadList [data-open-counterpart]").click();
  await until(() => cards().length === 3, "the messages");

  // Nothing under the owner's own message or the removed one.
  assert.equal(cards()[0].querySelector(".message-safety"), null, "not under their own message");
  assert.equal(cards()[2].querySelector(".message-safety"), null, "not under a removed message");

  // Report: a reason is needed; the 999 line is there.
  button("Report", cards()[1]).click();
  await until(() => list().querySelector("[data-safety-report]"), "the report form");
  assert.match(list().textContent, /isn't told who reported it\. If you're in danger, call 999\./u);
  list().querySelector("[data-safety-report]").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => /Choose a reason\./u.test(list().textContent), "the reason error");
  assert.equal(posts.length, 0);
  list().querySelector("input[value=threat]").checked = true;
  list().querySelector("textarea[name=note]").value = "Second time this week.";
  list().querySelector("[data-safety-report]").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => /Reported - thank you/u.test(list().textContent), "the report confirmation");
  assert.deepEqual(posts[0], { path: "/org/messages/safety/reports", body: { message_id: "msg_abuse", reason: "threat", note: "Second time this week." }, csrf: "csrf" });
  assert.equal(button("Report", cards()[1]), undefined, "reported once");

  // Block, after a confirm.
  button("Block", cards()[1]).click();
  await until(() => /Block this person\?/u.test(list().textContent), "the block confirm");
  button("Block", cards()[1]).click();
  await until(() => /Blocked\. Their messages won't reach your gyms/u.test(list().textContent), "the block confirmation");
  assert.deepEqual(posts[1], { path: "/org/messages/safety/blocks", body: { user_id: RHYS }, csrf: "csrf" });
  assert.equal(button("Block", cards()[1]), undefined, "nothing more to block");
  assert.match(document.getElementById("orgBlockedPeopleList").textContent, /Rhys/u, "listed under Blocked people straight away");

  // Replying to someone who blocked the gym: plain words.
  document.getElementById("orgThreadReplyText").value = "Please call us.";
  document.getElementById("orgThreadReplyForm").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await until(() => !document.getElementById("orgThreadReplyError").hidden, "the send error");
  assert.equal(document.getElementById("orgThreadReplyError").textContent, "This person isn't accepting messages from you at the moment.");

  // Unblock from Account.
  button("Unblock", document.getElementById("orgBlockedPeopleList")).click();
  await until(() => /You haven't blocked anyone/u.test(document.getElementById("orgBlockedPeopleList").textContent), "unblocked");
  assert.equal(posts[2].path, `/org/messages/safety/blocks/${RHYS}/remove`);
});

test("the bell tells the owner why their message was removed and what happened to their report, and opens that gym's messages", async () => {
  document.getElementById("orgThreadDetailBackButton").click();
  document.getElementById("orgNotificationBellButton").click();
  const panel = document.getElementById("orgNotificationPanelBody");
  await until(() => /removed by Kolosseum/u.test(panel.textContent), "the bell");
  assert.match(panel.textContent, /A message you sent was removed by Kolosseum: Sales messages need consent\./u);
  assert.match(panel.textContent, /The message you reported was removed - thank you for reporting it/u);
  document.getElementById("orgMessagesSection").hidden = true;
  panel.querySelector("[data-open-org-notifications]").click();
  await until(() => !document.getElementById("orgMessagesSection").hidden, "the gym's messages");
});
