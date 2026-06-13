// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  "docs/roadmap/V1_BOUNDARY_GUARD_SCAFFOLDING.md",
  "docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.md",
  "docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
];

const token = "CI_V1_ACTIVE_BOUNDARY_CONFIRMATION_MISSING";

function fail(message) {
  console.error(JSON.stringify({
    ok: false,
    token,
    guard: "S-V1-01",
    message
  }, null, 2));
  process.exitCode = 1;
}

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

for (const file of requiredFiles) {
  const absolutePath = path.join(repoRoot, file);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing required file: ${file}`);
  }
}

if (process.exitCode) {
  throw new Error("S-V1-01 active boundary confirmation files are missing.");
}

const activeBoundary = readText("docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md");
const scaffold = readText("docs/roadmap/V1_BOUNDARY_GUARD_SCAFFOLDING.md");
const confirmationMd = readText("docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.md");
const failureIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");
const guardsIndex = readText("docs/GUARDS_INDEX.md");
const checksums = readText("docs/checksums.sha256");

const jsonText = readText("docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json");
let confirmation;
try {
  confirmation = JSON.parse(jsonText);
} catch (error) {
  fail(`Invalid JSON in V1_ACTIVE_BOUNDARY_CONFIRMATION.json: ${error.message}`);
}

const expected = {
  schema_version: "kolosseum.v1.active_boundary_confirmation.v1",
  slice_id: "S-V1-01",
  release_id: "v1",
  release_name: "First Lawful Run",
  status: "active_boundary_confirmed"
};

for (const [key, value] of Object.entries(expected)) {
  if (confirmation?.[key] !== value) {
    fail(`Unexpected confirmation value for ${key}.`);
  }
}

const requiredInvariantValues = [
  "engine_isolation_preserved",
  "product_payment_ui_do_not_change_engine_truth",
  "copy_claim_boundary_preserved",
  "forbidden_claim_language_not_added",
  "v0_boundary_not_reopened"
];

for (const invariant of requiredInvariantValues) {
  if (!Array.isArray(confirmation?.invariants) || !confirmation.invariants.includes(invariant)) {
    fail(`Missing invariant: ${invariant}`);
  }
}

const requiredTextBindings = [
  [activeBoundary, "S-V1-01 Active v1 Boundary Confirmation", "ACTIVE_RELEASE_BOUNDARY.md"],
  [activeBoundary, "docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json", "ACTIVE_RELEASE_BOUNDARY.md"],
  [scaffold, "S-V1-01 guard binding", "V1_BOUNDARY_GUARD_SCAFFOLDING.md"],
  [confirmationMd, "Release: v1 - First Lawful Run", "V1_ACTIVE_BOUNDARY_CONFIRMATION.md"],
  [confirmationMd, "Phase 7 truth projection", "V1_ACTIVE_BOUNDARY_CONFIRMATION.md"],
  [confirmationMd, "Phase 8 evidence sealing", "V1_ACTIVE_BOUNDARY_CONFIRMATION.md"],
  [confirmationMd, "S-V1-01 preserves engine isolation", "V1_ACTIVE_BOUNDARY_CONFIRMATION.md"],
  [failureIndex, token, "FAILURE_TOKEN_INDEX.md"],
  [guardsIndex, "s_v1_01_active_boundary_confirmation_guard.mjs", "GUARDS_INDEX.md"]
];

for (const [text, needle, label] of requiredTextBindings) {
  if (!text.includes(needle)) {
    fail(`Missing binding in ${label}: ${needle}`);
  }
}

if (!checksums.trim()) {
  fail("docs/checksums.sha256 is empty after checksum regeneration.");
}

if (process.exitCode) {
  throw new Error("S-V1-01 active v1 boundary confirmation failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-01",
  message: "Active v1 boundary confirmation passed."
}, null, 2));
