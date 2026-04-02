#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    writeReport: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--no-write-report") {
      args.writeReport = false;
      continue;
    }
  }

  return args;
}

function walkFiles(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

function rel(root, fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, "/");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isTextReleaseFile(filePath) {
  return /\.(md|txt|json)$/i.test(filePath);
}

function isVerifierOutputFile(filePath) {
  return path.basename(filePath).toLowerCase() === "v1_freeze_rollback_compatibility.json";
}

function isRollbackCandidate(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (isVerifierOutputFile(filePath)) {
    return false;
  }

  return base.includes("rollback") && (base.endsWith(".md") || base.endsWith(".txt"));
}

function isFreezeCandidate(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (isVerifierOutputFile(filePath)) {
    return false;
  }

  return base.includes("freeze");
}

function discoverReleaseFiles(root) {
  const releasesDir = path.join(root, "docs", "releases");
  const files = walkFiles(releasesDir).filter(isTextReleaseFile);

  const rollbackFiles = files.filter(isRollbackCandidate);
  const freezeFiles = files.filter(isFreezeCandidate);

  return {
    releasesDir,
    rollbackFiles,
    freezeFiles,
  };
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10 && i + 1 < text.length) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function getLineIndexFromOffset(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineStarts[mid];
    const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.MAX_SAFE_INTEGER;

    if (offset >= start && offset < next) {
      return mid;
    }
    if (offset < start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 0;
}

function computeNegatedLines(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const negated = new Set();

  let inMustNotBlock = false;
  let inAssertionsBlock = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    const isHeader = /^#{1,6}\s/.test(trimmed);
    const isNumbered = /^\d+\.\s/.test(trimmed);
    const isBullet = /^[-*]\s+/.test(trimmed);

    if (lower.includes("rollback must not:")) {
      inMustNotBlock = true;
      inAssertionsBlock = false;
      negated.add(i);
      continue;
    }

    if (lower.includes("required operator assertions")) {
      inAssertionsBlock = true;
      inMustNotBlock = false;
      negated.add(i);
      continue;
    }

    if (isHeader) {
      inMustNotBlock = false;
      inAssertionsBlock = false;
    }

    if (inMustNotBlock) {
      if (trimmed === "") {
        continue;
      }

      if (isBullet) {
        negated.add(i);
        continue;
      }

      if (isHeader || isNumbered) {
        inMustNotBlock = false;
      }
    }

    if (inAssertionsBlock) {
      if (trimmed === "") {
        continue;
      }

      if (isBullet) {
        negated.add(i);
        continue;
      }

      if (isHeader || isNumbered) {
        inAssertionsBlock = false;
      }
    }

    if (
      lower.includes("must not") ||
      lower.includes("mustn't") ||
      lower.includes("do not") ||
      lower.includes("don't") ||
      lower.includes("never") ||
      lower.includes("forbidden") ||
      lower.includes("illegal") ||
      lower.includes("prohibited") ||
      lower.includes("cannot") ||
      lower.includes("can't")
    ) {
      negated.add(i);
    }
  }

  return { lines, negated };
}

function collectViolations(root, rollbackFiles) {
  const rules = [
    {
      rule_id: "ROLLBACK_HISTORY_MUTATION",
      message: "Rollback must not rewrite or alter historical truth, recorded data, or audit history.",
      patterns: [
        /\brewrite historical truth\b/gi,
        /\bmodify historical truth\b/gi,
        /\bmodify historical data\b/gi,
        /\brewrite recorded data\b/gi,
        /\bretroactively affect recorded data\b/gi,
        /\balter execution history\b/gi,
        /\bsuppress audit trails?\b/gi,
        /\bdelete audit trails?\b/gi
      ]
    },
    {
      rule_id: "ROLLBACK_ENGINE_TRUTH_IMPACT",
      message: "Rollback must not alter engine truth, legality, determinism, replay output, or evidence eligibility.",
      patterns: [
        /\balter engine truth\b/gi,
        /\balter engine execution\b/gi,
        /\balter legality\b/gi,
        /\balter determinism\b/gi,
        /\balter replay output\b/gi,
        /\balter evidence eligibility\b/gi,
        /\balter engine outputs already produced\b/gi,
        /\bdestroy evidence artefacts?\b/gi,
        /\bdelete evidence artefacts?\b/gi
      ]
    },
    {
      rule_id: "ROLLBACK_REGISTRY_MUTATION",
      message: "Rollback must not mutate or hot-swap registries.",
      patterns: [
        /\bhot-?swap registr(?:y|ies)\b/gi,
        /\bmodify registr(?:y|ies)\b/gi,
        /\bmutate registr(?:y|ies)\b/gi,
        /\boverride registr(?:y|ies)\b/gi,
        /\brewrite registr(?:y|ies)\b/gi
      ]
    },
    {
      rule_id: "ROLLBACK_PROOF_BYPASS",
      message: "Rollback must not bypass CI, replay, or evidence preconditions.",
      patterns: [
        /\bbypass ci\b/gi,
        /\bskip ci\b/gi,
        /\bbypass replay\b/gi,
        /\bskip replay\b/gi,
        /\bseal evidence anyway\b/gi,
        /\bexport without replay\b/gi,
        /\bmanual evidence\b/gi
      ]
    },
    {
      rule_id: "ROLLBACK_DORMANT_PHASE_REENABLE",
      message: "Rollback must not re-enable dormant proof-layer phases.",
      patterns: [
        /\bre-?enable phase 7\b/gi,
        /\bre-?enable phase 8\b/gi,
        /\benable phase 7\b/gi,
        /\benable phase 8\b/gi
      ]
    },
    {
      rule_id: "ROLLBACK_FALLBACK_LANGUAGE",
      message: "Rollback must not rely on fallback, best-effort recovery, or inferred reconstruction.",
      patterns: [
        /\bbest effort\b/gi,
        /\bfallback\b/gi,
        /\bgraceful degradation\b/gi,
        /\binfer\b/gi,
        /\breconstruct missing data\b/gi,
        /\binvent missing data\b/gi
      ]
    }
  ];

  const violations = [];

  for (const rollbackFile of rollbackFiles) {
    const normalized = readUtf8(rollbackFile).replace(/\r\n/g, "\n");
    const lineStarts = buildLineStarts(normalized);
    const { negated } = computeNegatedLines(normalized);

    for (const rule of rules) {
      for (const regex of rule.patterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(normalized)) !== null) {
          const lineIndex = getLineIndexFromOffset(lineStarts, match.index);
          if (negated.has(lineIndex)) {
            continue;
          }

          violations.push({
            rule_id: rule.rule_id,
            file: rel(root, rollbackFile),
            line: lineIndex + 1,
            matched_text: match[0],
            message: rule.message
          });
        }
      }
    }
  }

  return violations;
}

