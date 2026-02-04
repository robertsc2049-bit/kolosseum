import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fileExists(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function findRepoRoot(startDir) {
  let cur = startDir;
  for (let i = 0; i < 25; i++) {
    const candidate = path.join(cur, "package.json");
    if (await fileExists(candidate)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(`Could not locate repo root (package.json) starting from: ${startDir}`);
}

function stripJsonc(raw) {
  // Safe even for .json (no-op on typical files)
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

async function importDistModule(repoRoot, relPath, requiredExportName) {
  const abs = path.join(repoRoot, relPath);
  if (!(await fileExists(abs))) {
    throw new Error(`Missing dist module: ${abs}`);
  }

  const mod = await import(pathToFileURL(abs).href);

  // Accept either named export or default object with the export on it.
  const fn = mod[requiredExportName] ?? mod.default?.[requiredExportName] ?? null;
  if (!fn) {
    const keys = Object.keys(mod).sort().join(", ");
    throw new Error(
      [
        `Loaded dist module but missing export: ${requiredExportName}`,
        `modulePath: ${abs}`,
        `exports: ${keys || "(none)"}`
      ].join("\n")
    );
  }

  return fn;
}

async function loadRunPipeline() {
  const repoRoot = await findRepoRoot(__dirname);
  // This matches the stack trace you posted (dist/engine/src/run_pipeline.js).
  const runPipeline = await importDistModule(repoRoot, "dist/engine/src/run_pipeline.js", "runPipeline");
  return { runPipeline };
}

async function loadRenderer() {
  const repoRoot = await findRepoRoot(__dirname);
  // Renderer used to validate the debug output.
  const renderSessionText = await importDistModule(repoRoot, "dist/engine/src/render/session_text.js", "renderSessionText");
  return { renderSessionText };
}

async function loadVanillaMinimalPhase1Input() {
  const repoRoot = await findRepoRoot(__dirname);
  const fixtureAbs = path.join(repoRoot, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");

  if (!(await fileExists(fixtureAbs))) {
    throw new Error(`Missing golden input fixture: ${fixtureAbs}`);
  }

  const raw = await fs.readFile(fixtureAbs, "utf8");
  const cleaned = stripJsonc(raw).trim();

  if (!cleaned) {
    const rawPreview = raw.length > 200 ? raw.slice(0, 200) + "â€¦" : raw;
    throw new Error(
      [
        "vanilla_minimal.json became empty after JSONC stripping (unexpected).",
        `fixtureAbs: ${fixtureAbs}`,
        `rawLength: ${raw.length}`,
        `rawPreview: ${JSON.stringify(rawPreview)}`
      ].join("\n")
    );
  }

  return JSON.parse(cleaned);
}

test("runPipeline does not emit rendered_text by default, but does when debug flag enabled", async () => {
  const { runPipeline } = await loadRunPipeline();
  const { renderSessionText } = await loadRenderer();

  const phase1Input = await loadVanillaMinimalPhase1Input();

  const out1 = await runPipeline(phase1Input);
  assert.ok(out1 && typeof out1 === "object");
  assert.equal("rendered_text" in out1, false);

  const out2 = await runPipeline({ ...phase1Input, debug_render_session_text: true });
  assert.ok(out2 && typeof out2 === "object");
  assert.equal(out2.ok, true);
  assert.ok(out2.rendered_text);
  assert.equal(typeof out2.rendered_text.title, "string");
  assert.ok(Array.isArray(out2.rendered_text.lines));

  const expected = renderSessionText(out2.session);
  assert.deepEqual(out2.rendered_text, expected);
});
