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
  const phase3ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase3.js");

  if (!(await fileExists(phase1ModulePath)) || !(await fileExists(phase2ModulePath)) || !(await fileExists(phase3ModulePath))) {
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
  assert.equal(await fileExists(phase3ModulePath), true, `expected built phase3 module to exist: ${phase3ModulePath}`);

  return { phase1ModulePath, phase2ModulePath, phase3ModulePath };
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
      available_equipment: ["eq_barbell", "eq_bench", "eq_rack"],
      banned_equipment: ["eq_barbell"]
    }
  };
}

function makeAcceptedPhase1InputVariantB() {
  return {
    constraints: {
      banned_equipment: ["eq_barbell"],
      available_equipment: ["eq_rack", "eq_barbell", "eq_bench"],
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

const EXPECTED_PHASE3_OUTPUT = {
  constraints_resolved: true,
  notes: [
    "PHASE_3: registries loaded",
    "PHASE_3: constraints envelope present — canonicalized (v1)"
  ],
  registry_index_version: "1.0.0",
  loaded_registries: ["activity", "movement", "exercise", "program"],
  constraints: {
    available_equipment: ["eq_bench", "eq_rack"],
    banned_equipment: ["eq_barbell"]
  },
  constraints_resolution: {
    rules_applied: ["banned_over_available_equipment"],
    removed_from_available_equipment: ["eq_barbell"]
  }
};

test("S3 phase3 sovereign precedence lock: semantically identical accepted inputs replay identical phase3 output after phase1 -> phase2 -> phase3", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase2ModulePath, phase3ModulePath } = await ensureBuiltEngine(root, env);

  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase2Module = await import(pathToFileURL(phase2ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase2CanonicaliseAndHash } = phase2Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  assert.equal(typeof phase1Validate, "function", "expected phase1Validate export");
  assert.equal(typeof phase2CanonicaliseAndHash, "function", "expected phase2CanonicaliseAndHash export");
  assert.equal(typeof phase3ResolveConstraintsAndLoadRegistries, "function", "expected phase3ResolveConstraintsAndLoadRegistries export");

  const p1a = phase1Validate(makeAcceptedPhase1InputVariantA());
  const p1b = phase1Validate(makeAcceptedPhase1InputVariantB());

  assert.equal(p1a.ok, true, `variantA phase1 failed: ${JSON.stringify(p1a)}`);
  assert.equal(p1b.ok, true, `variantB phase1 failed: ${JSON.stringify(p1b)}`);

  assert.deepEqual(
    p1a.canonical_input,
    p1b.canonical_input,
    "phase1 canonical input must be identical for semantically identical accepted inputs"
  );

  const p2a = phase2CanonicaliseAndHash(p1a.canonical_input);
  const p2b = phase2CanonicaliseAndHash(p1b.canonical_input);

  assert.equal(p2a.ok, true, `variantA phase2 failed: ${JSON.stringify(p2a)}`);
  assert.equal(p2b.ok, true, `variantB phase2 failed: ${JSON.stringify(p2b)}`);

  assert.equal(
    p2a.phase2.phase2_canonical_json,
    p2b.phase2.phase2_canonical_json,
    "phase2 canonical json must replay identically after phase1 canonicalisation"
  );
  assert.equal(
    p2a.phase2.phase2_hash,
    p2b.phase2.phase2_hash,
    "phase2 hash must replay identically after phase1 canonicalisation"
  );

  const p3a = phase3ResolveConstraintsAndLoadRegistries(p1a.canonical_input);
  const p3b = phase3ResolveConstraintsAndLoadRegistries(p1b.canonical_input);

  assert.equal(p3a.ok, true, `variantA phase3 failed: ${JSON.stringify(p3a)}`);
  assert.equal(p3b.ok, true, `variantB phase3 failed: ${JSON.stringify(p3b)}`);

  assert.deepEqual(
    p3a.phase3,
    p3b.phase3,
    "phase3 output must replay identically for semantically identical accepted inputs"
  );

  assert.deepEqual(
    p3a.phase3,
    EXPECTED_PHASE3_OUTPUT,
    "phase3 output must preserve sovereign envelope semantics and precedence resolution"
  );

  assert.deepEqual(
    p3a.phase3.constraints.available_equipment,
    ["eq_bench", "eq_rack"],
    "overlapping banned equipment must be removed from effective available_equipment"
  );

  assert.deepEqual(
    p3a.phase3.constraints.banned_equipment,
    ["eq_barbell"],
    "banned_equipment must be retained"
  );

  assert.deepEqual(
    p3a.phase3.constraints_resolution?.rules_applied,
    ["banned_over_available_equipment"],
    "rules_applied must record precedence deterministically"
  );

  assert.deepEqual(
    p3a.phase3.constraints_resolution?.removed_from_available_equipment,
    ["eq_barbell"],
    "removed overlap must be emitted deterministically"
  );
});