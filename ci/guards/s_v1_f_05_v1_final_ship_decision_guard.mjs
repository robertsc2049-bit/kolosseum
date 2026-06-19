// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @law V1 Final Ship Decision
 * @severity high
 * @scope release
 * @desc Proves the S-V1-F-05 final v1 ship decision record is evidence based and bounded to release decision surfaces.
 *
 * DEV NOTE: S-V1-F-05 release guard. This guard protects the final ship
 * decision surface from becoming product code, tag authority, package-version
 * authority, engine behaviour, registry content, or post-v1 activation.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const TOKEN = "CI_V1_FINAL_SHIP_DECISION_GUARD";

const REQUIRED_FILES = [
  "docs/releases/V1_FINAL_SHIP_DECISION.md",
  "docs/releases/V1_FINAL_SHIP_DECISION.json",
  "ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs",
  "ci/guards/s_v1_f_05_v1_final_ship_decision_guard.mjs",
  "test/s_v1_f_05_v1_final_ship_decision.test.mjs"
];

const REQUIRED_DOC_LINKS = [
  {
    path: "docs/v1/V1_ACCEPTANCE_GATE.md",
    phrase: "## S-V1-F-05 V1 Final Ship Decision"
  },
  {
    path: "docs/v1/V1_RELEASE_BOUNDARY.md",
    phrase: "## S-V1-F-05 V1 Final Ship Decision"
  },
  {
    path: "docs/v1/V1_NOT_IN_SCOPE.md",
    phrase: "## S-V1-F-05 V1 Final Ship Decision Non-Scope"
  },
  {
    path: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
    phrase: "## S-V1-F-05 V1 Final Ship Decision Authority"
  }
];

const PROOF_COMMAND = "node --test test/s_v1_f_05_v1_final_ship_decision.test.mjs && node ci/guards/s_v1_f_05_v1_final_ship_decision_guard.mjs && node ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs --check";
const INLINE_GATE = "node --test test/s_v1_f_05_v1_final_ship_decision.test.mjs && node ci/guards/s_v1_f_05_v1_final_ship_decision_guard.mjs && node ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs --check";

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-F-05",
    token: TOKEN,
    message,
    details
  }, null, 2));
  process.exitCode = 1;
}

function assert(condition, message, details = {}) {
  if (!condition) {
    throw Object.assign(new Error(message), { details });
  }
}

try {
  for (const file of REQUIRED_FILES) {
    assert(fs.existsSync(path.join(ROOT, file)), "S-V1-F-05 required file missing.", { file });
  }

  for (const link of REQUIRED_DOC_LINKS) {
    const text = readText(link.path);
    assert(text.includes(link.phrase), "S-V1-F-05 required authority link missing.", link);
  }

  const record = readJson("docs/releases/V1_FINAL_SHIP_DECISION.json");
  const markdown = readText("docs/releases/V1_FINAL_SHIP_DECISION.md");
  const pkg = readJson("package.json");

  assert(record.record_id === "v1_final_ship_decision", "record_id mismatch.", { actual: record.record_id });
  assert(record.slice_id === "S-V1-F-05", "slice_id mismatch.", { actual: record.slice_id });
  assert(["SHIP", "BLOCKED"].includes(record.decision), "decision must be SHIP or BLOCKED.", { actual: record.decision });

  const forbiddenDecisionText = [
    "partial-complete",
    "partial complete",
    "almost complete",
    "nearly complete",
    "mostly complete"
  ];

  const combined = `${markdown}\n${JSON.stringify(record)}`.toLowerCase();
  for (const phrase of forbiddenDecisionText) {
    assert(!combined.includes(phrase), "forbidden incomplete completion wording found.", { phrase });
  }

  const rules = record.ship_blocking_rules ?? {};
  assert(rules.evidence_based_decision_required === true, "evidence decision rule missing.");
  assert(rules.failed_acceptance_item_blocks_v1 === true, "failed acceptance blocker rule missing.");
  assert(rules.incomplete_v1_completion_wording_forbidden === true, "incomplete wording blocker rule missing.");
  assert(rules.product_code_change_allowed === false, "product code non-scope rule missing.");
  assert(rules.feature_implementation_allowed === false, "feature implementation non-scope rule missing.");
  assert(rules.release_tag_creation_allowed === false, "tag non-scope rule missing.");
  assert(rules.engine_behaviour_change_allowed === false, "engine behaviour non-scope rule missing.");
  assert(rules.registry_content_change_allowed === false, "registry content non-scope rule missing.");

  const evidence = Array.isArray(record.required_evidence) ? record.required_evidence : [];
  for (const command of [
    "npm.cmd run acceptance:v1:check",
    "npm.cmd run proof:s-v1-f-04",
    "npm.cmd run lint:fast"
  ]) {
    assert(evidence.some((item) => item.label === command && item.command === command), "required evidence command missing.", { command });
  }

  if (record.decision === "SHIP") {
    assert(record.mainline_evidence?.main_clean_before_decision === true, "SHIP requires main clean evidence.");
    assert(record.mainline_evidence?.head_equals_origin_main === true, "SHIP requires origin/main equality evidence.");
    assert(record.mainline_evidence?.required_checks_green === true, "SHIP requires green evidence.");
    for (const item of evidence) {
      assert(item.exit_code === 0 && item.passed === true, "SHIP requires every evidence command to pass.", item);
    }
    assert(record.blocked_reason === null, "SHIP must not carry blocked_reason.");
  }

  if (record.decision === "BLOCKED") {
    assert(typeof record.blocked_reason === "string" && record.blocked_reason.length > 0, "BLOCKED requires blocked_reason.");
  }

  assert(pkg.scripts?.["proof:s-v1-f-05"] === PROOF_COMMAND, "proof:s-v1-f-05 package script mismatch.", {
    actual: pkg.scripts?.["proof:s-v1-f-05"]
  });

  assert(pkg.scripts?.["acceptance:v1:ship-decision:check"] === "node ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs --check", "acceptance ship decision package script mismatch.", {
    actual: pkg.scripts?.["acceptance:v1:ship-decision:check"]
  });

  assert(pkg.scripts?.["lint:fast"]?.includes(INLINE_GATE), "lint:fast does not include S-V1-F-05 gate.");
  assert(pkg.scripts?.["lint:fast:inline"]?.includes(INLINE_GATE), "lint:fast:inline does not include S-V1-F-05 gate.");

  const runnerResult = spawnSync(process.execPath, ["ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs", "--check"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  if (runnerResult.status !== 0) {
    throw Object.assign(new Error("S-V1-F-05 runner check failed."), {
      details: {
        status: runnerResult.status,
        stdout: runnerResult.stdout,
        stderr: runnerResult.stderr
      }
    });
  }

  assert(runnerResult.stdout.includes("S-V1-F-05 V1_FINAL_SHIP_DECISION_CHECK_PASS"), "runner success marker missing.");

  console.log(JSON.stringify({
    ok: true,
    guard: "S-V1-F-05",
    token: TOKEN,
    decision: record.decision,
    message: "S-V1-F-05 final ship decision guard passed."
  }, null, 2));
} catch (error) {
  fail(error.message, error.details ?? {});
}
