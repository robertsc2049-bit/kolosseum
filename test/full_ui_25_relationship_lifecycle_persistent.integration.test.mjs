// DEV NOTE: FULL-UI-25 relationship lifecycle closure proof.
// Proves the coach-athlete relationship lifecycle functions that were
// mis-tracked as partial/missing in product/ui/function_manifest.json are
// either already real (revoke, cancel, expiry, audit - reusing the exact
// public routes the real UI calls) or newly real (athlete decline, athlete-
// initiated end-relationship, FULL-UI-25), and that closed relationships are
// never deleted - only ever appended to - and remain visible through the
// same lawful routes. Every step crosses only public HTTP routes.

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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

// --- Fresh-process restart plumbing (mirrors FULL-UI-23/24's HTTP restart gate). ---

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

test(
  "FULL-UI-25 proves the coach-athlete relationship lifecycle: revoke, cancel, expiry, audit, athlete decline, athlete-initiated end, preserved history, coach notifications and fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

    const evidence = {
      schema_version: "kolosseum.full_ui_25.relationship_lifecycle.v1.0.0",
      slice_id: "FULL-UI-25",
      recorded_at_iso8601: new Date().toISOString(),
      nonce,
      steps: []
    };

    function record(id, label, ok, detail) {
      evidence.steps.push({ id, label, result: ok ? "PASS" : "FAIL", detail: detail ?? null });
      assert.ok(ok, `${id}: ${label}`);
    }

    let server = null;
    let restarted = null;
    const userIds = [];

    const cleanup = async () => {
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
        [userIds.filter(Boolean)]
      );
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
      await pool.end();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const firstProcessId = server.child?.pid ?? process.pid;

    async function registerCoach(label) {
      const email = `full_ui_25_${label}_${nonce}@example.com`;
      const registration = await request(baseUrl, "POST", "/account/register", {
        actor_type: "coach",
        display_name: `Full-UI-25 ${label}`,
        email,
        password: "FullUi25CoachLifecycle!2026",
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version: "terms_v1",
        accepted_consent_version: "consent_v1"
      });
      assertStatus(registration, 201, `${label} coach registration`);
      const userId = registration.json?.account?.user_id ?? "";
      userIds.push(userId);
      return {
        userId,
        email,
        cookie: sessionCookie(registration, `${label} coach registration`),
        csrf: registration.json?.csrf_token
      };
    }

    async function registerAthlete(label) {
      const email = `full_ui_25_${label}_${nonce}@example.com`;
      const password = "FullUi25AthleteLifecycle!2026";
      const registration = await request(baseUrl, "POST", "/account/register", {
        actor_type: "athlete",
        display_name: `Full-UI-25 ${label}`,
        email,
        password,
        activity_id: "powerlifting",
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version: "terms_v1",
        accepted_consent_version: "consent_v1"
      });
      assertStatus(registration, 201, `${label} athlete registration`);
      const userId = registration.json?.account?.user_id ?? "";
      userIds.push(userId);
      return {
        userId,
        email,
        password,
        cookie: sessionCookie(registration, `${label} athlete registration`)
      };
    }

    const coach = await registerCoach("coach");
    const athleteDeclines = await registerAthlete("athlete_declines");
    const athleteEnds = await registerAthlete("athlete_ends");
    const athleteRevoked = await registerAthlete("athlete_revoked");

    // ============================================================
    // relationship_invite_create + relationship_lists: coach invites
    // three athletes by email (the real, lawful, non-opaque-ID route).
    // ============================================================
    async function inviteByEmail(athleteEmail) {
      const result = await request(baseUrl, "POST", "/coach-workspace/relationship-invitations", {
        athlete_email: athleteEmail
      }, { cookie: coach.cookie, csrf: coach.csrf });
      assertStatus(result, 201, `invite ${athleteEmail}`);
      return result.json?.relationship;
    }

    const invitationDeclines = await inviteByEmail(athleteDeclines.email);
    const invitationEnds = await inviteByEmail(athleteEnds.email);
    const invitationRevoked = await inviteByEmail(athleteRevoked.email);

    // ============================================================
    // relationship_decline: athlete declines - the symmetric
    // counterpart to accept, proven for the first time in this slice.
    // ============================================================
    async function pendingInvitationFor(athleteCookie) {
      const pending = await request(baseUrl, "GET", "/coach-workspace/relationship-invitations", undefined, {
        cookie: athleteCookie
      });
      assertStatus(pending, 200, "athlete pending invitations");
      return pending.json?.invitations?.find((entry) => entry.coach_user_id === coach.userId);
    }

    const athleteDeclinesSignIn = await request(baseUrl, "POST", "/account/sign-in", {
      email: athleteDeclines.email, password: athleteDeclines.password
    });
    assertStatus(athleteDeclinesSignIn, 200, "athlete_declines sign-in");
    const athleteDeclinesCookie = sessionCookie(athleteDeclinesSignIn, "athlete_declines sign-in");
    const athleteDeclinesCsrf = athleteDeclinesSignIn.json?.csrf_token;

    const pendingForDecline = await pendingInvitationFor(athleteDeclinesCookie);
    assert.ok(pendingForDecline, "expected a pending invitation to decline");

    const decline = await request(
      baseUrl, "POST",
      `/coach-workspace/relationship-invitations/${encodeURIComponent(pendingForDecline.relationship_id)}/decline`,
      {}, { cookie: athleteDeclinesCookie, csrf: athleteDeclinesCsrf }
    );
    assertStatus(decline, 201, "athlete declines invitation");
    assert.equal(decline.json?.relationship?.relationship_state, "declined");
    record(
      "relationship_decline",
      "Athlete declines a pending invitation",
      decline.json?.relationship?.relationship_state === "declined",
      { relationship_id: pendingForDecline.relationship_id }
    );

    // ============================================================
    // relationship_accept (already proven in FULL-UI-24) + setup for
    // athlete_relationship_revoke: athlete accepts, then ends it
    // themselves.
    // ============================================================
    const athleteEndsSignIn = await request(baseUrl, "POST", "/account/sign-in", {
      email: athleteEnds.email, password: athleteEnds.password
    });
    const athleteEndsCookie = sessionCookie(athleteEndsSignIn, "athlete_ends sign-in");
    const athleteEndsCsrf = athleteEndsSignIn.json?.csrf_token;

    const pendingForEnds = await pendingInvitationFor(athleteEndsCookie);
    const acceptEnds = await request(
      baseUrl, "POST",
      `/coach-workspace/relationship-invitations/${encodeURIComponent(pendingForEnds.relationship_id)}/accept`,
      {}, { cookie: athleteEndsCookie, csrf: athleteEndsCsrf }
    );
    assertStatus(acceptEnds, 201, "athlete_ends accepts invitation");

    const myRelationshipsBeforeEnd = await request(baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, {
      cookie: athleteEndsCookie
    });
    assertStatus(myRelationshipsBeforeEnd, 200, "athlete_ends own relationships before ending");
    assert.equal(myRelationshipsBeforeEnd.json?.relationships?.length, 1);
    assert.equal(myRelationshipsBeforeEnd.json?.relationships?.[0]?.relationship_state, "accepted");

    const endRelationship = await request(
      baseUrl, "POST",
      `/coach-workspace/relationships/${encodeURIComponent(pendingForEnds.relationship_id)}/end`,
      {}, { cookie: athleteEndsCookie, csrf: athleteEndsCsrf }
    );
    assertStatus(endRelationship, 200, "athlete ends relationship from their own profile");
    assert.equal(endRelationship.json?.relationship?.relationship_state, "revoked");

    const myRelationshipsAfterEnd = await request(baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, {
      cookie: athleteEndsCookie
    });
    assertStatus(myRelationshipsAfterEnd, 200, "athlete_ends own relationships after ending");
    assert.equal(myRelationshipsAfterEnd.json?.relationships?.[0]?.relationship_state, "revoked");
    record(
      "athlete_relationship_revoke",
      "Athlete ends an accepted relationship from their own profile",
      endRelationship.json?.relationship?.relationship_state === "revoked",
      { relationship_id: pendingForEnds.relationship_id }
    );
    record(
      "athlete_archive_inactive",
      "A relationship the athlete ended is preserved and visible as past history, not deleted",
      myRelationshipsAfterEnd.json?.relationships?.length === 1,
      { relationship_id: pendingForEnds.relationship_id }
    );

    // ============================================================
    // relationship_revoke + relationship_cancel: the coach's existing
    // "Revoke relationship" / "Cancel invitation" control - the same
    // real /sessions/beta-coach-relationship write the app.js UI uses.
    // ============================================================
    const athleteRevokedSignIn = await request(baseUrl, "POST", "/account/sign-in", {
      email: athleteRevoked.email, password: athleteRevoked.password
    });
    const athleteRevokedCookie = sessionCookie(athleteRevokedSignIn, "athlete_revoked sign-in");
    const athleteRevokedCsrf = athleteRevokedSignIn.json?.csrf_token;
    const pendingForRevoked = await pendingInvitationFor(athleteRevokedCookie);
    const acceptRevoked = await request(
      baseUrl, "POST",
      `/coach-workspace/relationship-invitations/${encodeURIComponent(pendingForRevoked.relationship_id)}/accept`,
      {}, { cookie: athleteRevokedCookie, csrf: athleteRevokedCsrf }
    );
    assertStatus(acceptRevoked, 201, "athlete_revoked accepts invitation");

    const revokeTimestamp = new Date().toISOString();
    const coachRevoke = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: pendingForRevoked.relationship_id,
      coach_user_id: coach.userId,
      athlete_user_id: athleteRevoked.userId,
      relationship_state: "revoked",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: acceptRevoked.json?.relationship?.accepted_at_iso8601 ?? null,
      created_at_iso8601: invitationRevoked.created_at_iso8601,
      updated_at_iso8601: revokeTimestamp,
      revoked_at_iso8601: revokeTimestamp,
      expires_at_iso8601: null
    });
    assertStatus(coachRevoke, 201, "coach revokes accepted relationship");
    record(
      "relationship_revoke",
      "Coach revokes an accepted relationship",
      coachRevoke.json?.relationship?.relationship_state === "revoked",
      { relationship_id: pendingForRevoked.relationship_id }
    );

    // Cancel a still-pending invitation (a fourth, disposable athlete) -
    // the same generic revoke transition applied while still "invited".
    const athleteCancelled = await registerAthlete("athlete_cancelled");
    const invitationCancelled = await inviteByEmail(athleteCancelled.email);
    const cancelTimestamp = new Date().toISOString();
    const coachCancel = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: invitationCancelled.relationship_id,
      coach_user_id: coach.userId,
      athlete_user_id: athleteCancelled.userId,
      relationship_state: "revoked",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: null,
      created_at_iso8601: invitationCancelled.created_at_iso8601,
      updated_at_iso8601: cancelTimestamp,
      revoked_at_iso8601: cancelTimestamp,
      expires_at_iso8601: null
    });
    assertStatus(coachCancel, 201, "coach cancels pending invitation");
    record(
      "relationship_cancel",
      "Coach cancels a pending invitation",
      coachCancel.json?.relationship?.relationship_state === "revoked",
      { relationship_id: invitationCancelled.relationship_id }
    );

    // ============================================================
    // relationship_expiry: an invitation past its own expiry date is
    // reported as expired, through the real coach-facing listing route.
    // ============================================================
    const athleteExpired = await registerAthlete("athlete_expired");
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    const expiryTimestamp = new Date().toISOString();
    const expiredInvite = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: `full_ui_25_expired_${nonce}`,
      coach_user_id: coach.userId,
      athlete_user_id: athleteExpired.userId,
      relationship_state: "invited",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: null,
      created_at_iso8601: expiryTimestamp,
      updated_at_iso8601: expiryTimestamp,
      revoked_at_iso8601: null,
      expires_at_iso8601: pastExpiry
    });
    assertStatus(expiredInvite, 201, "create an already-past-expiry invitation");

    const relationshipsList = await request(baseUrl, "GET", "/coach-workspace/relationships", undefined, {
      cookie: coach.cookie
    });
    assertStatus(relationshipsList, 200, "coach reviews relationship list");
    const expiredEntry = relationshipsList.json?.relationships?.find(
      (entry) => entry.athlete_user_id === athleteExpired.userId
    );
    assert.ok(expiredEntry, "expected the expired invitation in the coach's relationship list");
    assert.equal(expiredEntry.relationship_state, "expired");
    assert.equal(expiredEntry.relationship_expired, true);
    record(
      "relationship_expiry",
      "Coach sees an expired relationship as a distinct, correctly labelled state",
      expiredEntry.relationship_state === "expired",
      { athlete_user_id: athleteExpired.userId }
    );

    // ============================================================
    // relationship_audit + relationship_lists: the coach's relationship
    // list carries real audit facts (ids, timestamps, current state) for
    // every relationship, not just a name.
    // ============================================================
    const revokedEntry = relationshipsList.json?.relationships?.find(
      (entry) => entry.athlete_user_id === athleteRevoked.userId
    );
    assert.ok(revokedEntry, "expected the revoked relationship still listed");
    assert.equal(revokedEntry.relationship.relationship_id, pendingForRevoked.relationship_id);
    assert.ok(revokedEntry.relationship.revoked_at_iso8601, "expected an audit-facts revoked_at timestamp");
    assert.ok(revokedEntry.relationship.created_at_iso8601, "expected an audit-facts created_at timestamp");
    record(
      "relationship_audit",
      "Coach sees relationship detail and audit facts (ids and timestamps), not just a name",
      Boolean(revokedEntry.relationship.relationship_id && revokedEntry.relationship.revoked_at_iso8601),
      { relationship_id: revokedEntry.relationship.relationship_id }
    );

    // ============================================================
    // relationship_history_preserved: every athlete this coach ever
    // interacted with in this test - declined, ended, revoked, cancelled,
    // expired - remains visible in the same lawful listing route. Nothing
    // is deleted.
    // ============================================================
    const listedAthleteIds = new Set(relationshipsList.json?.relationships?.map((entry) => entry.athlete_user_id));
    const allExpectedAthletes = [
      athleteDeclines.userId,
      athleteEnds.userId,
      athleteRevoked.userId,
      athleteCancelled.userId,
      athleteExpired.userId
    ];
    const allPreserved = allExpectedAthletes.every((id) => listedAthleteIds.has(id));
    record(
      "relationship_history_preserved",
      "Every closed relationship (declined, ended, revoked, cancelled, expired) remains visible through the coach's relationship list - nothing is deleted",
      allPreserved,
      { preserved_count: allExpectedAthletes.filter((id) => listedAthleteIds.has(id)).length }
    );

    // ============================================================
    // relationship_invite_receive: the coach receives (is notified of)
    // the athlete's response to their invitation - both the accepted and
    // declined cases.
    // ============================================================
    const coachNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, {
      cookie: coach.cookie
    });
    assertStatus(coachNotifications, 200, "coach reads their own notifications");
    const notificationTypes = new Set(coachNotifications.json?.notifications?.map((entry) => entry.notification_type));
    record(
      "relationship_invite_receive",
      "Coach receives the athlete's response (accepted/declined) to an invitation",
      notificationTypes.has("relationship_accepted") && notificationTypes.has("relationship_declined"),
      { notification_types: [...notificationTypes] }
    );

    // ============================================================
    // Fresh-process restart: the same recovery a browser refresh after
    // a deploy/restart would trigger.
    // ============================================================
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(typeof databaseUrl === "string" && databaseUrl.trim().length > 0, "FULL-UI-25 restart gate requires DATABASE_URL");
    const environment = { ...process.env, DATABASE_URL: databaseUrl };
    delete environment.SMOKE_NO_DB;

    restarted = await startFreshServerProcess(root, environment);
    assert.notEqual(restarted.child.pid, firstProcessId, "restart must use a new operating-system process");

    const relationshipsAfterRestart = await request(restarted.baseUrl, "GET", "/coach-workspace/relationships", undefined, {
      cookie: coach.cookie
    });
    assertStatus(relationshipsAfterRestart, 200, "coach relationship list after restart");
    const listedAfterRestart = new Set(relationshipsAfterRestart.json?.relationships?.map((entry) => entry.athlete_user_id));
    const preservedAfterRestart = allExpectedAthletes.every((id) => listedAfterRestart.has(id));

    const myRelationshipsAfterRestart = await request(restarted.baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, {
      cookie: athleteEndsCookie
    });
    assertStatus(myRelationshipsAfterRestart, 200, "athlete's own relationship after restart");

    record(
      "restart_fresh_process_reconstruction",
      "A fresh operating-system process reconstructs the same relationship-lifecycle state",
      preservedAfterRestart && myRelationshipsAfterRestart.json?.relationships?.[0]?.relationship_state === "revoked",
      { first_pid: firstProcessId, restarted_pid: restarted.child.pid }
    );

    // --- Write the machine-readable evidence record. ---
    assert.ok(evidence.steps.every((entry) => entry.result === "PASS"), "every recorded step must be PASS before writing evidence");
    evidence.status = "PASS";
    evidence.coach_user_id = coach.userId;

    const evidencePath = path.join(root, "docs", "product", "FULL_UI_25_RELATIONSHIP_LIFECYCLE_EVIDENCE.json");
    await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    const writtenBack = JSON.parse(await fs.readFile(evidencePath, "utf8"));
    assert.equal(writtenBack.status, "PASS");
    assert.equal(writtenBack.steps.length, evidence.steps.length);
  }
);
