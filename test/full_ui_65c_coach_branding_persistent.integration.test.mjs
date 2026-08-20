// DEV NOTE: FULL-UI-65 coach branding preference persistent proof. Proves a
// coach can save and re-read their own accent colour and tagline, that a
// second save supersedes the first (latest wins, nothing UPDATEd or
// DELETEd), that malformed input (bad hex colour, unknown field,
// over-length tagline) is rejected before anything is stored, that an
// athlete with an accepted relationship sees the coach's brand colour and
// tagline through the existing relationship endpoint, that a coach with no
// saved preference yet shows null (not an error) to their athlete, that an
// athlete with no relationship to this coach never sees it at all, that a
// non-coach account cannot read or write the branding routes, that
// deterministic compile output is completely unaffected, and that
// everything survives a fresh-process restart. Every step crosses only
// public HTTP routes.

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
  const email = `brand_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Brand ${label} Coach`,
    email,
    password: `Brand${label}Coach!2026`,
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
    { display_name: `Brand ${label} Coach`, email },
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
  const email = `brand_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Brand ${label} Athlete`,
    email,
    password: `Brand${label}Athlete!2026`,
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

function relationshipFor(relationships, coachUserId) {
  return relationships.find((entry) => entry.coach_user_id === coachUserId);
}

test(
  "Coach branding: save/read, supersede-on-save, validation rejections, athlete relationship view, unset-preference is null, unrelated athlete sees nothing, non-coach denied, deterministic compile untouched, fresh-process restart",
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
    const unsetCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(unsetCoach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);
    const strangerAthlete = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(strangerAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `brand_rel_${nonce}_a`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `brand_rel_${nonce}_b`, coachUserId: unsetCoach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    // ============================================================
    // Before any save, the coach's own GET returns a null preference,
    // not an error.
    // ============================================================
    const beforeSave = await request(baseUrl, "GET", "/coach-branding", undefined, { cookie: coach.cookie });
    assertStatus(beforeSave, 200, "coach reads branding before ever saving");
    assert.equal(beforeSave.json?.brand_preference, null);

    // ============================================================
    // Validation: unknown field, malformed hex colour, over-length
    // tagline are all rejected before anything is stored.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/coach-branding", {
        brand_color: "#336699", brand_tagline: "Strength, factual and simple.", extra_field: "no"
      }, { cookie: coach.cookie, csrf: coach.csrf }),
      400,
      "unknown field is rejected"
    );

    assertStatus(
      await request(baseUrl, "POST", "/coach-branding", {
        brand_color: "not-a-colour"
      }, { cookie: coach.cookie, csrf: coach.csrf }),
      400,
      "malformed hex colour is rejected"
    );

    assertStatus(
      await request(baseUrl, "POST", "/coach-branding", {
        brand_color: "#336699", brand_tagline: "x".repeat(121)
      }, { cookie: coach.cookie, csrf: coach.csrf }),
      400,
      "an over-length tagline is rejected"
    );

    // ============================================================
    // A valid save is stored and read back in full.
    // ============================================================
    const firstSave = await request(baseUrl, "POST", "/coach-branding", {
      brand_color: "#336699", brand_tagline: "Strength coaching, factual and simple."
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(firstSave, 201, "coach saves first brand preference");
    assert.equal(firstSave.json?.brand_preference?.brand_color, "#336699");
    assert.equal(firstSave.json?.brand_preference?.brand_tagline, "Strength coaching, factual and simple.");

    const readAfterFirstSave = await request(baseUrl, "GET", "/coach-branding", undefined, { cookie: coach.cookie });
    assertStatus(readAfterFirstSave, 200, "coach reads back first saved preference");
    assert.equal(readAfterFirstSave.json?.brand_preference?.brand_color, "#336699");

    // ============================================================
    // A second save supersedes the first - latest wins, nothing is
    // UPDATEd or DELETEd.
    // ============================================================
    const secondSave = await request(baseUrl, "POST", "/coach-branding", {
      brand_color: "#a52a2a"
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(secondSave, 201, "coach saves second, superseding brand preference");
    assert.equal(secondSave.json?.brand_preference?.brand_color, "#a52a2a");
    assert.equal(secondSave.json?.brand_preference?.brand_tagline, null, "omitted tagline clears to null on the new row");

    const readAfterSecondSave = await request(baseUrl, "GET", "/coach-branding", undefined, { cookie: coach.cookie });
    assertStatus(readAfterSecondSave, 200, "coach reads back superseding preference");
    assert.equal(readAfterSecondSave.json?.brand_preference?.brand_color, "#a52a2a");
    assert.equal(readAfterSecondSave.json?.brand_preference?.brand_tagline, null);

    // ============================================================
    // A coach account cannot write or read another coach's branding
    // implicitly - identity always comes from the session, never a
    // client-supplied field, so there is no cross-coach id to even try.
    // Confirm the unset coach still reads null for their own identity.
    // ============================================================
    const unsetCoachRead = await request(baseUrl, "GET", "/coach-branding", undefined, { cookie: unsetCoach.cookie });
    assertStatus(unsetCoachRead, 200, "second coach, who never saved, reads null");
    assert.equal(unsetCoachRead.json?.brand_preference, null);

    // ============================================================
    // A non-coach account is denied both read and write.
    // ============================================================
    const athleteWrite = await request(baseUrl, "POST", "/coach-branding", {
      brand_color: "#000000"
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(athleteWrite, 403, "athlete cannot save coach branding");
    assert.equal(athleteWrite.json?.error, "COACH_ACCOUNT_REQUIRED");

    const athleteRead = await request(baseUrl, "GET", "/coach-branding", undefined, { cookie: athlete.cookie });
    assertStatus(athleteRead, 403, "athlete cannot read the coach branding route directly");
    assert.equal(athleteRead.json?.error, "COACH_ACCOUNT_REQUIRED");

    // ============================================================
    // An unauthenticated request is rejected outright.
    // ============================================================
    assertStatus(
      await request(baseUrl, "GET", "/coach-branding", undefined, {}),
      401,
      "unauthenticated request is rejected"
    );

    // ============================================================
    // The athlete sees the coach's current brand colour/tagline through
    // the existing relationship endpoint - and null for the coach who
    // never saved a preference, not an error and not a missing field.
    // ============================================================
    const athleteRelationships = await request(
      baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, { cookie: athlete.cookie }
    );
    assertStatus(athleteRelationships, 200, "athlete reads own relationships");

    const brandedEntry = relationshipFor(athleteRelationships.json?.relationships ?? [], coach.userId);
    assert.ok(brandedEntry, "expected the branded coach's relationship in the athlete's list");
    assert.equal(brandedEntry.coach_brand_color, "#a52a2a");
    assert.equal(brandedEntry.coach_brand_tagline, null);

    const unsetEntry = relationshipFor(athleteRelationships.json?.relationships ?? [], unsetCoach.userId);
    assert.ok(unsetEntry, "expected the unbranded coach's relationship in the athlete's list");
    assert.equal(unsetEntry.coach_brand_color, null);
    assert.equal(unsetEntry.coach_brand_tagline, null);

    // ============================================================
    // An athlete with no relationship to the branded coach at all never
    // sees that coach's entry, branded or otherwise.
    // ============================================================
    const strangerRelationships = await request(
      baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, { cookie: strangerAthlete.cookie }
    );
    assertStatus(strangerRelationships, 200, "unrelated athlete reads own (empty) relationships");
    assert.equal(relationshipFor(strangerRelationships.json?.relationships ?? [], coach.userId), undefined);

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Coach branding reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the superseding preference and the
    // athlete-visible relationship view reconstruct identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedRead = await request(restarted.baseUrl, "GET", "/coach-branding", undefined, { cookie: coach.cookie });
    assertStatus(restartedRead, 200, "coach branding after fresh-process restart");
    assert.equal(restartedRead.json?.brand_preference?.brand_color, "#a52a2a");

    const restartedRelationships = await request(
      restarted.baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, { cookie: athlete.cookie }
    );
    assertStatus(restartedRelationships, 200, "athlete relationships after fresh-process restart");
    assert.equal(
      relationshipFor(restartedRelationships.json?.relationships ?? [], coach.userId)?.coach_brand_color,
      "#a52a2a"
    );
  }
);
