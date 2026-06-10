
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadRegistry,
  scanFiles,
  validateRegistry,
} from "../../ci/scripts/run_public_sales_claim_registry_guard.mjs";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "claims", "public_sales_claim_registry.json");
const fixturesPath = path.join(repoRoot, "tests", "fixtures", "public_sales_claim_registry_guard_fixtures.json");
const docPath = path.join(repoRoot, "docs", "slices", "PUBLIC_SALES_CLAIM_REGISTRY_GUARD.md");
const guardPath = path.join(repoRoot, "ci", "scripts", "run_public_sales_claim_registry_guard.mjs");

const registry = loadRegistry(registryPath);
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");
const guardSource = fs.readFileSync(guardPath, "utf8");

const tmpDir = path.join(os.tmpdir(), "kolosseum_s44_public_sales_claim_guard");

function writeTmpFile(name, content) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, `${content}\n`, "utf8");
  return filePath;
}

function joinParts(parts) {
  return parts.join("");
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("S44_REGISTRY_001 registry is closed-world and valid", () => {
  assert.equal(registry.schema_version, "kolosseum.public_sales_claim_registry.v1");
  assert.equal(registry.closed_world, true);
  assert.equal(registry.claim_marker, "PUBLIC_CLAIM:");
  assert.deepEqual(validateRegistry(registry), []);
});

run("S44_REGISTRY_002 allowed claim types are exact", () => {
  assert.deepEqual(
    registry.allowed_claim_types.sort(),
    [
      "access_fact",
      "authority_limit",
      "factual_runtime_surface",
      "price_fact",
      "proof_scoped_value",
      "seat_cap_fact",
      "visibility_fact"
    ].sort()
  );
});

run("S44_REGISTRY_003 every allowed claim has proof", () => {
  const proofIds = new Set(registry.proofs.map((proof) => proof.proof_id));

  for (const claim of registry.allowed_claims) {
    assert.ok(Array.isArray(claim.proof_ids), `${claim.claim_id} proof_ids missing`);
    assert.ok(claim.proof_ids.length > 0, `${claim.claim_id} proof_ids empty`);

    for (const proofId of claim.proof_ids) {
      assert.ok(proofIds.has(proofId), `${claim.claim_id} unknown proof ${proofId}`);
    }
  }
});

run("S44_ALLOWED_001 coach_16 pricing copy passes", () => {
  const copy = fixtures.allowed_coach_16_claims.map((claim) => `PUBLIC_CLAIM: ${claim}`).join("\n");
  const filePath = writeTmpFile("allowed_coach_16.txt", copy);
  const report = scanFiles({ files: [filePath], registry });

  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.scanned_files, 1);
  assert.deepEqual(report.failures, []);
});

run("S44_FAIL_001 unknown and stronger claims fail", () => {
  for (const fixture of fixtures.bad_claim_token_sets) {
    const filePath = writeTmpFile(`${fixture.id}.txt`, joinParts(fixture.parts));
    const report = scanFiles({ files: [filePath], registry });

    assert.equal(report.ok, false, `${fixture.id} should fail`);
    assert.ok(
      report.failures.some((failure) => failure.code === fixture.expected_code),
      `${fixture.id} expected ${fixture.expected_code}, got ${JSON.stringify(report.failures, null, 2)}`
    );
  }
});

run("S44_FAIL_002 missing proof link fails closed", () => {
  const badRegistry = JSON.parse(JSON.stringify(registry));
  badRegistry.allowed_claims[0].proof_ids = [];

  const failures = validateRegistry(badRegistry);
  assert.ok(failures.some((failure) => failure.code === "PSCRG_MISSING_PROOF_LINK"));
});

run("S44_FAIL_003 unknown proof link fails closed", () => {
  const badRegistry = JSON.parse(JSON.stringify(registry));
  badRegistry.allowed_claims[0].proof_ids = ["proof_missing"];

  const failures = validateRegistry(badRegistry);
  assert.ok(failures.some((failure) => failure.code === "PSCRG_UNKNOWN_PROOF_LINK"));
});

run("S44_FAIL_004 invalid claim type fails closed", () => {
  const badRegistry = JSON.parse(JSON.stringify(registry));
  badRegistry.allowed_claims[0].claim_type = "unregistered_claim_type";

  const failures = validateRegistry(badRegistry);
  assert.ok(failures.some((failure) => failure.code === "PSCRG_INVALID_CLAIM_TYPE"));
});

run("S44_REPORT_001 report format is deterministic", () => {
  const filePath = writeTmpFile("report_unknown.txt", joinParts(["PUBLIC_CLAIM: Unknown stronger claim"]));
  const report = scanFiles({ files: [filePath], registry });

  assert.equal(typeof report.ok, "boolean");
  assert.equal(report.registry_id, "public_sales_claim_registry");
  assert.equal(typeof report.scanned_files, "number");
  assert.ok(Array.isArray(report.failures));

  const failure = report.failures[0];
  assert.ok(Object.hasOwn(failure, "code"));
  assert.ok(Object.hasOwn(failure, "path"));
  assert.ok(Object.hasOwn(failure, "line"));
  assert.ok(Object.hasOwn(failure, "rule_id"));
  assert.ok(Object.hasOwn(failure, "claim"));
  assert.ok(Object.hasOwn(failure, "excerpt"));
});

run("S44_DOC_001 markdown documents exact-match and fail-closed rules", () => {
  assert.ok(doc.includes("PUBLIC_CLAIM: exact registered claim phrase"));
  assert.ok(doc.includes("Fail-Closed Behaviour"));
  assert.ok(doc.includes("Coaches may comment, never decide"));
});

run("S44_GUARD_001 guard exports required functions", () => {
  for (const token of [
    "loadRegistry",
    "validateRegistry",
    "scanText",
    "scanFiles",
    "writeReport",
    "main"
  ]) {
    assert.ok(guardSource.includes(`export function ${token}`), `Missing export: ${token}`);
  }
});

console.log("S44 public sales claim registry guard tests passed.");
