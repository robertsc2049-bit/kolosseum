// DEV NOTE: BETA-FIX-01 behavioural copy-registry reconciliation tests.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BETA_COPY_REQUIRED_IDS,
  BETA_COPY_TOKENS,
  scanBetaCopyText,
  verifyBetaCopyRegistry
} from "../ci/lib/beta_copy_registry_guard_lib.mjs";

import {
  buildBeta20Phase7CopyReferences,
  lintBeta20Phase7CopyRegistry,
  validateBeta20Phase7CopyReferences
} from "../ci/lib/beta20_phase7_copy_guard_lib.mjs";

import {
  createCiTokenReport
} from "../ci/scripts/ci_token_report.mjs";

const repoRoot = process.cwd();
const fixtureCases = JSON.parse(fs.readFileSync("test/fixtures/beta_fix_01_copy_registry_reconciliation/cases.json", "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function writeFile(root, relPath, content) {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function writeJson(root, relPath, value) {
  writeFile(root, relPath, JSON.stringify(value, null, 2) + "\n");
}

function hashFile(root, relPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relPath))).digest("hex");
}

function readRepoJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), "utf8"));
}

function seedRepo({ source = "node.textContent = copy(\"beta.onboarding.title\");\n", registryMutator = null, scopeMutator = null, subordinateMutator = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-beta-fix-01-"));
  const registry = readRepoJson("copy/beta_copy_registry.json");
  const scope = readRepoJson("ci/locks/beta_copy_scope.json");

  for (const subordinate of registry.subordinate_registries) {
    const content = fs.readFileSync(path.join(repoRoot, subordinate.path));
    writeFile(root, subordinate.path, content);
    if (subordinate.mirror_path) writeFile(root, subordinate.mirror_path, content);
  }

  if (typeof subordinateMutator === "function") subordinateMutator({ root, registry });

  const testScope = {
    ...scope,
    registry_paths: ["copy/beta_copy_registry.json", ...registry.subordinate_registries.flatMap((item) => item.mirror_path ? [item.path, item.mirror_path] : [item.path])],
    inline_scan_paths: ["src/ui/beta/surface.mjs"],
    reference_scan_paths: [],
    path_prefixes: ["app/beta/", "src/beta/", "src/ui/beta/", "server/beta/", "web/beta/", "client/beta/"],
    technical_exclusions: []
  };

  if (typeof registryMutator === "function") registryMutator(registry);
  if (typeof scopeMutator === "function") scopeMutator(testScope);

  writeJson(root, "copy/beta_copy_registry.json", registry);
  writeJson(root, "ci/locks/beta_copy_scope.json", testScope);
  writeFile(root, "src/ui/beta/surface.mjs", source);
  return { root, registry, scope: testScope };
}

function runSeed(options = {}) {
  const seeded = seedRepo(options);
  return {
    ...seeded,
    result: verifyBetaCopyRegistry({ root: seeded.root })
  };
}

function hasToken(result, token) {
  return result.failures.some((failure) => failure.token === token);
}

test("BETA-FIX-01 current authoritative beta copy registry passes", () => {
  const result = verifyBetaCopyRegistry();
  assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
});

test("BETA-FIX-01 retains all 21 required BETA-04 IDs", () => {
  const registry = readRepoJson("copy/beta_copy_registry.json");
  assert.deepEqual([...registry.required_copy_ids].sort(), [...BETA_COPY_REQUIRED_IDS].sort());
  assert.deepEqual(registry.entries.map((entry) => entry.copy_id).sort(), [...BETA_COPY_REQUIRED_IDS].sort());
});

test("BETA-FIX-01 allowed registered copy-ID usage passes", () => {
  const fixture = fixtureCases.cases.find((item) => item.case_id === "allowed_registered_copy");
  const { result } = runSeed({ source: fixture.source });
  assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
});

test("BETA-FIX-01 inline user-facing copy fails", () => {
  const fixture = fixtureCases.cases.find((item) => item.case_id === "inline_copy");
  const { result } = runSeed({ source: fixture.source });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.inlineCopy), true);
});

test("BETA-FIX-01 unknown copy-ID reference fails", () => {
  const fixture = fixtureCases.cases.find((item) => item.case_id === "unknown_copy_id");
  const { result } = runSeed({ source: fixture.source });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.unknownCopyId), true);
});

test("BETA-FIX-01 missing required copy ID fails", () => {
  const { result } = runSeed({
    registryMutator(registry) {
      registry.required_copy_ids.pop();
      registry.entries.pop();
      registry.canonical_copy_ids = registry.canonical_copy_ids.filter((copyId) => copyId !== BETA_COPY_REQUIRED_IDS.at(-1));
    }
  });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.missingRequiredCopyId), true);
});

