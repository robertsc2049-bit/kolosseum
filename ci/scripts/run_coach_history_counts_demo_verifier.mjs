import fs from "node:fs";
import path from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`${message}\n`);
}

const targetPath = process.argv[2] ?? "docs/demo/P169_COACH_HISTORY_COUNTS_DEMO.md";
const absolutePath = path.resolve(targetPath);

if (!fs.existsSync(absolutePath)) {
  fail(`P169 verifier failed: missing file '${targetPath}'.`);
}

const raw = fs.readFileSync(absolutePath, "utf8");
const text = raw.replace(/\r\n/g, "\n");

const requiredPhrases = [
  "# P169 — Coach History Counts Demo",
  "This surface does not perform analytics, scoring, ranking, interpretation, coaching judgement, readiness estimation, or narrative framing.",
  "The following counters are allowed:",
  "The following grouping keys are allowed:",
  "The following semantic classes are forbidden in this demo:",
  "## Final rule"
];

for (const phrase of requiredPhrases) {
  if (!text.includes(phrase)) {
    fail(`P169 verifier failed: required phrase missing -> ${phrase}`);
  }
}

const allowedCounterIds = [
  "assigned_sessions_count",
  "started_sessions_count",
  "completed_sessions_count",
  "partial_completion_count",
  "split_return_count",
  "extra_work_count",
  "skipped_work_count",
  "dropped_work_count",
  "substitution_count",
  "runtime_event_count"
];

for (const counterId of allowedCounterIds) {
  if (!text.includes(`- ${counterId}`)) {
    fail(`P169 verifier failed: allowed counter missing -> ${counterId}`);
  }
}

const allowedGroupingKeys = [
  "athlete_id",
  "session_id",
  "activity_id",
  "event_type",
  "event_date_utc",
  "explicit_date_window"
];

for (const groupingKey of allowedGroupingKeys) {
  if (!text.includes(`- ${groupingKey}`)) {
    fail(`P169 verifier failed: allowed grouping key missing -> ${groupingKey}`);
  }
}

const bannedTerms = [
  "analytics",
  "score",
  "scoring",
  "trend",
  "trends",
  "insight",
  "insights",
  "risk",
  "risky",
  "safer",
  "safety",
  "readiness",
  "fatigue",
  "recovery",
  "compliance",
  "adherent",
  "adherence",
  "performance",
  "improving",
  "decline",
  "regression",
  "rank",
  "ranking",
  "top athlete",
  "behind",
  "on track",
  "needs attention",
  "recommendation",
  "recommend",
  "optimise",
  "optimize"
];

function extractSection(sectionTitle) {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const match = text.match(regex);
  return match ? match[1] : "";
}

const forbiddenCopySection = extractSection("Forbidden copy");
if (!forbiddenCopySection) {
  fail("P169 verifier failed: missing 'Forbidden copy' section.");
}

for (const term of bannedTerms) {
  if (!forbiddenCopySection.toLowerCase().includes(term.toLowerCase())) {
    fail(`P169 verifier failed: forbidden copy term missing from forbidden list -> ${term}`);
  }
}

const allowedCopySection = extractSection("Allowed copy");
if (!allowedCopySection) {
  fail("P169 verifier failed: missing 'Allowed copy' section.");
}

for (const term of bannedTerms) {
  const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (pattern.test(allowedCopySection)) {
    fail(`P169 verifier failed: banned semantic leaked into allowed copy -> ${term}`);
  }
}

const examplePayloadSection = extractSection("Example factual payload");
if (!examplePayloadSection) {
  fail("P169 verifier failed: missing 'Example factual payload' section.");
}

const examplePayloadHardBans = [
  "dashboard",
  "dashboards",
  "messaging",
  "rankings"
];

for (const forbiddenSurface of examplePayloadHardBans) {
  const pattern = new RegExp(`\\b${forbiddenSurface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (pattern.test(examplePayloadSection)) {
    fail(`P169 verifier failed: forbidden surface language leaked into example payload -> ${forbiddenSurface}`);
  }
}

const referenceFenceSection = extractSection("Reference fence");
if (!referenceFenceSection) {
  fail("P169 verifier failed: missing 'Reference fence' section.");
}

const referenceFenceRequiredBullets = [
  "- Kolosseum_v0_redefinition",
  "- PRODUCT REQUIREMENTS DOCUMENT (PRD)",
  "- COACH_RELATIONSHIP_AUTHORITY_LAW",
  "- reporting and neutral summary / counts-only surfaces"
];

for (const bullet of referenceFenceRequiredBullets) {
  if (!referenceFenceSection.includes(bullet)) {
    fail(`P169 verifier failed: missing required reference fence bullet -> ${bullet}`);
  }
}

const forbiddenReferenceAssertions = [
  "This demo references readiness analytics surfaces.",
  "This demo references scoring surfaces.",
  "This demo references analytics surfaces."
];

for (const badLine of forbiddenReferenceAssertions) {
  if (referenceFenceSection.includes(badLine)) {
    fail(`P169 verifier failed: forbidden reference surfaced in reference fence -> ${badLine}`);
  }
}

ok("coach_history_counts_demo_verifier: OK");