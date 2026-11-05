// Message safety (Online Safety Act 2023; Terms of Service clause 10). A
// coach sends their athlete an abusive message. Dan reports it, an admin
// removes it and stops the coach sending messages, Dan is told the outcome
// and the coach is told why. The message shows as removed for both of
// them, its text is never served again, and the report keeps what was said.
// Then Dan blocks the coach: the coach's messages and broadcasts stop
// reaching him until he unblocks. Only the person who received a message
// can report it, and only an admin can decide a report.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];
const REMOVED = "This message was removed by Kolosseum for breaking the Terms of Service.";

function client(baseUrl) {
  const jar = new Map();
  let csrf = "";
  async function req(method, route, body) {
    const headers = { origin: baseUrl };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (csrf && method !== "GET") headers["x-kolosseum-csrf"] = csrf;
    const response = await fetch(baseUrl + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
    }
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, json, text };
  }
  async function refresh() {
    const detail = await req("GET", "/account/detail");
    csrf = detail.json?.csrf_token ?? csrf;
    return detail.json;
  }
  return { req, refresh, setCsrf: (value) => { csrf = value; } };
}
const ok = (result, status, label) => { assert.equal(result.status, status, `${label}: ${result.text}`); return result; };

async function createAdmin(email, password) {
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  const userId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query("INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)", [userId, email, "Safety Admin", salt, hash]);
  return userId;
}

