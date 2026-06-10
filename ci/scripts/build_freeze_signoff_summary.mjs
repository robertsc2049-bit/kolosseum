import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function repoRoot() {
  return process.cwd();
}

function posixRel(absPath) {
  return path.relative(repoRoot(), absPath).split(path.sep).join("/");
}

function sha256HexUtf8(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function readJsonStrict(absPath) {
  if (!fs.existsSync(absPath)) {
    fail(`P147_SIGNOFF_SOURCE_MISSING: ${posixRel(absPath)}`);
  }

  const raw = fs.readFileSync(absPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`P147_SIGNOFF_SOURCE_INVALID_JSON: ${posixRel(absPath)} :: ${error.message}`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    fail(`P147_SIGNOFF_SOURCE_SHAPE_INVALID: ${posixRel(absPath)} :: root must be object`);
  }

  return { parsed, raw };
}

function firstString(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === "string" && obj[key].trim().length > 0) {
      return obj[key].trim();
    }
  }
  return null;
}

function firstBoolean(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === "boolean") {
      return obj[key];
    }
  }
  return null;
}

function normaliseVerdict(value) {
  if (typeof value !== "string") {
    return null;
  }

  const v = value.trim().toUpperCase();

  if (["PASS", "PASSED", "OK", "SUCCESS", "GREEN", "ACCEPTED", "COMPLETE", "READY", "CLOSED", "SEALED", "CLOSURE_COMPLETE"].includes(v)) {
    return "PASS";
  }

  if (["FAIL", "FAILED", "ERROR", "RED", "REJECTED", "BLOCKED", "INCOMPLETE", "NOT_READY", "OPEN", "PRE_SEAL"].includes(v)) {
    return "FAIL";
  }

  return null;
}

function extractVerdict(role, doc) {
  const directVerdict = firstString(doc, [
    "signoff_verdict",
    "freeze_signoff_verdict",
    "freeze_verdict",
    "overall_verdict",
    "verdict",
    "status",
    "result",
    "readiness_verdict",
    "closure_verdict",
    "exit_verdict",
    "drift_verdict",
    "freeze_state"
  ]);

  const normalisedDirect = normaliseVerdict(directVerdict);
  if (normalisedDirect) {
    return normalisedDirect;
  }

  const okFlag = firstBoolean(doc, [
    "ok",
    "passed",
    "pass",
    "ready",
    "closed",
    "accepted",
    "success",
    "freeze_declared"
  ]);

  if (okFlag !== null) {
    return okFlag ? "PASS" : "FAIL";
  }

  fail(`P147_SIGNOFF_VERDICT_MISSING_OR_UNKNOWN: ${role}`);
}

function extractEvidenceId(role, doc, relPath) {
  return firstString(doc, [
    "document_id",
    "artefact_id",
    "artifact_id",
    "report_id",
    "verifier_id",
    "id",
    "name"
  ]) ?? `${role}:${relPath}`;
}

