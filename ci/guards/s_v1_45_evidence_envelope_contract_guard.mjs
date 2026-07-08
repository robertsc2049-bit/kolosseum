// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-45 artefact envelope contract guard.
 * Purpose: proves the v1 artefact envelope contract remains process-integrity-only,
 * deterministic, source-bound, and tamper-detecting.
 * Boundary: checks contract wiring and invariant behaviour only. It does not create
 * product approval, medical approval, suitability approval, coach intervention, or
 * engine authority.
 * Determinism: reads committed files, runs fixed fixtures, and compares stable hashes.
 * Failure: emits CI_V1_EVIDENCE_ENVELOPE_CONTRACT when wiring, wording, or seal
 * behaviour drifts.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

import {
  S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES,
  getV1ArtefactEnvelopeContract,
  tryBuildV1ArtefactEnvelope,
  verifyV1ArtefactEnvelope
} from "../../src/v1EvidenceEnvelopeContract.mjs";

const GUARD = "S-V1-45";
const TOKEN = "CI_V1_EVIDENCE_ENVELOPE_CONTRACT";

const FILES = Object.freeze({
  source: "src/v1EvidenceEnvelopeContract.mjs",
  test: "test/s_v1_45_evidence_envelope_contract.test.mjs",
  guard: "ci/guards/s_v1_45_evidence_envelope_contract_guard.mjs",
  doc: "docs/v1/V1_EVIDENCE_ENVELOPE_CONTRACT.md",
  fixture: "ci/fixtures/s_v1_45_evidence_envelope_tamper_negative.json",
  packageJson: "package.json"
});

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    details
  }, null, 2));
  process.exitCode = 1;
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(`Missing required file: ${file}`);
    return "";
  }

  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function assertIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(`${file} must include ${needle}`);
  }
}

function assertNotIncludes(text, needle, file) {
  if (text.includes(needle)) {
    fail(`${file} must not include ${needle}`);
  }
}

function runNodeTest(file) {
  const result = spawnSync(process.execPath, ["--test", file], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false
  });

  if (result.status !== 0) {
    fail(`${file} failed`, {
      stdout: result.stdout,
      stderr: result.stderr
    });
  }
}

function validInput() {
  return {
    source_binding: {
      source_id: "guard_runtime_log",
      source_type: "runtime_event_log",
      source_hash_sha256: "a".repeat(64)
    },
    replay_boundary: {
      accepted_proof_available: true,
      proof_scope: "process_integrity_only",
      source_bound: true,
      external_approval: false,
      correctness_claim: false,
      training_value_claim: false
    },
    artefact_binding: {
      artefact_id: "guard_replay_boundary_record",
      artefact_type: "replay_boundary_record",
      artefact_hash_sha256: "b".repeat(64)
    },
    issued_at_iso8601: "2026-06-16T00:00:00.000Z"
  };
}

const source = read(FILES.source);
const test = read(FILES.test);
const doc = read(FILES.doc);
const fixtureText = read(FILES.fixture);
const packageJson = read(FILES.packageJson);

for (const [file, text] of [
  [FILES.source, source],
  [FILES.test, test],
  [FILES.doc, doc],
  [FILES.fixture, fixtureText],
  [FILES.packageJson, packageJson]
]) {
  if (text.length === 0) {
    fail(`${file} must not be empty`);
  }
}

assertIncludes(packageJson, "node --test test/s_v1_45_evidence_envelope_contract.test.mjs", FILES.packageJson);
assertIncludes(packageJson, "node ci/guards/s_v1_45_evidence_envelope_contract_guard.mjs", FILES.packageJson);

assertIncludes(source, "Evidence proves process integrity only.", FILES.source);
assertIncludes(source, "Evidence does not imply correctness.", FILES.source);
assertIncludes(source, "process_integrity_only: true", FILES.source);
assertIncludes(source, "correctness_claim: false", FILES.source);
assertIncludes(source, "training_value_claim: false", FILES.source);
assertIncludes(source, "medical_approval: false", FILES.source);
assertIncludes(source, "suitability_approval: false", FILES.source);
assertIncludes(source, "verifyV1ArtefactEnvelope", FILES.source);

for (const forbidden of [
  "phase7",
  "phase8",
  "phase_7",
  "phase_8",
  "evidence_envelope",
  "evidence sealing",
  "sealEvidence",
  "@kolosseum/engine",
  "engine/src/"
]) {
  assertNotIncludes(source, forbidden, FILES.source);
}

assertIncludes(doc, "Evidence proves process integrity only.", FILES.doc);
assertIncludes(doc, "Evidence does not imply correctness.", FILES.doc);
assertIncludes(doc, "Envelope hash and seal hash are deterministic.", FILES.doc);
assertIncludes(doc, "Tampered envelope material is rejected.", FILES.doc);

const fixture = JSON.parse(fixtureText);
if (fixture.expected_error_code !== S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.MATERIAL_HASH_MISMATCH) {
  fail("tamper fixture must target material hash mismatch.");
}

const contract = getV1ArtefactEnvelopeContract();
if (contract.integrity_boundary.process_integrity_only !== true) {
  fail("contract must remain process-integrity-only.");
}
if (contract.integrity_boundary.correctness_claim !== false || contract.integrity_boundary.training_value_claim !== false) {
  fail("contract must suppress correctness and training-value claims.");
}

const built = tryBuildV1ArtefactEnvelope(validInput());
if (!built.ok) {
  fail(`valid fixture failed: ${built.error_code}`);
}

const verified = verifyV1ArtefactEnvelope(built.envelope);
if (!verified.ok) {
  fail(`valid envelope verification failed: ${verified.error_code}`);
}

const tampered = JSON.parse(JSON.stringify(built.envelope));
tampered.source_binding.source_hash_sha256 = fixture.mutation.replacement;

const tamperResult = verifyV1ArtefactEnvelope(tampered);
if (tamperResult.ok || tamperResult.error_code !== S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.MATERIAL_HASH_MISMATCH) {
  fail("tampered envelope must fail material hash verification.");
}

runNodeTest(FILES.test);

if (process.exitCode) {
  throw new Error("S-V1-45 evidence envelope contract guard failed.");
}

console.log("s_v1_45_evidence_envelope_contract_guard: PASS");