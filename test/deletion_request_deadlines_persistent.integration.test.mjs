// A deletion request can't be missed. The privacy notice promises erasure
// "normally within 30 days" and erasing is a manual admin step, so: the
// admin is emailed when a request arrives (once, not again on a retry);
// the admin queue shows each request's erase-by date, the oldest open one
// first; and a daily email lists every request due within 9 days or overdue.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { confirmDataDeletion } from "../dist/src/api/data_rights_service.js";
import { confirmOrgOwnerDataDeletion } from "../dist/src/api/org_owner_data_rights_service.js";
import { listAdminDataDeletionRequests, listAdminOrgOwnerDataDeletionRequests } from "../dist/src/api/product_admin_review_service.js";
import { deadlineReminderEmail, deletionDeadline, runDeletionDeadlineSweep } from "../dist/src/api/deletion_request_deadlines.js";

const DAY = 86400000;

test("each request's erase-by date and state, in calendar days", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const at = (daysAgo, hours = 0) => new Date(now.getTime() - daysAgo * DAY - hours * 3600000);
  assert.deepEqual(deletionDeadline(at(0), "queued_for_review", now), { due_by_iso8601: "2026-12-07T12:00:00.000Z", days_left: 30, deadline_state: "on_time" });
  assert.equal(deletionDeadline(at(20), "queued_for_review", now).deadline_state, "on_time", "day 20: 10 left");
  assert.deepEqual(deletionDeadline(at(21), "queued_for_review", now).deadline_state, "due_soon", "day 21: 9 left");
  assert.equal(deletionDeadline(at(30), "queued_for_review", now).days_left, 0, "the last day");
  assert.equal(deletionDeadline(at(30), "queued_for_review", now).deadline_state, "due_soon");
  assert.deepEqual(deletionDeadline(at(30, 1), "queued_for_review", now), { due_by_iso8601: "2026-11-07T11:00:00.000Z", days_left: 0, deadline_state: "due_soon" }, "due earlier today: still today");
  assert.deepEqual(deletionDeadline(at(31), "queued_for_review", now), { due_by_iso8601: "2026-11-06T12:00:00.000Z", days_left: -1, deadline_state: "overdue" });
  assert.equal(deletionDeadline(at(20, -11.5), "queued_for_review", new Date("2026-11-07T23:59:00Z")).days_left, 10, "calendar days, not hours");
  assert.equal(deletionDeadline(at(45), "queued_for_review", now).days_left, -15);
  assert.equal(deletionDeadline(at(45), "completed", now).deadline_state, "done", "erased requests are never overdue");

  const email = deadlineReminderEmail([
    { kind: "athlete_or_coach", deletion_request_id: "deletion_request_a", user_id: "user_a", requested_at_iso8601: "", ...deletionDeadline(at(33), "queued_for_review", now) },
    { kind: "org_owner", deletion_request_id: "org_owner_deletion_request_b", user_id: "user_b", requested_at_iso8601: "", ...deletionDeadline(at(25), "queued_for_review", now) }
  ]);
  assert.equal(email.subject, "1 deletion request is overdue");
  assert.ok(email.lines.includes("- deletion_request_a (an athlete or coach, user user_a): erase by 2026-11-04, OVERDUE by 3 days"), email.lines.join("\n"));
  assert.ok(email.lines.includes("- org_owner_deletion_request_b (a gym or organisation owner, user user_b): erase by 2026-11-12, 5 days left"), email.lines.join("\n"));
  assert.equal(deadlineReminderEmail([{ kind: "org_owner", deletion_request_id: "x", user_id: "y", requested_at_iso8601: "", ...deletionDeadline(at(22), "queued_for_review", now) }]).subject, "1 deletion request due soon");
});