function buildReport(root, discovered, violations) {
  return {
    ok: violations.length === 0,
    verifier_id: "freeze_rollback_compatibility_verifier",
    checked_at_utc: new Date().toISOString(),
    root: root.replace(/\\/g, "/"),
    rollback_files_checked: discovered.rollbackFiles.map((file) => rel(root, file)),
    freeze_files_checked: discovered.freezeFiles.map((file) => rel(root, file)),
    invariant: "rollback may affect operational access only; it must not alter truth, legality, determinism, replay, evidence, registry immutability, or dormant proof-layer reachability",
    violations
  };
}

function writeReport(root, report) {
  const outPath = path.join(root, "docs", "releases", "V1_FREEZE_ROLLBACK_COMPATIBILITY.json");
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return outPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const discovered = discoverReleaseFiles(args.root);

  const preViolations = [];

  if (discovered.rollbackFiles.length === 0) {
    preViolations.push({
      rule_id: "ROLLBACK_DOC_MISSING",
      file: "docs/releases",
      line: 1,
      matched_text: "",
      message: "No rollback runbook found under docs/releases."
    });
  }

  if (discovered.freezeFiles.length === 0) {
    preViolations.push({
      rule_id: "FREEZE_DOC_MISSING",
      file: "docs/releases",
      line: 1,
      matched_text: "",
      message: "No freeze artefact found under docs/releases."
    });
  }

  const contentViolations =
    preViolations.length === 0
      ? collectViolations(args.root, discovered.rollbackFiles)
      : [];

  const report = buildReport(args.root, discovered, [...preViolations, ...contentViolations]);

  if (args.writeReport) {
    writeReport(args.root, report);
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();