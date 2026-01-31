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
      out.push(...(await walk(full, maxDepth, depth + 1)));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function findVanillaMinimalFixture() {
  const root = process.cwd();
  const ciDir = path.join(root, "ci");
  const files = await walk(ciDir, 6);

  const candidates = files
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .filter((f) => path.basename(f).toLowerCase().includes("vanilla_minimal"))
    .sort((a, b) => a.length - b.length);

  if (candidates.length === 0) {
    throw new Error("No vanilla_minimal*.json found under ./ci (needed for run_pipeline flag test).");
  }

  return candidates[0];
}

test("runPipeline does not emit rendered_text by default, but does when debug flag enabled", async () => {
  const { runPipeline } = await loadRunPipeline();
  const { renderSessionText } = await loadRenderer();

  const fixturePath = await findVanillaMinimalFixture();
  const raw = await fs.readFile(fixturePath, "utf8");
  const phase1Input = JSON.parse(raw);

  const out1 = await runPipeline(phase1Input);
  assert.ok(out1 && typeof out1 === "object");
  assert.equal("rendered_text" in out1, false);

  const out2 = await runPipeline({ ...phase1Input, debug_render_session_text: true });
  assert.ok(out2 && typeof out2 === "object");
  assert.equal(out2.ok, true);
  assert.ok(out2.rendered_text);
  assert.equal(typeof out2.rendered_text.title, "string");
  assert.ok(Array.isArray(out2.rendered_text.lines));

  // Validate it matches the renderer output exactly (deterministic)
  const expected = renderSessionText(out2.session);
  assert.deepEqual(out2.rendered_text, expected);
});
