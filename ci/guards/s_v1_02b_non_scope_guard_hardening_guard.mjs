// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-02B non-scope guard.
 * Purpose: blocks activation of post-v1 product surfaces inside active implementation paths.
 * Boundary: authority docs, fixtures, tests, and guard files may discuss excluded scope; active product paths must not implement it.
 * Determinism: scans stable path sets and fixture vectors without network or runtime state.
 * Failure: emits CI_V1_NON_SCOPE_GUARD_HARDENING when excluded scope is activated or the negative fixture is not rejected.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-02B";
const TOKEN = "CI_V1_NON_SCOPE_GUARD_HARDENING";

const REQUIRED_AUTHORITY_BINDINGS = [
  {
    path: "docs/v1/V1_NOT_IN_SCOPE.md",
    needles: [
      "Silence is not permission.",
      "marketplace",
      "messaging or chat",
      "gym access control",
      "door access",
      "EPOS",
      "enterprise billing",
      "readiness scoring",
      "safety scoring",
      "suitability scoring",
      "automatic operational-readiness decision",
      "Controlled-launch exceptions do not activate marketplace, messaging, chat, social, broad analytics, gym access, EPOS, enterprise, organisation, team, unit, federation, or dashboard scope."
    ]
  },
  {
    path: "docs/v1/V1_RELEASE_BOUNDARY.md",
    needles: [
      "controlled commercial launch boundary",
      "payment path sufficient for controlled launch",
      "marketplace",
      "messaging or chat",
      "broad analytics dashboards",
      "gym access control",
      "EPOS",
      "enterprise billing",
      "commercial dashboards unless explicitly listed in a later v1 boundary rewrite"
    ]
  },
  {
    path: "docs/v1/V1_ACCEPTANCE_GATE.md",
    needles: [
      "payment state cannot alter engine legality",
      "payment state cannot alter deterministic compile output",
      "commercial copy remains claim-safe",
      "operational monitoring must remain factual",
      "Legal surfaces must not imply medical, safety, suitability, readiness, coaching-quality, training-effectiveness, operational, or external-approval claims."
    ]
  },
  {
    path: "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
    needles: [
      "V1 slices must state boundary, proof, and non-scope.",
      "org/team/unit/gym runtime capability",
      "claim, outcome, advisory, or interpretation language",
      "Metric Threshold Marker Engine implementation"
    ]
  }
];

const NEGATIVE_FIXTURE_PATH = "ci/fixtures/v1_non_scope_negative/s_v1_02b_post_v1_scope_leakage.json";

const ACTIVE_SCAN_ROOTS = [
  "app",
  "src",
  "server",
  "web",
  "pages",
  "components",
  "routes",
  "packages"
];

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml"
]);

const FORBIDDEN_PATH_PATTERNS = [
  ["marketplace_surface", /(^|[/\\])(?:marketplace|coach-marketplace|athlete-marketplace|programme-marketplace)(?:[/\\]|$)/i],
  ["messaging_surface", /(^|[/\\])(?:messaging|chat|social-feed|friends|train-together)(?:[/\\]|$)/i],
  ["gym_access_surface", /(^|[/\\])(?:gym-access|door-access|code-scanner-access|scanner-access)(?:[/\\]|$)/i],
  ["epos_surface", /(^|[/\\])(?:epos|retail|stock-flow|stock-flows)(?:[/\\]|$)/i],
  ["enterprise_billing_surface", /(^|[/\\])(?:enterprise-billing|enterprise-account-management)(?:[/\\]|$)/i],
  ["dashboard_surface", /(^|[/\\])(?:team-dashboard|organisation-dashboard|organization-dashboard|unit-dashboard|federation-dashboard|gym-dashboard|commercial-dashboard|broad-analytics)(?:[/\\]|$)/i],
  ["runtime_surface", /(^|[/\\])(?:organisation-runtime|organization-runtime|team-runtime|unit-runtime|gym-runtime|federation-runtime)(?:[/\\]|$)/i]
];

const ACTIVATION_VERBS = String.raw`(?:implement|build|create|ship|enable|activate|add|wire|expose|launch|route|render|serve|persist|store|mutate|compute|score|infer|recommend)`;

