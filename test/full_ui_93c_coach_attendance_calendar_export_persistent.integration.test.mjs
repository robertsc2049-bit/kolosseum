// DEV NOTE: FULL-UI-93 coach individual attendance-events calendar export
// persistent proof. Org owners already have /org/organisations/:org_id/
// attendance-events/calendar.ics (FULL-UI-92), but coaches - who have a
// full individual attendance-events CRUD surface (create, list, cancel,
// skip, reschedule, at /attendance-events) - had no calendar export at
// all until this slice.
// Proves: a scheduled occurrence appears as its own VEVENT at its original
// date/time; a rescheduled occurrence appears using its rescheduled_to_*
// slot, never the original; a skipped occurrence produces no VEVENT at
// all; a cancelled event's occurrences are entirely absent; a second
// coach's own events never leak into the first coach's export; the
// correct download headers are set; and everything survives a
// fresh-process restart. Every step crosses only public HTTP routes.

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
  const email = `coach_attendance_ics_${label}_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Coach Attendance ICS ${label}`,
    email,
    password: `CoachAttendanceIcs${label}!2026`,
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
    { display_name: `Coach Attendance ICS ${label}`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);
  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/accessibility",
    { accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false } },
    { cookie, csrf }
  ), 200, `${label} coach onboarding accessibility`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

// Parses just enough of the returned ICS text to assert against - a real
// VEVENT-per-line splitter, no library needed for these simple assertions.
function parseVEvents(icsText) {
  const blocks = icsText.split("BEGIN:VEVENT").slice(1);
  return blocks.map((block) => {
    const body = block.split("END:VEVENT")[0];
    const field = (name) => {
      const match = body.match(new RegExp(`\\n${name}[^:]*:([^\\r\\n]*)`, "u"));
      return match ? match[1] : null;
    };
    const fieldWithParams = (name) => {
      const match = body.match(new RegExp(`\\n${name}([^:]*):([^\\r\\n]*)`, "u"));
      return match ? `${match[1]}:${match[2]}` : null;
    };
    const uid = field("UID");
    return {
      uid: uid ? uid.replace(/@kolosseum\.app$/u, "") : uid,
      summary: field("SUMMARY"),
      dtstart: fieldWithParams("DTSTART")
    };
  });
}

