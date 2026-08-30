// DEV NOTE: Attendance events slice 1 - persistent lifecycle proof. Proves
// a coach creates a single (non-recurring) event, invites a subset of
// their own accepted athletes, an invited athlete's RSVP is written and
// read back correctly, the coach's roster view reflects it, an
// uninvited athlete cannot RSVP even with a guessed valid occurrence_id,
// a non-accepted athlete cannot be invited, cancelling an event blocks
// further RSVPs against it, and everything survives a fresh-process
// restart. Every step crosses only public HTTP routes.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function spawnNode(argumentsList, options) {
  const child = spawn(process.execPath, argumentsList, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  return {
    child,
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

async function waitForExit(child) {
  if (child.exitCode !== null) {
    return { code: child.exitCode, signal: child.signalCode ?? null };
  }
  return await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal: signal ?? null }));
  });
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForHealth(processRecord, baseUrl, timeoutMilliseconds = 15000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = null;

  while (Date.now() < deadline) {
    if (processRecord.child.exitCode !== null) {
      const exit = await waitForExit(processRecord.child);
      throw new Error(
        `Server exited before health became ready. exit_code=${exit.code} signal=${exit.signal}\n` +
        `stdout:\n${processRecord.stdout || "<empty>"}\nstderr:\n${processRecord.stderr || "<empty>"}`
      );
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
      lastError = new Error(`Health returned ${response.status}`);
    }
    catch (error) {
      lastError = error;
    }
    await delay(120);
  }

  throw new Error(
    `Server did not become healthy. base_url=${baseUrl} last_error=${lastError?.message ?? String(lastError)}\n` +
    `stdout:\n${processRecord.stdout || "<empty>"}\nstderr:\n${processRecord.stderr || "<empty>"}`
  );
}

async function startFreshServerProcess(root, environment) {
  const mainModule = path.join(root, "dist", "src", "main.js");
  await fs.access(mainModule);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const processRecord = spawnNode([mainModule], {
    cwd: root,
    env: { ...environment, PORT: String(port) }
  });
  await waitForHealth(processRecord, baseUrl);
  return { ...processRecord, baseUrl, port };
}

