import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function stripBom(s) {
  return s.replace(/^\uFEFF/, "");
}

function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readTextUtf8Normalized(p) {
  const raw = readFileSync(p, "utf8");
  return normalizeLf(stripBom(raw));
}

function stableStringify(value) {
  const seen = new WeakSet();
  const sorter = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(sorter);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sorter(v[k]);
    return out;
  };
  return JSON.stringify(sorter(value), null, 2) + "\n";
}

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function readJson(p) {
  const text = readTextUtf8Normalized(p);
  return JSON.parse(text);
}

function writeUtf8NoBomLf(p, text) {
  const normalized = normalizeLf(text);
  writeFileSync(p, normalized, { encoding: "utf8" });
}

function listJsonFiles(dirAbs) {
  if (!existsSync(dirAbs)) return [];
  return readdirSync(dirAbs)
    .filter((f) => extname(f).toLowerCase() === ".json")
    .map((f) => join(dirAbs, f))
    .sort();
}

function diffHint(expectedText, actualText) {
  const e = expectedText.split("\n");
  const a = actualText.split("\n");
  const n = Math.max(e.length, a.length);
  for (let i = 0; i < n; i++) {
    if (e[i] !== a[i]) {
      const start = Math.max(0, i - 3);
      const end = Math.min(n, i + 4);
      const lines = [];
      lines.push(`first_diff_line=${i + 1}`);
      lines.push("--- expected (window) ---");
      for (let j = start; j < end; j++) lines.push(`${String(j + 1).padStart(4)} | ${e[j] ?? ""}`);
      lines.push("--- actual (window) ---");
      for (let j = start; j < end; j++) lines.push(`${String(j + 1).padStart(4)} | ${a[j] ?? ""}`);
      return lines.join("\n");
    }
  }
  return "texts differ (unable to locate diff line)";
}

async function tryImportModule(modulePath) {
  try {
    const abs = resolve(process.cwd(), modulePath);
    const url = new URL("file://" + abs.replace(/\\/g, "/"));
    return await import(url.href);
  } catch {
    return null;
  }
}

/**
 * 🔒 LOCKED runner entrypoint (default):
 *   dist/src/run_pipeline.js :: runPipeline
 *
 * Escape hatch (intentional only):
 *   ENGINE_ENTRY=<module path> ENGINE_FN=<export name or 'default'>
 *
 * Autodiscovery is intentionally removed to prevent silent runner drift.
 */
async function resolveEngineRunner() {
  const entryEnv = (process.env.ENGINE_ENTRY || "").trim();
  const fnEnv = (process.env.ENGINE_FN || "").trim();

  // Intentional override path (explicit only)
  if (entryEnv) {
    const mod = await tryImportModule(entryEnv);
    if (!mod) die(`e2e:golden: ENGINE_ENTRY '${entryEnv}' could not be imported.`);
    if (!fnEnv) die(`e2e:golden: ENGINE_FN not set. Set ENGINE_FN to the exported function name in '${entryEnv}'.`);
    const f = fnEnv === "default" ? mod.default : mod[fnEnv];
    if (typeof f !== "function") die(`e2e:golden: '${entryEnv}' does not export a function named '${fnEnv}'.`);
    return { run: f, note: `ENGINE_ENTRY=${entryEnv} ENGINE_FN=${fnEnv}` };
  }

  // Locked default runner
  const lockedEntry = "dist/src/run_pipeline.js";
  const lockedFnName = "runPipeline";

  const mod = await tryImportModule(lockedEntry);
  if (!mod) {
    die(
      `e2e:golden: Locked runner could not be imported.\n` +
        `expected entry: ${lockedEntry}\n\n` +
        `Fix:\n` +
        `  1) npm run build\n` +
        `  2) Ensure '${lockedEntry}' exists and exports '${lockedFnName}'.\n\n` +
        `If you intentionally moved the runner, run with explicit env:\n` +
        `  ENGINE_ENTRY=<module path> ENGINE_FN=<export name or 'default'> npm run e2e:golden\n`
    );
  }

  const f = mod[lockedFnName];
  if (typeof f !== "function") {
    const exports = Object.keys(mod || {}).sort().join(", ");
    die(
      `e2e:golden: Locked runner module imported but missing required export.\n` +
        `entry: ${lockedEntry}\n` +
        `required export: ${lockedFnName}\n` +
        `module exports: [${exports || "(none)"}]\n\n` +
        `Fix:\n` +
        `  - Ensure '${lockedEntry}' exports '${lockedFnName}'.\n` +
        `  - Or intentionally override with:\n` +
        `    ENGINE_ENTRY=<module path> ENGINE_FN=<export name or 'default'> npm run e2e:golden\n`
    );
  }

  return { run: f, note: `locked: ${lockedEntry}::${lockedFnName}` };
}

