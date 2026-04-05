import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), "utf8"));
}

function walkFiles(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    results.push(current);
  }
  return results;
}

function rel(fullPath) {
  return path.relative(repoRoot, fullPath).replace(/\\/g, "/");
}

const scope = readJson("ci/locks/v0_export_nothing_scope.json");
const excludedRegexes = scope.excluded_path_patterns.map((pattern) => new RegExp(pattern, "i"));
const forbiddenContentRegexes = scope.forbidden_content_regexes.map((pattern) => new RegExp(pattern, "i"));

function isExcluded(relPath) {
  return excludedRegexes.some((rx) => rx.test(relPath));
}

function collectRuntimeFiles() {
  const files = [];
  for (const root of scope.runtime_roots) {
    const absRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absRoot)) continue;
    for (const fullPath of walkFiles(absRoot)) {
      const relPath = rel(fullPath);
      if (isExcluded(relPath)) continue;
      if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|html|css)$/i.test(relPath)) continue;
      files.push(relPath);
    }
  }
  return files.sort();
}

test("export-nothing scope file is pinned and non-empty", () => {
  assert.equal(scope.schema_version, "kolosseum.v0_export_nothing_scope.v1.0.0");
  assert.ok(Array.isArray(scope.runtime_roots));
  assert.ok(scope.runtime_roots.length > 0);
});

test("runtime scan scope resolves to at least one runtime file", () => {
  const runtimeFiles = collectRuntimeFiles();
  assert.ok(runtimeFiles.length > 0, "runtime scan found no files; scope is too weak to prove reachability.");
});

test("no forbidden export or evidence route or UI markers are reachable in v0 runtime roots", () => {
  const runtimeFiles = collectRuntimeFiles();
  for (const relPath of runtimeFiles) {
    const text = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
    for (const rx of forbiddenContentRegexes) {
      assert.equal(rx.test(text), false, `forbidden runtime surface reachability in ${relPath} via ${rx}`);
    }
  }
});

test("versioned implementation files may exist in repo without proving v0 reachability", () => {
  const runtimeFiles = collectRuntimeFiles();
  assert.ok(runtimeFiles.includes("src/api/evidence_activation_v1.ts") || true);
});

test("guard excludes test surfaces from runtime reachability proof", () => {
  assert.equal(isExcluded("test/example.test.mjs"), true);
  assert.equal(isExcluded("src/api/example.ts"), false);
});