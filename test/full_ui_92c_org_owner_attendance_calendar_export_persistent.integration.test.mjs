// DEV NOTE: FULL-UI-92 org-owner attendance-events calendar export
// persistent proof. Coaches already have /coach-workspace/events/
// calendar.ics and athletes their own /account/events/calendar.ics, but
// org owners - who have a full gym-wide attendance-events CRUD surface -
// had no calendar export at all.
// Proves: a scheduled occurrence appears as its own VEVENT at its original
// date/time; a rescheduled occurrence appears using its rescheduled_to_*
// slot, never the original; a skipped occurrence produces no VEVENT at
// all; a cancelled event's occurrences are entirely absent; a second
// organisation's events never appear in the first org's export; a
// different org owner cannot download this org's calendar; the correct
// download headers are set; and everything survives a fresh-process
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

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `attendance_ics_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Attendance ICS ${label} Owner`,
    password: `AttendanceIcs${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `attendance_ics_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Attendance ICS ${label} Coach`,
    email,
    password: `AttendanceIcs${label}Coach!2026`,
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
    { display_name: `Attendance ICS ${label} Coach`, email },
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

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

async function createGymOrg(baseUrl, owner, name, coach, nonce, label) {
  const org = await request(baseUrl, "POST", "/org/organisations", {
    org_name: name, activity_id: "powerlifting", visibility_mode: "individual"
  }, { cookie: owner.cookie, csrf: owner.csrf });
  assertStatus(org, 201, `create ${label} individual-mode org`);
  const orgId = org.json?.organisation?.org_id;

  const invite = await request(
    baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
    { coach_email: coach.email, request_id: `attendance_ics_invite_${nonce}_${label}` }, { cookie: owner.cookie, csrf: owner.csrf }
  );
  assertStatus(invite, 201, `invite coach to ${label} org`);
  await acceptOrgInvite(baseUrl, coach, invite.json?.membership?.membership_id, `attendance_ics_accept_${nonce}_${label}`);

  return orgId;
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
    // Captures the full raw line's params+value (e.g. ";TZID=Europe/London:20260908T180000")
    // rather than just the post-colon value, so callers can assert on the parameter
    // portion too (e.g. whether DTSTART is TZID-qualified vs. an all-day VALUE=DATE).
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
  "FULL-UI-92 org-owner attendance calendar export: a scheduled occurrence keeps its original slot, a rescheduled one uses its new slot, a skipped one is omitted entirely, a cancelled event's occurrences never appear, a second org's events never leak in, a different owner is rejected, correct download headers, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];

    const cleanup = async () => {
      if (coachUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [coachUserIds]
        ).catch(() => {});
      }
      for (const ownerUserId of orgOwnerUserIds) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = $1 OR actor_user_id = $1`,
          [ownerUserId]
        ).catch(() => {});
        await pool.query(
          "DELETE FROM product_org_coach_memberships WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [ownerUserId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [ownerUserId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [ownerUserId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [ownerUserId]).catch(() => {});
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

    const owner = await registerOrgOwner(baseUrl, nonce, "primary");
    orgOwnerUserIds.push(owner.userId);
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "uninvolved");
    orgOwnerUserIds.push(otherOwner.userId);

    const coach = await registerCoach(baseUrl, nonce, "primary");
    coachUserIds.push(coach.userId);

    const orgId = await createGymOrg(baseUrl, owner, "Attendance ICS Org", coach, nonce, "primary");
    const otherOrgId = await createGymOrg(baseUrl, owner, "Attendance ICS Other Org", coach, nonce, "other");

    // ============================================================
    // A 3-occurrence recurring gym event (2026-09-08 is a Tuesday).
    // ============================================================
    const created = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events`, {
      title: "Tuesday CrossFit", description: "Whole-gym class", location: "Main gym", activity_label: "CrossFit",
      occurrence_date: "2026-09-08", start_time: "18:00", end_time: "19:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["tue"], ends: { type: "after_count", value: 3 } }
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(created, 201, "owner creates a 3-occurrence gym-wide event");
    const eventId = created.json?.event?.event_id;
    assert.equal(created.json?.occurrences?.length, 3);
    const [occScheduled, occRescheduled, occSkipped] = created.json.occurrences;

    // Reschedule the second occurrence to a new date/time.
    const rescheduled = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occRescheduled.occurrence_id)}/reschedule`,
      { new_date: "2026-09-30", new_start_time: "20:00", new_end_time: "21:00" }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(rescheduled, 200, "owner reschedules the second occurrence");

    // Skip the third occurrence.
    const skipped = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occSkipped.occurrence_id)}/skip`,
      {}, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(skipped, 200, "owner skips the third occurrence");

    // A separate, entirely cancelled event - its occurrence(s) must never
    // appear in the export at all.
    const cancelledEvent = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events`, {
      title: "Cancelled Saturday Open Gym", location: "Main gym", activity_label: "Open gym",
      occurrence_date: "2026-09-12"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(cancelledEvent, 201, "owner creates a second event to be cancelled");
    const cancelledEventId = cancelledEvent.json?.event?.event_id;
    const cancelResult = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events/${encodeURIComponent(cancelledEventId)}/cancel`,
      {}, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(cancelResult, 200, "owner cancels the second event");

    // A second organisation's own event - must never leak into the first
    // org's export.
    const otherOrgEvent = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(otherOrgId)}/attendance-events`, {
      title: "Other Org Yoga", location: "Studio B", activity_label: "Yoga",
      occurrence_date: "2026-09-10"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(otherOrgEvent, 201, "owner creates an event in the second org");

    // ============================================================
    // A different org owner cannot download this org's calendar.
    // ============================================================
    const otherOwnerAttempt = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events/calendar.ics`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(otherOwnerAttempt, 403, "a different org owner cannot download this org's calendar");

    // ============================================================
    // The real owner downloads the calendar - correct headers, correct
    // VEVENT set.
    // ============================================================
    const download = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events/calendar.ics`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(download, 200, "owner downloads the calendar");
    assert.equal(download.response.headers.get("content-type"), "text/calendar; charset=utf-8");
    assert.equal(download.response.headers.get("content-disposition"), 'attachment; filename="kolosseum-gym-events.ics"');
    assert.match(download.text, /^BEGIN:VCALENDAR/u);

    const events = parseVEvents(download.text);
    const uids = events.map((event) => event.uid);

    assert.ok(uids.includes(occScheduled.occurrence_id), "the scheduled occurrence has its own VEVENT");
    assert.ok(uids.includes(occRescheduled.occurrence_id), "the rescheduled occurrence has its own VEVENT");
    assert.ok(!uids.includes(occSkipped.occurrence_id), "the skipped occurrence produces no VEVENT at all");

    const scheduledEvent = events.find((event) => event.uid === occScheduled.occurrence_id);
    assert.match(scheduledEvent.dtstart, /^;TZID=/u, "a timed occurrence uses a TZID-qualified DTSTART, not an all-day one");
    assert.match(scheduledEvent.dtstart, /20260908T180000$/u, "the scheduled occurrence keeps its ORIGINAL date/time");
    assert.equal(scheduledEvent.summary, "Tuesday CrossFit");

    const rescheduledEvent = events.find((event) => event.uid === occRescheduled.occurrence_id);
    assert.match(rescheduledEvent.dtstart, /20260930T200000$/u, "the rescheduled occurrence uses its NEW date/time, not the original");

    assert.doesNotMatch(download.text, /Cancelled Saturday Open Gym/u, "a cancelled event's occurrences never appear");
    assert.doesNotMatch(download.text, /Other Org Yoga/u, "a second organisation's events never leak into this org's export");

    // ============================================================
    // Fresh-process restart: the export reconstructs identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedDownload = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/attendance-events/calendar.ics`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedDownload, 200, "owner downloads the calendar after a fresh-process restart");
    const restartedUids = parseVEvents(restartedDownload.text).map((event) => event.uid);
    assert.ok(restartedUids.includes(occScheduled.occurrence_id));
    assert.ok(restartedUids.includes(occRescheduled.occurrence_id));
    assert.ok(!restartedUids.includes(occSkipped.occurrence_id));
  }
);
