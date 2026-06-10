
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";

const docPath = "docs/pilot/S33_FIRST_EXECUTABLE_SESSION_START_PACK.md";
const fixturePath = "docs/pilot/fixtures/s33_first_executable_session_start.valid.json";

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S33", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const requiredDocStrings = [
  "A pilot athlete with accepted Phase 1 and an available executable session can lawfully start the first session, producing a factual session_started event.",
  "Start session",
  "session_started",
  "phase1_status",
  "compile_status",
  "session_available",
  "start_control_enabled",
  "blocked_reason"
];

for (const s of requiredDocStrings) {
  if (!doc.includes(s)) fail(`Missing required S33 doc string: ${s}`);
}

const requiredFixture = {
  slice: "S33",
  proof_name: "first_executable_session_start",
  phase1_status: "accepted",
  compile_status: "passed",
  session_available: true,
  start_control_label: "Start session",
  start_control_enabled: true,
  blocked_reason: null,
  action: "start_session",
  action_accepted: true,
  rejected_reason: null,
  event_type: "session_started"
};

for (const [key, expected] of Object.entries(requiredFixture)) {
  const actual = fixture[key];
  if (actual !== expected) {
    fail(`Fixture field ${key} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

if (fixture.consent_granted !== true) fail("Fixture consent_granted must be true.");
if (fixture.jurisdiction_acknowledged !== true) fail("Fixture jurisdiction_acknowledged must be true.");
if (fixture.compile_failure_token !== null) fail("Fixture compile_failure_token must be null.");
if (fixture.pilot_status !== "coach_ready") fail("Fixture pilot_status must be coach_ready.");
if (fixture.athlete_status !== "active") fail("Fixture athlete_status must be active.");
if (fixture.executable_work_items_count < 1) fail("Fixture executable_work_items_count must be at least 1.");

console.log(JSON.stringify({ ok: true, slice: "S33", checked: [docPath, fixturePath] }, null, 2));