test(
  "FULL-UI-93 coach attendance calendar export: a scheduled occurrence keeps its original slot, a rescheduled one uses its new slot, a skipped one is omitted entirely, a cancelled event's occurrences never appear, a second coach's own events never leak in, correct download headers, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const coachUserIds = [];

    const cleanup = async () => {
      if (coachUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [coachUserIds]
        ).catch(() => {});
      }
      for (const userId of coachUserIds) {
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

    const coach = await registerCoach(baseUrl, nonce, "primary");
    coachUserIds.push(coach.userId);
    const otherCoach = await registerCoach(baseUrl, nonce, "other");
    coachUserIds.push(otherCoach.userId);

    // ============================================================
    // A 3-occurrence recurring individual coach event (2026-09-08 is a
    // Tuesday). owner_scope defaults to "coach" when omitted.
    // ============================================================
    const created = await request(baseUrl, "POST", "/attendance-events", {
      title: "Tuesday 1:1 Session", description: "Individual coaching", location: "Home gym", activity_label: "Strength",
      occurrence_date: "2026-09-08", start_time: "18:00", end_time: "19:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["tue"], ends: { type: "after_count", value: 3 } }
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(created, 201, "coach creates a 3-occurrence individual event");
    const eventId = created.json?.event?.event_id;
    assert.equal(created.json?.occurrences?.length, 3);
    const [occScheduled, occRescheduled, occSkipped] = created.json.occurrences;

    // Reschedule the second occurrence to a new date/time.
    const rescheduled = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occRescheduled.occurrence_id)}/reschedule`,
      { new_date: "2026-09-30", new_start_time: "20:00", new_end_time: "21:00" }, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(rescheduled, 200, "coach reschedules the second occurrence");

    // Skip the third occurrence.
    const skipped = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occSkipped.occurrence_id)}/skip`,
      {}, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(skipped, 200, "coach skips the third occurrence");

    // A separate, entirely cancelled event - its occurrence(s) must never
    // appear in the export at all.
    const cancelledEvent = await request(baseUrl, "POST", "/attendance-events", {
      title: "Cancelled Saturday Session", location: "Home gym", activity_label: "Strength",
      occurrence_date: "2026-09-12"
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(cancelledEvent, 201, "coach creates a second event to be cancelled");
    const cancelledEventId = cancelledEvent.json?.event?.event_id;
    const cancelResult = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(cancelledEventId)}/cancel`,
      {}, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(cancelResult, 200, "coach cancels the second event");

    // A second coach's own event - must never leak into the first coach's
    // export.
    const otherCoachEvent = await request(baseUrl, "POST", "/attendance-events", {
      title: "Other Coach Yoga", location: "Studio B", activity_label: "Yoga",
      occurrence_date: "2026-09-10"
    }, { cookie: otherCoach.cookie, csrf: otherCoach.csrf });
    assertStatus(otherCoachEvent, 201, "other coach creates their own event");

    // ============================================================
    // The coach downloads their own calendar - correct headers, correct
    // VEVENT set, no leakage from the other coach.
    // ============================================================
    const download = await request(
      baseUrl, "GET", "/attendance-events/calendar.ics", undefined,
      { cookie: coach.cookie }
    );
    assertStatus(download, 200, "coach downloads their own calendar");
    assert.equal(download.response.headers.get("content-type"), "text/calendar; charset=utf-8");
    assert.equal(download.response.headers.get("content-disposition"), 'attachment; filename="kolosseum-coach-events.ics"');
    assert.match(download.text, /^BEGIN:VCALENDAR/u);

    const events = parseVEvents(download.text);
    const uids = events.map((event) => event.uid);

    assert.ok(uids.includes(occScheduled.occurrence_id), "the scheduled occurrence has its own VEVENT");
    assert.ok(uids.includes(occRescheduled.occurrence_id), "the rescheduled occurrence has its own VEVENT");
    assert.ok(!uids.includes(occSkipped.occurrence_id), "the skipped occurrence produces no VEVENT at all");

    const scheduledEvent = events.find((event) => event.uid === occScheduled.occurrence_id);
    assert.match(scheduledEvent.dtstart, /^;TZID=/u, "a timed occurrence uses a TZID-qualified DTSTART, not an all-day one");
    assert.match(scheduledEvent.dtstart, /20260908T180000$/u, "the scheduled occurrence keeps its ORIGINAL date/time");
    assert.equal(scheduledEvent.summary, "Tuesday 1:1 Session");

    const rescheduledEvent = events.find((event) => event.uid === occRescheduled.occurrence_id);
    assert.match(rescheduledEvent.dtstart, /20260930T200000$/u, "the rescheduled occurrence uses its NEW date/time, not the original");

    assert.doesNotMatch(download.text, /Cancelled Saturday Session/u, "a cancelled event's occurrences never appear");
    assert.doesNotMatch(download.text, /Other Coach Yoga/u, "a second coach's own events never leak into this coach's export");

    // The other coach's own export, symmetrically, never contains this
    // coach's events.
    const otherDownload = await request(
      baseUrl, "GET", "/attendance-events/calendar.ics", undefined,
      { cookie: otherCoach.cookie }
    );
    assertStatus(otherDownload, 200, "other coach downloads their own calendar");
    assert.match(otherDownload.text, /Other Coach Yoga/u);
    assert.doesNotMatch(otherDownload.text, /Tuesday 1:1 Session/u, "the first coach's events never leak into the second coach's export");

    // ============================================================
    // Fresh-process restart: the export reconstructs identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedDownload = await request(
      restarted.baseUrl, "GET", "/attendance-events/calendar.ics", undefined,
      { cookie: coach.cookie }
    );
    assertStatus(restartedDownload, 200, "coach downloads their calendar after a fresh-process restart");
    const restartedUids = parseVEvents(restartedDownload.text).map((event) => event.uid);
    assert.ok(restartedUids.includes(occScheduled.occurrence_id));
    assert.ok(restartedUids.includes(occRescheduled.occurrence_id));
    assert.ok(!restartedUids.includes(occSkipped.occurrence_id));
  }
);
