/* test/s1_phase1_closure_hardening_api.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";

function repoRoot() {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "..");
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function spawnProc(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...opts
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => {
    stdout += d.toString("utf8");
  });

  child.stderr.on("data", (d) => {
    stderr += d.toString("utf8");
  });

  return {
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

function spawnNode(args, opts = {}) {
  return spawnProc(process.execPath, args, opts);
}

function spawnNpm(args, opts = {}) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnProc(npmCmd, args, opts);
}

async function ensureBuiltServer(root, env) {
  const serverModulePath = path.join(root, "dist", "src", "server.js");

  if (!(await fileExists(serverModulePath))) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(
    await fileExists(serverModulePath),
    true,
    `expected built server module to exist: ${serverModulePath}`
  );

  return serverModulePath;
}

async function applySchema(root, env) {
  const schemaScript = path.join(root, "scripts", "apply-schema.mjs");
  const schema = spawnNode([schemaScript], { cwd: root, env });
  const code = await new Promise((resolve) => schema.child.on("close", resolve));

  if (code !== 0) {
    throw new Error(
      `apply-schema failed (code=${code}).\nstdout:\n${schema.stdout}\nstderr:\n${schema.stderr}`
    );
  }
}

async function importBuiltApp(root, env) {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousSmokeNoDb = process.env.SMOKE_NO_DB;

  process.env.DATABASE_URL = env.DATABASE_URL;
  delete process.env.SMOKE_NO_DB;

  try {
    const serverModulePath = await ensureBuiltServer(root, env);
    const serverModule = await import(pathToFileURL(serverModulePath).href);

    assert.ok(serverModule?.app, "expected built server module to export app");
    assert.equal(typeof serverModule.app.listen, "function", "expected built app.listen");

    return serverModule.app;
  } finally {
    if (typeof previousDatabaseUrl === "undefined") {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (typeof previousSmokeNoDb === "undefined") {
      delete process.env.SMOKE_NO_DB;
    } else {
      process.env.SMOKE_NO_DB = previousSmokeNoDb;
    }
  }
}

async function startInProcessServer(app) {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.equal(typeof port, "number", "expected in-process server port");

  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function stopInProcessServer(serverHandle) {
  if (!serverHandle?.server) return;

  await new Promise((resolve, reject) => {
    serverHandle.server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function httpJson(method, url, body) {
  const init = {
    method,
    headers: { "content-type": "application/json" }
  };

  if (typeof body !== "undefined") {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let json = null;
  try {
    json = text.length ? JSON.parse(text) : null;
  } catch {
    // keep raw text for assertions
  }

  return { res, text, json };
}

function makeValidPhase1Input() {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "powerlifting",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

function assertPhase1BadRequest(payload, label, expectedErrorPredicate) {
  assert.equal(payload.res.status, 400, `${label}: expected 400, got ${payload.res.status}. raw=${payload.text}`);
  assert.ok(payload.json && typeof payload.json === "object", `${label}: expected json object. raw=${payload.text}`);
  assert.equal(payload.json.ok, false, `${label}: expected ok=false. raw=${payload.text}`);
  assert.equal(payload.json.code, "BAD_REQUEST", `${label}: expected BAD_REQUEST code. raw=${payload.text}`);
  assert.equal(payload.json.error, "Phase 1 failed", `${label}: expected Phase 1 failed error. raw=${payload.text}`);
  assert.ok(payload.json.details && typeof payload.json.details === "object", `${label}: expected details object. raw=${payload.text}`);
  assert.equal(payload.json.details.failure_token, "type_mismatch", `${label}: expected type_mismatch token. raw=${payload.text}`);
  assert.ok(Array.isArray(payload.json.details.details), `${label}: expected AJV details array. raw=${payload.text}`);
  assert.ok(
    payload.json.details.details.some(expectedErrorPredicate),
    `${label}: expected matching AJV boundary error. got=${JSON.stringify(payload.json.details.details)}`
  );
}

test("S1 phase1 closure hardening: /blocks/compile rejects closed-world boundary violations before downstream processing", async (t) => {
  const root = repoRoot();
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  };
  delete env.SMOKE_NO_DB;

  await applySchema(root, env);
  const app = await importBuiltApp(root, env);
  const serverHandle = await startInProcessServer(app);

  t.after(async () => {
    await stopInProcessServer(serverHandle);
  });

  {
    const payload = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
      phase1_input: {
        ...makeValidPhase1Input(),
        unknown_top_level_field: "forbidden"
      }
    });

    assertPhase1BadRequest(
      payload,
      "unknown top-level field",
      (err) =>
        err &&
        err.keyword === "additionalProperties" &&
        err.params &&
        err.params.additionalProperty === "unknown_top_level_field"
    );
  }

  {
    const invalid = makeValidPhase1Input();
    delete invalid.activity_id;

    const payload = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
      phase1_input: invalid
    });

    assertPhase1BadRequest(
      payload,
      "missing required activity_id",
      (err) =>
        err &&
        err.keyword === "required" &&
        err.params &&
        err.params.missingProperty === "activity_id"
    );
  }

  {
    const payload = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
      phase1_input: {
        ...makeValidPhase1Input(),
        execution_scope: "org_managed"
      }
    });

    assertPhase1BadRequest(
      payload,
      "conditional missing governing_authority_id",
      (err) =>
        err &&
        err.keyword === "required" &&
        err.params &&
        err.params.missingProperty === "governing_authority_id"
    );
  }

  {
    const payload = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
      phase1_input: {
        ...makeValidPhase1Input(),
        constraints: {
          constraints_version: "1.0.0",
          unknown_nested_field: true
        }
      }
    });

    assertPhase1BadRequest(
      payload,
      "unknown nested constraints field",
      (err) =>
        err &&
        err.keyword === "additionalProperties" &&
        err.params &&
        err.params.additionalProperty === "unknown_nested_field"
    );
  }

  {
    const payload = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
      phase1_input: makeValidPhase1Input()
    });

    assert.ok(
      payload.res.status === 200 || payload.res.status === 201,
      `happy path: expected 200/201, got ${payload.res.status}. raw=${payload.text}`
    );
    assert.ok(payload.json && typeof payload.json === "object", `happy path: expected json object. raw=${payload.text}`);
    assert.equal(typeof payload.json.block_id, "string", `happy path: expected block_id string. raw=${payload.text}`);
    assert.equal(payload.json.engine_version, "EB2-1.0.0", `happy path: expected engine_version. raw=${payload.text}`);
    assert.equal(typeof payload.json.canonical_hash, "string", `happy path: expected canonical_hash string. raw=${payload.text}`);
    assert.ok(payload.json.planned_session && typeof payload.json.planned_session === "object", `happy path: expected planned_session object. raw=${payload.text}`);
    assert.ok(payload.json.runtime_trace && typeof payload.json.runtime_trace === "object", `happy path: expected runtime_trace object. raw=${payload.text}`);
  }
});