function extractReasonLines(doc) {
  const candidates = [];

  const arrayFields = [
    "blocking_failures",
    "failures",
    "errors",
    "missing",
    "notes",
    "warnings",
    "reasons"
  ];

  for (const field of arrayFields) {
    if (Array.isArray(doc[field])) {
      for (const item of doc[field]) {
        if (typeof item === "string" && item.trim().length > 0) {
          candidates.push(item.trim());
        } else if (item && typeof item === "object") {
          const maybeText = firstString(item, ["message", "detail", "reason", "token", "id", "path"]);
          if (maybeText) {
            candidates.push(maybeText);
          }
        }
      }
    }
  }

  const scalarFields = [
    "message",
    "detail",
    "reason",
    "summary",
    "failure_token",
    "invariant"
  ];

  for (const field of scalarFields) {
    const v = firstString(doc, [field]);
    if (v) {
      candidates.push(v);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const line of candidates) {
    if (!seen.has(line)) {
      seen.add(line);
      deduped.push(line);
    }
  }

  return deduped.slice(0, 12);
}

function resolvePinnedRole(role, candidates) {
  for (const rel of candidates) {
    const abs = path.resolve(repoRoot(), rel);
    if (fs.existsSync(abs)) {
      return { role, rel, abs };
    }
  }

  fail(`P147_SIGNOFF_SOURCE_UNRESOLVED: ${role} :: tried ${candidates.join(", ")}`);
}

const roleCandidates = {
  closure: [
    "docs/releases/V1_FREEZE_CLOSURE.json",
    "docs/releases/V1_FREEZE_CLOSURE_STATUS.json",
    "docs/releases/V1_FREEZE_CLOSURE_REPORT.json",
    "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
    "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
    "docs/releases/V1_FREEZE_STATE.json",
    "docs/releases/V1_FREEZE_PROOF_CHAIN.json"
  ],
  readiness: [
    "docs/releases/V1_PROMOTION_READINESS.json",
    "docs/releases/V1_FREEZE_READINESS.json",
    "docs/releases/V1_RELEASE_READINESS.json"
  ],
  exit: [
    "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
    "docs/releases/V1_FREEZE_EXIT_STATUS.json",
    "docs/releases/V1_RELEASE_EXIT_CRITERIA.json"
  ],
  drift: [
    "docs/releases/V1_FREEZE_PROOF_FRESHNESS.json",
    "docs/releases/V1_FREEZE_DRIFT_STATUS.json",
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
    "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json",
    "docs/releases/V1_PROOF_FRESHNESS.json"
  ]
};

const resolved = [
  resolvePinnedRole("closure", roleCandidates.closure),
  resolvePinnedRole("readiness", roleCandidates.readiness),
  resolvePinnedRole("exit", roleCandidates.exit),
  resolvePinnedRole("drift", roleCandidates.drift)
];

const artefacts = resolved.map((entry) => {
  const { parsed, raw } = readJsonStrict(entry.abs);
  const verdict = extractVerdict(entry.role, parsed);
  return {
    role: entry.role,
    relPath: entry.rel,
    id: extractEvidenceId(entry.role, parsed, entry.rel),
    verdict,
    sha256: sha256HexUtf8(raw),
    reasons: extractReasonLines(parsed)
  };
});

artefacts.sort((a, b) => a.role.localeCompare(b.role));

const overallVerdict = artefacts.every((item) => item.verdict === "PASS") ? "PASS" : "FAIL";

const blockingLines = artefacts
  .filter((item) => item.verdict !== "PASS")
  .flatMap((item) => {
    if (item.reasons.length === 0) {
      return [`- [${item.role}] ${item.id} :: verdict=FAIL`];
    }
    return item.reasons.map((reason) => `- [${item.role}] ${reason}`);
  });

const sourceBundle = artefacts.map((item) => ({
  role: item.role,
  path: item.relPath,
  id: item.id,
  verdict: item.verdict,
  sha256: item.sha256
}));

const sourceBundleSha256 = sha256HexUtf8(JSON.stringify(sourceBundle));

const lines = [
  "# V1 Freeze Signoff Summary",
  "",
  `overall_signoff: ${overallVerdict}`,
  `review_goal: under_2_minutes`,
  `source_bundle_sha256: ${sourceBundleSha256}`,
  "",
  "## Source Artefacts",
  "",
  ...artefacts.flatMap((item) => [
    `- role: ${item.role}`,
    `  id: ${item.id}`,
    `  verdict: ${item.verdict}`,
    `  path: ${item.relPath}`,
    `  sha256: ${item.sha256}`
  ]),
  "",
  "## Verdict Summary",
  "",
  ...artefacts.map((item) => `- ${item.role}: ${item.verdict}`),
  "",
  "## Blocking Failures",
  "",
  ...(blockingLines.length > 0 ? blockingLines : ["- none"]),
  "",
  "## Final Ruling",
  "",
  overallVerdict === "PASS"
    ? "Freeze signoff PASS. All required source artefacts resolved and passed."
    : "Freeze signoff FAIL. One or more required source artefacts are non-passing.",
  ""
];

const output = lines.join("\n");
const outPath = path.resolve(repoRoot(), "docs/releases/V1_FREEZE_SIGNOFF_SUMMARY.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output, "utf8");

process.stdout.write(JSON.stringify({
  ok: true,
  output_path: posixRel(outPath),
  overall_signoff: overallVerdict,
  source_bundle_sha256: sourceBundleSha256
}, null, 2) + "\n");