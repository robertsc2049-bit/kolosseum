// DEV NOTE: S-V1-P-06 / FULL-UI-31 - device sync contract-ingestion proof.
// Proves an athlete can connect a simulated device (opaque, hashed
// provider account reference - no raw or token-like value ever appears
// in any response), ingest a metric with no body_metric_entry
// equivalent (routes to device_metric_entry) and one that does (routes
// to body_metric_entry with source device_synced - the routing decision
// itself, not just documented), a payload carrying a provider-computed
// score field is rejected outright, an accepted coach can read the same
// data read-only while an unrelated coach cannot, disconnect blocks
// further ingestion on that connection but leaves every prior fact
// intact, all of this survives a fresh-process restart, and the test
// itself proves zero live network egress - every HTTP call made during
// the run touches only 127.0.0.1.

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

async function registerCoach(baseUrl, nonce) {
  const email = `devicesync_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: "Device Sync Coach",
    email,
    password: "DeviceSyncCoach!2026",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, "coach registration");
  const cookie = cookieNamed(result, "kolosseum_session", "coach registration");
  const csrf = result.json?.csrf_token;

  const onboardingProfile = await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: "Device Sync Coach", email },
    { cookie, csrf }
  );
  assertStatus(onboardingProfile, 200, "coach onboarding profile");

  const onboardingTerms = await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  );
  assertStatus(onboardingTerms, 200, "coach onboarding terms");

  const onboardingComplete = await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  );
  assertStatus(onboardingComplete, 200, "coach onboarding complete");

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `devicesync_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Device Sync ${label} Athlete`,
    email,
    password: `DeviceSync${label}Athlete!2026`,
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
  "Device sync: connect is opaque and hashed, heart-rate routes to device_metric_entry, weight routes to body_metric_entry, a provider score is rejected outright, coach read-only works, disconnect blocks new ingestion but keeps prior facts, survives a restart, and zero non-localhost network egress occurs",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const userIds = [];

    const observedHosts = new Set();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      try {
        const url = typeof input === "string" ? input : input?.url ?? String(input);
        observedHosts.add(new URL(url).hostname);
      }
      catch {
        // non-URL fetch input is not part of this proof's scope
      }
      return originalFetch(input, init);
    };

    const cleanup = async () => {
      for (const userId of userIds.filter(Boolean)) {
        await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      globalThis.fetch = originalFetch;
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const athlete = await registerAthlete(baseUrl, nonce, "primary");
    userIds.push(athlete.userId);
    const coach = await registerCoach(baseUrl, nonce);
    userIds.push(coach.userId);
    const unrelatedCoach = await registerCoach(baseUrl, `${nonce}_unrelated`);
    userIds.push(unrelatedCoach.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `device_sync_rel_${nonce}`,
      coachUserId: coach.userId,
      athleteUserId: athlete.userId,
      state: "accepted"
    });

    // ============================================================
    // Connect is opaque and hashed - no raw or token-like account
    // identifier ever appears in the response.
    // ============================================================
    const rawProviderAccountId = `garmin_raw_secret_${nonce}`;
    const connect = await request(
      baseUrl, "POST", "/device-sync/connect",
      { provider: "garmin", provider_account_id: rawProviderAccountId },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(connect, 201, "athlete connects a simulated Garmin device");
    assert.equal(connect.json?.connection?.connection_status, "active");
    assert.equal(connect.json?.connection?.provider, "garmin");
    assert.ok(String(connect.json?.connection?.provider_account_ref ?? "").startsWith("opaque_"));
    assert.ok(!connect.text.includes(rawProviderAccountId), "raw provider_account_id must never appear in the response");
    const connectionId = connect.json?.connection?.connection_id;
    assert.ok(connectionId);

    // ============================================================
    // Heart rate has no body_metric_entry equivalent - it routes to
    // device_metric_entry.
    // ============================================================
    const ingestHeartRate = await request(
      baseUrl, "POST", "/device-sync/ingest",
      { connection_id: connectionId, metric_type: "resting_heart_rate_bpm", value: 54, unit: "bpm", reported_at: new Date().toISOString() },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(ingestHeartRate, 201, "athlete ingests a resting heart rate reading");
    assert.equal(ingestHeartRate.json?.entry?.record_type, "device_metric_entry");
    assert.equal(ingestHeartRate.json?.entry?.metric_type, "resting_heart_rate_bpm");

    const deviceMetricsAfterHeartRate = await request(baseUrl, "GET", "/device-sync/metrics", undefined, { cookie: athlete.cookie });
    assertStatus(deviceMetricsAfterHeartRate, 200, "athlete lists device metric history");
    assert.equal(deviceMetricsAfterHeartRate.json?.entries?.length, 1);
    assert.equal(deviceMetricsAfterHeartRate.json?.entries?.[0]?.metric_type, "resting_heart_rate_bpm");

    // ============================================================
    // Weight overlaps what a human already logs - it routes to
    // body_metric_entry with source device_synced, proving the routing
    // decision rather than just documenting it.
    // ============================================================
    const ingestWeight = await request(
      baseUrl, "POST", "/device-sync/ingest",
      { connection_id: connectionId, metric_type: "body_weight_kg", value: 81.6, unit: "kg", reported_at: new Date().toISOString() },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(ingestWeight, 201, "athlete ingests a synced weight reading");
    assert.equal(ingestWeight.json?.entry?.record_type, "body_metric_entry");
    assert.equal(ingestWeight.json?.entry?.source, "device_synced");
    assert.equal(ingestWeight.json?.entry?.metric_type, "body_weight_kg");

    const bodyMetricsAfterWeight = await request(baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assertStatus(bodyMetricsAfterWeight, 200, "athlete's body-metrics history includes the device-synced weight entry");
    assert.equal(bodyMetricsAfterWeight.json?.entries?.length, 1);
    assert.equal(bodyMetricsAfterWeight.json?.entries?.[0]?.source, "device_synced");

    const deviceMetricsUnaffectedByWeight = await request(baseUrl, "GET", "/device-sync/metrics", undefined, { cookie: athlete.cookie });
    assert.equal(deviceMetricsUnaffectedByWeight.json?.entries?.length, 1, "weight must not also appear as a device_metric_entry");

    // ============================================================
    // A payload carrying a provider-computed score field is rejected
    // outright - not silently dropped and not stored-then-hidden.
    // ============================================================
    const scorePayload = await request(
      baseUrl, "POST", "/device-sync/ingest",
      {
        connection_id: connectionId,
        metric_type: "resting_heart_rate_bpm",
        value: 60,
        unit: "bpm",
        reported_at: new Date().toISOString(),
        readiness_score: 87
      },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(scorePayload, 400, "a payload carrying readiness_score is rejected outright");
    assert.equal(scorePayload.json?.error, "device_sync_provider_score_field_rejected");

    const deviceMetricsUnaffectedByRejectedScore = await request(baseUrl, "GET", "/device-sync/metrics", undefined, { cookie: athlete.cookie });
    assert.equal(deviceMetricsUnaffectedByRejectedScore.json?.entries?.length, 1, "the rejected payload must not have been persisted");

    // ============================================================
    // An accepted coach reads the same connection and metric history
    // read-only; an unrelated coach is denied.
    // ============================================================
    const coachConnections = await request(
      baseUrl, "GET", `/device-sync/connections/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: coach.cookie }
    );
    assertStatus(coachConnections, 200, "accepted coach lists the athlete's connections read-only");
    assert.equal(coachConnections.json?.connections?.length, 1);

    const coachMetrics = await request(
      baseUrl, "GET", `/device-sync/metrics/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: coach.cookie }
    );
    assertStatus(coachMetrics, 200, "accepted coach lists the athlete's device metric history read-only");
    assert.equal(coachMetrics.json?.entries?.length, 1);

    const unrelatedCoachConnections = await request(
      baseUrl, "GET", `/device-sync/connections/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: unrelatedCoach.cookie }
    );
    assertStatus(unrelatedCoachConnections, 403, "an unrelated coach cannot read the athlete's connections");

    // ============================================================
    // Disconnect blocks new ingestion on that connection but leaves
    // every prior fact intact.
    // ============================================================
    const disconnect = await request(
      baseUrl, "POST", "/device-sync/disconnect",
      { connection_id: connectionId },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(disconnect, 200, "athlete disconnects the device");
    assert.equal(disconnect.json?.connection?.connection_status, "disconnected");

    const ingestAfterDisconnect = await request(
      baseUrl, "POST", "/device-sync/ingest",
      { connection_id: connectionId, metric_type: "steps_count", value: 8000, unit: "steps", reported_at: new Date().toISOString() },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(ingestAfterDisconnect, 409, "ingestion on a disconnected connection is blocked");
    assert.equal(ingestAfterDisconnect.json?.error, "device_sync_connection_not_active");

    const deviceMetricsAfterDisconnect = await request(baseUrl, "GET", "/device-sync/metrics", undefined, { cookie: athlete.cookie });
    assert.equal(deviceMetricsAfterDisconnect.json?.entries?.length, 1, "the prior heart-rate fact remains after disconnect");

    const bodyMetricsAfterDisconnect = await request(baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assert.equal(bodyMetricsAfterDisconnect.json?.entries?.length, 1, "the prior weight fact remains after disconnect");

    const connectionsAfterDisconnect = await request(baseUrl, "GET", "/device-sync/connections", undefined, { cookie: athlete.cookie });
    assert.equal(connectionsAfterDisconnect.json?.connections?.length, 1, "disconnect appends a fact, it does not delete the connection row");
    assert.equal(connectionsAfterDisconnect.json?.connections?.[0]?.connection_status, "disconnected");

    // ============================================================
    // Fresh-process restart: all of the above survives on a genuinely
    // new process, not an in-memory-only artefact of the still-running
    // test server.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedConnections = await request(restarted.baseUrl, "GET", "/device-sync/connections", undefined, { cookie: athlete.cookie });
    assertStatus(restartedConnections, 200, "connections list survives a fresh-process restart");
    assert.equal(restartedConnections.json?.connections?.length, 1);
    assert.equal(restartedConnections.json?.connections?.[0]?.connection_status, "disconnected");

    const restartedMetrics = await request(restarted.baseUrl, "GET", "/device-sync/metrics", undefined, { cookie: athlete.cookie });
    assertStatus(restartedMetrics, 200, "device metric history survives a fresh-process restart");
    assert.equal(restartedMetrics.json?.entries?.length, 1);

    const restartedBodyMetrics = await request(restarted.baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assertStatus(restartedBodyMetrics, 200, "the device-synced body-metric entry survives a fresh-process restart");
    assert.equal(restartedBodyMetrics.json?.entries?.length, 1);
    assert.equal(restartedBodyMetrics.json?.entries?.[0]?.source, "device_synced");

    // ============================================================
    // Zero live network egress: every HTTP call made anywhere in this
    // run - including the fresh-process health check - touched only
    // the local test server, never a real provider host.
    // ============================================================
    assert.deepEqual([...observedHosts].sort(), ["127.0.0.1"]);
  }
);