test("BETA-FIX-01 duplicate baseline copy ID fails", () => {
  const { result } = runSeed({
    registryMutator(registry) {
      registry.entries.push(clone(registry.entries[0]));
    }
  });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.duplicateCopyId), true);
});

test("BETA-FIX-01 subordinate registry conflict fails", () => {
  const { result } = runSeed({
    subordinateMutator({ root, registry }) {
      const subordinate = registry.subordinate_registries[0];
      const values = JSON.parse(fs.readFileSync(path.join(root, subordinate.path), "utf8"));
      values[0].copy_id = BETA_COPY_REQUIRED_IDS[0];
      writeJson(root, subordinate.path, values);
      writeJson(root, subordinate.mirror_path, values);
      subordinate.copy_ids[0] = BETA_COPY_REQUIRED_IDS[0];
      subordinate.content_sha256 = hashFile(root, subordinate.path);
      subordinate.mirror_sha256 = hashFile(root, subordinate.mirror_path);
    }
  });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.duplicateCopyId), true);
});

test("BETA-FIX-01 forbidden simple term fails", () => {
  const fixture = fixtureCases.cases.find((item) => item.case_id === "forbidden_language");
  const failures = scanBetaCopyText(fixture.text, "fixture");
  assert.equal(failures.some((failure) => failure.token === BETA_COPY_TOKENS.forbiddenLanguage), true);
});

test("BETA-FIX-01 contextual claim fails separately", () => {
  const fixture = fixtureCases.cases.find((item) => item.case_id === "contextual_claim");
  const failures = scanBetaCopyText(fixture.text, "fixture");
  assert.equal(failures.some((failure) => failure.token === BETA_COPY_TOKENS.forbiddenContext), true);
});

test("BETA-FIX-01 valid factual copy passes", () => {
  const fixture = fixtureCases.cases.find((item) => item.case_id === "valid_factual_copy");
  assert.deepEqual(scanBetaCopyText(fixture.text, "fixture"), []);
});

test("BETA-FIX-01 scoped beta prefixes are scanned", () => {
  const seeded = seedRepo();
  writeFile(seeded.root, "app/beta/future.js", "node.textContent = \"Future inline beta wording\";\n");
  const result = verifyBetaCopyRegistry({ root: seeded.root });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.inlineCopy), true);
});

test("BETA-FIX-01 unscoped technical files are not presentation scanned", () => {
  const seeded = seedRepo();
  writeFile(seeded.root, "src/internal/technical.mjs", "const note = \"Technical internal phrase only\";\n");
  const result = verifyBetaCopyRegistry({ root: seeded.root });
  assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
});

test("BETA-FIX-01 invalid scope-path contract fails", () => {
  const { result } = runSeed({
    scopeMutator(scope) {
      scope.path_prefixes = scope.path_prefixes.slice(1);
    }
  });
  assert.equal(result.ok, false);
  assert.equal(hasToken(result, BETA_COPY_TOKENS.invalidScope), true);
});

test("BETA-FIX-01 BETA-20 copy references remain valid", () => {
  const references = buildBeta20Phase7CopyReferences();
  assert.deepEqual(validateBeta20Phase7CopyReferences(references), references);
});

test("BETA-FIX-01 BETA-20 inline-copy rejection remains active", () => {
  const references = clone(buildBeta20Phase7CopyReferences());
  references.section_label_copy_ids.program_summary = "Programme summary";
  assert.throws(() => validateBeta20Phase7CopyReferences(references), (error) => error?.reason === "inline_copy_or_unknown_reference_forbidden");
});

test("BETA-FIX-01 BETA-20 forbidden-language rejection remains active", () => {
  const registry = readRepoJson("copy/beta_20_phase7_projection_copy.json");
  registry.entries[0].text = "Recommended next step";
  const result = lintBeta20Phase7CopyRegistry(registry);
  assert.equal(result.ok, false);
  assert.equal(result.failures.some((failure) => failure.reason === "claim_term_found"), true);
});

test("BETA-FIX-01 failures use the structured CI token report", () => {
  const report = createCiTokenReport({
    guard: "BETA-FIX-01",
    token: BETA_COPY_TOKENS.guard,
    failures: [{ token: BETA_COPY_TOKENS.inlineCopy, message: "Inline copy blocked." }]
  });
  assert.equal(report.schema_version, "kolosseum.ci_token_report.v1");
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, BETA_COPY_TOKENS.inlineCopy);
});
