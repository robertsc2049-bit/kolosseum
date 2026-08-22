// DEV NOTE: FULL-UI-66 coach broadcast messaging persistent proof. Proves
// one broadcast call fans out into every currently-accepted athlete's own
// thread (readable back through their normal thread route), that a
// pending (not yet accepted) athlete and an unrelated athlete never
// receive it, that empty/over-length body_text is rejected before any
// send, that a coach with zero accepted athletes gets a clean
// zero-recipient result rather than an error, that a non-coach account is
// denied, that deterministic compile output is unaffected, and that the
// broadcast messages survive a fresh-process restart. Every step crosses
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
  const email = `broadcast_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Broadcast ${label} Coach`,
    email,
    password: `Broadcast${label}Coach!2026`,
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
    { display_name: `Broadcast ${label} Coach`, email },
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
  const email = `broadcast_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Broadcast ${label} Athlete`,
    email,
    password: `Broadcast${label}Athlete!2026`,
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
    expires_at_iso8601: state === "invited" ? new Date(Date.now() + 86400000).toISOString() : null
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
  "Coach broadcast messaging: fans out to every accepted athlete, excludes pending/unrelated athletes, validation rejections, zero-recipient result, non-coach denied, deterministic compile untouched, fresh-process restart",
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
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[]) OR thread_id IN (
             SELECT thread_id FROM product_message_threads
             WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])
           )`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
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
    const emptyCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(emptyCoach.userId);

    const acceptedAthlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(acceptedAthlete1.userId);
    const acceptedAthlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(acceptedAthlete2.userId);
    const pendingAthlete = await registerAthlete(baseUrl, nonce, "3");
    athleteUserIds.push(pendingAthlete.userId);
    const unrelatedAthlete = await registerAthlete(baseUrl, nonce, "4");
    athleteUserIds.push(unrelatedAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `broadcast_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: acceptedAthlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `broadcast_rel_${nonce}_2`, coachUserId: coach.userId, athleteUserId: acceptedAthlete2.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `broadcast_rel_${nonce}_3`, coachUserId: coach.userId, athleteUserId: pendingAthlete.userId, state: "invited"
    });

    // ============================================================
    // Validation: empty and over-length body_text are both rejected
    // before any send is attempted.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/messages/coach/broadcast", { body_text: "   " }, { cookie: coach.cookie, csrf: coach.csrf }),
      400,
      "empty body_text is rejected"
    );
    assertStatus(
      await request(baseUrl, "POST", "/messages/coach/broadcast", { body_text: "x".repeat(4001) }, { cookie: coach.cookie, csrf: coach.csrf }),
      400,
      "an over-length body_text is rejected"
    );

    // ============================================================
    // A non-coach account is denied.
    // ============================================================
    const athleteAttempt = await request(
      baseUrl, "POST", "/messages/coach/broadcast", { body_text: "Hello" }, { cookie: acceptedAthlete1.cookie, csrf: acceptedAthlete1.csrf }
    );
    assertStatus(athleteAttempt, 403, "athlete cannot call the coach broadcast route");
    assert.equal(athleteAttempt.json?.error, "COACH_ACCOUNT_REQUIRED");

    // ============================================================
    // An unauthenticated request is rejected outright.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/messages/coach/broadcast", { body_text: "Hello" }, {}),
      401,
      "unauthenticated request is rejected"
    );

    // ============================================================
    // A coach with zero accepted athletes gets a clean zero-recipient
    // result, not an error.
    // ============================================================
    const emptyBroadcast = await request(
      baseUrl, "POST", "/messages/coach/broadcast", { body_text: "Anyone out there?" }, { cookie: emptyCoach.cookie, csrf: emptyCoach.csrf }
    );
    assertStatus(emptyBroadcast, 201, "coach with zero accepted athletes broadcasts");
    assert.equal(emptyBroadcast.json?.sent_count, 0);
    assert.deepEqual(emptyBroadcast.json?.athlete_user_ids, []);

    // ============================================================
    // A real broadcast fans out into every currently-accepted athlete's
    // own thread, and only those athletes.
    // ============================================================
    const broadcastText = "Team update: Saturday's session moves to 9am.";
    const broadcast = await request(
      baseUrl, "POST", "/messages/coach/broadcast", { body_text: broadcastText }, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(broadcast, 201, "coach broadcasts to accepted athletes");
    assert.equal(broadcast.json?.sent_count, 2);
    assert.deepEqual(
      [...broadcast.json?.athlete_user_ids].sort(),
      [acceptedAthlete1.userId, acceptedAthlete2.userId].sort()
    );

    const resultFor = (athleteUserId) =>
      broadcast.json?.results?.find((entry) => entry.athlete_user_id === athleteUserId);

    const broadcastId = broadcast.json?.broadcast_id;
    assert.ok(broadcastId, "expected a broadcast_id");

    // ============================================================
    // Read status starts at zero - neither accepted athlete has
    // opened their thread yet.
    // ============================================================
    const readStatusBeforeRead = await request(
      baseUrl, "GET", `/messages/coach/broadcasts/${encodeURIComponent(broadcastId)}/read-status`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(readStatusBeforeRead, 200, "coach reads broadcast read-status before either athlete has opened it");
    assert.equal(readStatusBeforeRead.json?.sent_count, 2);
    assert.equal(readStatusBeforeRead.json?.read_count, 0, "neither athlete has opened their thread yet");
    assert.deepEqual(
      [...readStatusBeforeRead.json?.athletes ?? []].map((entry) => entry.athlete_user_id).sort(),
      [acceptedAthlete1.userId, acceptedAthlete2.userId].sort(),
      "read-status only ever lists the athletes this broadcast actually reached"
    );
    assert.ok(
      readStatusBeforeRead.json?.athletes?.every((entry) => entry.read === false && entry.read_at_iso8601 === null),
      "every athlete should start unread"
    );

    // ============================================================
    // Each accepted athlete reads the broadcast message back through
    // their own normal thread route - the exact same read path a
    // 1:1 message would use. Opening the thread is what marks it read.
    // ============================================================
    for (const athlete of [acceptedAthlete1, acceptedAthlete2]) {
      const threadId = resultFor(athlete.userId)?.thread_id;
      assert.ok(threadId, `expected a thread_id for ${athlete.userId}`);

      const threadMessages = await request(
        baseUrl, "GET", `/messages/athlete/threads/${encodeURIComponent(threadId)}`, undefined, { cookie: athlete.cookie }
      );
      assertStatus(threadMessages, 200, `${athlete.userId} reads their own thread`);
      assert.ok(
        threadMessages.json?.messages?.some((message) => message.body_text === broadcastText),
        `expected the broadcast text in ${athlete.userId}'s thread`
      );
    }

    // ============================================================
    // Now that both accepted athletes have opened their thread, the
    // same broadcast_id shows both as read - re-derived live, not a
    // stored counter that could drift.
    // ============================================================
    const readStatusAfterRead = await request(
      baseUrl, "GET", `/messages/coach/broadcasts/${encodeURIComponent(broadcastId)}/read-status`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(readStatusAfterRead, 200, "coach reads broadcast read-status after both athletes opened it");
    assert.equal(readStatusAfterRead.json?.read_count, 2, "both athletes should now show as read");
    assert.ok(
      readStatusAfterRead.json?.athletes?.every((entry) => entry.read === true && typeof entry.read_at_iso8601 === "string"),
      "every athlete should now be read, with a real read_at_iso8601"
    );

    // ============================================================
    // A coach who never sent this broadcast (or a stranger id) gets a
    // quiet empty result, never an error - the same "structural
    // non-match" posture used throughout this codebase.
    // ============================================================
    const strangerReadStatus = await request(
      baseUrl, "GET", `/messages/coach/broadcasts/${encodeURIComponent(broadcastId)}/read-status`, undefined,
      { cookie: emptyCoach.cookie }
    );
    assertStatus(strangerReadStatus, 200, "an unrelated coach's read-status call for this broadcast still succeeds");
    assert.equal(strangerReadStatus.json?.sent_count, 0, "an unrelated coach sees zero rows for a broadcast that isn't theirs");

    // ============================================================
    // The pending (not yet accepted) athlete and a completely
    // unrelated athlete never receive the broadcast - no thread is
    // created for them at all.
    // ============================================================
    for (const athlete of [pendingAthlete, unrelatedAthlete]) {
      const threads = await request(baseUrl, "GET", "/messages/athlete/threads", undefined, { cookie: athlete.cookie });
      assertStatus(threads, 200, `${athlete.userId} reads own (empty) thread list`);
      assert.equal(
        threads.json?.threads?.some((thread) => thread.coach_user_id === coach.userId),
        false,
        `expected no thread with the broadcasting coach for ${athlete.userId}`
      );
    }

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Coach broadcast messaging reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the broadcast messages reconstruct
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedThreadId = resultFor(acceptedAthlete1.userId)?.thread_id;
    const restartedMessages = await request(
      restarted.baseUrl, "GET", `/messages/athlete/threads/${encodeURIComponent(restartedThreadId)}`, undefined, { cookie: acceptedAthlete1.cookie }
    );
    assertStatus(restartedMessages, 200, "broadcast thread after fresh-process restart");
    assert.ok(restartedMessages.json?.messages?.some((message) => message.body_text === broadcastText));

    const restartedReadStatus = await request(
      restarted.baseUrl, "GET", `/messages/coach/broadcasts/${encodeURIComponent(broadcastId)}/read-status`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(restartedReadStatus, 200, "broadcast read-status after fresh-process restart");
    assert.equal(restartedReadStatus.json?.read_count, 2, "the already-read state survives a fresh-process restart, reconstructed from Postgres");
  }
);
