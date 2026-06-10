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
  const phase3ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase3.js");

  if (!(await fileExists(phase1ModulePath)) || !(await fileExists(phase3ModulePath))) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(await fileExists(phase1ModulePath), true, `expected built phase1 module to exist: ${phase1ModulePath}`);
  assert.equal(await fileExists(phase3ModulePath), true, `expected built phase3 module to exist: ${phase3ModulePath}`);

  return { phase1ModulePath, phase3ModulePath };
}

function makeAcceptedPhase1Input({ available_equipment, banned_equipment }) {
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
      available_equipment,
      banned_equipment
    }
  };
}

function asSortedUnique(values) {
  return [...new Set(values)].sort();
}

function assertSubset(subset, superset, message) {
  const supersetSet = new Set(superset);
  for (const item of subset) {
    assert.equal(supersetSet.has(item), true, `${message}: unexpected item ${item}`);
  }
}

test("S4 phase3 remove-only constraint engine: stricter bans monotonically prune available_equipment and never expand solution space", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath } = await ensureBuiltEngine(root, env);

  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  assert.equal(typeof phase1Validate, "function", "expected phase1Validate export");
  assert.equal(typeof phase3ResolveConstraintsAndLoadRegistries, "function", "expected phase3ResolveConstraintsAndLoadRegistries export");

  const baselineInput = makeAcceptedPhase1Input({
    available_equipment: ["eq_barbell", "eq_bench", "eq_rack"],
    banned_equipment: []
  });

  const stricterInput = makeAcceptedPhase1Input({
    available_equipment: ["eq_barbell", "eq_bench", "eq_rack"],
    banned_equipment: ["eq_barbell"]
  });

  const strictestInput = makeAcceptedPhase1Input({
    available_equipment: ["eq_barbell", "eq_bench", "eq_rack"],
    banned_equipment: ["eq_barbell", "eq_rack"]
  });

  const missingBanInput = makeAcceptedPhase1Input({
    available_equipment: ["eq_barbell", "eq_bench", "eq_rack"],
    banned_equipment: ["eq_cable"]
  });

  const p1Baseline = phase1Validate(baselineInput);
  const p1Stricter = phase1Validate(stricterInput);
  const p1Strictest = phase1Validate(strictestInput);
  const p1MissingBan = phase1Validate(missingBanInput);

  assert.equal(p1Baseline.ok, true, `baseline phase1 failed: ${JSON.stringify(p1Baseline)}`);
  assert.equal(p1Stricter.ok, true, `stricter phase1 failed: ${JSON.stringify(p1Stricter)}`);
  assert.equal(p1Strictest.ok, true, `strictest phase1 failed: ${JSON.stringify(p1Strictest)}`);
  assert.equal(p1MissingBan.ok, true, `missingBan phase1 failed: ${JSON.stringify(p1MissingBan)}`);

  const p3Baseline = phase3ResolveConstraintsAndLoadRegistries(p1Baseline.canonical_input);
  const p3Stricter = phase3ResolveConstraintsAndLoadRegistries(p1Stricter.canonical_input);
  const p3Strictest = phase3ResolveConstraintsAndLoadRegistries(p1Strictest.canonical_input);
  const p3MissingBan = phase3ResolveConstraintsAndLoadRegistries(p1MissingBan.canonical_input);

  assert.equal(p3Baseline.ok, true, `baseline phase3 failed: ${JSON.stringify(p3Baseline)}`);
  assert.equal(p3Stricter.ok, true, `stricter phase3 failed: ${JSON.stringify(p3Stricter)}`);
  assert.equal(p3Strictest.ok, true, `strictest phase3 failed: ${JSON.stringify(p3Strictest)}`);
  assert.equal(p3MissingBan.ok, true, `missingBan phase3 failed: ${JSON.stringify(p3MissingBan)}`);

  const baselineAvailable = asSortedUnique(p3Baseline.phase3.constraints.available_equipment);
  const stricterAvailable = asSortedUnique(p3Stricter.phase3.constraints.available_equipment);
  const strictestAvailable = asSortedUnique(p3Strictest.phase3.constraints.available_equipment);
  const missingBanAvailable = asSortedUnique(p3MissingBan.phase3.constraints.available_equipment);

  assert.deepEqual(
    baselineAvailable,
    ["eq_barbell", "eq_bench", "eq_rack"],
    "baseline effective available_equipment must remain intact when there are no overlapping bans"
  );

  assert.deepEqual(
    stricterAvailable,
    ["eq_bench", "eq_rack"],
    "stricter effective available_equipment must remove overlapping banned items"
  );

  assert.deepEqual(
    strictestAvailable,
    ["eq_bench"],
    "strictest effective available_equipment must further shrink under additional overlapping bans"
  );

  assert.deepEqual(
    missingBanAvailable,
    ["eq_barbell", "eq_bench", "eq_rack"],
    "banning equipment outside the available set must not synthesize replacements or expand the set"
  );

  assertSubset(
    stricterAvailable,
    baselineAvailable,
    "stricter effective available_equipment must be a subset of baseline"
  );

  assertSubset(
    strictestAvailable,
    stricterAvailable,
    "strictest effective available_equipment must be a subset of stricter"
  );

  assertSubset(
    strictestAvailable,
    baselineAvailable,
    "strictest effective available_equipment must be a subset of baseline"
  );

  assert.equal(
    stricterAvailable.length <= baselineAvailable.length,
    true,
    "stricter effective available_equipment must be equal-or-smaller than baseline"
  );

  assert.equal(
    strictestAvailable.length <= stricterAvailable.length,
    true,
    "strictest effective available_equipment must be equal-or-smaller than stricter"
  );

  assert.equal(
    missingBanAvailable.length <= baselineAvailable.length,
    true,
    "missing-ban effective available_equipment must never be larger than baseline"
  );

  assert.deepEqual(
    asSortedUnique(p3Stricter.phase3.constraints_resolution?.rules_applied ?? []),
    ["banned_over_available_equipment"],
    "overlapping bans must continue to record the same sovereign precedence rule"
  );

  assert.deepEqual(
    asSortedUnique(p3Stricter.phase3.constraints_resolution?.removed_from_available_equipment ?? []),
    ["eq_barbell"],
    "stricter overlap removal must be emitted deterministically"
  );

  assert.deepEqual(
    asSortedUnique(p3Strictest.phase3.constraints_resolution?.rules_applied ?? []),
    ["banned_over_available_equipment"],
    "additional overlap must preserve the same precedence rule identity"
  );

  assert.deepEqual(
    asSortedUnique(p3Strictest.phase3.constraints_resolution?.removed_from_available_equipment ?? []),
    ["eq_barbell", "eq_rack"],
    "strictest overlap removal must be emitted deterministically"
  );

  assert.deepEqual(
    asSortedUnique(p3MissingBan.phase3.constraints_resolution?.removed_from_available_equipment ?? []),
    [],
    "non-overlapping bans must not fabricate removals"
  );
});