test("a reported abusive message is removed by an admin, the coach is restricted and told why, and a block stops their messages", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  let adminId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_message_reports WHERE reporter_user_id = ANY($1::text[]) OR reported_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_messaging_restrictions WHERE user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_user_blocks WHERE blocker_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_message_threads WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminId]).catch(() => {});
    await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminId]).catch(() => {});
    for (const userId of userIds) {
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `safety_${name.toLowerCase().replace(/[^a-z]+/gu, "_")}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "SafetyTest!2026", date_of_birth: "1994-06-06",
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", ...extra
    }), 201, `register ${name}`);
    const detail = await c.refresh();
    userIds.push(detail.account.user_id);
    return { email, userId: detail.account.user_id };
  };

  const coach = client(baseUrl);
  const coachAccount = await register(coach, "coach", "Coach Grim");
  for (const [method, route, body] of [
    ["PATCH", "/account/coach-onboarding/profile", { display_name: "Coach Grim", email: coachAccount.email }],
    ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }],
    ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }],
    ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]
  ]) await coach.req(method, route, body);

  const dan = client(baseUrl);
  const danAccount = await register(dan, "athlete", "Dan", { activity_id: "powerlifting" });
  const fields = { activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true, accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard" };
  for (const stage of STAGES.slice(1)) await dan.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
  ok(await dan.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, "Dan onboarded");
  await coach.refresh();
  ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: danAccount.email }), 201, "Dan invited");
  await dan.refresh();
  const invitations = (await dan.req("GET", "/coach-workspace/relationship-invitations")).json;
  const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
  ok(await dan.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, "Dan accepts");
  await coach.refresh();
  await dan.refresh();

  const toDan = (body, id) => coach.req("POST", `/messages/coach/athletes/${danAccount.userId}/send`, { body_text: body, client_request_id: id });
  ok(await toDan("You're useless. Quit before you embarrass yourself again.", `m1_${nonce}`), 201, "coach sends");
  const threads = ok(await dan.req("GET", "/messages/athlete/threads"), 200, "Dan's threads").json.threads;
  const threadId = threads[0].thread_id;
  const danThread = () => dan.req("GET", `/messages/athlete/threads/${threadId}`);
  const abusive = ok(await danThread(), 200, "Dan reads").json.messages.find((m) => m.sender_role === "coach");

  // Only the person who received it can report it, with a reason.
  ok(await dan.req("POST", "/messages/safety/reports", { message_id: abusive.message_id, reason: "rude" }), 422, "a reason from the list");
  ok(await coach.req("POST", "/messages/safety/reports", { message_id: abusive.message_id, reason: "abuse" }), 404, "the sender can't report their own message");
  const stranger = client(baseUrl);
  await register(stranger, "athlete", "Stranger", { activity_id: "powerlifting" });
  ok(await stranger.req("POST", "/messages/safety/reports", { message_id: abusive.message_id, reason: "abuse" }), 404, "someone outside the thread can't");
  const report = ok(await dan.req("POST", "/messages/safety/reports", { message_id: abusive.message_id, reason: "abuse", note: "Third time this week." }), 201, "Dan reports it").json;
  assert.equal(report.status, "open");
  assert.equal(ok(await dan.req("POST", "/messages/safety/reports", { message_id: abusive.message_id, reason: "threat" }), 201, "again").json.already_reported, true, "one report per person per message");

  // The admin sees it with what was said; only admins can.
  ok(await dan.req("GET", "/admin/message-reports"), 401, "athletes can't see the queue");
  const adminEmail = `safety_admin_${nonce}@example.com`;
  adminId = await createAdmin(adminEmail, "SafetyAdminPassword1234");
  const admin = client(baseUrl);
  const adminSignIn = ok(await admin.req("POST", "/admin/sign-in", { email: adminEmail, password: "SafetyAdminPassword1234" }), 200, "admin signs in");
  admin.setCsrf(adminSignIn.json.csrf_token);
  const queue = ok(await admin.req("GET", "/admin/message-reports"), 200, "queue").json.reports;
  const queued = queue.find((r) => r.report_id === report.report_id);
  assert.equal(queued.reason_label, "Abuse or harassment");
  assert.equal(queued.note, "Third time this week.");
  assert.equal(queued.message.body_text, "You're useless. Quit before you embarrass yourself again.");
  assert.equal(queued.sender.name, "Coach Grim");
  assert.equal(queued.reporter.name, "Dan");

  // Remove it and stop the coach sending messages - with a reason they'll see.
  ok(await admin.req("POST", `/admin/message-reports/${report.report_id}/decide`, { decision: "remove_and_restrict" }), 400, "a reason is required to remove");
  const decided = ok(await admin.req("POST", `/admin/message-reports/${report.report_id}/decide`, { decision: "remove_and_restrict", note: "Abusive language towards an athlete." }), 200, "removed and restricted").json;
  assert.equal(decided.status, "removed_and_restricted");
  ok(await admin.req("POST", `/admin/message-reports/${report.report_id}/decide`, { decision: "dismiss" }), 409, "decided once");

  const afterDan = ok(await danThread(), 200, "Dan reads again").json.messages.find((m) => m.message_id === abusive.message_id);
  assert.equal(afterDan.body_text, REMOVED);
  assert.equal(afterDan.removed, true);
  const coachThread = ok(await coach.req("GET", `/messages/coach/threads/${threadId}`), 200, "coach reads").json.messages.find((m) => m.message_id === abusive.message_id);
  assert.equal(coachThread.body_text, REMOVED, "removed for both people");
  const restricted = ok(await toDan("Sorry.", `m2_${nonce}`), 403, "restricted coach can't send");
  assert.equal(restricted.json.error, "messaging_restricted");
  const evidence = (await admin.req("GET", "/admin/message-reports?status=all")).json.reports.find((r) => r.report_id === report.report_id);
  assert.equal(evidence.message.body_text, "You're useless. Quit before you embarrass yourself again.", "the report keeps what was said");
  assert.equal(evidence.message.removed, true);
  assert.equal(evidence.sender_restricted, true);

  // Both are told.
  const notes = async (c, type) => (ok(await c.req("GET", "/account/notifications"), 200, "notifications").json.notifications ?? []).filter((n) => n.notification_type === type);
  const outcome = await notes(dan, "message_report_outcome");
  assert.equal(outcome.length, 1);
  assert.deepEqual(outcome[0].notification_payload, { outcome: "removed" });
  const removedNotice = await notes(coach, "message_removed");
  assert.equal(removedNotice.length, 1);
  assert.deepEqual(removedNotice[0].notification_payload, { reason: "Abusive language towards an athlete." });

  // The admin lifts the restriction; the coach can send again.
  ok(await admin.req("POST", `/admin/messaging-restrictions/${coachAccount.userId}/lift`, {}), 200, "lifted");
  ok(await toDan("See you Thursday.", `m3_${nonce}`), 201, "coach can send again");

  // Dan blocks the coach: their messages and broadcasts stop reaching him.
  ok(await dan.req("POST", "/messages/safety/blocks", { user_id: danAccount.userId }), 422, "not yourself");
  ok(await dan.req("POST", "/messages/safety/blocks", { user_id: `stranger_${nonce}` }), 404, "only someone who has messaged you");
  const blocks = ok(await dan.req("POST", "/messages/safety/blocks", { user_id: coachAccount.userId }), 200, "Dan blocks the coach").json.blocks;
  assert.deepEqual(blocks.map((b) => [b.user_id, b.display_name]), [[coachAccount.userId, "Coach Grim"]]);
  const blocked = ok(await toDan("Hello?", `m4_${nonce}`), 403, "blocked coach can't send");
  assert.equal(blocked.json.error, "message_recipient_unavailable");
  const broadcast = ok(await coach.req("POST", "/messages/coach/broadcast", { body_text: "Gym closed Friday.", client_request_id: `b1_${nonce}` }), 201, "broadcast").json;
  assert.equal(broadcast.sent_count, 0, "the broadcast skips Dan");
  ok(await dan.req("POST", `/messages/athlete/coaches/${coachAccount.userId}/send`, { body_text: "Blocking you for now.", client_request_id: `d1_${nonce}` }), 201, "Dan can still message the coach");
  ok(await dan.req("POST", `/messages/safety/blocks/${coachAccount.userId}/remove`, {}), 200, "Dan unblocks");
  ok(await toDan("Thanks.", `m5_${nonce}`), 201, "messages reach Dan again");

  // A report that breaks no rule is dismissed, and the reporter is told so.
  const latest = ok(await danThread(), 200, "Dan reads").json.messages.filter((m) => m.sender_role === "coach").at(-1);
  const second = ok(await dan.req("POST", "/messages/safety/reports", { message_id: latest.message_id, reason: "other" }), 201, "second report").json;
  ok(await admin.req("POST", `/admin/message-reports/${second.report_id}/decide`, { decision: "dismiss" }), 200, "dismissed");
  const outcomes = await notes(dan, "message_report_outcome");
  assert.deepEqual(outcomes.map((n) => n.notification_payload.outcome).sort(), ["no_action", "removed"]);
  assert.equal(ok(await danThread(), 200, "Dan reads").json.messages.find((m) => m.message_id === latest.message_id).body_text, "Thanks.", "a dismissed report leaves the message");
  const own = ok(await dan.req("GET", "/messages/safety/reports"), 200, "Dan's reports").json.reports;
  assert.deepEqual(own.map((r) => r.status).sort(), ["dismissed", "removed_and_restricted"]);
});