async function stopFreshServerProcess(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  if (process.platform === "win32") server.child.kill();
  else server.child.kill("SIGTERM");
  await Promise.race([waitForExit(server.child), delay(3000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([waitForExit(server.child), delay(2000)]);
  }
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `attendance_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Attendance ${label} Coach`,
    email,
    password: `Attendance${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Attendance ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `attendance_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Attendance ${label} Athlete`,
    email,
    password: `Attendance${label}Athlete!2026`,
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId, state }) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

test(
  "Attendance events: create + invite + RSVP round-trip, an uninvited athlete is rejected, a non-accepted athlete cannot be invited, cancelling blocks further RSVPs, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const coachUserIds = [];
    const athleteUserIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);
    const strangerAthlete = await registerAthlete(baseUrl, nonce, "stranger");
    athleteUserIds.push(strangerAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `attendance_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `attendance_rel_${nonce}_2`, coachUserId: coach.userId, athleteUserId: athlete2.userId, state: "invited"
    });

    // ============================================================
    // A coach cannot invite a non-accepted (merely invited) athlete.
    // ============================================================
    const createRejected = await request(baseUrl, "POST", "/attendance-events", {
      title: "Saturday class",
      description: "",
      location: "Main gym",
      activity_label: "Powerlifting",
      timezone: "Europe/London",
      occurrence_date: "2026-09-05",
      start_time: "09:00",
      end_time: "10:00",
      athlete_user_ids: [athlete2.userId]
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(createRejected, 403, "cannot invite a non-accepted athlete");
    assert.equal(createRejected.json?.error, "attendance_event_invite_athlete_not_accepted");

    // ============================================================
    // Create a real event, inviting only the accepted athlete.
    // ============================================================
    const created = await request(baseUrl, "POST", "/attendance-events", {
      title: "Saturday class",
      description: "Squat and bench focus",
      location: "Main gym",
      activity_label: "Powerlifting",
      timezone: "Europe/London",
      occurrence_date: "2026-09-05",
      start_time: "09:00",
      end_time: "10:00",
      athlete_user_ids: [athlete1.userId]
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(created, 201, "create event");
    const eventId = created.json?.event?.event_id;
    const occurrenceId = created.json?.occurrences?.[0]?.occurrence_id;
    assert.ok(eventId, "expected an event_id");
    assert.ok(occurrenceId, "expected an occurrence_id");
    assert.equal(created.json?.invites?.length, 1, "expected exactly one invite");
    assert.equal(created.json?.invites?.[0]?.athlete_user_id, athlete1.userId);

    // ============================================================
    // An uninvited athlete cannot RSVP, even with a real, valid-looking
    // occurrence_id.
    // ============================================================
    const strangerRsvp = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: strangerAthlete.cookie, csrf: strangerAthlete.csrf }
    );
    assertStatus(strangerRsvp, 403, "an uninvited athlete cannot RSVP");
    assert.equal(strangerRsvp.json?.error, "attendance_event_not_invited");

    // ============================================================
    // The invited athlete sees the event and submits a real RSVP.
    // ============================================================
    const mineBeforeRsvp = await request(baseUrl, "GET", "/attendance-events/mine", undefined, { cookie: athlete1.cookie });
    assertStatus(mineBeforeRsvp, 200, "athlete reads own invited occurrences");
    assert.equal(mineBeforeRsvp.json?.occurrences?.length, 1);
    assert.equal(mineBeforeRsvp.json?.occurrences?.[0]?.my_rsvp_state, null, "no response yet");
    assert.equal(mineBeforeRsvp.json?.occurrences?.[0]?.title, "Saturday class");

    const rsvp = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(rsvp, 201, "athlete submits RSVP");
    assert.equal(rsvp.json?.rsvp?.rsvp_state, "attending");

    const mineAfterRsvp = await request(baseUrl, "GET", "/attendance-events/mine", undefined, { cookie: athlete1.cookie });
    assertStatus(mineAfterRsvp, 200, "athlete re-reads own occurrences");
    assert.equal(mineAfterRsvp.json?.occurrences?.[0]?.my_rsvp_state, "attending");

    // A later RSVP change on the same occurrence overwrites (append-only
    // history, but the LATEST state wins on every read).
    const changedRsvp = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
      { rsvp_state: "maybe" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(changedRsvp, 201, "athlete changes RSVP");

    // ============================================================
    // The coach's own roster/detail view reflects the current RSVP.
    // ============================================================
    const detail = await request(baseUrl, "GET", `/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: coach.cookie });
    assertStatus(detail, 200, "coach reads event detail");
    assert.equal(detail.json?.event?.title, "Saturday class");
    assert.equal(detail.json?.event?.status, "active");
    assert.equal(detail.json?.roster?.length, 1);
    assert.equal(detail.json?.roster?.[0]?.athlete_user_id, athlete1.userId);
    assert.equal(detail.json?.roster?.[0]?.rsvp_by_occurrence?.[occurrenceId], "maybe");

    // ============================================================
    // Cancelling the event blocks any further RSVP against it.
    // ============================================================
    const cancelled = await request(baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/cancel`, {}, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(cancelled, 200, "coach cancels the event");
    assert.equal(cancelled.json?.event?.status, "cancelled");

    const rsvpAfterCancel = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(rsvpAfterCancel, 404, "cannot RSVP to a cancelled event's occurrence");
    assert.equal(rsvpAfterCancel.json?.error, "attendance_event_event_not_available");

    // Cancelling twice is rejected outright, never silently accepted.
    const cancelledAgain = await request(baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/cancel`, {}, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(cancelledAgain, 409, "cancelling an already-cancelled event is rejected");

    // ============================================================
    // Fresh-process restart: every read reconstructs identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedDetail = await request(restarted.baseUrl, "GET", `/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: coach.cookie });
    assertStatus(restartedDetail, 200, "coach reads event detail after fresh-process restart");
    assert.equal(restartedDetail.json?.event?.status, "cancelled");
    assert.equal(restartedDetail.json?.roster?.[0]?.rsvp_by_occurrence?.[occurrenceId], "maybe");
  }
);