function extractFailureTokenFromThrown(err) {
  const text = String(err?.stack || err?.message || err || "");
  const m = text.match(/failure_token=([a-z0-9_]+)/i);
  if (!m) return null;
  return String(m[1]).trim();
}

async function main() {
  const inputsDir = resolve(process.cwd(), "test/fixtures/golden/inputs");
  const expectedDir = resolve(process.cwd(), "test/fixtures/golden/expected");

  mkdirSync(inputsDir, { recursive: true });
  mkdirSync(expectedDir, { recursive: true });

  const inputFiles = listJsonFiles(inputsDir);
  if (inputFiles.length === 0) {
    die(
`e2e:golden: No fixtures found.
Put input JSON files in:
  test/fixtures/golden/inputs/*.json

Then run:
  npm run e2e:golden

To create snapshots locally:
  UPDATE_GOLDEN=1 npm run e2e:golden
`
    );
  }

  const isCI =
    String(process.env.CI || "").toLowerCase() === "true" ||
    process.env.GITHUB_ACTIONS === "true";

  const update = (process.env.UPDATE_GOLDEN || "").trim() === "1";

  if (isCI && update) {
    die("e2e:golden: UPDATE_GOLDEN=1 is not allowed in CI. Run locally, commit snapshots, then push.");
  }

  const { run, note } = await resolveEngineRunner();
  console.log(`e2e:golden: runner=${note}`);

  const offenders = [];

  for (const inPath of inputFiles) {
    const name = basename(inPath, ".json");
    const outPath = join(expectedDir, `${name}.json`);

    const input = readJson(inPath);

    let actual;
    try {
      actual = await run(input);
    } catch (e) {
      // Treat thrown engine failures that include failure_token=... as canonical failure outputs.
      // This allows negative goldens without depending on exception stack stability.
      const token = extractFailureTokenFromThrown(e);
      if (token) {
        actual = { ok: false, failure_token: token };
      } else {
        offenders.push({ name, kind: "runtime", detail: String(e?.stack || e) });
        continue;
      }
    }

    const actualText = stableStringify(actual);
    const actualHash = sha256(actualText);

    if (!existsSync(outPath)) {
      if (update) {
        writeUtf8NoBomLf(outPath, actualText);
        console.log(`SNAPSHOT new: ${name} sha256=${actualHash}`);
      } else {
        offenders.push({ name, kind: "missing_snapshot", detail: `missing expected: ${outPath}` });
      }
      continue;
    }

    const expectedText = readTextUtf8Normalized(outPath);
    const expectedHash = sha256(expectedText);

    if (expectedText !== actualText) {
      if (update) {
        writeUtf8NoBomLf(outPath, actualText);
        console.log(`SNAPSHOT updated: ${name} sha256=${expectedHash} -> ${actualHash}`);
      } else {
        offenders.push({
          name,
          kind: "mismatch",
          detail: `expected_sha256=${expectedHash} actual_sha256=${actualHash}\n${diffHint(expectedText, actualText)}`,
        });
      }
    } else {
      console.log(`OK: ${name} sha256=${actualHash}`);
    }
  }

  if (offenders.length) {
    console.error(`\nFAIL e2e:golden (${offenders.length} fixture(s) not clean):`);
    for (const o of offenders) {
      console.error(`\n--- ${o.name} [${o.kind}] ---`);
      console.error(o.detail);
    }
    console.error("\nFix:");
    console.error("  - If snapshots are correct to update (local only): UPDATE_GOLDEN=1 npm run e2e:golden");
    console.error("  - Otherwise fix engine output regression.");
    process.exit(1);
  }

  console.log(`\nPASS e2e:golden (${inputFiles.length} fixture(s)).`);
}

await main();
