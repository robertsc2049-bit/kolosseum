import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function loadRunPipeline() {
  const candidates = [
    "../dist/src/run_pipeline.js",
    "../dist/engine/src/run_pipeline.js"
  ];

  let lastErr;
  for (const p of candidates) {
    try {
      return await import(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to import runPipeline from dist");
}

async function loadRenderer() {
  const candidates = [
    "../dist/src/render/session_text.js",
    "../dist/engine/src/render/session_text.js",
    "../dist/render/session_text.js",
    "../dist/engine/render/session_text.js"
  ];

  let lastErr;
  for (const p of candidates) {
    try {
      return await import(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to import renderSessionText from dist");
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".vscode",
  ".next",
  "coverage"
]);

async function walk(dir, maxDepth, depth = 0) {
  if (depth > maxDepth) return [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      out.push(...(await walk(full, maxDepth, depth + 1)));
      continue;
    }

    if (ent.isFile()) out.push(full);
  }
  return out;
}

async function findVanillaMinimalFixture() {
  const root = process.cwd();

  // Search broadly; fixtures are not guaranteed to live under ./ci
  const files = await walk(root, 8);

  const candidates = files
    .filter((f) => {
      const base = path.basename(f).toLowerCase();
      if (!(base.endsWith(".json") || base.endsWith(".jsonc"))) return false;
      return base.includes("vanilla_minimal");
    })
    .sort((a, b) => a.length - b.length);

  if (candidates.length === 0) {
    throw new Error(
      "No vanilla_minimal*.json/jsonc found anywhere in repo (needed for run_pipeline flag test)."
    );
  }

  return candidates[0];
}

test("runPipeline does not emit rendered_text by default, but does when debug flag enabled", async () => {
  const { runPipeline } = await loadRunPipeline();
  const { renderSessionText } = await loadRenderer();

  const fixturePath = await findVanillaMinimalFixture();
  const raw = await fs.readFile(fixturePath, "utf8");

  // jsonc-safe parse (strip // line comments + /* */ blocks)
  const cleaned = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const phase1Input = JSON.parse(cleaned);

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
