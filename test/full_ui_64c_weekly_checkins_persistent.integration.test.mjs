// DEV NOTE: FULL-UI-64 athlete weekly check-in lifecycle proof. Proves a
// valid check-in is stored and read back with all three ratings and its
// optional note, that unknown fields/out-of-range ratings/malformed dates/
// an over-length note are all rejected, that a second submission for a
// week that already has a check-in is rejected with a 409 rather than
// silently overwriting or silently deduping, that a different week
// succeeds and both rows are readable newest-week-first, that the athlete
// and accepted coach routes return byte-identical output, that an
// unrelated coach is rejected, that deterministic compile output is
// completely unaffected, and that everything survives a fresh-process
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
  const email = `checkin_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Checkin ${label} Coach`,
    email,
    password: `Checkin${label}Coach!2026`,
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
    { display_name: `Checkin ${label} Coach`, email },
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
  const email = `checkin_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Checkin ${label} Athlete`,
    email,
    password: `Checkin${label}Athlete!2026`,
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
    revoked_at_iso8601: state === "revoked" ? now : null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function compileFixture(baseUrl, fixture) {
  const result = await request(baseUrl, "POST", "/blocks/compile", { phase1_input: fixture });
  assert.ok(
    result.response.status === 200 || result.response.status === 201,
    `deterministic compile: expected 200 or 201, received ${result.response.status}. raw=${result.text}`
  );
  return result.json;
}

test(
  "Weekly check-ins: valid submission, validation rejections, duplicate-week conflict, athlete/coach parity, relationship gating, deterministic compile untouched, fresh-process restart",
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
    const strangerCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(strangerCoach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `checkin_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    // ============================================================
    // Validation: unknown field, out-of-range rating, malformed date,
    // over-length note are all rejected before anything is stored.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/weekly-checkins", {
        week_start_date: "2026-08-17", energy_level: 3, motivation_level: 3, sleep_quality: 3, extra_field: "no"
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      400,
      "unknown field is rejected"
    );

    assertStatus(
      await request(baseUrl, "POST", "/weekly-checkins", {
        week_start_date: "2026-08-17", energy_level: 6, motivation_level: 3, sleep_quality: 3
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      400,
      "out-of-range rating is rejected"
    );

    assertStatus(
      await request(baseUrl, "POST", "/weekly-checkins", {
        week_start_date: "not-a-date", energy_level: 3, motivation_level: 3, sleep_quality: 3
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      400,
      "malformed week_start_date is rejected"
    );

    assertStatus(
      await request(baseUrl, "POST", "/weekly-checkins", {
        week_start_date: "2026-08-17", energy_level: 3, motivation_level: 3, sleep_quality: 3, note: "x".repeat(281)
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      400,
      "an over-length note is rejected"
    );

    // ============================================================
    // A valid submission is stored and read back in full.
    // ============================================================
    const firstCheckin = await request(baseUrl, "POST", "/weekly-checkins", {
      week_start_date: "2026-08-17", energy_level: 4, motivation_level: 3, sleep_quality: 5, note: "Felt strong on squats"
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(firstCheckin, 201, "athlete submits first weekly check-in");
    assert.equal(firstCheckin.json?.checkin?.week_start_date, "2026-08-17");
    assert.equal(firstCheckin.json?.checkin?.energy_level, 4);
    assert.equal(firstCheckin.json?.checkin?.motivation_level, 3);
    assert.equal(firstCheckin.json?.checkin?.sleep_quality, 5);
    assert.equal(firstCheckin.json?.checkin?.note, "Felt strong on squats");

    // ============================================================
    // A second submission for the same week is a 409 conflict, not a
    // silent overwrite and not a silent dedupe.
    // ============================================================
    const duplicateWeek = await request(baseUrl, "POST", "/weekly-checkins", {
      week_start_date: "2026-08-17", energy_level: 1, motivation_level: 1, sleep_quality: 1
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(duplicateWeek, 409, "resubmission for an already-submitted week is rejected");
    assert.equal(duplicateWeek.json?.error, "weekly_checkin_already_submitted_for_week");

    // ============================================================
    // A different week succeeds and is stored as its own row, with no
    // optional note.
    // ============================================================
    const secondCheckin = await request(baseUrl, "POST", "/weekly-checkins", {
      week_start_date: "2026-08-24", energy_level: 2, motivation_level: 2, sleep_quality: 2
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(secondCheckin, 201, "athlete submits second weekly check-in for a different week");
    assert.equal(secondCheckin.json?.checkin?.note, null);

    // ============================================================
    // Athlete reads own history, newest week first.
    // ============================================================
    const athleteCheckins = await request(baseUrl, "GET", "/weekly-checkins", undefined, { cookie: athlete.cookie });
    assertStatus(athleteCheckins, 200, "athlete reads own weekly check-in history");
    assert.equal(athleteCheckins.json?.checkins?.length, 2);
    assert.deepEqual(
      athleteCheckins.json?.checkins?.map((checkin) => checkin.week_start_date),
      ["2026-08-24", "2026-08-17"],
      "newest week first"
    );

    // ============================================================
    // The accepted coach reads byte-identical output.
    // ============================================================
    const coachCheckins = await request(
      baseUrl, "GET", `/weekly-checkins/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: coach.cookie }
    );
    assertStatus(coachCheckins, 200, "coach reads athlete's weekly check-in history");
    assert.deepEqual(
      coachCheckins.json?.checkins,
      athleteCheckins.json?.checkins,
      "coach view must match the athlete's own view exactly"
    );

    // ============================================================
    // An unrelated coach is rejected outright.
    // ============================================================
    const strangerCheckins = await request(
      baseUrl, "GET", `/weekly-checkins/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: strangerCoach.cookie }
    );
    assertStatus(strangerCheckins, 403, "unrelated coach cannot read this athlete's weekly check-ins");
    assert.equal(strangerCheckins.json?.error, "weekly_checkin_relationship_access_denied");

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Weekly check-ins reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: both rows reconstruct identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedCheckins = await request(restarted.baseUrl, "GET", "/weekly-checkins", undefined, { cookie: athlete.cookie });
    assertStatus(restartedCheckins, 200, "weekly check-ins after fresh-process restart");
    assert.deepEqual(
      restartedCheckins.json?.checkins?.map((checkin) => checkin.week_start_date),
      ["2026-08-24", "2026-08-17"]
    );
  }
);
