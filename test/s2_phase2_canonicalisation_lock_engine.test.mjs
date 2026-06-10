/* test/s2_phase2_canonicalisation_lock_engine.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function spawnNpm(args, opts = {}) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnProc(npmCmd, args, opts);
}

async function ensureBuiltEngine(root, env) {
  const phase1ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase1.js");
  const phase2ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase2.js");

  if (!(await fileExists(phase1ModulePath)) || !(await fileExists(phase2ModulePath))) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(await fileExists(phase1ModulePath), true, `expected built phase1 module to exist: ${phase1ModulePath}`);
  assert.equal(await fileExists(phase2ModulePath), true, `expected built phase2 module to exist: ${phase2ModulePath}`);

  return { phase1ModulePath, phase2ModulePath };
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

const EXPECTED_CANONICAL_JSON =
  '{"activity_id":"powerlifting","actor_type":"athlete","bias_mode":"none","consent_granted":true,"constraints":{"available_equipment":["eq_barbell","eq_bench","eq_dumbbell","eq_plate","eq_rack"],"constraints_version":"1.0.0"},"engine_version":"EB2-1.0.0","enum_bundle_version":"EB2-1.0.0","execution_scope":"individual","exposure_prompt_density":"standard","instruction_density":"standard","nd_mode":false,"phase1_schema_version":"1.0.0"}';

const EXPECTED_CANONICAL_HASH =
  "66fa742ab2fbf641eae14665e7ed35dfbfdef2646020e614d1e985ce8e8b0c58";

test("S2 phase2 canonicalisation lock: phase1 canonical input deterministically replays to identical phase2 bytes and hash", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase2ModulePath } = await ensureBuiltEngine(root, env);

  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase2Module = await import(pathToFileURL(phase2ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase2CanonicaliseAndHash } = phase2Module;

  assert.equal(typeof phase1Validate, "function", "expected phase1Validate export");
  assert.equal(typeof phase2CanonicaliseAndHash, "function", "expected phase2CanonicaliseAndHash export");

  const p1a = phase1Validate(makeAcceptedPhase1InputVariantA());
  const p1b = phase1Validate(makeAcceptedPhase1InputVariantB());

  assert.equal(p1a.ok, true, `variantA phase1 failed: ${JSON.stringify(p1a)}`);
  assert.equal(p1b.ok, true, `variantB phase1 failed: ${JSON.stringify(p1b)}`);

  assert.deepEqual(
    p1a.canonical_input,
    p1b.canonical_input,
    "phase1 canonical input must be identical for reordered accepted input"
  );

  const first = phase2CanonicaliseAndHash(p1a.canonical_input);
  const second = phase2CanonicaliseAndHash(p1a.canonical_input);
  const reordered = phase2CanonicaliseAndHash(p1b.canonical_input);

  assert.equal(first.ok, true, `first canonicalisation failed: ${JSON.stringify(first)}`);
  assert.equal(second.ok, true, `second canonicalisation failed: ${JSON.stringify(second)}`);
  assert.equal(reordered.ok, true, `reordered canonicalisation failed: ${JSON.stringify(reordered)}`);

  assert.equal(first.phase2.phase2_canonical_json, EXPECTED_CANONICAL_JSON, "canonical JSON must remain frozen");
  assert.equal(first.phase2.phase2_hash, EXPECTED_CANONICAL_HASH, "canonical hash must remain frozen");

  assert.equal(Buffer.from(first.phase2.canonical_input_json).toString("utf8"), EXPECTED_CANONICAL_JSON, "canonical bytes must decode to frozen canonical JSON");
  assert.equal(first.phase2.canonical_input_hash, EXPECTED_CANONICAL_HASH, "legacy canonical_input_hash alias must match frozen hash");

  assert.equal(second.phase2.phase2_canonical_json, first.phase2.phase2_canonical_json, "same canonical input must replay identical canonical JSON");
  assert.equal(second.phase2.phase2_hash, first.phase2.phase2_hash, "same canonical input must replay identical hash");
  assert.deepEqual(Array.from(second.phase2.canonical_input_json), Array.from(first.phase2.canonical_input_json), "same canonical input must replay identical canonical bytes");

  assert.equal(reordered.phase2.phase2_canonical_json, first.phase2.phase2_canonical_json, "reordered accepted input must canonicalise to identical JSON after phase1");
  assert.equal(reordered.phase2.phase2_hash, first.phase2.phase2_hash, "reordered accepted input must canonicalise to identical hash after phase1");
  assert.deepEqual(Array.from(reordered.phase2.canonical_input_json), Array.from(first.phase2.canonical_input_json), "reordered accepted input must canonicalise to identical bytes after phase1");
});


