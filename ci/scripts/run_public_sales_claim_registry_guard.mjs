import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REGISTRY_PATH = path.join(process.cwd(), "claims", "public_sales_claim_registry.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function reconstruct(parts) {
  if (!Array.isArray(parts)) return String(parts);
  return parts.join("");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

function excerptAt(text, index, length = 140) {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function makeFailure({ code, filePath, line, ruleId = null, claim = null, excerpt = "" }) {
  return {
    code,
    path: filePath,
    line,
    rule_id: ruleId,
    claim,
    excerpt,
  };
}

export function loadRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  return readJson(registryPath);
}

export function validateRegistry(registry) {
  const failures = [];

  if (!registry || typeof registry !== "object") {
    failures.push(makeFailure({
      code: "PSCRG_INVALID_REGISTRY",
      filePath: "registry",
      line: 0,
      excerpt: "Registry is not an object",
    }));
    return failures;
  }

  if (registry.schema_version !== "kolosseum.public_sales_claim_registry.v1") {
    failures.push(makeFailure({
      code: "PSCRG_INVALID_REGISTRY_VERSION",
      filePath: "registry",
      line: 0,
      excerpt: "Unexpected registry schema version",
    }));
  }

  if (registry.closed_world !== true) {
    failures.push(makeFailure({
      code: "PSCRG_REGISTRY_NOT_CLOSED",
      filePath: "registry",
      line: 0,
      excerpt: "Registry must be closed_world true",
    }));
  }

  const proofIds = new Set((registry.proofs ?? []).map((proof) => proof.proof_id));
  const claimIds = new Set();
  const claimPhrases = new Set();

  for (const claim of registry.allowed_claims ?? []) {
    if (claimIds.has(claim.claim_id)) {
      failures.push(makeFailure({
        code: "PSCRG_DUPLICATE_CLAIM_ID",
        filePath: "registry",
        line: 0,
        claim: claim.claim_id,
        excerpt: claim.phrase ?? "",
      }));
    }

    claimIds.add(claim.claim_id);

    if (claimPhrases.has(claim.phrase)) {
      failures.push(makeFailure({
        code: "PSCRG_DUPLICATE_CLAIM_PHRASE",
        filePath: "registry",
        line: 0,
        claim: claim.phrase,
        excerpt: claim.phrase,
      }));
    }

    claimPhrases.add(claim.phrase);

    if (!registry.allowed_claim_types.includes(claim.claim_type)) {
      failures.push(makeFailure({
        code: "PSCRG_INVALID_CLAIM_TYPE",
        filePath: "registry",
        line: 0,
        claim: claim.phrase,
        excerpt: claim.claim_type,
      }));
    }

    if (!Array.isArray(claim.proof_ids) || claim.proof_ids.length === 0) {
      failures.push(makeFailure({
        code: "PSCRG_MISSING_PROOF_LINK",
        filePath: "registry",
        line: 0,
        claim: claim.phrase,
        excerpt: claim.phrase,
      }));
      continue;
    }

    for (const proofId of claim.proof_ids) {
      if (!proofIds.has(proofId)) {
        failures.push(makeFailure({
          code: "PSCRG_UNKNOWN_PROOF_LINK",
          filePath: "registry",
          line: 0,
          claim: claim.phrase,
          excerpt: proofId,
        }));
      }
    }
  }

  return failures;
}

export function scanText({ text, filePath, registry }) {
  const failures = [];
  const marker = registry.claim_marker ?? "PUBLIC_CLAIM:";
  const allowedClaims = new Set((registry.allowed_claims ?? []).map((claim) => claim.phrase));
  const lines = text.split(/\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const markerIndex = line.indexOf(marker);

    if (markerIndex === -1) continue;

    const claim = line.slice(markerIndex + marker.length).trim();

    if (!allowedClaims.has(claim)) {
      failures.push(makeFailure({
        code: "PSCRG_UNKNOWN_PUBLIC_CLAIM",
        filePath,
        line: index + 1,
        claim,
        excerpt: line.trim(),
      }));
    }
  }

  for (const rule of registry.forbidden_semantics?.substring_rules ?? []) {
    for (const patternParts of rule.patterns ?? []) {
      const pattern = reconstruct(patternParts);
      const regex = new RegExp(escapeRegExp(pattern), "i");
      const match = regex.exec(text);

      if (match) {
        failures.push(makeFailure({
          code: "PSCRG_FORBIDDEN_SEMANTIC",
          filePath,
          line: lineNumberAt(text, match.index),
          ruleId: rule.rule_id,
          excerpt: excerptAt(text, match.index),
        }));
      }
    }
  }

  for (const rule of registry.forbidden_semantics?.context_rules ?? []) {
    const windowSize = Number(rule.window ?? 80);

    for (const leftParts of rule.left_patterns ?? []) {
      const left = reconstruct(leftParts);
      const leftRegex = new RegExp(escapeRegExp(left), "ig");
      let leftMatch;

      while ((leftMatch = leftRegex.exec(text)) !== null) {
        const start = Math.max(0, leftMatch.index - windowSize);
        const end = Math.min(text.length, leftMatch.index + left.length + windowSize);
        const context = text.slice(start, end);

        for (const rightParts of rule.right_patterns ?? []) {
          const right = reconstruct(rightParts);
          const rightRegex = new RegExp(escapeRegExp(right), "i");

          if (rightRegex.test(context)) {
            failures.push(makeFailure({
              code: "PSCRG_FORBIDDEN_CONTEXT",
              filePath,
              line: lineNumberAt(text, leftMatch.index),
              ruleId: rule.rule_id,
              excerpt: context.replace(/\s+/g, " ").trim(),
            }));
          }
        }
      }
    }
  }

  return failures;
}

export function scanFiles({ files, registry }) {
  const failures = [...validateRegistry(registry)];
  let scannedFiles = 0;

  for (const filePath of files) {
    let text;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (error) {
      failures.push(makeFailure({
        code: "PSCRG_SCAN_FILE_UNREADABLE",
        filePath,
        line: 0,
        excerpt: error instanceof Error ? error.message : String(error),
      }));
      continue;
    }

    scannedFiles += 1;
    failures.push(...scanText({ text, filePath, registry }));
  }

  return {
    ok: failures.length === 0,
    registry_id: registry.registry_id ?? "unknown",
    scanned_files: scannedFiles,
    failures,
  };
}

export function writeReport(report, reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {
    registryPath: DEFAULT_REGISTRY_PATH,
    reportPath: path.join(process.cwd(), "tmp", "public_sales_claim_registry_guard.report.json"),
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--registry") {
      args.registryPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--report") {
      args.reportPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--file") {
      args.files.push(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const registry = loadRegistry(args.registryPath);

  if (args.files.length === 0) {
    const registryOnlyFailures = validateRegistry(registry);
    const report = {
      ok: registryOnlyFailures.length === 0,
      registry_id: registry.registry_id ?? "unknown",
      scanned_files: 0,
      failures: registryOnlyFailures,
    };

    writeReport(report, args.reportPath);

    if (!report.ok) {
      console.error(JSON.stringify(report, null, 2));
      process.exitCode = 1;
      return report;
    }

    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  const report = scanFiles({ files: args.files, registry });
  writeReport(report, args.reportPath);

  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return report;
  }

  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}