test("the admin is told about each new request, sees its deadline, and is reminded before it's late", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const ids = { athlete: "", coach: "", owner: "" };

  // Capture the admin emails instead of sending them.
  const realFetch = globalThis.fetch;
  const emails = [];
  const savedEnv = { ...process.env };
  Object.assign(process.env, { RESEND_API_KEY: "re_test_only", KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO: "admin@example.com", KOLOSSEUM_EMAIL_FROM: "app@example.com", KOLOSSEUM_PUBLIC_APP_URL: "https://app.example.com" });
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.resend.com/")) { emails.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }
    return realFetch(url, init);
  };

  t.after(async () => {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    await new Promise((resolve) => server.close(resolve));
    const people = [ids.athlete, ids.coach, ids.owner];
    const q = (sql) => pool.query(sql, [people]).catch(() => {});
    await q("DELETE FROM data_deletion_requests WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM org_owner_data_deletion_requests WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM product_org_owner_sessions WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM product_org_owner_accounts WHERE user_id = ANY($1::text[])");
    for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await q(`DELETE FROM ${table} WHERE user_id = ANY($1::text[])`);
    await pool.end();
  });

  const post = async (route, body) => {
    const response = await realFetch(baseUrl + route, { method: "POST", headers: { origin: baseUrl, "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await response.text();
    assert.equal(response.status, 201, `${route}: ${text}`);
    return { json: JSON.parse(text), response };
  };
  for (const actor of ["athlete", "coach"]) {
    const { response } = await post("/account/register", {
      actor_type: actor, display_name: `Deadline ${actor}`, email: `deadline_${actor}_${nonce}@example.com`, password: `Deadline${actor}!2026`,
      date_of_birth: "1990-02-02", accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1",
      ...(actor === "athlete" ? { activity_id: "powerlifting" } : {})
    });
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith("kolosseum_session=")).split(";")[0];
    const detail = await (await realFetch(`${baseUrl}/account/detail`, { headers: { origin: baseUrl, cookie } })).json();
    ids[actor] = detail.account.user_id;
  }
  ids.owner = (await post("/org/register", { email: `deadline_owner_${nonce}@example.com`, display_name: "Deadline Owner", password: "DeadlineOwner!2026", accepted_terms: true, accepted_terms_version: "terms_v1" })).json.org_owner.user_id;
  emails.length = 0;

  // A new request emails the admin its erase-by date; a retry of the same request doesn't.
  const athleteRequest = await confirmDataDeletion(ids.athlete, "athlete", "DELETE", "", `req_${nonce}_a`);
  await confirmDataDeletion(ids.athlete, "athlete", "DELETE", "", `req_${nonce}_a`);
  const coachRequest = await confirmDataDeletion(ids.coach, "coach", "DELETE", "", `req_${nonce}_c`);
  const ownerRequest = await confirmOrgOwnerDataDeletion(ids.owner, "DELETE", "", `req_${nonce}_o`);
  assert.equal(emails.length, 3, emails.map((e) => e.subject).join(" | "));
  const due = new Date(Date.parse(athleteRequest.requested_at_iso8601) + 30 * DAY).toISOString().slice(0, 10);
  assert.equal(emails[0].subject, `Deletion request - erase by ${due}`);
  assert.deepEqual(emails[0].to, ["admin@example.com"]);
  assert.match(emails[0].text, new RegExp(`Request: ${athleteRequest.deletion_request_id}`, "u"));
  assert.match(emails[0].text, /An athlete or coach asked for their data to be deleted\./u);
  assert.match(emails[0].text, /https:\/\/app\.example\.com\/admin\//u);
  assert.match(emails[2].text, /A gym or organisation owner asked for their data to be deleted\./u);
  assert.match(emails[2].text, new RegExp(ownerRequest.deletion_request_id, "u"));

  // Backdate: the coach's request is 33 days old (overdue), the owner's 25 (due soon).
  const backdate = (table, id, days) => pool.query(`UPDATE ${table} SET requested_at = now() - make_interval(days => $2) WHERE deletion_request_id = $1`, [id, days]);
  await backdate("data_deletion_requests", coachRequest.deletion_request_id, 33);
  await backdate("org_owner_data_deletion_requests", ownerRequest.deletion_request_id, 25);

  // The admin queue: open requests oldest first, each with its deadline.
  const queue = (await listAdminDataDeletionRequests(undefined)).filter((r) => [ids.athlete, ids.coach].includes(r.user_id));
  assert.deepEqual(queue.map((r) => [r.user_id, r.deadline_state]), [[ids.coach, "overdue"], [ids.athlete, "on_time"]]);
  assert.equal(queue[0].days_left, -3);
  assert.equal(queue[1].days_left, 30);
  const ownerQueue = await listAdminOrgOwnerDataDeletionRequests(ids.owner);
  assert.equal(ownerQueue[0].deadline_state, "due_soon");
  assert.equal(ownerQueue[0].days_left, 5);

  // The daily reminder lists the overdue and due-soon ones, not the new one.
  const sent = [];
  await runDeletionDeadlineSweep({ force: true, send: async (subject, lines) => { sent.push({ subject, lines }); } });
  assert.equal(sent.length, 1);
  const body = sent[0].lines.join("\n");
  assert.match(body, new RegExp(`${coachRequest.deletion_request_id} \\(an athlete or coach, user ${ids.coach}\\): erase by \\d{4}-\\d{2}-\\d{2}, OVERDUE by 3 days`, "u"));
  assert.match(body, new RegExp(`${ownerRequest.deletion_request_id} \\(a gym or organisation owner, user ${ids.owner}\\): erase by \\d{4}-\\d{2}-\\d{2}, 5 days left`, "u"));
  assert.doesNotMatch(body, new RegExp(athleteRequest.deletion_request_id, "u"));
  assert.match(sent[0].subject, /overdue/u);

  // Once erased, a request drops out of the reminder and sorts below the open ones.
  await pool.query(`UPDATE data_deletion_requests SET queue_status = 'completed' WHERE deletion_request_id = $1`, [coachRequest.deletion_request_id]);
  const after = (await listAdminDataDeletionRequests(undefined)).filter((r) => [ids.athlete, ids.coach].includes(r.user_id));
  assert.deepEqual(after.map((r) => [r.user_id, r.deadline_state]), [[ids.athlete, "on_time"], [ids.coach, "done"]]);
  sent.length = 0;
  await runDeletionDeadlineSweep({ force: true, send: async (subject, lines) => { sent.push({ subject, lines }); } });
  assert.doesNotMatch(sent.map((s) => s.lines.join("\n")).join("\n"), new RegExp(coachRequest.deletion_request_id, "u"));

  // Not before 08:00 UTC, and at most once a day.
  const early = new Date(); early.setUTCHours(7, 0, 0, 0);
  assert.equal(await runDeletionDeadlineSweep({ now: early, send: async () => { throw new Error("sent too early"); } }), 0);
});
