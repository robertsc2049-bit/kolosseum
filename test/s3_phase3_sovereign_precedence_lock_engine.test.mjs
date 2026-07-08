
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

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

// DEV NOTE: S-V0-06 sovereign constraints precedence closure.
// These fixtures prove that explicit Phase 1 constraints remain authoritative
// through Phase 3. Later logic must not restore removed options, reinterpret a
// constraint envelope, or soften invalid constraint shapes into warnings.
const S_V0_06_FIXTURE_LABELS = Object.freeze({
  bannedBeatsAvailable: "S-V0-06 positive: explicit banned equipment wins over lower-priority availability",
  canonicalOrder: "S-V0-06 positive: equivalent declared constraint order replays the same Phase 3 output",
  invalidEnvelope: "S-V0-06 negative: invalid constraint envelope fails closed with explicit token",
  noRecommendationLanguage: "S-V0-06 negative: constraint resolution emits no recommendation language"
});

test("S-V0-06 sovereign constraints precedence closure: explicit banned equipment wins over lower-priority availability", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath } = await ensureBuiltEngine(root, env);
  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  assert.equal(typeof phase1Validate, "function", "expected phase1Validate export");
  assert.equal(typeof phase3ResolveConstraintsAndLoadRegistries, "function", "expected phase3ResolveConstraintsAndLoadRegistries export");

  const fixtureLabel = S_V0_06_FIXTURE_LABELS.bannedBeatsAvailable;
  const input = makeAcceptedPhase1InputVariantA();
  input.constraints = {
    constraints_version: "1.0.0",
    available_equipment: ["eq_plate", "eq_rack", "eq_barbell", "eq_bench"],
    banned_equipment: ["eq_barbell", "eq_bench"]
  };

  const phase1 = phase1Validate(input);
  assert.equal(phase1.ok, true, `${fixtureLabel}: phase1 failed: ${JSON.stringify(phase1)}`);

  const phase3 = phase3ResolveConstraintsAndLoadRegistries(phase1.canonical_input);
  assert.equal(phase3.ok, true, `${fixtureLabel}: phase3 failed: ${JSON.stringify(phase3)}`);

  assert.deepEqual(
    phase3.phase3.constraints.available_equipment,
    ["eq_plate", "eq_rack"],
    `${fixtureLabel}: lower-priority available_equipment must have banned items removed`
  );

  assert.deepEqual(
    phase3.phase3.constraints.banned_equipment,
    ["eq_barbell", "eq_bench"],
    `${fixtureLabel}: sovereign banned_equipment must be preserved`
  );

  assert.deepEqual(
    phase3.phase3.constraints_resolution?.rules_applied,
    ["banned_over_available_equipment"],
    `${fixtureLabel}: precedence rule identity must be explicit and deterministic`
  );

  assert.deepEqual(
    phase3.phase3.constraints_resolution?.removed_from_available_equipment,
    ["eq_barbell", "eq_bench"],
    `${fixtureLabel}: removed lower-priority values must be explicitly recorded`
  );
});

test("S-V0-06 sovereign constraints precedence closure: equivalent declared order replays identical Phase 3 precedence output", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath } = await ensureBuiltEngine(root, env);
  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  const fixtureLabel = S_V0_06_FIXTURE_LABELS.canonicalOrder;

  const variantA = makeAcceptedPhase1InputVariantA();
  variantA.constraints = {
    constraints_version: "1.0.0",
    available_equipment: ["eq_rack", "eq_barbell", "eq_plate", "eq_bench"],
    banned_equipment: ["eq_bench", "eq_barbell"]
  };

  const variantB = makeAcceptedPhase1InputVariantA();
  variantB.constraints = {
    constraints_version: "1.0.0",
    available_equipment: ["eq_bench", "eq_plate", "eq_barbell", "eq_rack"],
    banned_equipment: ["eq_barbell", "eq_bench"]
  };

  const phase1A = phase1Validate(variantA);
  const phase1B = phase1Validate(variantB);

  assert.equal(phase1A.ok, true, `${fixtureLabel}: variantA phase1 failed: ${JSON.stringify(phase1A)}`);
  assert.equal(phase1B.ok, true, `${fixtureLabel}: variantB phase1 failed: ${JSON.stringify(phase1B)}`);

  const phase3A = phase3ResolveConstraintsAndLoadRegistries(phase1A.canonical_input);
  const phase3B = phase3ResolveConstraintsAndLoadRegistries(phase1B.canonical_input);

  assert.equal(phase3A.ok, true, `${fixtureLabel}: variantA phase3 failed: ${JSON.stringify(phase3A)}`);
  assert.equal(phase3B.ok, true, `${fixtureLabel}: variantB phase3 failed: ${JSON.stringify(phase3B)}`);

  assert.deepEqual(
    phase3A.phase3.constraints,
    phase3B.phase3.constraints,
    `${fixtureLabel}: equivalent declaration ordering must not change effective constraints`
  );

  assert.deepEqual(
    phase3A.phase3.constraints_resolution,
    phase3B.phase3.constraints_resolution,
    `${fixtureLabel}: equivalent declaration ordering must not change precedence summary`
  );
});

test("S-V0-06 sovereign constraints precedence closure: invalid constraint envelope fails closed with explicit token", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase3ModulePath } = await ensureBuiltEngine(root, env);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  const fixtureLabel = S_V0_06_FIXTURE_LABELS.invalidEnvelope;

  const phase3 = phase3ResolveConstraintsAndLoadRegistries({
    activity_id: "powerlifting",
    constraints: ["eq_barbell"]
  });

  assert.equal(phase3.ok, false, `${fixtureLabel}: invalid constraints must fail`);
  assert.equal(phase3.failure_token, "type_mismatch", `${fixtureLabel}: failure token must stay stable`);
  assert.deepEqual(
    phase3.details,
    { path: "constraints", expected: "object" },
    `${fixtureLabel}: failure details must be explicit and stable`
  );
});

test("S-V0-06 sovereign constraints precedence closure: output contains no recommendation language or fallback bypass", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath } = await ensureBuiltEngine(root, env);
  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;

  const fixtureLabel = S_V0_06_FIXTURE_LABELS.noRecommendationLanguage;
  const input = makeAcceptedPhase1InputVariantA();
  input.constraints = {
    constraints_version: "1.0.0",
    available_equipment: ["eq_barbell", "eq_dumbbell", "eq_plate"],
    banned_equipment: ["eq_barbell"]
  };

  const phase1 = phase1Validate(input);
  assert.equal(phase1.ok, true, `${fixtureLabel}: phase1 failed: ${JSON.stringify(phase1)}`);

  const phase3 = phase3ResolveConstraintsAndLoadRegistries(phase1.canonical_input);
  assert.equal(phase3.ok, true, `${fixtureLabel}: phase3 failed: ${JSON.stringify(phase3)}`);

  const serialized = JSON.stringify(phase3).toLowerCase();

  for (const forbidden of ["recommend", "recommended", "recommendation", "bypass", "override"]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `${fixtureLabel}: Phase 3 sovereign constraint output must not contain forbidden term ${forbidden}`
    );
  }
});
