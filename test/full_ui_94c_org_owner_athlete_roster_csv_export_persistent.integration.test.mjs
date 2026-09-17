// DEV NOTE: FULL-UI-94 org-owner athlete roster CSV export persistent
// proof. Coaches already had a CSV export of their own athlete roster
// (FULL-UI-70), but org owners - who have a full "athlete visibility"
// screen for their organisation's roster - had no way to download it.
// This reuses org_visibility_service.ts's own getOrgAthleteVisibility()
// exactly as the existing JSON route does, so the CSV's own shape
// necessarily varies by visibility_mode the same way the JSON payload
// already does.
// Proves: an individual-mode ("gym") org's CSV contains ONLY aggregate
// per-coach counts and NEVER any athlete_user_id/display_name/email
// anywhere in the raw CSV text (the actual privacy invariant under
// test); a shared-mode ("team") org's CSV lists one row per athlete with
// real identity, and a display name containing a comma survives
// CSV-quoting intact; an org with zero coaches still gets a valid
// header-only CSV; a different org owner is rejected; correct download
// headers; and everything survives a fresh-process restart. Every step
// crosses only public HTTP routes.

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
  const email = `csv_roster_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `CSV Roster ${label} Owner`,
    password: `CsvRoster${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `csv_roster_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `CSV Roster ${label} Coach`,
    email,
    password: `CsvRoster${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} coach registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerAthlete(baseUrl, nonce, label, displayName) {
  const email = `csv_roster_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: displayName,
    email,
    password: `CsvRoster${label}Athlete!2026`,
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
    displayName
  };
}

// Seeds a beta17_coach_relationship record directly, mirroring the same
// "connect athlete" test-seeding convention used by
// test/org_visibility_lifecycle_persistent.integration.test.mjs.
async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId, state }) {
  const now = new Date().toISOString();
  const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

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
    expires_at_iso8601: state === "invited" ? farFuture : null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

function parseCsvRows(csvText) {
  return csvText.replace(/\r\n$/u, "").split("\r\n").map((line) => {
    // A minimal CSV row splitter sufficient for these test fixtures - no
    // field here contains an escaped internal comma inside a quoted value
    // except the one deliberately tested by splitting on the quoted
    // segment first.
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === "\"") {
        if (inQuotes && line[i + 1] === "\"") { current += "\""; i += 1; }
        else inQuotes = !inQuotes;
      }
      else if (char === "," && !inQuotes) { cells.push(current); current = ""; }
      else current += char;
    }
    cells.push(current);
    return cells;
  });
}

test(
  "FULL-UI-94 org-owner athlete roster CSV export: individual-mode aggregate-only counts never leak athlete identity, shared-mode lists one row per athlete with quoting-safe commas, zero-coach org gets a valid header-only CSV, a different owner is rejected, correct download headers, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];

    const cleanup = async () => {
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query(
          "DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query(
          "DELETE FROM product_org_coach_memberships WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const userId of [...coachUserIds, ...athleteUserIds]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      const relationshipUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (relationshipUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [relationshipUserIds]
        ).catch(() => {});
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
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);

    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const coachC = await registerCoach(baseUrl, nonce, "c");
    coachUserIds.push(coachC.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1", "CSV Roster Athlete One");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2", "CSV Roster Athlete Two");
    athleteUserIds.push(athlete2.userId);
    const athleteComma = await registerAthlete(baseUrl, nonce, "comma", "Smith, Jordan");
    athleteUserIds.push(athleteComma.userId);

    // ============================================================
    // Individual-mode ("gym") org: coachA has 1 accepted + 1 invited
    // athlete. Only aggregate counts should ever leave this CSV.
    // ============================================================
    const individualOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "CSV Roster Individual Gym", activity_id: "powerlifting", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(individualOrg, 201, "create individual-mode org");
    const individualOrgId = individualOrg.json?.organisation?.org_id;

    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA to individual org");
    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `accept_${nonce}_a`);

    await seedRelationship(baseUrl, {
      relationshipId: `csv_roster_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `csv_roster_rel_${nonce}_a2`, coachUserId: coachA.userId, athleteUserId: athlete2.userId, state: "invited"
    });

    const individualDownload = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-visibility/export.csv`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(individualDownload, 200, "owner downloads the individual-mode roster CSV");
    assert.equal(individualDownload.response.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(individualDownload.response.headers.get("content-disposition"), 'attachment; filename="kolosseum-org-roster.csv"');

    const individualRows = parseCsvRows(individualDownload.text);
    assert.deepEqual(individualRows[0], ["coach_user_id", "coach_display_name", "membership_status", "active_athlete_count", "invited_athlete_count"]);
    const coachARow = individualRows.find((row) => row[0] === coachA.userId);
    assert.ok(coachARow, "expected coachA's aggregate row");
    assert.equal(coachARow[2], "active");
    assert.equal(coachARow[3], "1");
    assert.equal(coachARow[4], "1");

    // The actual privacy invariant: no athlete identity anywhere in the
    // raw CSV text for an individual-mode org.
    assert.equal(individualDownload.text.includes("athlete_user_id"), false);
    for (const athlete of [athlete1, athlete2, athleteComma]) {
      assert.equal(individualDownload.text.includes(athlete.userId), false, `must never mention ${athlete.userId}`);
      assert.equal(individualDownload.text.includes(athlete.email), false, `must never mention ${athlete.email}`);
      assert.equal(individualDownload.text.includes(athlete.displayName), false, `must never mention ${athlete.displayName}`);
    }

    // ============================================================
    // A different org owner cannot download this org's roster CSV.
    // ============================================================
    const otherOwnerAttempt = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-visibility/export.csv`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(otherOwnerAttempt, 403, "a different org owner cannot download this org's roster CSV");

    // ============================================================
    // Shared-mode ("team") org: coachC has 1 accepted athlete whose
    // display name contains a comma - proves csvEscapeField's quoting
    // keeps the CSV structurally valid.
    // ============================================================
    const sharedOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "CSV Roster Shared Team", activity_id: "powerlifting", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(sharedOrg, 201, "create shared-mode org");
    const sharedOrgId = sharedOrg.json?.organisation?.org_id;

    const inviteC = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachC.email, request_id: `invite_${nonce}_c` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteC, 201, "invite coachC to shared org");
    await acceptOrgInvite(baseUrl, coachC, inviteC.json?.membership?.membership_id, `accept_${nonce}_c`);

    await seedRelationship(baseUrl, {
      relationshipId: `csv_roster_rel_${nonce}_ccomma`, coachUserId: coachC.userId, athleteUserId: athleteComma.userId, state: "accepted"
    });

    const sharedDownload = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/athlete-visibility/export.csv`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(sharedDownload, 200, "owner downloads the shared-mode roster CSV");
    assert.equal(sharedDownload.response.headers.get("content-type"), "text/csv; charset=utf-8");

    const sharedRows = parseCsvRows(sharedDownload.text);
    assert.deepEqual(sharedRows[0], ["coach_user_id", "coach_display_name", "athlete_user_id", "display_name", "email", "relationship_state", "activity_id", "position"]);
    const athleteCommaRow = sharedRows.find((row) => row[2] === athleteComma.userId);
    assert.ok(athleteCommaRow, "expected the comma-named athlete's own row, correctly parsed as ONE row despite the internal comma");
    assert.equal(athleteCommaRow[3], "Smith, Jordan");
    assert.equal(athleteCommaRow[4], athleteComma.email);
    assert.equal(athleteCommaRow[5], "accepted");
    // The raw text itself must contain the quoted form, proving the
    // builder actually escaped it rather than relying on parseCsvRows'
    // own leniency to paper over an unescaped comma.
    assert.match(sharedDownload.text, /"Smith, Jordan"/u);

    // ============================================================
    // An org with zero coaches still gets a valid header-only CSV.
    // ============================================================
    const emptyOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "CSV Roster Empty Team", activity_id: "powerlifting", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(emptyOrg, 201, "create empty shared-mode org");
    const emptyOrgId = emptyOrg.json?.organisation?.org_id;

    const emptyDownload = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(emptyOrgId)}/athlete-visibility/export.csv`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(emptyDownload, 200, "owner downloads the empty org's roster CSV without error");
    const emptyRows = parseCsvRows(emptyDownload.text);
    assert.equal(emptyRows.length, 1, "expected only the header row");
    assert.deepEqual(emptyRows[0], ["coach_user_id", "coach_display_name", "athlete_user_id", "display_name", "email", "relationship_state", "activity_id", "position"]);

    // ============================================================
    // Fresh-process restart: both CSVs reconstruct identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedIndividual = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-visibility/export.csv`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedIndividual, 200, "individual-mode CSV after fresh-process restart");
    assert.equal(restartedIndividual.text.includes("athlete_user_id"), false);
    const restartedIndividualRows = parseCsvRows(restartedIndividual.text);
    const restartedCoachARow = restartedIndividualRows.find((row) => row[0] === coachA.userId);
    assert.equal(restartedCoachARow?.[3], "1");
    assert.equal(restartedCoachARow?.[4], "1");

    const restartedShared = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/athlete-visibility/export.csv`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedShared, 200, "shared-mode CSV after fresh-process restart");
    assert.match(restartedShared.text, /"Smith, Jordan"/u);
  }
);
