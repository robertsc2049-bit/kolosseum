// Message safety for gym and organisation owners (Online Safety Act 2023;
// Terms of Service clause 10). An athlete sends their gym an abusive
// message. The owner reports it and blocks the athlete: the athlete's
// messages stop reaching the gym while the gym's coach still gets through,
// and the owner can still message the athlete. An admin removes the
// reported message and the owner is told, with a link to that gym's
// messages. When the athlete reports the owner's own message and an admin
// removes it, the owner is told why. Only the owner who received a message
// can report it, and only someone who messaged the owner can be blocked.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";


// Seeds coach profiles and relationships through the early beta harness
// routes without an account cookie; sessions_access_gate.ts allows that only
// with this switch, and never in production.
process.env.KOLOSSEUM_SESSIONS_TEST_HARNESS = "1";

async function request(baseUrl, method, route, body, who = {}) {
  const headers = { origin: baseUrl };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (who.cookie) headers.cookie = who.cookie;
  if (who.csrf && method !== "GET") headers["x-kolosseum-csrf"] = who.csrf;
  const response = await fetch(baseUrl + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, json, text, response };
}
const ok = (result, status, label) => { assert.equal(result.status, status, `${label}: ${result.text}`); return result; };
function cookieNamed(result, name) {
  const found = result.response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `expected ${name} cookie`);
  return found.split(";")[0];
}

async function createAdmin(email, password) {
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  const userId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query("INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)", [userId, email, "Safety Admin", salt, hash]);
  return userId;
}

