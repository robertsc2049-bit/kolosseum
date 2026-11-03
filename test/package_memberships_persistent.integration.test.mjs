// Package memberships: a coach puts an athlete on one of their packages and
// records payments made outside the app. Past the paid-up date payment is
// due - the athlete can't book the coach's open slots and the coach can
// cancel every upcoming call and in-person session in one go. Both see
// what's included and what's been used this period.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { nextPaidUntil, paymentDue, paymentOutlook, periodOf } from "../dist/src/api/package_membership_service.js";

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

test("billing periods run from the start date, month ends clamped", () => {
  assert.deepEqual(periodOf("2026-01-31", "monthly", "2026-02-28"), { start: "2026-02-28", end: "2026-03-30" });
  assert.deepEqual(periodOf("2026-01-31", "monthly", "2026-01-31"), { start: "2026-01-31", end: "2026-02-27" });
  assert.deepEqual(periodOf("2016-01-15", "monthly", "2026-11-02"), { start: "2026-10-15", end: "2026-11-14" });
  assert.deepEqual(periodOf("2026-11-02", "weekly", "2026-11-20"), { start: "2026-11-16", end: "2026-11-22" });
  assert.deepEqual(periodOf("2026-11-02", "one_off", "2027-05-01"), { start: "2026-11-02", end: null });
  assert.equal(nextPaidUntil("2026-01-31", "monthly", null), "2026-02-27");
  assert.equal(nextPaidUntil("2026-01-31", "monthly", "2026-02-27"), "2026-03-30");
  assert.equal(nextPaidUntil("2026-11-02", "weekly", "2026-11-08"), "2026-11-15");
  assert.equal(paymentDue({ started_on: "2026-11-02", paid_until: "2026-11-30", paid_in_full: false }, "2026-11-30"), false);
  assert.equal(paymentDue({ started_on: "2026-11-02", paid_until: "2026-11-30", paid_in_full: false }, "2026-12-01"), true);
  assert.equal(paymentDue({ started_on: "2026-12-01", paid_until: null, paid_in_full: false }, "2026-11-30"), false, "not started yet");
  assert.equal(paymentDue({ started_on: "2026-11-02", paid_until: null, paid_in_full: true }, "2027-01-01"), false);
  // Owed now and coming up in the next 30 days, counted in periods.
  const monthly = (paid_until, started_on = "2026-09-02") => ({ billing: "monthly", started_on, paid_until, paid_in_full: false });
  assert.deepEqual(paymentOutlook(monthly("2026-10-01"), "2026-11-20"), { owed: 2, upcoming: 1 }, "October and November owed, December coming");
  assert.deepEqual(paymentOutlook(monthly("2026-12-01"), "2026-11-20"), { owed: 0, upcoming: 1 });
  assert.deepEqual(paymentOutlook(monthly("2027-02-01"), "2026-11-20"), { owed: 0, upcoming: 0 });
  assert.deepEqual(paymentOutlook(monthly(null, "2026-12-10"), "2026-11-20"), { owed: 0, upcoming: 1 }, "starts unpaid within the month");
  assert.deepEqual(paymentOutlook({ billing: "weekly", started_on: "2026-11-02", paid_until: "2026-11-08", paid_in_full: false }, "2026-11-20"), { owed: 2, upcoming: 4 });
  assert.deepEqual(paymentOutlook({ billing: "one_off", started_on: "2026-11-02", paid_until: null, paid_in_full: false }, "2026-11-20"), { owed: 1, upcoming: 0 });
  assert.deepEqual(paymentOutlook({ billing: "one_off", started_on: "2026-11-02", paid_until: null, paid_in_full: true }, "2026-11-20"), { owed: 0, upcoming: 0 });
});

