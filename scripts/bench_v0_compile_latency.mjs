/* scripts/bench_v0_compile_latency.mjs */
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

function repoRoot() {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "..");
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
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

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

async function waitForHealth(baseUrl, { timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
      lastErr = new Error(`health not ok: ${res.status}`);
    } catch (err) {
      lastErr = err;
    }

    await delay(120);
  }

  throw new Error(
    `server did not become healthy in time (${timeoutMs}ms). last error: ${lastErr?.message ?? String(lastErr)}`
  );
}

async function httpJson(method, url, body) {
  const init = {
    method,
    headers: { "content-type": "application/json" }
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const startedAt = performance.now();
  const res = await fetch(url, init);
  const endedAt = performance.now();

  const text = await res.text();
  let json = null;

  try {
    json = text.length ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  return {
    res,
    text,
    json,
    durationMs: endedAt - startedAt
  };
}

async function ensureBuiltDist(root, env) {
  const serverModulePath = path.join(root, "dist", "src", "server.js");
  if (await fileExists(serverModulePath)) return serverModulePath;

  const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
  const code = await new Promise((resolve) => build.child.on("close", resolve));

  if (code !== 0) {
    throw new Error(
      `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
    );
  }

  if (!(await fileExists(serverModulePath))) {
    throw new Error(`build:fast completed but dist server is still missing: ${serverModulePath}`);
  }

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

async function startServer(root, databaseUrl) {
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: "0"
  };
  delete env.SMOKE_NO_DB;

  const serverModulePath = await ensureBuiltDist(root, env);
  const port = await getFreePort();

  process.env.DATABASE_URL = databaseUrl;
  delete process.env.SMOKE_NO_DB;
  process.env.PORT = String(port);

  const freshSuffix = `?bench=${Date.now()}-${Math.random()}`;
  const [{ app }, { sessionStateCache }] = await Promise.all([
    import(pathToFileURL(serverModulePath).href + freshSuffix),
    import(pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href + freshSuffix)
  ]);

  if (!app || typeof app.listen !== "function") {
    throw new Error("expected dist server app.listen()");
  }
  if (!sessionStateCache || typeof sessionStateCache.clear !== "function") {
    throw new Error("expected dist sessionStateCache.clear()");
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });

  await waitForHealth(baseUrl);

  return {
    baseUrl,
    sessionStateCache,
    async close() {
      await new Promise((resolve) => {
        try {
          server.close(() => resolve());
        } catch {
          resolve();
        }
      });
      await delay(50);
    }
  };
}

function roundMs(n) {
  return Number(n.toFixed(3));
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0];

  const rank = (p / 100) * (sortedValues.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const weight = rank - low;

  if (low === high) return sortedValues[low];
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
}

function summarizeDurations(durations) {
  const sorted = [...durations].sort((a, b) => a - b);

  return {
    count: durations.length,
    min_ms: roundMs(sorted[0]),
    p50_ms: roundMs(percentile(sorted, 50)),
    p95_ms: roundMs(percentile(sorted, 95)),
    p99_ms: roundMs(percentile(sorted, 99)),
    max_ms: roundMs(sorted[sorted.length - 1]),
    mean_ms: roundMs(durations.reduce((sum, n) => sum + n, 0) / durations.length)
  };
}

async function benchmarkWarmEndpoint({
  baseUrl,
  pathName,
  payload,
  iterations,
  expectedStatus,
  label
}) {
  const samples = [];

  for (let i = 1; i <= iterations; i += 1) {
    const result = await httpJson("POST", `${baseUrl}${pathName}`, payload);
    if (result.res.status !== expectedStatus) {
      throw new Error(
        `${label} iteration ${i}: expected ${expectedStatus}, got ${result.res.status}. raw=${result.text}`
      );
    }
    samples.push(roundMs(result.durationMs));
  }

  return {
    label,
    mode: "warm",
    endpoint: pathName,
    expected_status: expectedStatus,
    summary: summarizeDurations(samples),
    samples_ms: samples
  };
}

async function benchmarkColdEndpoint({
  root,
  databaseUrl,
  pathName,
  payload,
  iterations,
  expectedStatus,
  label
}) {
  const samples = [];

  for (let i = 1; i <= iterations; i += 1) {
    const server = await startServer(root, databaseUrl);
    try {
      const result = await httpJson("POST", `${server.baseUrl}${pathName}`, payload);
      if (result.res.status !== expectedStatus) {
        throw new Error(
          `${label} iteration ${i}: expected ${expectedStatus}, got ${result.res.status}. raw=${result.text}`
        );
      }
      samples.push(roundMs(result.durationMs));
    } finally {
      await server.close();
    }
  }

  return {
    label,
    mode: "cold",
    endpoint: pathName,
    expected_status: expectedStatus,
    summary: summarizeDurations(samples),
    samples_ms: samples
  };
}

async function main() {
  const root = repoRoot();
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const warmIterations = parsePositiveInt(process.env.BENCH_WARM_ITERATIONS, 30);
  const coldIterations = parsePositiveInt(process.env.BENCH_COLD_ITERATIONS, 5);
  const shouldWriteJson = parseBool(process.env.BENCH_WRITE_JSON, true);

  const buildEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: "0"
  };
  delete buildEnv.SMOKE_NO_DB;

  await ensureBuiltDist(root, buildEnv);
  await applySchema(root, buildEnv);

  const helloPath = path.join(root, "examples", "hello_world.json");
  const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

  const compileOnlyPayload = { phase1_input: phase1 };
  const compileAndCreatePayload = { phase1_input: phase1 };

  const warmServer = await startServer(root, databaseUrl);

  let report;
  try {
    const warmCompileOnly = await benchmarkWarmEndpoint({
      baseUrl: warmServer.baseUrl,
      pathName: "/blocks/compile",
      payload: compileOnlyPayload,
      iterations: warmIterations,
      expectedStatus: 200,
      label: "compile_only"
    });

    const warmCompileCreateSession = await benchmarkWarmEndpoint({
      baseUrl: warmServer.baseUrl,
      pathName: "/blocks/compile?create_session=true",
      payload: compileAndCreatePayload,
      iterations: warmIterations,
      expectedStatus: 201,
      label: "compile_create_session"
    });

    const coldCompileOnly = await benchmarkColdEndpoint({
      root,
      databaseUrl,
      pathName: "/blocks/compile",
      payload: compileOnlyPayload,
      iterations: coldIterations,
      expectedStatus: 200,
      label: "compile_only"
    });

    const coldCompileCreateSession = await benchmarkColdEndpoint({
      root,
      databaseUrl,
      pathName: "/blocks/compile?create_session=true",
      payload: compileAndCreatePayload,
      iterations: coldIterations,
      expectedStatus: 201,
      label: "compile_create_session"
    });

    report = {
      benchmark: "v0_compile_latency",
      generated_at_utc: new Date().toISOString(),
      environment: {
        node: process.version,
        database_url: databaseUrl,
        warm_iterations: warmIterations,
        cold_iterations: coldIterations
      },
      results: {
        warm_compile_only: warmCompileOnly,
        warm_compile_create_session: warmCompileCreateSession,
        cold_compile_only: coldCompileOnly,
        cold_compile_create_session: coldCompileCreateSession
      }
    };
  } finally {
    await warmServer.close();
  }

  if (shouldWriteJson) {
    const outDir = path.join(root, "artifacts", "benchmarks");
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, "v0_compile_latency.latest.json");
    await fs.writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exitCode = 1;
});