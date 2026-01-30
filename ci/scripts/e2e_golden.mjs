import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
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
  const raw = readFileSync(p, "utf8");
  return JSON.parse((raw).replace(/^\uFEFF/, ""));
}

function writeUtf8NoBom(p, text) {
  writeFileSync(p, text, { encoding: "utf8" });
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

function walkFiles(dirAbs, exts, out) {
  if (!existsSync(dirAbs)) return;
  for (const ent of readdirSync(dirAbs, { withFileTypes: true })) {
    const p = join(dirAbs, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      walkFiles(p, exts, out);
      continue;
    }
    const e = extname(ent.name).toLowerCase();
    if (exts.has(e)) out.push(p);
  }
}

function rel(pAbs) {
  const cwd = process.cwd();
  return pAbs.startsWith(cwd) ? pAbs.slice(cwd.length + 1) : pAbs;
}

function looksLikeRunnerSource(text) {
  // Heuristics: file references multiple phases / pipeline, and exports something callable.
  const t = text.toLowerCase();
  const phaseHits =
    (t.includes("phase1") ? 1 : 0) +
    (t.includes("phase2") ? 1 : 0) +
    (t.includes("phase3") ? 1 : 0) +
    (t.includes("phase4") ? 1 : 0) +
    (t.includes("phase5") ? 1 : 0) +
    (t.includes("phase6") ? 1 : 0);

  const pipelineWords =
    t.includes("pipeline") ||
    t.includes("compile") ||
    t.includes("session") ||
    t.includes("engine") ||
    t.includes("phases/phase");

  const exportWords =
    t.includes("export function") ||
    t.includes("export const") ||
    t.includes("export default");

  return phaseHits >= 3 && pipelineWords && exportWords;
}

async function resolveEngineRunner() {
  const entry = (process.env.ENGINE_ENTRY || "").trim();
  const fn = (process.env.ENGINE_FN || "").trim();

  const fnNames = [
    // your likely names
    "runPipeline",
    "runEngine",
    "compileSession",
    "buildSession",
    "compile",
    "run",

    // fallback names
    "main",
    "execute",
    "engine",
  ];

  // Explicit override
  if (entry) {
    const mod = await tryImportModule(entry);
    if (!mod) die(`e2e:golden: ENGINE_ENTRY '${entry}' could not be imported.`);
    if (!fn) die(`e2e:golden: ENGINE_FN not set. Set ENGINE_FN to the exported function name in '${entry}'.`);
    const f = fn === "default" ? mod.default : mod[fn];
    if (typeof f !== "function") die(`e2e:golden: '${entry}' does not export a function named '${fn}'.`);
    return { run: f, note: `ENGINE_ENTRY=${entry} ENGINE_FN=${fn}` };
  }

  // Scan for likely runner modules (dist first, then engine/src, then src)
    const roots = [
    resolve(process.cwd(), "dist/src"),
    resolve(process.cwd(), "engine/dist/src"),
    resolve(process.cwd(), "engine/src"),
    resolve(process.cwd(), "src"),
    resolve(process.cwd(), "scripts"),
  ];

  const filesAbs = [];
  walkFiles(process.cwd(), new Set([".mjs", ".js"]), filesAbs);

  // filter to those under roots (prefer)
  const preferred = new Set(roots.filter(existsSync).map((r) => r));
  const underPreferred = filesAbs.filter((p) => {
    for (const r of preferred) if (p.startsWith(r)) return true;
    return false;
  });

  const pool = (underPreferred.length ? underPreferred : filesAbs);

  // shortlist via heuristics to avoid importing every module (side effects)
  const shortlisted = [];
  for (const pAbs of pool) {
    try {
      const txt = readFileSync(pAbs, "utf8");
      if (looksLikeRunnerSource(txt)) shortlisted.push(pAbs);
    } catch {
      // ignore unreadable
    }
  }

  // If heuristics got nothing, fall back to a small number of Ã¢â‚¬Å“centralÃ¢â‚¬Â modules
    const fallbackCentral = [
    resolve(process.cwd(), "dist/src/run_pipeline.js"),
    resolve(process.cwd(), "engine/dist/src/run_pipeline.js"),
    resolve(process.cwd(), "dist/src/index.js"),
    resolve(process.cwd(), "dist/src/server.js"),
    resolve(process.cwd(), "engine/src/run_pipeline.ts"),
    resolve(process.cwd(), "engine/src/index.js"),
    resolve(process.cwd(), "engine/src/index.ts"),
  ].filter(existsSync);

  const candidatesAbs = [...shortlisted, ...fallbackCentral].slice(0, 80);

  for (const pAbs of candidatesAbs) {
    const relPath = rel(pAbs);
    const mod = await tryImportModule(relPath);
    if (!mod) continue;

    // Try named exports first
    for (const name of fnNames) {
      if (typeof mod[name] === "function") return { run: mod[name], note: `auto: ${relPath}::${name}` };
    }

    // Try default export as function
    if (typeof mod.default === "function") return { run: mod.default, note: `auto: ${relPath}::default` };
  }

  const triedList = candidatesAbs.map((p) => "  - " + rel(p)).join("\n");
  die(
`e2e:golden: Could not auto-discover an engine runner function.

Next steps (pick one):
A) Find a runner export and set env once:
   ENGINE_ENTRY=<module path> ENGINE_FN=<export name or 'default'> npm run e2e:golden

B) If no runner exists, we will create one file:
   engine/src/run_pipeline.mjs exporting runPipeline(input)

Auto-discovery shortlists up to 80 candidates using phase/pipeline heuristics.
Tried candidates:
${triedList || "  (none)"}
`
  );
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

To create snapshots:
  UPDATE_GOLDEN=1 npm run e2e:golden
`
    );
  }

  const { run, note } = await resolveEngineRunner();
  console.log(`e2e:golden: runner=${note}`);

  const update = (process.env.UPDATE_GOLDEN || "").trim() === "1";
  const offenders = [];

  for (const inPath of inputFiles) {
    const name = basename(inPath, ".json");
    const outPath = join(expectedDir, `${name}.json`);

    const input = readJson(inPath);

    let actual;
    try {
      actual = await run(input);
    } catch (e) {
      offenders.push({ name, kind: "runtime", detail: String(e?.stack || e) });
      continue;
    }

    const actualText = stableStringify(actual);
    const actualHash = sha256(actualText);

    if (!existsSync(outPath)) {
      if (update) {
        writeUtf8NoBom(outPath, actualText);
        console.log(`Ã¢Å“â€¦ ${name}: wrote snapshot (new) sha256=${actualHash}`);
      } else {
        offenders.push({ name, kind: "missing_snapshot", detail: `missing expected: ${outPath}` });
      }
      continue;
    }

    const expectedText = readFileSync(outPath, "utf8");
    const expectedHash = sha256(expectedText);

    if (expectedText !== actualText) {
      if (update) {
        writeUtf8NoBom(outPath, actualText);
        console.log(`Ã¢Å“â€¦ ${name}: updated snapshot sha256=${expectedHash} -> ${actualHash}`);
      } else {
        offenders.push({
          name,
          kind: "mismatch",
          detail: `expected_sha256=${expectedHash} actual_sha256=${actualHash}\n${diffHint(expectedText, actualText)}`,
        });
      }
    } else {
      console.log(`Ã¢Å“â€¦ ${name}: OK sha256=${actualHash}`);
    }
  }

  if (offenders.length) {
    console.error(`\nÃ¢ÂÅ’ e2e:golden failed (${offenders.length} fixture(s) not clean):`);
    for (const o of offenders) {
      console.error(`\n--- ${o.name} [${o.kind}] ---`);
      console.error(o.detail);
    }
    console.error("\nFix:");
    console.error("  - If snapshots are correct to update: UPDATE_GOLDEN=1 npm run e2e:golden");
    console.error("  - Otherwise fix engine output regression.");
    process.exit(1);
  }

  console.log(`\ne2e:golden: OK (${inputFiles.length} fixture(s)).`);
}

await main();