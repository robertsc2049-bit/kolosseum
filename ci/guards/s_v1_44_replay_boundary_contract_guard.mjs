// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import {
  S_V1_44_ALLOWED_REPLAY_PHASES,
  S_V1_44_FAILURE_CODES,
  S_V1_44_REPLAY_BOUNDARY_COPY,
  getReplayBoundaryContractV1,
  tryBuildReplayBoundaryRecordV1
} from "../../src/v1ReplayBoundaryContract.mjs";

const ROOT = process.cwd();
const TOKEN = "CI_V1_REPLAY_BOUNDARY_CONTRACT";

const REQUIRED_FILES = [
  "src/v1ReplayBoundaryContract.mjs",
  "test/s_v1_44_replay_boundary_contract.test.mjs",
  "ci/guards/s_v1_44_replay_boundary_contract_guard.mjs",
  "docs/v1/V1_REPLAY_BOUNDARY_CONTRACT.md"
];

/**
 * DEV NOTE:
 * Purpose: enforces that S-V1-44 remains a narrow replay boundary contract with
 * source binding, rejected-replay handling, and neutral wording.
 * Boundary: this guard does not run the replay runner and does not generate
 * evidence; it checks the contract slice wiring and invariant text.
 * Determinism: reads fixed files and fixed strings only.
 * Failure: any missing file, missing package wiring, forbidden phase, or wording
 * drift terminates with a non-zero status.
 */
function main() {
  void TOKEN;
  for (const file of REQUIRED_FILES) {
    requireFile(file);
  }

  const packageJson = readText("package.json");
  requireText(packageJson, "node --test test/s_v1_44_replay_boundary_contract.test.mjs", "package.json must wire S-V1-44 test into lint:fast.");
  requireText(packageJson, "node ci/guards/s_v1_44_replay_boundary_contract_guard.mjs", "package.json must wire S-V1-44 guard into lint:fast.");

  const source = readText("src/v1ReplayBoundaryContract.mjs");
  requireText(source, "process_integrity_only", "source must keep process-integrity-only boundary.");
  requireText(source, "source_bound", "source must expose source-bound proof boundary.");
  requireText(source, "accepted_proof_available", "source must expose accepted proof availability.");
  requireText(source, "correctness_claim: false", "source must suppress correctness claims.");
  requireText(source, "training_value_claim: false", "source must suppress training value claims.");

  const doc = readText("docs/v1/V1_REPLAY_BOUNDARY_CONTRACT.md");
  requireText(doc, "Replay records process integrity only.", "doc must include controlled process-integrity wording.");
  requireText(doc, "Replay rejected. Accepted proof is not available.", "doc must include rejected replay wording.");
  requireText(doc, "Replay output is bound to the declared source.", "doc must include source-bound wording.");

  const contract = getReplayBoundaryContractV1();
  assertJsonEqual(contract.replay_scope.allowed_replay_phases, ["phase2", "phase6"], "allowed replay phases must stay fixed.");
  assertJsonEqual(S_V1_44_ALLOWED_REPLAY_PHASES, ["phase2", "phase6"], "allowed phase export must stay fixed.");

  const accepted = tryBuildReplayBoundaryRecordV1({
    source: {
      source_id: "guard_source",
      source_type: "runtime_event_log",
      source_hash_sha256: "d".repeat(64)
    },
    replay: {
      replay_verdict: "ACCEPTED",
      replayed_phases: ["phase2", "phase6"],
      output_hash_sha256: "e".repeat(64),
      failure_tokens: []
    }
  });

  if (!accepted.ok) {
    die(`accepted fixture failed: ${accepted.error_code}`);
  }

  if (accepted.record.proof_boundary.proof_scope !== "process_integrity_only") {
    die("accepted fixture must remain process_integrity_only.");
  }

  const rejected = tryBuildReplayBoundaryRecordV1({
    source: {
      source_id: "guard_source",
      source_type: "runtime_event_log",
      source_hash_sha256: "d".repeat(64)
    },
    replay: {
      replay_verdict: "REJECTED",
      replayed_phases: ["phase2", "phase6"],
      output_hash_sha256: null,
      failure_tokens: ["nondeterminism_detected"]
    }
  });

  if (!rejected.ok) {
    die(`rejected fixture should produce a non-accepted boundary record: ${rejected.error_code}`);
  }

  if (rejected.record.proof_boundary.accepted_proof_available !== false) {
    die("rejected replay must not expose accepted proof availability.");
  }

  const forbidden = tryBuildReplayBoundaryRecordV1({
    source: {
      source_id: "guard_source",
      source_type: "runtime_event_log",
      source_hash_sha256: "d".repeat(64)
    },
    replay: {
      replay_verdict: "ACCEPTED",
      replayed_phases: ["phase2", "phase8"],
      output_hash_sha256: "e".repeat(64),
      failure_tokens: []
    }
  });

  if (forbidden.ok || forbidden.error_code !== S_V1_44_FAILURE_CODES.FORBIDDEN_REPLAY_PHASE) {
    die("forbidden replay phase must fail closed.");
  }

  const wording = Object.values(S_V1_44_REPLAY_BOUNDARY_COPY).join(" ");
  const forbiddenWording = [
    /certif/i,
    /approved/i,
    /endorsed/i,
    /correct training/i,
    /training value/i,
    /successful training/i,
    /external validation/i
  ];

  for (const pattern of forbiddenWording) {
    if (pattern.test(wording)) {
      die(`replay boundary wording drifted: ${pattern}`);
    }
  }

  console.log("s_v1_44_replay_boundary_contract_guard: PASS");
}

function requireFile(file) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    die(`missing required file: ${file}`);
  }
}

function readText(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function requireText(text, needle, message) {
  if (!text.includes(needle)) {
    die(message);
  }
}

function assertJsonEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    die(message);
  }
}

function die(message) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-44",
    token: TOKEN,
    message
  }, null, 2));
  console.error(`s_v1_44_replay_boundary_contract_guard: FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

main();
