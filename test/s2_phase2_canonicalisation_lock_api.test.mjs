/* test/s2_phase2_canonicalisation_lock_api.test.mjs */
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

function makeAcceptedPhase1InputVariantA() {
  return {
    phase1_schema_version: "1.0.0",
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    consent_granted: true,
    activity_id: "powerlifting",
    actor_type: "athlete",
    execution_scope: "individual",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none",
    constraints: {
      constraints_version: "1.0.0",
      available_equipment: ["eq_barbell", "eq_dumbbell", "eq_bench", "eq_rack", "eq_plate"],
      banned_equipment: []
    }
  };
}

function makeAcceptedPhase1InputVariantB() {
  return {
    constraints: {
      banned_equipment: [],
      available_equipment: ["eq_plate", "eq_rack", "eq_bench", "eq_dumbbell", "eq_barbell"],
      constraints_version: "1.0.0"
    },
    bias_mode: "none",
    exposure_prompt_density: "standard",
    instruction_density: "standard",
    nd_mode: false,
    execution_scope: "individual",
    actor_type: "athlete",
    activity_id: "powerlifting",
    consent_granted: true,
    enum_bundle_version: "EB2-1.0.0",
    engine_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0"
  };
}

const EXPECTED_CANONICAL_HASH =
  "66fa742ab2fbf641eae14665e7ed35dfbfdef2646020e614d1e985ce8e8b0c58";

test("S2 phase2 canonicalisation lock: /blocks/compile deterministically replays canonical hash for accepted input", async (t) => {
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

  const first = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
    phase1_input: makeAcceptedPhase1InputVariantA()
  });
  const second = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
    phase1_input: makeAcceptedPhase1InputVariantA()
  });
  const reordered = await httpJson("POST", `${serverHandle.baseUrl}/blocks/compile`, {
    phase1_input: makeAcceptedPhase1InputVariantB()
  });

  for (const [label, payload] of [
    ["first", first],
    ["second", second],
    ["reordered", reordered]
  ]) {
    assert.ok(
      payload.res.status === 200 || payload.res.status === 201,
      `${label}: expected 200/201, got ${payload.res.status}. raw=${payload.text}`
    );
    assert.ok(payload.json && typeof payload.json === "object", `${label}: expected json object. raw=${payload.text}`);
    assert.equal(typeof payload.json.canonical_hash, "string", `${label}: expected canonical_hash string. raw=${payload.text}`);
    assert.equal(payload.json.engine_version, "EB2-1.0.0", `${label}: expected engine_version. raw=${payload.text}`);
  }

  assert.equal(
    first.json.canonical_hash,
    EXPECTED_CANONICAL_HASH,
    `first: canonical_hash must remain frozen for accepted representative input. raw=${first.text}`
  );
  assert.equal(
    second.json.canonical_hash,
    first.json.canonical_hash,
    `second: same accepted input must replay identical canonical_hash. first=${first.json.canonical_hash} second=${second.json.canonical_hash}`
  );
  assert.equal(
    reordered.json.canonical_hash,
    first.json.canonical_hash,
    `reordered: semantically identical accepted input must replay identical canonical_hash. first=${first.json.canonical_hash} reordered=${reordered.json.canonical_hash}`
  );
});



