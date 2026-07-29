// DEV NOTE: FULL-UI-03C persistent HTTP proof.
// Product actions cross authenticated HTTP routes. Direct database access is
// limited to proof inspection and cleanup.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
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
  if (child.exitCode !== null) return { code: child.exitCode, signal: child.signalCode ?? null };
  return await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal: signal ?? null }));
  });
}

async function waitForHealth(processRecord, baseUrl, timeoutMilliseconds = 20000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = null;

  while (Date.now() < deadline) {
    if (processRecord.child.exitCode !== null) {
      const exit = await waitForExit(processRecord.child);
      throw new Error([
        "Server exited before health became ready.",
        `exit_code=${String(exit.code)}`,
        `signal=${String(exit.signal)}`,
        "stdout:", processRecord.stdout || "<empty>",
        "stderr:", processRecord.stderr || "<empty>"
      ].join("\n"));
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

  throw new Error([
    "Server did not become healthy.",
    `base_url=${baseUrl}`,
    `last_error=${lastError?.message ?? String(lastError)}`,
    "stdout:", processRecord.stdout || "<empty>",
    "stderr:", processRecord.stderr || "<empty>"
  ].join("\n"));
}

async function startServer(root, environment) {
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

async function stopServer(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  if (process.platform === "win32") server.child.kill();
  else server.child.kill("SIGTERM");
  await Promise.race([waitForExit(server.child), delay(3000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([waitForExit(server.child), delay(2000)]);
  }
}

async function restartServer(server, root, environment) {
  await stopServer(server);
  return await startServer(root, environment);
}

async function requestJson(baseUrl, method, route, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    redirect: "manual",
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; }
  catch { /* raw text is retained for assertion output */ }
  return { response, text, json };
}

function assertStatus(result, expected, label) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected ${expected}, received ${result.response.status}. raw=${result.text}`
  );
}

function sessionCookie(result, label) {
  const values = typeof result.response.headers.getSetCookie === "function"
    ? result.response.headers.getSetCookie()
    : [result.response.headers.get("set-cookie")].filter(Boolean);
  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

async function withClient(databaseUrl, operation) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try { return await operation(client); }
  finally { await client.end(); }
}

async function cleanup(databaseUrl, userId) {
  if (!userId) return;
  await withClient(databaseUrl, async (client) => {
    await client.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM beta_product_records WHERE subject_user_id = $1", [userId]);
    await client.query("DELETE FROM beta_accounts WHERE user_id = $1", [userId]);
  });
}

const accessibilityA = Object.freeze({
  reduced_motion: true,
  high_contrast: false,
  larger_text: false,
  screen_reader_optimised: true
});

const accessibilityB = Object.freeze({
  reduced_motion: false,
  high_contrast: true,
  larger_text: true,
  screen_reader_optimised: true
});

test(
  "FULL-UI-03C draft progression confirmation history and fresh-process reconstruction are persistent",
  { timeout: 180000 },
  async (testContext) => {
    const root = repoRoot();
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(
      typeof databaseUrl === "string" && databaseUrl.trim().length > 0,
      "FULL-UI-03C integration proof requires DATABASE_URL"
    );

    const environment = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };
    delete environment.SMOKE_NO_DB;

    const nonce = crypto.randomUUID().replaceAll("-", "");
    const email = `onboarding-${nonce}@example.test`;
    const password = "Onboarding-proof-2026";
    let userId = "";
    let server = await startServer(root, environment);

    testContext.after(async () => {
      await stopServer(server);
      await cleanup(databaseUrl, userId);
    });

    const registration = await requestJson(server.baseUrl, "POST", "/account/register", {
      body: {
        actor_type: "athlete",
        display_name: "Onboarding Proof Athlete",
        email,
        password,
        activity_id: "powerlifting",
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version: "terms_v1",
        accepted_consent_version: "consent_v1"
      }
    });
    assertStatus(registration, 201, "register athlete");
    userId = registration.json?.account?.user_id ?? "";
    assert.ok(userId);
    let cookie = sessionCookie(registration, "register athlete");
    let csrf = registration.json?.csrf_token;
    assert.ok(csrf);

    const initial = await requestJson(server.baseUrl, "GET", "/account/onboarding/", { cookie });
    assertStatus(initial, 200, "initial onboarding");
    assert.equal(initial.json.onboarding_status, "incomplete");
    assert.equal(initial.json.current_stage, "activity");
    assert.equal(initial.json.saved_draft_state, false);
    assert.equal(initial.json.current_effective_declaration, null);

    const inferenceFailure = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "activity",
        fields: { readiness: "ready" }
      }
    });
    assertStatus(inferenceFailure, 422, "reject inference field");
    assert.equal(inferenceFailure.json.error, "athlete_onboarding_inference_field_prohibited");

    const activity = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "execution_scope",
        fields: { activity_id: "general_strength" }
      }
    });
    assertStatus(activity, 200, "save activity");
    assert.equal(activity.json.saved_draft_state, true);
    assert.equal(activity.json.current_stage, "execution_scope");

    const execution = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "product_acknowledgement",
        fields: {
          activity_id: "general_strength",
          execution_scope: "coach_managed"
        }
      }
    });
    assertStatus(execution, 200, "save execution scope");

    const backwards = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "activity",
        fields: {
          activity_id: "general_strength",
          execution_scope: "coach_managed"
        }
      }
    });
    assertStatus(backwards, 200, "move backwards");
    assert.equal(backwards.json.current_stage, "activity");
    assert.equal(backwards.json.draft.fields.execution_scope, "coach_managed");

    const product = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "jurisdiction",
        fields: {
          activity_id: "general_strength",
          execution_scope: "coach_managed",
          product_acknowledged: true
        }
      }
    });
    assertStatus(product, 200, "save product acknowledgement");

    const jurisdiction = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "accessibility",
        fields: {
          ...product.json.draft.fields,
          jurisdiction_code: "scotland",
          jurisdiction_acknowledged: true
        }
      }
    });
    assertStatus(jurisdiction, 200, "save jurisdiction");

    const accessibility = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "instruction_density",
        fields: {
          ...jurisdiction.json.draft.fields,
          accessibility_preferences: accessibilityA
        }
      }
    });
    assertStatus(accessibility, 200, "save accessibility");

    const review = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "review",
        fields: {
          ...accessibility.json.draft.fields,
          instruction_density: "minimal"
        }
      }
    });
    assertStatus(review, 200, "save instruction density and open review");
    assert.equal(review.json.current_stage, "review");

    const invalidConfirmation = await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", {
      cookie,
      csrf,
      body: { review_confirmed: false }
    });
    assertStatus(invalidConfirmation, 422, "reject unconfirmed review");
    assert.ok(invalidConfirmation.json.field_errors.review_confirmed);

    const confirmation = await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", {
      cookie,
      csrf,
      body: { review_confirmed: true }
    });
    assertStatus(confirmation, 200, "confirm onboarding");
    assert.equal(confirmation.json.onboarding_status, "completed");
    assert.equal(confirmation.json.completion_persisted, true);
    assert.equal(confirmation.json.saved_draft_state, false);
    assert.equal(confirmation.json.current_effective_declaration.declaration_status, "current");
    assert.equal(confirmation.json.current_effective_declaration.fields.activity_id, "general_strength");
    assert.equal(confirmation.json.current_effective_declaration.fields.execution_scope, "coach_managed");
    assert.equal(confirmation.json.historical_declaration_count, 0);
    const originalDeclarationId = confirmation.json.current_effective_declaration.declaration_id;

    const postCompletionDraft = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", {
      cookie,
      csrf,
      body: {
        current_stage: "activity",
        fields: { activity_id: "powerlifting" }
      }
    });
    assertStatus(postCompletionDraft, 409, "reject declaration draft after completion");

    const unlawfulEdit = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/preferences", {
      cookie,
      csrf,
      body: {
        activity_id: "powerlifting",
        accessibility_preferences: accessibilityB,
        instruction_density: "detailed"
      }
    });
    assertStatus(unlawfulEdit, 422, "reject immutable field edit");
    assert.ok(unlawfulEdit.json.field_errors.activity_id);

    const preferenceUpdate = await requestJson(server.baseUrl, "PATCH", "/account/onboarding/preferences", {
      cookie,
      csrf,
      body: {
        accessibility_preferences: accessibilityB,
        instruction_density: "detailed"
      }
    });
    assertStatus(preferenceUpdate, 200, "update lawful preferences");
    assert.equal(preferenceUpdate.json.current_effective_declaration.declaration_version, 2);
    assert.notEqual(preferenceUpdate.json.current_effective_declaration.declaration_id, originalDeclarationId);
    assert.equal(preferenceUpdate.json.current_effective_declaration.fields.activity_id, "general_strength");
    assert.equal(preferenceUpdate.json.current_effective_declaration.fields.execution_scope, "coach_managed");
    assert.deepEqual(preferenceUpdate.json.current_effective_declaration.fields.accessibility_preferences, accessibilityB);
    assert.equal(preferenceUpdate.json.historical_declaration_count, 1);
    assert.equal(preferenceUpdate.json.historical_declarations[0].declaration_id, originalDeclarationId);
    assert.equal(preferenceUpdate.json.historical_declarations[0].declaration_status, "superseded");
    assert.equal(preferenceUpdate.json.historical_declarations[0].immutable, true);

    const databaseProof = await withClient(databaseUrl, async (client) => {
      return await client.query(
        `
        SELECT event_type, event_payload
        FROM product_account_events
        WHERE
          user_id = $1
          AND event_type IN (
            'athlete_onboarding_draft_saved',
            'athlete_declaration_confirmed'
          )
        ORDER BY occurred_at ASC, event_id ASC
        `,
        [userId]
      );
    });
    assert.ok(databaseProof.rows.filter((row) => row.event_type === "athlete_onboarding_draft_saved").length >= 7);
    assert.equal(databaseProof.rows.filter((row) => row.event_type === "athlete_declaration_confirmed").length, 2);

    server = await restartServer(server, root, environment);

    const reconstructed = await requestJson(server.baseUrl, "GET", "/account/onboarding/", { cookie });
    assertStatus(reconstructed, 200, "fresh-process reconstruction");
    assert.equal(reconstructed.json.onboarding_status, "completed");
    assert.equal(reconstructed.json.current_effective_declaration.declaration_version, 2);
    assert.equal(reconstructed.json.historical_declarations[0].declaration_id, originalDeclarationId);

    const signOut = await requestJson(server.baseUrl, "POST", "/account/sign-out", {
      cookie,
      csrf,
      body: {}
    });
    assertStatus(signOut, 204, "sign out");

    const signIn = await requestJson(server.baseUrl, "POST", "/account/sign-in", {
      body: { email, password }
    });
    assertStatus(signIn, 200, "sign in after restart");
    cookie = sessionCookie(signIn, "sign in after restart");
    csrf = signIn.json.csrf_token;

    const signedInReconstruction = await requestJson(server.baseUrl, "GET", "/account/onboarding/", { cookie });
    assertStatus(signedInReconstruction, 200, "sign-in reconstruction");
    assert.equal(signedInReconstruction.json.current_effective_declaration.declaration_version, 2);
    assert.equal(signedInReconstruction.json.historical_declaration_count, 1);
    assert.deepEqual(signedInReconstruction.json.inference_boundary, {
      ability_inferred: false,
      safety_inferred: false,
      readiness_inferred: false,
      suitability_inferred: false
    });
  }
);