test("S4 phase3 remove-only constraint engine: semantically identical stricter accepted inputs replay identical phase3 output", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath } = await ensureBuiltEngine(root, env);

  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  const variantA = {
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
      banned_equipment: ["eq_barbell", "eq_rack"]
    }
  };

  const variantB = {
    constraints: {
      banned_equipment: ["eq_rack", "eq_barbell"],
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

  const p1a = phase1Validate(variantA);
  const p1b = phase1Validate(variantB);

  assert.equal(p1a.ok, true, `variantA phase1 failed: ${JSON.stringify(p1a)}`);
  assert.equal(p1b.ok, true, `variantB phase1 failed: ${JSON.stringify(p1b)}`);

  assert.deepEqual(
    p1a.canonical_input,
    p1b.canonical_input,
    "phase1 canonical input must be identical for semantically identical stricter inputs"
  );

  const p3a = phase3ResolveConstraintsAndLoadRegistries(p1a.canonical_input);
  const p3b = phase3ResolveConstraintsAndLoadRegistries(p1b.canonical_input);

  assert.equal(p3a.ok, true, `variantA phase3 failed: ${JSON.stringify(p3a)}`);
  assert.equal(p3b.ok, true, `variantB phase3 failed: ${JSON.stringify(p3b)}`);

  assert.deepEqual(
    p3a.phase3,
    p3b.phase3,
    "phase3 output must replay identically for semantically identical stricter inputs"
  );

  assert.deepEqual(
    asSortedUnique(p3a.phase3.constraints.available_equipment),
    ["eq_bench"],
    "strict replay case must remain remove-only and end with the pruned singleton set"
  );

  assert.deepEqual(
    asSortedUnique(p3a.phase3.constraints.banned_equipment),
    ["eq_barbell", "eq_rack"],
    "strict replay case must retain the banned_equipment set"
  );

  assert.deepEqual(
    asSortedUnique(p3a.phase3.constraints_resolution?.removed_from_available_equipment ?? []),
    ["eq_barbell", "eq_rack"],
    "strict replay case must deterministically record all removed overlap"
  );
});