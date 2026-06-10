#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "docs", "v0", "V0_COMPLETION_GATE_MANIFEST.json");
const packagePath = path.join(repoRoot, "package.json");

function normalise(value) {
  return String(value).replace(/\\/g, "/");
}

function fail(message, details = {}) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    token: "V0_COMPLETION_GATE_MANIFEST_INVALID",
    message,
    details
  }, null, 2)}\n`);
  process.exit(1);
}

function assert(condition, message, details = {}) {
  if (!condition) fail(message, details);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Failed to read JSON: ${normalise(path.relative(repoRoot, filePath))}`, {
      error: String(error?.message || error)
    });
  }
}

function existsRel(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function assertCleanTree() {
  const git = spawnSync("git", ["status", "--short"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (git.status !== 0) {
    fail("git status --short failed.", {
      stderr: String(git.stderr || "").trim()
    });
  }

  const status = String(git.stdout || "").trim();
  assert(status.length === 0, "Completion gate verifier requires a clean working tree.", { status });
}

function assertStringArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
  for (const item of value) {
    assert(typeof item === "string" && item.trim().length > 0, `${label} must contain only non-empty strings.`);
  }
}

function assertCommandOrder(lintFast, requiredEntries) {
  let lastIndex = -1;

  for (const entry of requiredEntries) {
    const index = lintFast.indexOf(entry);
    assert(index >= 0, "Required lint:fast entry missing.", { entry });
    assert(index > lastIndex, "Required lint:fast entries are out of order.", {
      entry,
      previous_index: lastIndex,
      index
    });
    lastIndex = index;
  }
}

function main() {
  assertCleanTree();

  assert(fs.existsSync(manifestPath), "Missing v0 completion gate manifest JSON.", {
    path: normalise(path.relative(repoRoot, manifestPath))
  });

  assert(fs.existsSync(packagePath), "Missing package.json.");

  const manifest = readJson(manifestPath);
  const pkg = readJson(packagePath);

  assert(manifest.manifest_id === "v0_completion_gate_manifest", "Invalid manifest_id.");
  assert(manifest.manifest_version === "1.0.0", "Invalid manifest_version.");
  assert(manifest.status === "authoritative", "Manifest status must be authoritative.");
  assert(manifest.release?.release_id === "v0", "Manifest release_id must be v0.");
  assert(manifest.authority?.creates_engine_law === false, "Completion manifest must not create engine law.");
  assert(manifest.authority?.creates_product_scope === false, "Completion manifest must not create product scope.");
  assert(manifest.authority?.checklist_only === true, "Completion manifest must be checklist-only.");

  assert(Array.isArray(manifest.required_source_documents), "required_source_documents must be an array.");
  for (const doc of manifest.required_source_documents) {
    assert(typeof doc?.id === "string" && doc.id.length > 0, "Source document requires id.", { doc });
    assert(typeof doc?.path === "string" && doc.path.length > 0, "Source document requires path.", { doc });

    if (doc.required === true) {
      assert(existsRel(doc.path), "Required source document is missing.", { id: doc.id, path: doc.path });
    }
  }

  assert(Array.isArray(manifest.required_commands), "required_commands must be an array.");
  for (const command of manifest.required_commands) {
    assert(typeof command?.id === "string" && command.id.length > 0, "Required command requires id.", { command });
    assert(typeof command?.command === "string" && command.command.length > 0, "Required command requires command text.", { command });
    assert(command.required === true, "Required command must declare required=true.", { command });
  }

  assertStringArray(manifest.required_guard_presence, "required_guard_presence");
  for (const guardPath of manifest.required_guard_presence) {
    assert(existsRel(guardPath), "Required guard/runner is missing.", { path: guardPath });
  }

  assertStringArray(manifest.required_lint_fast_entries, "required_lint_fast_entries");

  const lintFast = String(pkg?.scripts?.["lint:fast"] || "");
  assert(lintFast.length > 0, "package.json scripts.lint:fast is missing.");

  assertCommandOrder(lintFast, manifest.required_lint_fast_entries);

  assert(Array.isArray(manifest.completion_assertions), "completion_assertions must be an array.");
  assert(manifest.completion_assertions.length >= 5, "completion_assertions must contain the core v0 completion assertions.");

  const assertionText = JSON.stringify(manifest.completion_assertions);
  assert(assertionText.includes("does not create new engine behaviour"), "Completion assertions must preserve no-new-engine-law boundary.");

  assert(Array.isArray(manifest.not_completion_claims), "not_completion_claims must be an array.");
  assert(manifest.not_completion_claims.length >= 3, "not_completion_claims must state release-boundary limits.");

  process.stdout.write(`${JSON.stringify({
    ok: true,
    manifest_id: manifest.manifest_id,
    manifest_version: manifest.manifest_version,
    required_source_documents: manifest.required_source_documents.length,
    required_commands: manifest.required_commands.length,
    required_guard_presence: manifest.required_guard_presence.length,
    required_lint_fast_entries: manifest.required_lint_fast_entries.length
  }, null, 2)}\n`);
}

main();