const FORBIDDEN_TEXT_PATTERNS = [
  ["marketplace_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:marketplace|coach marketplace|athlete marketplace|programme marketplace|royalties engine)\b`, "i")],
  ["messaging_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:messaging|chat|social feed|friends|train together|train-together)\b`, "i")],
  ["gym_access_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:gym access|door access|code scanner access|scanner access)\b`, "i")],
  ["epos_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:EPOS|retail flow|stock flow|stock or retail)\b`, "i")],
  ["enterprise_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:enterprise billing|enterprise account management)\b`, "i")],
  ["dashboard_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:commercial dashboard|broad analytics|team dashboard|organisation dashboard|organization dashboard|unit dashboard|federation dashboard|gym dashboard)\b`, "i")],
  ["runtime_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:organisation runtime|organization runtime|team runtime|unit runtime|gym runtime|federation runtime)\b`, "i")],
  ["claim_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:readiness scoring|safety scoring|suitability scoring|return to play|return to run|fitness for duty|deployment ready|operational readiness|medical clearance|suitability clearance|readiness claim|safety claim|medical claim)\b`, "i")],
  ["recommendation_activation", new RegExp(String.raw`\b${ACTIVATION_VERBS}\b.{0,140}\b(?:recommendation flow|recommended intervention|optimisation|optimization|optimal load|automatic coaching decision|capability inference)\b`, "i")]
];

const failures = [];

function fail(message, details = {}) {
  failures.push({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  });
}

function repoPath(relPath) {
  return path.join(ROOT, relPath);
}

function readText(relPath) {
  return fs.readFileSync(repoPath(relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(repoPath(relPath));
}

function normalizePath(relPath) {
  return relPath.split(path.sep).join("/");
}

function isTextFile(absPath) {
  const ext = path.extname(absPath);
  if (!TEXT_EXTENSIONS.has(ext)) return false;

  const stat = fs.statSync(absPath);
  if (stat.size > 2_000_000) return false;

  const buffer = fs.readFileSync(absPath);
  return !buffer.includes(0);
}

function walkFiles(rootRel) {
  const rootAbs = repoPath(rootRel);
  if (!fs.existsSync(rootAbs)) return [];

  const out = [];
  const stack = [rootAbs];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = normalizePath(path.relative(ROOT, abs));

      if (entry.isDirectory()) {
        if (rel.includes("/__tests__") || rel.includes("/test/") || rel.includes("/tests/") || rel.includes("/fixtures/")) {
          continue;
        }

        stack.push(abs);
        continue;
      }

      if (entry.isFile()) {
        out.push(abs);
      }
    }
  }

  return out;
}

function detectForbiddenText(text) {
  const hits = [];

  for (const [id, regex] of FORBIDDEN_TEXT_PATTERNS) {
    if (regex.test(text)) {
      hits.push(id);
    }
  }

  return hits;
}

function detectForbiddenPath(relPath) {
  const hits = [];

  for (const [id, regex] of FORBIDDEN_PATH_PATTERNS) {
    if (regex.test(relPath)) {
      hits.push(id);
    }
  }

  return hits;
}

for (const binding of REQUIRED_AUTHORITY_BINDINGS) {
  if (!exists(binding.path)) {
    fail("Required v1 boundary authority file is missing.", {
      path: binding.path
    });
    continue;
  }

  const text = readText(binding.path);

  for (const needle of binding.needles) {
    if (!text.toLowerCase().includes(needle.toLowerCase())) {
      fail("Required v1 non-scope authority marker is missing.", {
        path: binding.path,
        marker: needle
      });
    }
  }
}

if (!exists(NEGATIVE_FIXTURE_PATH)) {
  fail("S-V1-02B negative fixture is missing.", {
    path: NEGATIVE_FIXTURE_PATH
  });
} else {
  let fixture;

  try {
    fixture = JSON.parse(readText(NEGATIVE_FIXTURE_PATH));
  } catch (error) {
    fail("S-V1-02B negative fixture is not valid JSON.", {
      path: NEGATIVE_FIXTURE_PATH,
      error: error.message
    });
  }

  if (fixture) {
    if (fixture.slice_id !== GUARD) {
      fail("S-V1-02B negative fixture has wrong slice_id.", {
        path: NEGATIVE_FIXTURE_PATH,
        actual: fixture.slice_id
      });
    }

    if (!Array.isArray(fixture.cases) || fixture.cases.length < 8) {
      fail("S-V1-02B negative fixture must include at least eight forbidden scope probes.", {
        path: NEGATIVE_FIXTURE_PATH
      });
    } else {
      for (const testCase of fixture.cases) {
        const caseHits = detectForbiddenText(String(testCase.probe_source ?? ""));

        if (testCase.expected_token !== TOKEN) {
          fail("S-V1-02B negative fixture case has wrong expected token.", {
            path: NEGATIVE_FIXTURE_PATH,
            case_id: testCase.case_id,
            expected_token: testCase.expected_token
          });
        }

        if (caseHits.length === 0) {
          fail("S-V1-02B guard accepted a forbidden negative probe.", {
            path: NEGATIVE_FIXTURE_PATH,
            case_id: testCase.case_id
          });
        }
      }
    }
  }
}

for (const root of ACTIVE_SCAN_ROOTS) {
  for (const absPath of walkFiles(root)) {
    const relPath = normalizePath(path.relative(ROOT, absPath));

    const pathHits = detectForbiddenPath(relPath);
    if (pathHits.length > 0) {
      fail("Forbidden post-v1 active implementation path detected.", {
        path: relPath,
        hits: pathHits
      });
    }

    if (!isTextFile(absPath)) {
      continue;
    }

    const text = fs.readFileSync(absPath, "utf8");
    const textHits = detectForbiddenText(text);

    if (textHits.length > 0) {
      fail("Forbidden post-v1 active implementation text detected.", {
        path: relPath,
        hits: textHits
      });
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(JSON.stringify(failure, null, 2));
  }

  throw new Error("S-V1-02B non-scope guard hardening failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Non-scope guard hardening passed."
}, null, 2));
