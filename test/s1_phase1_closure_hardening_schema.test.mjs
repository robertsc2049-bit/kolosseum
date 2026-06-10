/* test/s1_phase1_closure_hardening_schema.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";

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

async function ensureBuiltPhase1(root, env) {
  const phase1ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase1.js");

  if (!(await fileExists(phase1ModulePath))) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(
    await fileExists(phase1ModulePath),
    true,
    `expected built phase1 module to exist: ${phase1ModulePath}`
  );

  return phase1ModulePath;
}

function makeValidPhase1Input() {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "powerlifting",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

test("S1 phase1 closure hardening: closed-world schema rejects unknown, missing-required, and conditional-invalid inputs", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const phase1ModulePath = await ensureBuiltPhase1(root, env);
  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);

  assert.equal(typeof phase1Module.phase1Validate, "function", "expected phase1Validate export");

  const { phase1Validate } = phase1Module;

  {
    const valid = phase1Validate(makeValidPhase1Input());
    assert.equal(valid.ok, true, `expected canonical happy path to remain valid. got=${JSON.stringify(valid)}`);
    assert.equal(valid.canonical_input.execution_scope, "individual");
    assert.equal(valid.canonical_input.activity_id, "powerlifting");
  }

  {
    const input = {
      ...makeValidPhase1Input(),
      unknown_top_level_field: "forbidden"
    };

    const result = phase1Validate(input);
    assert.equal(result.ok, false, "expected unknown top-level field to fail");
    assert.equal(result.failure_token, "type_mismatch");
    assert.ok(Array.isArray(result.details), "expected AJV errors array for unknown field failure");
    assert.ok(
      result.details.some(
        (err) =>
          err &&
          err.keyword === "additionalProperties" &&
          err.params &&
          err.params.additionalProperty === "unknown_top_level_field"
      ),
      `expected additionalProperties error for unknown_top_level_field. got=${JSON.stringify(result.details)}`
    );
  }

  {
    const input = makeValidPhase1Input();
    delete input.activity_id;

    const result = phase1Validate(input);
    assert.equal(result.ok, false, "expected missing required field to fail");
    assert.equal(result.failure_token, "type_mismatch");
    assert.ok(Array.isArray(result.details), "expected AJV errors array for missing required field");
    assert.ok(
      result.details.some(
        (err) =>
          err &&
          err.keyword === "required" &&
          err.params &&
          err.params.missingProperty === "activity_id"
      ),
      `expected required error for activity_id. got=${JSON.stringify(result.details)}`
    );
  }

  {
    const input = {
      ...makeValidPhase1Input(),
      execution_scope: "coach_managed"
    };

    const result = phase1Validate(input);
    assert.equal(result.ok, false, "expected missing governing_authority_id for coach_managed to fail");
    assert.equal(result.failure_token, "type_mismatch");
    assert.ok(Array.isArray(result.details), "expected AJV errors array for conditional-required failure");
    assert.ok(
      result.details.some(
        (err) =>
          err &&
          err.keyword === "required" &&
          err.params &&
          err.params.missingProperty === "governing_authority_id"
      ),
      `expected required error for governing_authority_id. got=${JSON.stringify(result.details)}`
    );
  }

  {
    const input = {
      ...makeValidPhase1Input(),
      constraints: {
        constraints_version: "1.0.0",
        unknown_nested_field: true
      }
    };

    const result = phase1Validate(input);
    assert.equal(result.ok, false, "expected unknown nested constraints field to fail");
    assert.equal(result.failure_token, "type_mismatch");
    assert.ok(Array.isArray(result.details), "expected AJV errors array for nested unknown field");
    assert.ok(
      result.details.some(
        (err) =>
          err &&
          err.keyword === "additionalProperties" &&
          err.params &&
          err.params.additionalProperty === "unknown_nested_field"
      ),
      `expected additionalProperties error for unknown_nested_field. got=${JSON.stringify(result.details)}`
    );
  }
});
