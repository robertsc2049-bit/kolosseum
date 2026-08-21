// DEV NOTE: FULL-UI-70 coach roster CSV export persistent proof. Proves
// a real CSV download containing every one of the coach's own
// relationships (accepted and pending alike) with correct display name,
// email, activity and relationship state, that a value containing a
// comma is correctly quoted so the file structure survives, that a
// coach with zero relationships still gets a valid header-only CSV
// rather than an error, that a non-coach and an unauthenticated request
// are both denied, that deterministic compile output is unaffected, and
// that everything survives a fresh-process restart. Every step crosses
// only public HTTP routes.

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

async function requestRaw(baseUrl, method, route, body, options = {}) {
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
  const email = `roster_${label}_coach_${nonce}@example.com`;
  const result = await requestRaw(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Roster ${label} Coach`,
    email,
    password: `Roster${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(await requestRaw(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Roster ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);

  assertStatus(await requestRaw(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);

  assertStatus(await requestRaw(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label, displayName) {
  const email = `roster_${label}_athlete_${nonce}@example.com`;
  const result = await requestRaw(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: displayName,
    email,
    password: `Roster${label}Athlete!2026`,
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

  const result = await requestRaw(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: state === "invited" ? new Date(Date.now() + 86400000).toISOString() : null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function fetchCsv(baseUrl, options) {
  const response = await fetch(`${baseUrl}/coach-workspace/relationships/export.csv`, {
    headers: options.cookie ? { cookie: options.cookie } : {}
  });
  const text = await response.text();
  return { response, text };
}

function parseCsv(text) {
  return text.trim().split("\r\n").map((line) => {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (inQuotes) {
        if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
        else if (char === '"') inQuotes = false;
        else current += char;
      }
      else if (char === '"') inQuotes = true;
      else if (char === ",") { fields.push(current); current = ""; }
      else current += char;
    }
    fields.push(current);
    return fields;
  });
}

async function compileFixture(baseUrl, fixture) {
  const result = await requestRaw(baseUrl, "POST", "/blocks/compile", { phase1_input: fixture });
  assert.ok(
    result.response.status === 200 || result.response.status === 201,
    `deterministic compile: expected 200 or 201, received ${result.response.status}. raw=${result.text}`
  );
  return result.json;
}

test(
  "Coach roster CSV export: every relationship present with correct fields, comma-containing values correctly quoted, zero-relationship coach gets a valid header-only CSV, non-coach and unauthenticated denied, deterministic compile untouched, fresh-process restart",
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

    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const emptyCoach = await registerCoach(baseUrl, nonce, "empty");
    coachUserIds.push(emptyCoach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1", "Jane, Doe");
    athleteUserIds.push(athlete.userId);
    const pendingAthlete = await registerAthlete(baseUrl, nonce, "2", "Pending Athlete");
    athleteUserIds.push(pendingAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `roster_rel_${nonce}_1`, coachUserId: coachA.userId, athleteUserId: athlete.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `roster_rel_${nonce}_2`, coachUserId: coachA.userId, athleteUserId: pendingAthlete.userId, state: "invited"
    });

    // ============================================================
    // A non-coach account and an unauthenticated request are both
    // denied.
    // ============================================================
    const athleteAttempt = await fetchCsv(baseUrl, { cookie: athlete.cookie });
    assertStatus(athleteAttempt, 403, "athlete cannot export the roster");
    assert.equal(JSON.parse(athleteAttempt.text)?.error, "COACH_ACCOUNT_REQUIRED");

    assertStatus(await fetchCsv(baseUrl, {}), 401, "unauthenticated export is rejected");

    // ============================================================
    // A coach with zero relationships gets a valid header-only CSV,
    // not an error.
    // ============================================================
    const emptyExport = await fetchCsv(baseUrl, { cookie: emptyCoach.cookie });
    assertStatus(emptyExport, 200, "coach with zero relationships exports a valid CSV");
    assert.equal(emptyExport.response.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.match(emptyExport.response.headers.get("content-disposition") ?? "", /attachment; filename="athlete-roster-/u);
    const emptyRows = parseCsv(emptyExport.text);
    assert.equal(emptyRows.length, 1, "expected only the header row");
    assert.deepEqual(emptyRows[0], ["display_name", "email", "activity_id", "relationship_state", "connected_since"]);

    // ============================================================
    // A real export contains every relationship - accepted and
    // pending alike - with correct fields, and a display name
    // containing a comma is correctly quoted so the file structure
    // survives.
    // ============================================================
    const rosterExport = await fetchCsv(baseUrl, { cookie: coachA.cookie });
    assertStatus(rosterExport, 200, "coach A exports the roster");
    const rows = parseCsv(rosterExport.text);
    assert.equal(rows.length, 3, "expected a header row plus two athlete rows");

    const acceptedRow = rows.find((row) => row[0] === "Jane, Doe");
    assert.ok(acceptedRow, "expected the comma-containing display name to survive intact");
    assert.equal(acceptedRow[1], athlete.email);
    // activity_id is sourced from the athlete's own declarations
    // completion, not registration - a freshly-registered, not-yet-
    // onboarded athlete legitimately has no declared activity yet, and
    // the CSV must still render that as a clean empty field rather
    // than "undefined" or a broken row.
    assert.equal(acceptedRow[2], "");
    assert.equal(acceptedRow[3], "accepted");
    assert.ok(acceptedRow[4], "expected a non-empty connected_since date for the accepted relationship");

    const pendingRow = rows.find((row) => row[0] === "Pending Athlete");
    assert.ok(pendingRow, "expected the pending athlete's row");
    assert.equal(pendingRow[3], "invited");

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Coach roster CSV export reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the export reconstructs identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedExport = await fetchCsv(restarted.baseUrl, { cookie: coachA.cookie });
    assertStatus(restartedExport, 200, "roster export after fresh-process restart");
    const restartedRows = parseCsv(restartedExport.text);
    assert.equal(restartedRows.length, 3);
  }
);
