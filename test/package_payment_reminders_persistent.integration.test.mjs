// Package payment reminders: the athlete is reminded three days before their
// paid-up date runs out and told when payment is due; the coach is told
// when an athlete's paid-up date lapses (not when they start someone
// unpaid). Each shows in the bell and is emailed once - a coach gets one
// email for everyone who fell due.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { coachDueEmail, remindersFor, runPackageReminderSweep } from "../dist/src/api/package_payment_reminders.js";

async function request(base, method, route, body, options = {}) {
  const headers = { origin: base };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function cookieOf(result, name) {
  const found = result.response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `expected ${name} cookie`);
  return found.split(";")[0];
}

function expect(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${result.text.slice(0, 300)}`);
  return result.json;
}

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

test("which reminders a membership owes, keyed by the paid-up date", () => {
  const monthly = (paid_until, extra = {}) => ({ billing: "monthly", started_on: "2026-10-01", paid_until, paid_in_full: false, ...extra });
  assert.deepEqual(remindersFor(monthly("2026-11-30"), "2026-11-27"), [], "four days out");
  assert.deepEqual(remindersFor(monthly("2026-11-30"), "2026-11-28"), [{ kind: "upcoming", key: "upcoming:2026-11-30" }]);
  assert.deepEqual(remindersFor(monthly("2026-11-30"), "2026-11-30"), [{ kind: "upcoming", key: "upcoming:2026-11-30" }], "last paid day");
  assert.deepEqual(remindersFor(monthly("2026-11-30"), "2026-12-01"), [{ kind: "due", key: "due:2026-11-30" }, { kind: "coach_due", key: "coach_due:2026-11-30" }]);
  assert.deepEqual(remindersFor(monthly(null), "2026-10-05"), [{ kind: "due", key: "due:unpaid-2026-10-01" }], "started unpaid: the coach knows");
  assert.deepEqual(remindersFor(monthly(null, { started_on: "2026-12-01" }), "2026-11-20"), [], "not started");
  assert.deepEqual(remindersFor({ billing: "one_off", started_on: "2026-10-01", paid_until: null, paid_in_full: true }, "2027-01-01"), []);
  assert.equal(coachDueEmail([{ name: "Lee", packageName: "Online", paidUntil: "2026-11-30" }, { name: "Kim", packageName: "PT", paidUntil: "2026-11-29" }]).subject, "Payment due: 2 athletes");
});

test("athletes and coaches are reminded in the bell and by email, once each", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_package_payments WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_package_memberships WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_service_packages WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name) => {
    const email = `prem_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `Reminds${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1991-03-03"
    });
    expect(reg, 201, `${label} registers`);
    userIds.push(reg.json.account.user_id);
    return { userId: reg.json.account.user_id, email, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token };
  };

  const coach = await register("coach", "coach", "Chris Roberts");
  for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: "Chris Roberts", email: coach.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
    const result = await request(base, method, path, body, coach);
    assert.ok(result.response.status < 300, `${path}: ${result.text}`);
  }
  const online = expect(await request(base, "POST", "/coach-branding/packages", { name: "Online coaching", price: 80, billing: "monthly", includes: { programming: true } }, coach), 201, "monthly").packages[0];
  const coachAthlete = async (label, name) => {
    const athlete = await register("athlete", label, name);
    const invite = await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: athlete.email }, coach);
    assert.ok(invite.response.status < 300, `invite: ${invite.text}`);
    const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
    expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");
    return athlete;
  };
  const sam = await coachAthlete("sam", "Sam Soon");
  const lee = await coachAthlete("lee", "Lee Lapsed");
  const kim = await coachAthlete("kim", "Kim New");
  const pkg = (who) => `/check-ins/athletes/${who.userId}/package`;
  // Sam: paid up to two days from now. Lee: paid for the first month, 40
  // days ago. Kim: started today, not paid yet.
  expect(await request(base, "PUT", pkg(sam), { package_id: online.package_id, started_on: day(-10), paid_now: false }, coach), 200, "sam");
  expect(await request(base, "POST", `${pkg(sam)}/payment`, { paid_until: day(2) }, coach), 200, "sam paid");
  const leePaidUntil = expect(await request(base, "PUT", pkg(lee), { package_id: online.package_id, started_on: day(-40), paid_now: true }, coach), 200, "lee").membership.paid_until;
  expect(await request(base, "PUT", pkg(kim), { package_id: online.package_id, started_on: day(0), paid_now: false }, coach), 200, "kim");

  const bell = async (who) => expect(await request(base, "GET", "/account/notifications", undefined, who), 200, "bell").notifications
    .filter((n) => n.notification_type.includes("package_payment"))
    .map((n) => [n.notification_type, n.notification_payload.package_name, n.notification_payload.paid_until])
    .sort((a, b) => String(a).localeCompare(String(b)));
  assert.deepEqual(await bell(sam), [["package_payment_upcoming", "Online coaching", day(2)]]);
  assert.deepEqual(await bell(lee), [["package_payment_due", "Online coaching", leePaidUntil]]);
  assert.deepEqual(await bell(kim), [["package_payment_due", "Online coaching", null]]);
  assert.deepEqual(await bell(coach), [["athlete_package_payment_due", "Online coaching", leePaidUntil]], "only Lee lapsed");
  assert.deepEqual(await bell(sam), [["package_payment_upcoming", "Online coaching", day(2)]], "not repeated");

  // Other memberships in this database aren't this test's: only ours are recorded.
  const ours = new Set([sam, lee, kim, coach].map((who) => who.email));
  const sent = [];
  const send = async (to, email) => { if (ours.has(to)) sent.push({ to, ...email }); return true; };
  await runPackageReminderSweep({ send });
  const to = (who) => sent.filter((email) => email.to === who.email);
  assert.equal(sent.length, 4);
  assert.match(to(sam)[0].subject, /^Your Online coaching with Chris Roberts is paid up to /u);
  assert.equal(to(lee)[0].subject, "Payment due for your Online coaching with Chris Roberts");
  assert.match(to(lee)[0].text, /was paid up to/u);
  assert.match(to(kim)[0].text, /^Payment is due for your Online coaching/u);
  assert.equal(to(coach)[0].subject, "Payment due: Lee Lapsed");
  assert.match(to(coach)[0].text, /- Lee Lapsed - Online coaching, paid up to /u);

  sent.length = 0;
  await runPackageReminderSweep({ send });
  assert.equal(sent.length, 0, "each reminder goes once");

  // Lee pays a little: a fresh reminder for the new date. A failed send is
  // tried again next sweep.
  expect(await request(base, "POST", `${pkg(lee)}/payment`, { paid_until: day(1) }, coach), 200, "lee pays a bit");
  await runPackageReminderSweep({ send: async (address) => !ours.has(address) });
  assert.equal(sent.length, 0);
  await runPackageReminderSweep({ send });
  assert.deepEqual(sent.map((email) => [email.to, email.subject.startsWith("Your Online coaching")]), [[lee.email, true]]);
  assert.deepEqual((await bell(lee)).map(([type, , paidUntil]) => [type, paidUntil]), [["package_payment_due", leePaidUntil], ["package_payment_upcoming", day(1)]]);
});
