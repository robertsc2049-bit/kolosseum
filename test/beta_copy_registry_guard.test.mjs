import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  BETA_COPY_REQUIRED_IDS,
  TOKEN
} from "../ci/scripts/run_beta_copy_registry_guard.mjs";

const scriptPath = path.resolve("ci/scripts/run_beta_copy_registry_guard.mjs");

function writeFile(root, relPath, content) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, String(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function writeJson(root, relPath, value) {
  writeFile(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function validRegistry(overrides = {}) {
  const entries = BETA_COPY_REQUIRED_IDS.map((copyId) => ({
    copy_id: copyId,
    domain: copyId.split(".")[1],
    text: {
      "beta.onboarding.title": "Beta setup",
      "beta.onboarding.body": "Enter declared details only.",
      "beta.declaration.error.required": "Declaration field required.",
      "beta.declaration.error.invalid_scope": "Declaration outside beta scope.",
      "beta.session_compile.action": "Compile session.",
      "beta.session_compile.unavailable": "Session cannot be compiled from current declarations.",
      "beta.runtime_execution.start": "Start recorded execution.",
      "beta.runtime_execution.record_event": "Record event.",
      "beta.split_return.split": "Split recorded set.",
      "beta.split_return.return": "Return to recorded work.",
      "beta.partial_completion.recorded": "Partial completion recorded.",
      "beta.coach_assignment.assigned": "Coach assignment recorded.",
      "beta.coach_assignment.unassigned": "No coach assignment recorded.",
      "beta.coach_notes.boundary": "Coach notes are non-binding.",
      "beta.projection.summary": "Projection view shows recorded structure only.",
      "beta.replay.status": "Replay status recorded.",
      "beta.evidence.status": "Evidence status recorded.",
      "beta.export.action": "Create export.",
      "beta.export.limitation": "Export contains recorded data only.",
      "beta.limitations.scope": "Beta scope is limited to declared beta paths.",
      "beta.limitations.non_claim": "Kolosseum records facts only."
    }[copyId],
    params: []
  }));

  return {
    schema_version: "kolosseum.beta.copy_registry.v1",
    registry_id: "beta_copy_registry_baseline",
    closed_world: true,
    locale: "en-GB",
    required_copy_ids: [...BETA_COPY_REQUIRED_IDS],
    entries,
    ...overrides
  };
}

function seedRepo({ registry = validRegistry(), source = "BETA_COPY('beta.onboarding.title');\n" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-beta-copy-"));

  writeJson(root, "src/ui/copy/beta_copy_registry.json", registry);
  writeJson(root, "ci/locks/beta_copy_scope.json", {
    schema_version: "kolosseum.beta.copy_scope.v1",
    scope_id: "beta_copy_registry_scope",
    registry_path: "src/ui/copy/beta_copy_registry.json",
    paths: ["src/ui/beta/surface.mjs"],
    path_prefixes: []
  });
  writeFile(root, "src/ui/beta/surface.mjs", source);

  return root;
}

function runGuard(root) {
  const result = spawnSync(process.execPath, [
    scriptPath,
    "--root",
    root,
    "--registry",
    "src/ui/copy/beta_copy_registry.json",
    "--scope",
    "ci/locks/beta_copy_scope.json"
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  const raw = `${result.stdout}\n${result.stderr}`.trim();
  let parsed = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        parsed = JSON.parse(lines[i]);
        break;
      } catch {
        continue;
      }
    }
  }

  assert.ok(parsed, `expected JSON report\nstatus: ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);

  return {
    status: result.status,
    report: parsed,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

test("BETA-04 allowed beta copy ID surface passes", () => {
  const root = seedRepo();

  const result = runGuard(root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.ok, true);
  assert.equal(result.report.guard, "BETA-04");
  assert.equal(result.report.token, TOKEN.guard);
});

test("BETA-04 inline beta copy fails", () => {
  const root = seedRepo({
    source: "const title = \"Inline beta onboarding text\";\n"
  });

  const result = runGuard(root);

  assert.notEqual(result.status, 0);
  assert.equal(result.report.ok, false);
  assert.equal(result.report.failures.some((failure) => failure.token === TOKEN.inlineCopy), true);
});

test("BETA-04 forbidden term in registry copy fails", () => {
  const registry = validRegistry();
  registry.entries = registry.entries.map((entry) =>
    entry.copy_id === "beta.onboarding.title"
      ? { ...entry, text: "Safer beta setup." }
      : entry
  );

  const root = seedRepo({ registry });
  const result = runGuard(root);

  assert.notEqual(result.status, 0);
  assert.equal(result.report.ok, false);
  assert.equal(result.report.failures.some((failure) => failure.token === TOKEN.forbiddenLanguage), true);
});

test("BETA-04 contextual claim in registry copy fails", () => {
  const registry = validRegistry();
  registry.entries = registry.entries.map((entry) =>
    entry.copy_id === "beta.onboarding.title"
      ? { ...entry, text: "Designed for you." }
      : entry
  );

  const root = seedRepo({ registry });
  const result = runGuard(root);

  assert.notEqual(result.status, 0);
  assert.equal(result.report.ok, false);
  assert.equal(result.report.failures.some((failure) => failure.token === TOKEN.forbiddenClaimSemantic), true);
});

test("BETA-04 repo registry contains the required baseline copy IDs exactly", () => {
  const registry = JSON.parse(fs.readFileSync("src/ui/copy/beta_copy_registry.json", "utf8"));
  const ids = registry.entries.map((entry) => entry.copy_id).sort();

  assert.deepEqual(ids, [...BETA_COPY_REQUIRED_IDS].sort());
  assert.deepEqual([...registry.required_copy_ids].sort(), [...BETA_COPY_REQUIRED_IDS].sort());
});