test("a coach puts an athlete on a package, payment due blocks booking and lets the coach cancel what's booked", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_package_payments WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_package_memberships WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_checkins WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_availability_blocks WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_service_packages WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name) => {
    const email = `pmem_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `Members${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1991-03-03"
    });
    expect(reg, 201, `${label} registers`);
    userIds.push(reg.json.account.user_id);
    return { userId: reg.json.account.user_id, email, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token };
  };
  const finishCoachSetup = async (who, name) => {
    for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: name, email: who.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
      const result = await request(base, method, path, body, who);
      assert.ok(result.response.status < 300, `${path}: ${result.text}`);
    }
  };

  const coach = await register("coach", "coach", "Chris Roberts");
  await finishCoachSetup(coach, "Chris Roberts");
  const other = await register("coach", "other", "Pat Other");
  await finishCoachSetup(other, "Pat Other");
  const sam = await register("athlete", "sam", "Sam Lifter");
  const invite = await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: sam.email }, coach);
  assert.ok(invite.response.status < 300, `invite: ${invite.text}`);
  const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, sam), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, sam), 201, "accept");

  const online = expect(await request(base, "POST", "/coach-branding/packages", { name: "Online coaching", price: 80, billing: "monthly", includes: { programming: true, checkin_calls: 2, in_person_sessions: 1 } }, coach), 201, "monthly").packages[0];
  const block = expect(await request(base, "POST", "/coach-branding/packages", { name: "PT block", price: 120, billing: "one_off", includes: { in_person_sessions: 4 } }, coach), 201, "one-off").packages.find((p) => p.name === "PT block");
  const othersPackage = expect(await request(base, "POST", "/coach-branding/packages", { name: "Not yours", price: 10, billing: "monthly", includes: { programming: true } }, other), 201, "other's").packages[0];
  // Open in-person slots three days out (no call link needed).
  expect(await request(base, "POST", "/check-ins/availability/blocks", { repeats_weekly: false, on_date: day(3), start: "09:00", end: "11:00", slot_minutes: 30, call_method: "in_person", time_zone: "UTC" }, coach), 201, "hours");

  const packageOf = `/check-ins/athletes/${sam.userId}/package`;
  let view = expect(await request(base, "GET", packageOf, undefined, coach), 200, "no package yet");
  assert.equal(view.membership, null);
  assert.deepEqual(view.options.map((p) => p.name), ["Online coaching", "PT block"]);
  expect(await request(base, "GET", packageOf, undefined, other), 404, "not their athlete");
  expect(await request(base, "PUT", packageOf, { package_id: online.package_id }, sam), 403, "athletes can't");
  assert.ok(expect(await request(base, "PUT", packageOf, { package_id: othersPackage.package_id }, coach), 422, "another coach's package").field_errors.package_id);
  assert.ok(expect(await request(base, "PUT", packageOf, { package_id: online.package_id, started_on: "2020-01-01" }, coach), 422, "too long ago").field_errors.started_on);

  // Started 40 days ago, first month paid: now payment is due.
  const startedOn = day(-40);
  view = expect(await request(base, "PUT", packageOf, { package_id: online.package_id, started_on: startedOn, paid_now: true }, coach), 200, "start");
  assert.deepEqual([view.membership.package.name, view.membership.started_on, view.membership.paid_until, view.membership.payment_due], ["Online coaching", startedOn, nextPaidUntil(startedOn, "monthly", null), true]);
  assert.deepEqual(view.membership.package.includes_summary, ["Programming", "2 check-in calls a month", "1 in-person session a month"]);

  // Sam can't book, and is told why.
  const samSlots = expect(await request(base, "GET", "/check-ins/slots", undefined, sam), 200, "slots").coaches;
  assert.deepEqual([samSlots.length, samSlots[0].payment_due, samSlots[0].slots], [1, true, []]);
  const slotTime = new Date(`${day(3)}T09:00:00Z`).toISOString();
  assert.equal(expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: slotTime }, sam), 409, "payment due").error, "booking_payment_due");
  let mine = expect(await request(base, "GET", "/coach-workspace/relationships/mine", undefined, sam), 200, "my coach").relationships.find((r) => r.coach_user_id === coach.userId);
  assert.deepEqual([mine.my_package.package.name, mine.my_package.payment_due, mine.my_package.can_claim_payment], ["Online coaching", true, true]);

  // Sam says they've paid; saying it twice changes nothing. The coach is told.
  const paidRoute = `/check-ins/coaches/${coach.userId}/package/paid`;
  expect(await request(base, "POST", paidRoute, {}, coach), 403, "coaches can't");
  expect(await request(base, "POST", `/check-ins/coaches/${other.userId}/package/paid`, {}, sam), 404, "not on that coach's package");
  let claimed = expect(await request(base, "POST", paidRoute, { note: "Bank transfer Friday" }, sam), 200, "says paid").membership;
  assert.deepEqual([claimed.payment_claim.note, claimed.can_claim_payment, claimed.payment_due], ["Bank transfer Friday", false, true], "booking stays closed until the coach confirms");
  const claimedAt = claimed.payment_claim.claimed_at;
  claimed = expect(await request(base, "POST", paidRoute, { note: "again" }, sam), 200, "says it again").membership;
  assert.deepEqual([claimed.payment_claim.claimed_at, claimed.payment_claim.note], [claimedAt, "Bank transfer Friday"]);
  const bell = async (who, type) => expect(await request(base, "GET", "/account/notifications", undefined, who), 200, "bell").notifications.filter((n) => n.notification_type === type);
  assert.deepEqual((await bell(coach, "athlete_package_payment_claimed")).map((n) => [n.notification_payload.package_name, n.notification_payload.athlete_user_id]), [["Online coaching", sam.userId]]);
  assert.equal(expect(await request(base, "GET", "/check-ins/package-members", undefined, coach), 200, "members").members[0].payment_claim.note, "Bank transfer Friday");

  // It hasn't arrived: Sam is told, and can say it again.
  expect(await request(base, "POST", `${packageOf}/claim/decline`, {}, other), 404, "not their athlete");
  view = expect(await request(base, "POST", `${packageOf}/claim/decline`, {}, coach), 200, "not received");
  assert.deepEqual([view.membership.payment_claim, typeof view.membership.payment_claim_declined_at], [null, "string"]);
  expect(await request(base, "POST", `${packageOf}/claim/decline`, {}, coach), 404, "nothing to decline");
  const unread = (notifications) => notifications.filter((n) => n.read_at_iso8601 === null).length;
  assert.equal(unread(await bell(coach, "athlete_package_payment_claimed")), 0, "the coach has dealt with the claim");
  assert.equal((await bell(sam, "package_payment_claim_declined")).length, 1);
  assert.equal(unread(await bell(sam, "package_payment_due")), 1);
  claimed = expect(await request(base, "POST", paidRoute, {}, sam), 200, "says paid again").membership;
  assert.deepEqual([claimed.payment_claim.note, claimed.payment_claim_declined_at], [null, null]);
  assert.equal(unread([...await bell(sam, "package_payment_claim_declined"), ...await bell(sam, "package_payment_due")]), 0, "Sam has acted on both");
  assert.equal((await bell(coach, "athlete_package_payment_claimed")).length, 2, "a new claim, a new notification");

  // The coach can still book them; payment due, they cancel everything upcoming.
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: sam.userId, starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), call_method: "in_person", duration_minutes: 60, repeat: "weekly", occurrences: 3 }, coach), 201, "coach books");
  assert.equal(expect(await request(base, "GET", "/check-ins/mine", undefined, sam), 200, "booked").checkins.length, 3);
  const list = expect(await request(base, "GET", "/check-ins/package-members", undefined, coach), 200, "members");
  const members = list.members;
  assert.deepEqual(members.map((m) => [m.athlete_display_name, m.package.name, m.payment_due, m.owed_periods, m.owed_minor, m.currency]), [["Sam Lifter", "Online coaching", true, 1, 8000, "GBP"]]);
  // A month owed, the next month starts within 30 days.
  assert.deepEqual(list.totals, [{ currency: "GBP", owed_minor: 8000, upcoming_minor: 8000 }]);
  expect(await request(base, "POST", `${packageOf}/cancel-upcoming`, {}, other), 404, "not theirs");
  const cancelled = expect(await request(base, "POST", `${packageOf}/cancel-upcoming`, {}, coach), 200, "cancel upcoming");
  assert.equal(cancelled.cancelled_count, 3);
  assert.deepEqual(expect(await request(base, "GET", "/check-ins/mine", undefined, sam), 200, "none left").checkins, []);

  // Paid: one more month, and Sam books again.
  assert.ok(expect(await request(base, "POST", `${packageOf}/payment`, { paid_until: "2020-01-01" }, coach), 422, "bad date").field_errors.paid_until);
  view = expect(await request(base, "POST", `${packageOf}/payment`, {}, coach), 200, "payment");
  assert.deepEqual([view.membership.paid_until, view.membership.payment_due], [nextPaidUntil(startedOn, "monthly", nextPaidUntil(startedOn, "monthly", null)), false]);
  assert.equal(view.membership.payment_claim, null, "recording the payment confirms Sam's claim");
  assert.equal(unread(await bell(coach, "athlete_package_payment_claimed")), 0, "the payment settles the coach's reminders");
  if (view.membership.paid_until > day(3)) {
    assert.equal(expect(await request(base, "POST", paidRoute, {}, sam), 409, "nothing due yet").error, "package_payment_not_due");
  }
  assert.equal(view.membership.next_paid_until, nextPaidUntil(startedOn, "monthly", view.membership.paid_until), "what one more payment would cover");
  assert.equal(expect(await request(base, "POST", `${packageOf}/cancel-upcoming`, {}, coach), 409, "not due").error, "package_payment_not_due");
  expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: slotTime }, sam), 201, "books");
  mine = expect(await request(base, "GET", "/coach-workspace/relationships/mine", undefined, sam), 200, "my coach").relationships.find((r) => r.coach_user_id === coach.userId);
  assert.deepEqual(mine.my_package.usage, { checkin_calls: { used: 0, included: 2 }, in_person_sessions: { used: 1, included: 1 } });
  assert.equal(mine.my_package.payment_due, false);

  // A payment tapped by mistake is undone: the date goes back, the record goes.
  const paidUntilBefore = view.membership.paid_until;
  const extra = expect(await request(base, "POST", `${packageOf}/payment`, {}, coach), 200, "one too many");
  assert.ok(extra.recorded_payment_id);
  assert.equal(extra.membership.payments.length, 3, "first month, the payment, and this one");
  assert.deepEqual([extra.membership.payments[0].paid_until_from, extra.membership.payments[0].periods, extra.membership.payments[0].amount_minor], [paidUntilBefore, 1, 8000]);
  expect(await request(base, "POST", `${packageOf}/payments/${extra.membership.payments[1].payment_id}/undo`, {}, coach), 404, "only the newest");
  expect(await request(base, "POST", `${packageOf}/payments/${extra.recorded_payment_id}/undo`, {}, other), 404, "not their athlete");
  view = expect(await request(base, "POST", `${packageOf}/payments/${extra.recorded_payment_id}/undo`, {}, coach), 200, "undo");
  assert.deepEqual([view.membership.paid_until, view.membership.payments.length], [paidUntilBefore, 2]);
  expect(await request(base, "POST", `${packageOf}/payments/${extra.recorded_payment_id}/undo`, {}, coach), 404, "already undone");
  assert.deepEqual(await bell(sam, "package_payment_recorded"), [], "Sam isn't told while a payment can still be undone");
  // Too late to undo the one before.
  await pool.query("UPDATE product_package_payments SET recorded_at = recorded_at - interval '11 minutes' WHERE athlete_user_id = $1", [sam.userId]);
  assert.equal(expect(await request(base, "POST", `${packageOf}/payments/${view.membership.payments[0].payment_id}/undo`, {}, coach), 409, "too late").error, "package_payment_undo_expired");
  // Now Sam is told about each payment that stood (a receipt: dates, no amounts); never the one undone.
  const receipts = await bell(sam, "package_payment_recorded");
  assert.deepEqual(receipts.map((n) => n.notification_payload.paid_until).sort(), view.membership.payments.map((p) => p.paid_until_to).sort());
  assert.deepEqual(receipts.map((n) => [n.notification_payload.package_name, n.notification_payload.coach_user_id, "amount_minor" in n.notification_payload]), [["Online coaching", coach.userId, false], ["Online coaching", coach.userId, false]]);
  assert.deepEqual(await bell(coach, "package_payment_recorded"), [], "only the athlete");
  // The athlete sees dates, not amounts.
  mine = expect(await request(base, "GET", "/coach-workspace/relationships/mine", undefined, sam), 200, "my coach").relationships.find((r) => r.coach_user_id === coach.userId);
  assert.deepEqual(mine.my_package.payments.map((p) => [p.paid_until_to, p.periods, "amount_minor" in p]), view.membership.payments.map((p) => [p.paid_until_to, p.periods, false]));

  // Switched to the one-off block, not yet paid; then paid in full.
  view = expect(await request(base, "PUT", packageOf, { package_id: block.package_id }, coach), 200, "switch");
  assert.deepEqual([view.membership.package.name, view.membership.started_on, view.membership.payment_due, view.membership.period_end], ["PT block", day(0), true, null]);
  view = expect(await request(base, "POST", `${packageOf}/payment`, {}, coach), 200, "paid in full");
  assert.deepEqual([view.membership.paid_in_full, view.membership.payment_due], [true, false]);
  view = expect(await request(base, "POST", `${packageOf}/payments/${view.recorded_payment_id}/undo`, {}, coach), 200, "undo paid in full");
  assert.deepEqual([view.membership.paid_in_full, view.membership.payment_due, view.membership.payments.length], [false, true, 0]);
  view = expect(await request(base, "POST", `${packageOf}/payment`, {}, coach), 200, "paid in full again");
  assert.equal(view.membership.paid_in_full, true);
  const rows = await pool.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE ended_at IS NULL)::int AS current FROM product_package_memberships WHERE athlete_user_id = $1", [sam.userId]);
  assert.deepEqual([rows.rows[0].n, rows.rows[0].current], [2, 1], "the old one is ended, not deleted");

  // Ended.
  view = expect(await request(base, "POST", `${packageOf}/end`, {}, coach), 200, "end");
  assert.equal(view.membership, null);
  expect(await request(base, "POST", `${packageOf}/payment`, {}, coach), 404, "nothing to pay");
  mine = expect(await request(base, "GET", "/coach-workspace/relationships/mine", undefined, sam), 200, "my coach").relationships.find((r) => r.coach_user_id === coach.userId);
  assert.equal(mine.my_package, null);
});
