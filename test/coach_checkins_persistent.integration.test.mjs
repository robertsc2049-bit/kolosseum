// Check-in calls: a coach saves their WhatsApp number and Teams meeting link,
// books one-off or repeating check-ins with an athlete they coach, and the
// athlete confirms or asks to move one; the coach moves or cancels it. Both
// are told, and no one else can see or touch a check-in.
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

test("a coach books check-in calls on WhatsApp or Teams; the athlete confirms or asks to move them", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_coaching_requests WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_checkins WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_call_settings WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_share_links WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name = `${label} Person`) => {
    const email = `checkin_${label}_${nonce}@example.com`;
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
  const athlete = await register("athlete", "athlete", "Sam Lifter");
  const stranger = await register("athlete", "stranger", "Not Coached");
  const otherCoach = await register("coach", "other", "Pat Other");
  await finishCoachSetup(otherCoach, "Pat Other");

  const invite = await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: athlete.email }, coach);
  assert.ok(invite.response.status < 300, `invite: ${invite.text}`);
  const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");

  // How athletes reach the coach.
  assert.deepEqual(expect(await request(base, "GET", "/check-ins/call-settings", undefined, coach), 200, "settings").call_settings, { whatsapp_number: null, teams_link: null });
  for (const [body, code] of [
    [{ whatsapp_number: "07700 900123" }, "checkin_whatsapp_number_invalid"],
    [{ whatsapp_number: "call me" }, "checkin_whatsapp_number_invalid"],
    [{ teams_link: "https://evil.example.com/teams.microsoft.com" }, "checkin_teams_link_invalid"],
    [{ teams_link: "http://teams.microsoft.com/l/meetup-join/x" }, "checkin_teams_link_invalid"]
  ]) assert.equal(expect(await request(base, "PUT", "/check-ins/call-settings", body, coach), 422, JSON.stringify(body)).error, code);
  expect(await request(base, "PUT", "/check-ins/call-settings", { whatsapp_number: "+44 7700 900123" }, { cookie: coach.cookie }), 403, "needs CSRF");

  // WhatsApp needs a number first.
  const soon = new Date(Date.now() + 2 * 86400000);
  soon.setUTCHours(18, 0, 0, 0);
  assert.equal(expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: soon.toISOString(), call_method: "whatsapp" }, coach), 409, "no number yet").error, "checkin_whatsapp_number_missing");
  const teamsLink = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0";
  const saved = expect(await request(base, "PUT", "/check-ins/call-settings", { whatsapp_number: "+44 7700 900123", teams_link: teamsLink }, coach), 200, "save settings").call_settings;
  assert.deepEqual(saved, { whatsapp_number: "447700900123", teams_link: teamsLink });

  // Only an athlete they coach, and a sensible time.
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: stranger.userId, starts_at: soon.toISOString(), call_method: "whatsapp" }, coach), 404, "not their athlete");
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: soon.toISOString(), call_method: "whatsapp" }, otherCoach), 404, "another coach");
  assert.equal(expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: new Date(Date.now() - 86400000).toISOString(), call_method: "whatsapp" }, coach), 422, "past").error, "checkin_start_invalid");
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: soon.toISOString(), call_method: "zoom" }, coach), 422, "unknown method");
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: soon.toISOString(), call_method: "teams", repeat: "weekly", occurrences: 13 }, coach), 422, "too many");
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: soon.toISOString(), call_method: "whatsapp" }, athlete), 403, "athletes can't book");

  // A one-off WhatsApp call and a weekly run of 4 on Teams.
  expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: soon.toISOString(), duration_minutes: 15, call_method: "whatsapp", note: "Quick catch-up" }, coach), 201, "one-off");
  const later = new Date(soon.getTime() + 86400000);
  const booked = expect(await request(base, "POST", "/check-ins", { athlete_user_id: athlete.userId, starts_at: later.toISOString(), duration_minutes: 30, call_method: "teams", repeat: "weekly", occurrences: 4 }, coach), 201, "weekly run").checkins;
  assert.equal(booked.length, 5);
  assert.equal(booked[0].whatsapp_url, "https://wa.me/447700900123");
  const run = booked.filter((c) => c.series_id);
  assert.deepEqual(run.map((c) => new Date(c.starts_at).getTime() - later.getTime()), [0, 7, 14, 21].map((d) => d * 86400000));
  assert.ok(run.every((c) => c.teams_link === teamsLink && c.status === "scheduled"));
  expect(await request(base, "GET", `/check-ins/athletes/${athlete.userId}`, undefined, otherCoach), 404, "another coach can't read them");

  // The athlete sees them on Today with the join links, and is told once per booking.
  const mine = expect(await request(base, "GET", "/check-ins/mine", undefined, athlete), 200, "athlete list").checkins;
  assert.equal(mine.length, 5);
  assert.deepEqual([mine[0].coach_display_name, mine[0].call_method, mine[0].whatsapp_url, mine[0].note], ["Chris Roberts", "whatsapp", "https://wa.me/447700900123", "Quick catch-up"]);
  assert.equal(mine[1].teams_link, teamsLink);
  assert.deepEqual(expect(await request(base, "GET", "/check-ins/mine", undefined, stranger), 200, "stranger list").checkins, []);
  const athleteBell = expect(await request(base, "GET", "/account/notifications", undefined, athlete), 200, "athlete bell").notifications;
  const bookedNotes = athleteBell.filter((n) => n.notification_type === "checkin_scheduled");
  assert.equal(bookedNotes.length, 2, "one for the one-off, one for the weekly run");
  assert.ok(bookedNotes.every((n) => n.notification_payload.coach_user_id === coach.userId));

  // Confirm one; ask to move another (a reason is needed).
  expect(await request(base, "POST", `/check-ins/${mine[0].checkin_id}/respond`, { response: "confirm" }, stranger), 404, "not theirs");
  expect(await request(base, "POST", `/check-ins/${mine[0].checkin_id}/respond`, { response: "confirm" }, athlete), 200, "confirm");
  expect(await request(base, "POST", `/check-ins/${mine[1].checkin_id}/respond`, { response: "move" }, athlete), 422, "move needs a message");
  const responded = expect(await request(base, "POST", `/check-ins/${mine[1].checkin_id}/respond`, { response: "move", message: "Any evening after 6?" }, athlete), 200, "ask to move").checkins;
  assert.deepEqual(responded.slice(0, 2).map((c) => c.status), ["confirmed", "move_requested"]);
  const coachBell = expect(await request(base, "GET", "/account/notifications", undefined, coach), 200, "coach bell").notifications;
  assert.deepEqual(coachBell.filter((n) => n.notification_type.startsWith("checkin_")).map((n) => n.notification_type).sort(), ["checkin_confirmed", "checkin_move_requested"]);
  const moveNote = coachBell.find((n) => n.notification_type === "checkin_move_requested");
  assert.deepEqual([moveNote.notification_payload.athlete_user_id, moveNote.notification_payload.athlete_message, moveNote.deep_link.route_id, moveNote.deep_link.params.athlete_id], [athlete.userId, "Any evening after 6?", "coach_athlete_detail", athlete.userId]);

  // The coach moves it: booked again, waiting to be confirmed, and the athlete is told.
  const newTime = new Date(later.getTime() + 2 * 3600000);
  const moved = expect(await request(base, "POST", `/check-ins/${mine[1].checkin_id}/move`, { starts_at: newTime.toISOString() }, coach), 200, "move").checkins.find((c) => c.checkin_id === mine[1].checkin_id);
  assert.deepEqual([moved.starts_at, moved.status, moved.athlete_message], [newTime.toISOString(), "scheduled", null]);
  expect(await request(base, "POST", `/check-ins/${mine[1].checkin_id}/move`, { starts_at: newTime.toISOString() }, otherCoach), 404, "another coach can't move it");
  assert.equal(expect(await request(base, "GET", "/account/notifications", undefined, athlete), 200, "athlete bell 2").notifications.filter((n) => n.notification_type === "checkin_scheduled").length, 3);

  // Cancel the third call and every later one in the run; the first of the run stays.
  const third = run[2].checkin_id;
  const afterCancel = expect(await request(base, "POST", `/check-ins/${third}/cancel`, { and_later: true }, coach), 200, "cancel run").checkins;
  assert.deepEqual(afterCancel.map((c) => c.checkin_id), [mine[0].checkin_id, run[0].checkin_id, run[1].checkin_id]);
  expect(await request(base, "POST", `/check-ins/${third}/cancel`, {}, coach), 404, "already cancelled");
  const cancelledNotes = expect(await request(base, "GET", "/account/notifications", undefined, athlete), 200, "athlete bell 3").notifications.filter((n) => n.notification_type === "checkin_cancelled");
  assert.equal(cancelledNotes.length, 1, "one notification for cancelling the rest of the run");

  // When the coaching ends, the athlete no longer sees or answers the calls.
  const relationships = expect(await request(base, "GET", "/coach-workspace/relationships/mine", undefined, athlete), 200, "relationships");
  const relationshipId = (relationships.relationships ?? relationships.items ?? []).find((r) => r.coach_user_id === coach.userId)?.relationship_id;
  assert.ok(relationshipId, "found the relationship");
  const ended = await request(base, "POST", `/coach-workspace/relationships/${relationshipId}/end`, {}, athlete);
  assert.ok(ended.response.status < 300, `end: ${ended.text}`);
  assert.deepEqual(expect(await request(base, "GET", "/check-ins/mine", undefined, athlete), 200, "after ending").checkins, []);
  expect(await request(base, "POST", `/check-ins/${run[0].checkin_id}/respond`, { response: "confirm" }, athlete), 404, "can't answer after ending");
  expect(await request(base, "GET", `/check-ins/athletes/${athlete.userId}`, undefined, coach), 404, "coach can't list after ending");
});
