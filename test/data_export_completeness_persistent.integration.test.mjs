// "Download my data" gives a person everything Kolosseum keeps about them
// (UK GDPR Article 15). An athlete, their coach and the owner of their gym
// each have messages, a bell, a support report, a video and its feedback, a
// session review, a package payment, seller details, a push device, a weekly
// check-in and the maxes their coach set - and each one's export carries
// their own share of it, and nothing secret: no push address keys, and a
// received message Kolosseum removed stays removed.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { downloadDataExport, requestDataExport } from "../dist/src/api/data_rights_service.js";
import { downloadOrgOwnerDataExport, requestOrgOwnerDataExport } from "../dist/src/api/org_owner_data_rights_service.js";

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
const sorted = (rows) => rows.map((row) => JSON.stringify(row)).sort();
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("each person's export carries all of their own data, and nothing secret", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const ids = { athlete: "", coach: "", owner: "", org: `org_export_${nonce}` };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    const people = [ids.athlete, ids.coach, ids.owner];
    const q = (sql, params = [people]) => pool.query(sql, params).catch(() => {});
    await q("DELETE FROM product_package_payments WHERE coach_user_id = ANY($1::text[])");
    await q("DELETE FROM product_package_memberships WHERE coach_user_id = ANY($1::text[])");
    await q("DELETE FROM product_service_packages WHERE coach_user_id = ANY($1::text[]) OR org_id = $2", [people, ids.org]);
    await q("DELETE FROM product_video_submissions WHERE athlete_user_id = ANY($1::text[])");
    await q("DELETE FROM product_session_reviews WHERE coach_user_id = ANY($1::text[])");
    await q("DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])");
    await q("DELETE FROM product_message_threads WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[]) OR org_id = $2", [people, ids.org]);
    await q("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])");
    await q("DELETE FROM product_support_requests WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM org_owner_support_requests WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM product_coach_tax_details WHERE coach_user_id = ANY($1::text[])");
    await q("DELETE FROM product_gym_tax_details WHERE org_id = $1", [ids.org]);
    await q("DELETE FROM product_gym_listings WHERE org_id = $1", [ids.org]);
    await q("DELETE FROM product_push_subscriptions WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM data_export_requests WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM org_owner_data_export_requests WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])");
    await q("DELETE FROM product_organisations WHERE org_id = $1", [ids.org]);
    await q("DELETE FROM product_org_owner_sessions WHERE user_id = ANY($1::text[])");
    await q("DELETE FROM product_org_owner_accounts WHERE user_id = ANY($1::text[])");
    for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await q(`DELETE FROM ${table} WHERE user_id = ANY($1::text[])`);
    await pool.end();
  });

  for (const actor of ["athlete", "coach"]) {
    const result = ok(await request(baseUrl, "POST", "/account/register", {
      actor_type: actor, display_name: `Export ${actor}`, email: `export_${actor}_${nonce}@example.com`, password: `Export${actor}!2026`,
      date_of_birth: "1993-04-04", accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1",
      ...(actor === "athlete" ? { activity_id: "powerlifting" } : {})
    }), 201, `${actor} registers`);
    const cookie = result.response.headers.getSetCookie().find((c) => c.startsWith("kolosseum_session=")).split(";")[0];
    ids[actor] = ok(await request(baseUrl, "GET", "/account/detail", undefined, { cookie }), 200, `${actor} detail`).json.account.user_id;
  }
  ids.owner = ok(await request(baseUrl, "POST", "/org/register", { email: `export_owner_${nonce}@example.com`, display_name: "Export Gym Owner", password: "ExportOwner!2026", accepted_terms: true, accepted_terms_version: "terms_v1" }), 201, "owner registers").json.org_owner.user_id;
  const { athlete, coach, owner, org } = ids;

  await pool.query(`INSERT INTO product_organisations (org_id, owner_user_id, org_name, org_state, seat_limit, visibility_mode) VALUES ($1,$2,'Export Gym','active',5,'shared')`, [org, owner]);

  // Messages: athlete <-> coach (one of the coach's removed by Kolosseum), athlete -> gym.
  const coachThread = `thr_ca_${nonce}`;
  const gymThread = `thr_oa_${nonce}`;
  await pool.query(`INSERT INTO product_message_threads (thread_id, thread_type, coach_user_id, athlete_user_id) VALUES ($1,'coach_athlete',$2,$3)`, [coachThread, coach, athlete]);
  await pool.query(`INSERT INTO product_message_threads (thread_id, thread_type, athlete_user_id, org_id) VALUES ($1,'org_owner_athlete',$2,$3)`, [gymThread, athlete, org]);
  const message = (id, thread, sender, role, body, removed = false) => pool.query(
    `INSERT INTO product_messages (message_id, thread_id, sender_user_id, sender_role, body_text, client_request_id, removed_at, removed_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, thread, sender, role, body, `${id}_req`, removed ? new Date() : null, removed ? "Abusive." : null]
  );
  await message(`msg_a1_${nonce}`, coachThread, athlete, "athlete", "My knee felt fine today.");
  await message(`msg_c1_${nonce}`, coachThread, coach, "coach", "Great - add 2.5kg next week.");
  await message(`msg_c2_${nonce}`, coachThread, coach, "coach", "Something abusive.", true);
  await message(`msg_a2_${nonce}`, gymThread, athlete, "athlete", "Is the gym open on Sunday?");

  // A video, its feedback, a session review, a package payment.
  const submission = `vid_${nonce}`;
  await pool.query(
    `INSERT INTO product_video_submissions (submission_id, athlete_user_id, coach_user_id, relationship_id, session_id, work_item_id, exercise_label, caption, attachment_mime_type, attachment_byte_size, attachment_storage_key, client_request_id)
     VALUES ($1,$2,$3,'rel_x','sess_x','wi_x','Back squat','Top set',  'video/mp4', 1000, 'k', $4)`,
    [submission, athlete, coach, `${submission}_req`]
  );
  await pool.query(`INSERT INTO product_video_submission_feedback (feedback_id, submission_id, coach_user_id, feedback_text) VALUES ($1,$2,$3,'Hips rose first.')`, [`fb_${nonce}`, submission, coach]);
  await pool.query(
    `INSERT INTO product_session_reviews (review_record_id, coach_user_id, athlete_user_id, relationship_id, session_id, artefact_id, review_status, reviewed_at, recorded_at, record_sha256, review_payload)
     VALUES ($1,$2,$3,'rel_x','sess_x','art_x','reviewed',now(),now(),$4,'{"note":"Solid week."}')`,
    [`rev_${nonce}`, coach, athlete, sha(`rev_${nonce}`)]
  );
  await pool.query(`INSERT INTO product_service_packages (package_id, coach_user_id, name, price_minor, billing) VALUES ($1,$2,'Online coaching',8000,'monthly')`, [`pkg_${nonce}`, coach]);
  await pool.query(`INSERT INTO product_package_memberships (membership_id, package_id, coach_user_id, athlete_user_id, started_on) VALUES ($1,$2,$3,$4,'2026-11-01')`, [`mem_${nonce}`, `pkg_${nonce}`, coach, athlete]);
  await pool.query(`INSERT INTO product_package_payments (payment_id, membership_id, coach_user_id, athlete_user_id, periods, amount_minor, currency) VALUES ($1,$2,$3,$4,1,8000,'GBP')`, [`pay_${nonce}`, `mem_${nonce}`, coach, athlete]);

  // Bells, support reports, seller details, a gym listing, a push device.
  await pool.query(
    `INSERT INTO product_notifications (notification_id, recipient_user_id, notification_type, source_record_type, source_record_id, deep_link_route_id, notification_payload, occurred_at)
     VALUES ($1,$2,'video_feedback_received','video_feedback',$3,'shared_account','{"coach":"Export coach"}',now()),
            ($4,$5,'message_removed','message',$6,'org_messages','{"reason":"Abusive."}',now())`,
    [`ntf_a_${nonce}`, athlete, `fb_${nonce}`, `ntf_o_${nonce}`, owner, `msg_x_${nonce}`]
  );
  await pool.query(`INSERT INTO product_support_requests (correlation_id, user_id, route_hash, occurred_at, description) VALUES ($1,$2,'#/today',now(),'Timer froze')`, [`sup_${nonce}`, athlete]);
  await pool.query(`INSERT INTO org_owner_support_requests (correlation_id, user_id, route_hash, occurred_at, description) VALUES ($1,$2,'#/org',now(),'Roster blank')`, [`osup_${nonce}`, owner]);
  await pool.query(`INSERT INTO product_coach_tax_details (coach_user_id, seller_type, legal_name, tax_number_type, tax_number, address_line1, city, postcode) VALUES ($1,'individual','Export Coach','utr','1234567890','1 High St','Leeds','LS1 1AA')`, [coach]);
  await pool.query(`INSERT INTO product_gym_tax_details (org_id, seller_type, legal_name, company_number, address_line1, city, postcode) VALUES ($1,'company','Export Gym Ltd','01234567','2 Mill Rd','York','YO1 1AA')`, [org]);
  await pool.query(`INSERT INTO product_gym_listings (org_id, display_name, area, equipment) VALUES ($1,'Export Gym','York','["rack"]')`, [org]);
  await pool.query(`INSERT INTO product_push_subscriptions (endpoint, user_id, p256dh, auth) VALUES ($1,$2,'pk','secret-auth')`, [`https://push.example.net/send/${nonce}`, athlete]).catch(async () => {
    await pool.query(`INSERT INTO product_push_subscriptions (endpoint, user_id, auth) VALUES ($1,$2,'secret-auth')`, [`https://push.example.net/send/${nonce}`, athlete]);
  });

  // Product records: the athlete's weekly check-in and the maxes their coach set.
  const record = (type, id, subject, actor, payload) => pool.query(
    `INSERT INTO beta_product_records (record_type, record_id, subject_user_id, actor_user_id, effective_at, record_sha256, record_payload) VALUES ($1,$2,$3,$4,now(),$5,$6::jsonb)`,
    [type, id, subject, actor, sha(`${type}${id}`), JSON.stringify(payload)]
  );
  await record("weekly_checkin_entry", `wc_${nonce}`, athlete, athlete, { sleep_quality: 4, note: "Slept well" });
  await record("beta19_athlete_strength_profile", `sp_${nonce}`, athlete, coach, { benchmarks: [{ exercise_id: "back_squat", value: 140 }] });

  const exportFor = async (userId, asOwner = false) => {
    const requested = asOwner ? await requestOrgOwnerDataExport(userId) : await requestDataExport(userId);
    const payload = asOwner ? await downloadOrgOwnerDataExport(userId, requested.export_request_id) : await downloadDataExport(userId, requested.export_request_id);
    return payload.subject_data;
  };

  // The athlete.
  const a = await exportFor(athlete);
  assert.deepEqual(sorted(a.messages.map((m) => [m.direction, m.conversation, m.body_text])), sorted([
    ["sent", "coach_athlete", "My knee felt fine today."],
    ["received", "coach_athlete", "Great - add 2.5kg next week."],
    ["received", "coach_athlete", null],
    ["sent", "org_owner_athlete", "Is the gym open on Sunday?"]
  ]));
  assert.ok(a.messages.find((m) => m.body_text === null).removed_by_kolosseum_at_iso8601, "the removed message says so");
  assert.equal(a.video_submissions[0].role, "athlete");
  assert.deepEqual(a.video_submissions[0].feedback.map((f) => f.text), ["Hips rose first."]);
  assert.deepEqual(a.session_reviews.map((r) => [r.role, r.review.note]), [["athlete", "Solid week."]]);
  assert.deepEqual(a.package_payments.map((p) => [p.role, p.package_name, p.amount_minor]), [["athlete", "Online coaching", 8000]]);
  assert.deepEqual(a.notifications.map((n) => n.notification_type), ["video_feedback_received"]);
  assert.deepEqual(a.support_requests.map((s) => s.description), ["Timer froze"]);
  assert.deepEqual(a.push_subscriptions.map((p) => p.push_service), ["push.example.net"]);
  assert.doesNotMatch(JSON.stringify(a.push_subscriptions), /secret-auth|send\//u, "no push address or key");
  const athleteRecords = Object.fromEntries(a.product_records.map((r) => [r.record_type, r]));
  assert.equal(athleteRecords.weekly_checkin_entry.payload.note, "Slept well");
  assert.equal(athleteRecords.beta19_athlete_strength_profile.payload.benchmarks[0].value, 140, "the maxes their coach set are theirs");
  assert.ok(athleteRecords.beta16_auth || athleteRecords.beta16_phase1_declaration || a.account.length === 1);
  assert.deepEqual(a.tax_details, []);

  // The coach.
  const c = await exportFor(coach);
  assert.deepEqual(sorted(c.messages.map((m) => [m.direction, m.body_text])), sorted([
    ["received", "My knee felt fine today."],
    ["sent", "Great - add 2.5kg next week."],
    ["sent", "Something abusive."]
  ]), "their own sent message stays theirs even after removal; the gym thread isn't theirs");
  assert.equal(c.video_submissions[0].role, "coach");
  assert.deepEqual(c.package_payments.map((p) => p.role), ["coach"]);
  assert.deepEqual(c.tax_details.map((d) => [d.legal_name, d.tax_number, d.address]), [["Export Coach", "1234567890", "1 High St, Leeds, LS1 1AA, GB"]]);
  assert.ok(!c.product_records.some((r) => r.record_type === "beta19_athlete_strength_profile"), "the athlete's maxes aren't in the coach's copy");

  // The gym owner, on their second request (the first is then listed).
  await requestOrgOwnerDataExport(owner);
  const o = await exportFor(owner, true);
  assert.deepEqual(o.messages.map((m) => [m.direction, m.body_text]), [["received", "Is the gym open on Sunday?"]]);
  assert.deepEqual(o.notifications.map((n) => n.notification_type), ["message_removed"]);
  assert.deepEqual(o.support_requests.map((s) => s.description), ["Roster blank"]);
  assert.deepEqual(o.gym_listings.map((l) => [l.display_name, l.area]), [["Export Gym", "York"]]);
  assert.deepEqual(o.tax_details.map((d) => [d.gym, d.company_number]), [["Export Gym", "01234567"]]);
  assert.ok(o.account_requests.some((r) => r.request === "copy_of_data"), "earlier export requests are listed");
});