test("a gym owner reports and blocks an abusive athlete, is told the outcome, and is told why their own message was removed", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const ownerIds = [];
  const accountIds = [];
  let adminId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    const all = [...ownerIds, ...accountIds];
    await pool.query("DELETE FROM product_message_reports WHERE reporter_user_id = ANY($1::text[]) OR reported_user_id = ANY($1::text[])", [all]).catch(() => {});
    await pool.query("DELETE FROM product_messaging_restrictions WHERE user_id = ANY($1::text[])", [all]).catch(() => {});
    await pool.query("DELETE FROM product_user_blocks WHERE blocker_user_id = ANY($1::text[]) OR blocked_user_id = ANY($1::text[])", [all]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [all]).catch(() => {});
    await pool.query("DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])", [all]).catch(() => {});
    await pool.query("DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [all]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [accountIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminId]).catch(() => {});
    await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminId]).catch(() => {});
    for (const userId of ownerIds) {
      for (const table of ["product_org_audit_records", "product_org_coach_memberships"]) {
        await pool.query(`DELETE FROM ${table} WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)`, [userId]).catch(() => {});
      }
      await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [userId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
    }
    for (const userId of accountIds) {
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.end();
  });

  const registerOwner = async (label) => {
    const result = ok(await request(baseUrl, "POST", "/org/register", { email: `osafety_${label}_${nonce}@example.com`, display_name: `Iron Works ${label}`, password: `OrgSafety${label}!2026`, accepted_terms: true, accepted_terms_version: "terms_v1" }), 201, `${label} owner registers`);
    ownerIds.push(result.json.org_owner.user_id);
    return { userId: result.json.org_owner.user_id, cookie: cookieNamed(result, "kolosseum_org_owner_session"), csrf: result.json.csrf_token };
  };
  const registerAccount = async (actorType, name) => {
    const email = `osafety_${name.toLowerCase().replace(/[^a-z]+/gu, "_")}_${nonce}@example.com`;
    const result = ok(await request(baseUrl, "POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "OrgSafetyTest!2026", date_of_birth: "1993-03-03",
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1",
      ...(actorType === "athlete" ? { activity_id: "powerlifting" } : {})
    }), 201, `register ${name}`);
    accountIds.push(result.json.account.user_id);
    return { userId: result.json.account.user_id, email, cookie: cookieNamed(result, "kolosseum_session"), csrf: result.json.csrf_token };
  };

  const owner = await registerOwner("main");
  const coach = await registerAccount("coach", "Coach Nell");
  const athlete = await registerAccount("athlete", "Rhys");
  const now = new Date().toISOString();
  ok(await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: `osafety_rel_${nonce}`, coach_user_id: coach.userId, athlete_user_id: athlete.userId, relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete", accepted_at_iso8601: now, created_at_iso8601: now, updated_at_iso8601: now, revoked_at_iso8601: null, expires_at_iso8601: null
  }), 201, "Rhys is Nell's athlete");
  const org = ok(await request(baseUrl, "POST", "/org/organisations", { org_name: "Iron Works Gym", activity_id: "powerlifting", visibility_mode: "shared" }, owner), 201, "gym created").json.organisation;
  const invite = ok(await request(baseUrl, "POST", `/org/organisations/${org.org_id}/roster/invite`, { coach_email: coach.email, request_id: `inv_${nonce}` }, owner), 201, "Nell invited").json;
  ok(await request(baseUrl, "POST", `/coach-workspace/org-memberships/${invite.membership.membership_id}/accept`, { request_id: `acc_${nonce}` }, coach), 200, "Nell joins");

  const ownerToRhys = (body, id) => request(baseUrl, "POST", `/org/organisations/${org.org_id}/athlete-messages/athletes/${athlete.userId}/send`, { body_text: body, client_request_id: id }, owner);
  const rhysToGym = (body, id) => request(baseUrl, "POST", `/messages/athlete/org-messages/organisations/${org.org_id}/send`, { body_text: body, client_request_id: id }, athlete);
  const nellToGym = (body, id) => request(baseUrl, "POST", `/coach-workspace/org-messages/organisations/${org.org_id}/send`, { body_text: body, client_request_id: id }, coach);

  ok(await ownerToRhys("Your membership renews on the 1st.", `o1_${nonce}`), 201, "owner messages Rhys");
  ok(await rhysToGym("Your staff are idiots and I know where the manager parks.", `r1_${nonce}`), 201, "Rhys replies");
  ok(await nellToGym("Can I book the platform on Saturday?", `n1_${nonce}`), 201, "Nell messages the gym");

  const threadId = ok(await request(baseUrl, "GET", `/org/organisations/${org.org_id}/athlete-messages/threads`, undefined, owner), 200, "owner's athlete threads").json.threads[0].thread_id;
  const ownerThread = async () => ok(await request(baseUrl, "GET", `/org/organisations/${org.org_id}/athlete-messages/threads/${threadId}`, undefined, owner), 200, "owner reads").json.messages;
  const fromRhys = (await ownerThread()).find((m) => m.sender_role === "athlete");
  const fromOwner = (await ownerThread()).find((m) => m.sender_role === "org_owner");

  // Only the owner who received it can report it.
  ok(await request(baseUrl, "POST", "/org/messages/safety/reports", { message_id: fromOwner.message_id, reason: "abuse" }, owner), 404, "not their own message");
  const otherOwner = await registerOwner("other");
  ok(await request(baseUrl, "POST", "/org/messages/safety/reports", { message_id: fromRhys.message_id, reason: "abuse" }, otherOwner), 404, "another gym's owner can't");
  ok(await request(baseUrl, "POST", "/org/messages/safety/reports", { message_id: fromRhys.message_id, reason: "abuse" }, { cookie: owner.cookie }), 403, "needs the CSRF token");
  const report = ok(await request(baseUrl, "POST", "/org/messages/safety/reports", { message_id: fromRhys.message_id, reason: "threat", note: "Mentions where the manager parks." }, owner), 201, "owner reports it").json;
  assert.equal(report.status, "open");
  const own = ok(await request(baseUrl, "GET", "/org/messages/safety/reports", undefined, owner), 200, "owner's reports").json.reports;
  assert.deepEqual(own.map((r) => r.report_id), [report.report_id]);

  // Only someone who has messaged one of their gyms can be blocked.
  ok(await request(baseUrl, "POST", "/org/messages/safety/blocks", { user_id: `stranger_${nonce}` }, owner), 404, "a stranger");
  ok(await request(baseUrl, "POST", "/org/messages/safety/blocks", { user_id: athlete.userId }, otherOwner), 404, "Rhys never messaged the other gym");
  const blocks = ok(await request(baseUrl, "POST", "/org/messages/safety/blocks", { user_id: athlete.userId }, owner), 200, "owner blocks Rhys").json.blocks;
  assert.deepEqual(blocks.map((b) => [b.user_id, b.display_name]), [[athlete.userId, "Rhys"]]);
  assert.deepEqual(ok(await request(baseUrl, "GET", "/org/messages/safety/blocks", undefined, owner), 200, "listed").json.blocks.map((b) => b.user_id), [athlete.userId]);

  // Rhys's messages stop reaching the gym; Nell's still do; the owner can still message Rhys.
  const blocked = ok(await rhysToGym("Hello?", `r2_${nonce}`), 403, "Rhys can't message the gym");
  assert.equal(blocked.json.error, "message_recipient_unavailable");
  ok(await nellToGym("Saturday at 10?", `n2_${nonce}`), 201, "Nell still can");
  ok(await ownerToRhys("Please speak to staff respectfully.", `o2_${nonce}`), 201, "the owner can still message Rhys");

  // A coach can be blocked too, and unblocking lets messages through again.
  ok(await request(baseUrl, "POST", "/org/messages/safety/blocks", { user_id: coach.userId }, owner), 200, "owner blocks Nell");
  assert.equal(ok(await nellToGym("Hello?", `n3_${nonce}`), 403, "Nell can't").json.error, "message_recipient_unavailable");
  ok(await request(baseUrl, "POST", `/org/messages/safety/blocks/${coach.userId}/remove`, {}, owner), 200, "owner unblocks Nell");
  ok(await nellToGym("Thanks.", `n4_${nonce}`), 201, "Nell gets through again");

  // The admin sees who reported it and removes it; the owner is told, with a link to that gym's messages.
  const adminEmail = `osafety_admin_${nonce}@example.com`;
  adminId = await createAdmin(adminEmail, "OrgSafetyAdminPassword1234");
  const signIn = ok(await request(baseUrl, "POST", "/admin/sign-in", { email: adminEmail, password: "OrgSafetyAdminPassword1234" }), 200, "admin signs in");
  const admin = { cookie: cookieNamed(signIn, "kolosseum_admin_session"), csrf: signIn.json.csrf_token };
  const queued = ok(await request(baseUrl, "GET", "/admin/message-reports", undefined, admin), 200, "queue").json.reports.find((r) => r.report_id === report.report_id);
  assert.equal(queued.reporter.name, "Iron Works main");
  assert.equal(queued.reporter.kind, "org_owner");
  assert.equal(queued.sender.name, "Rhys");
  assert.equal(queued.message.body_text, "Your staff are idiots and I know where the manager parks.");
  ok(await request(baseUrl, "POST", `/admin/message-reports/${report.report_id}/decide`, { decision: "remove", note: "Threatening a member of staff." }, admin), 200, "removed");
  assert.equal((await ownerThread()).find((m) => m.message_id === fromRhys.message_id).removed, true, "removed for the owner");

  const ownerNotes = async (type) => (ok(await request(baseUrl, "GET", "/org/notifications", undefined, owner), 200, "owner notifications").json.notifications ?? []).filter((n) => n.notification_type === type);
  const outcome = await ownerNotes("message_report_outcome");
  assert.equal(outcome.length, 1);
  assert.deepEqual(outcome[0].notification_payload, { outcome: "removed", org_id: org.org_id, org_name: "Iron Works Gym" });
  assert.deepEqual(outcome[0].deep_link, { route_id: "org_messages", params: { org_id: org.org_id } });

  // Rhys reports the owner's message; an admin removes it; the owner is told why.
  const athleteReport = ok(await request(baseUrl, "POST", "/messages/safety/reports", { message_id: fromOwner.message_id, reason: "spam" }, athlete), 201, "Rhys reports the owner's message").json;
  ok(await request(baseUrl, "POST", `/admin/message-reports/${athleteReport.report_id}/decide`, { decision: "remove", note: "Sales messages need consent." }, admin), 200, "removed");
  const removedNote = await ownerNotes("message_removed");
  assert.equal(removedNote.length, 1);
  assert.deepEqual(removedNote[0].notification_payload, { reason: "Sales messages need consent.", org_id: org.org_id, org_name: "Iron Works Gym" });
  assert.deepEqual(removedNote[0].deep_link, { route_id: "org_messages", params: { org_id: org.org_id } });

  // Unblocking Rhys lets his messages through again.
  ok(await request(baseUrl, "POST", `/org/messages/safety/blocks/${athlete.userId}/remove`, {}, owner), 200, "owner unblocks Rhys");
  ok(await rhysToGym("Sorry about earlier.", `r3_${nonce}`), 201, "Rhys gets through again");

  // The owner's data export includes the reports they made.
  const exportResult = ok(await request(baseUrl, "POST", "/org/data-rights/export", {}, owner), 202, "owner exports their data").json;
  assert.ok(JSON.stringify(exportResult).includes(report.report_id) || exportResult.included_category_counts?.message_safety >= 1, `the export includes message safety: ${JSON.stringify(exportResult).slice(0, 400)}`);
});
