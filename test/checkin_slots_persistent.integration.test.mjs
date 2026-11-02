// Check-in slots: a coach sets the hours they're free (every week, or on a
// date, in their own time zone) and days off; their athletes book an open
// slot straight away - 12 hours' notice, 4 weeks ahead, one at a time - and
// can cancel it. Two athletes can't take the same slot.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function request(base, method, route, body, options = {}) {
  const headers = { origin: base };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json, buffer };
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

test("a coach sets check-in hours; their athletes book open slots straight away", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_coaching_requests WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_checkins WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_availability_blocks WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_availability_days_off WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_call_settings WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_share_links WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name = `${label} Person`) => {
    const email = `slots_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `ShareLink${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
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
  const sam = await register("athlete", "sam", "Sam Lifter");
  const jo = await register("athlete", "jo", "Jo Other");
  const stranger = await register("athlete", "stranger", "Not Coached");
  for (const athlete of [sam, jo]) {
    const invite = await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: athlete.email }, coach);
    assert.ok(invite.response.status < 300, `invite: ${invite.text}`);
    const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
    expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");
  }
  expect(await request(base, "PUT", "/check-ins/call-settings", { whatsapp_number: "+44 7700 900123" }, coach), 200, "call settings");

  // New York hours, so the local time has to survive the conversion.
  const zone = "America/New_York";
  const localParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const inThreeDays = new Date(Date.now() + 3 * 86400000);
  const weekday = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(inThreeDays) + "T00:00:00Z").getUTCDay();
  const oneOffDate = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(Date.now() + 5 * 86400000));

  // Checked.
  assert.deepEqual(expect(await request(base, "GET", "/check-ins/availability", undefined, coach), 200, "empty").blocks, []);
  for (const [body, field] of [
    [{ weekday: 9, start: "18:00", end: "20:00", slot_minutes: 30, call_method: "whatsapp", time_zone: zone }, "weekday"],
    [{ weekday, start: "18:00", end: "18:15", slot_minutes: 30, call_method: "whatsapp", time_zone: zone }, "end"],
    [{ weekday, start: "6pm", end: "20:00", slot_minutes: 30, call_method: "whatsapp", time_zone: zone }, "start"],
    [{ weekday, start: "18:00", end: "20:00", slot_minutes: 30, call_method: "zoom", time_zone: zone }, "call_method"],
    [{ weekday, start: "18:00", end: "20:00", slot_minutes: 30, call_method: "whatsapp", time_zone: "Mars/Olympus" }, "time_zone"],
    [{ repeats_weekly: false, on_date: "2020-01-01", start: "09:00", end: "10:00", slot_minutes: 30, call_method: "in_person", time_zone: zone }, "on_date"]
  ]) assert.ok(expect(await request(base, "POST", "/check-ins/availability/blocks", body, coach), 422, JSON.stringify(body)).field_errors[field], `${field} explained`);
  expect(await request(base, "POST", "/check-ins/availability/blocks", { weekday, start: "18:00", end: "19:00", slot_minutes: 30, call_method: "whatsapp", time_zone: zone }, sam), 403, "athletes can't set hours");

  // Every week 18:00-19:00 in 30-minute WhatsApp calls, and one Saturday-style
  // morning in person.
  let availability = expect(await request(base, "POST", "/check-ins/availability/blocks", { weekday, start: "18:00", end: "19:00", slot_minutes: 30, call_method: "whatsapp", time_zone: zone }, coach), 201, "weekly").blocks;
  availability = expect(await request(base, "POST", "/check-ins/availability/blocks", { repeats_weekly: false, on_date: oneOffDate, start: "09:00", end: "10:00", slot_minutes: 60, call_method: "in_person", time_zone: zone }, coach), 201, "one-off").blocks;
  assert.deepEqual(availability.map((b) => [b.repeats_weekly, b.start, b.end, b.slot_minutes, b.call_method]), [[true, "18:00", "19:00", 30, "whatsapp"], [false, "09:00", "10:00", 60, "in_person"]]);
  assert.equal(availability[1].on_date, oneOffDate);

  // The athletes see the open slots, in the coach's hours whatever the clocks do.
  const slotsFor = async (who) => expect(await request(base, "GET", "/check-ins/slots", undefined, who), 200, "slots").coaches;
  const samCoaches = await slotsFor(sam);
  assert.equal(samCoaches.length, 1);
  assert.equal(samCoaches[0].coach_display_name, "Chris Roberts");
  const slots = samCoaches[0].slots;
  const weekly = slots.filter((s) => s.call_method === "whatsapp");
  assert.ok(weekly.length >= 6 && weekly.length <= 10, `two slots a week for four weeks: ${weekly.length}`);
  for (const slot of weekly) {
    const local = localParts(slot.starts_at);
    assert.ok(["18:00", "18:30"].includes(`${local.hour}:${local.minute}`), `local time ${local.hour}:${local.minute}`);
    assert.equal(slot.duration_minutes, 30);
  }
  const morning = slots.filter((s) => s.call_method === "in_person");
  assert.equal(morning.length, 1);
  assert.equal(`${localParts(morning[0].starts_at).hour}:${localParts(morning[0].starts_at).minute}`, "09:00");
  assert.ok(slots.every((s) => new Date(s.starts_at).getTime() >= Date.now() + 12 * 3600000 - 60000), "12 hours' notice");
  assert.ok(slots.every((s) => new Date(s.starts_at).getTime() <= Date.now() + 28 * 86400000 + 60000), "4 weeks ahead at most");
  assert.deepEqual(await slotsFor(stranger), [], "only the coach's own athletes");

  // Sam books the first weekly slot - booked straight away.
  const first = weekly[0];
  expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: first.starts_at }, stranger), 404, "not coached");
  expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: first.starts_at }, { cookie: sam.cookie }), 403, "needs CSRF");
  expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: new Date(new Date(first.starts_at).getTime() + 10 * 60000).toISOString() }, sam), 409, "not a slot");
  const booked = expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: first.starts_at, note: "Talk about my squat" }, sam), 201, "book").checkins;
  assert.equal(booked.length, 1);
  assert.deepEqual([booked[0].starts_at, booked[0].status, booked[0].booked_by, booked[0].call_method, booked[0].whatsapp_url, booked[0].note], [first.starts_at, "confirmed", "athlete", "whatsapp", "https://wa.me/447700900123", "Talk about my squat"]);

  // One upcoming self-booked call at a time; the slot is gone for everyone.
  assert.equal(expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: weekly[1].starts_at }, sam), 409, "one at a time").error, "booking_one_at_a_time");
  assert.equal((await slotsFor(sam))[0].booked_upcoming_at, first.starts_at);
  assert.ok(!(await slotsFor(jo))[0].slots.some((s) => s.starts_at === first.starts_at), "taken for Jo too");
  assert.equal(expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: first.starts_at }, jo), 409, "taken").error, "booking_slot_taken");

  // Two athletes going for the same slot at once: exactly one gets it.
  const contested = weekly[2].starts_at;
  const third = await register("athlete", "third", "Third Athlete");
  const invite = await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: third.email }, coach);
  assert.ok(invite.response.status < 300);
  const thirdInvitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, third), 200, "invitations").invitations[0];
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${thirdInvitation.relationship_id}/accept`, {}, third), 201, "accept");
  const race = await Promise.all([jo, third].map((who) => request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: contested }, who)));
  assert.deepEqual(race.map((r) => r.response.status).sort(), [201, 409], "one booking, one refused");

  // The coach is told, sees it as confirmed, and the athlete isn't told about their own booking.
  const coachBell = expect(await request(base, "GET", "/account/notifications", undefined, coach), 200, "coach bell").notifications;
  assert.equal(coachBell.filter((n) => n.notification_type === "checkin_booked").length, 2);
  const samBell = expect(await request(base, "GET", "/account/notifications", undefined, sam), 200, "sam bell").notifications;
  assert.equal(samBell.filter((n) => n.notification_type === "checkin_scheduled").length, 0);
  const coachView = expect(await request(base, "GET", `/check-ins/athletes/${sam.userId}`, undefined, coach), 200, "coach view").checkins;
  assert.deepEqual(coachView.map((c) => [c.status, c.booked_by]), [["confirmed", "athlete"]]);

  // A day off closes that day's slots.
  const offDate = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(weekly[3].starts_at));
  availability = expect(await request(base, "POST", "/check-ins/availability/days-off", { from_date: offDate, to_date: offDate, note: "Away" }, coach), 201, "day off");
  assert.deepEqual(availability.days_off.map((d) => [d.from_date, d.to_date, d.note]), [[offDate, offDate, "Away"]]);
  assert.ok(!(await slotsFor(jo))[0].slots.some((s) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(s.starts_at)) === offDate), "no slots on the day off");
  expect(await request(base, "POST", "/check-ins/availability/days-off", { from_date: offDate, to_date: "2000-01-01" }, coach), 422, "last before first");

  // Sam cancels their booking: the slot opens, the coach is told, Sam can book again.
  const samCall = booked[0].checkin_id;
  expect(await request(base, "POST", `/check-ins/${samCall}/cancel-mine`, {}, jo), 404, "not Jo's");
  assert.deepEqual(expect(await request(base, "POST", `/check-ins/${samCall}/cancel-mine`, {}, sam), 200, "cancel mine").checkins, []);
  assert.ok((await slotsFor(jo))[0].slots.some((s) => s.starts_at === first.starts_at), "open again");
  assert.equal(expect(await request(base, "GET", "/account/notifications", undefined, coach), 200, "coach bell 2").notifications.filter((n) => n.notification_type === "checkin_cancelled_by_athlete").length, 1);
  assert.equal(expect(await request(base, "GET", "/account/notifications", undefined, sam), 200, "sam bell 2").notifications.filter((n) => n.notification_type === "checkin_cancelled").length, 0, "not told about their own cancel");
  expect(await request(base, "POST", "/check-ins/book", { coach_user_id: coach.userId, starts_at: weekly[1].starts_at }, sam), 201, "can book again");

  // A coach-booked call can't be cancelled by the athlete this way.
  const coachBooked = expect(await request(base, "POST", "/check-ins", { athlete_user_id: sam.userId, starts_at: new Date(Date.now() + 20 * 86400000).toISOString(), call_method: "whatsapp" }, coach), 201, "coach books").checkins.find((c) => c.booked_by === "coach");
  expect(await request(base, "POST", `/check-ins/${coachBooked.checkin_id}/cancel-mine`, {}, sam), 404, "only their own bookings");

  // Removing the hours removes their slots.
  for (const block of (expect(await request(base, "GET", "/check-ins/availability", undefined, coach), 200, "hours").blocks)) {
    expect(await request(base, "DELETE", `/check-ins/availability/blocks/${block.block_id}`, undefined, coach), 200, "remove block");
  }
  const after = await slotsFor(jo);
  assert.ok(after.length === 0 || after[0].slots.length === 0, "no slots left");
});
