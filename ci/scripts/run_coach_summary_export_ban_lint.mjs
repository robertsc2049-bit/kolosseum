import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeFailure(token, file, pathValue, details) {
  return {
    token,
    file,
    path: pathValue,
    details
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function runCoachSummaryExportBanLint({
  copySurfacePath,
  fieldBoundaryPath
}) {
  const failures = [];

  const copyDoc = readJson(copySurfacePath);
  const fieldDoc = readJson(fieldBoundaryPath);

  const phrases = Array.isArray(copyDoc.phrases) ? copyDoc.phrases : [];
  const allowedFields = Array.isArray(fieldDoc.allowed_fields) ? fieldDoc.allowed_fields : [];
  const forbiddenFields = Array.isArray(fieldDoc.forbidden_fields) ? fieldDoc.forbidden_fields : [];

  const forbiddenPatterns = [
    {
      pattern_id: "forbidden_export_download",
      regex: "\\b(export|download|print|printable|share(?:able)?|pdf|file|report)\\b",
      token: "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"
    },
    {
      pattern_id: "forbidden_proof_evidence",
      regex: "\\b(proof|evidence|seal(?:ed)?|audit(?:-ready)?|artifact|artefact|package|packaging)\\b",
      token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
    },
    {
      pattern_id: "forbidden_generation",
      regex: "\\b(generate|generated|generator|formal report|coach report)\\b",
      token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
    }
  ].map((entry) => ({
    ...entry,
    compiled: new RegExp(entry.regex, "i")
  }));

  const expectedPhrases = new Set([
    "View summary.",
    "Session summary.",
    "Execution summary.",
    "Block summary.",
    "Read-only summary.",
    "View factual session state."
  ]);

  const seenPhrases = new Set();
  for (let i = 0; i < phrases.length; i += 1) {
    const phrase = phrases[i];
    const phrasePath = `phrases[${i}]`;

    if (!isNonEmptyString(phrase)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", copySurfacePath, phrasePath, "phrase must be a non-empty string."));
      continue;
    }

    if (seenPhrases.has(phrase)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", copySurfacePath, phrasePath, `Duplicate phrase '${phrase}'.`));
    }
    seenPhrases.add(phrase);

    for (const rule of forbiddenPatterns) {
      if (rule.compiled.test(phrase)) {
        failures.push(makeFailure(rule.token, copySurfacePath, phrasePath, `Phrase '${phrase}' matches forbidden summary wording pattern '${rule.pattern_id}'.`));
      }
    }

    if (!expectedPhrases.has(phrase)) {
      failures.push(makeFailure("CI_LINT_COPY_INLINE_STRING", copySurfacePath, phrasePath, `Phrase '${phrase}' is not in the allowed coach summary copy set.`));
    }
  }

  const seenAllowed = new Set();
  for (let i = 0; i < allowedFields.length; i += 1) {
    const field = allowedFields[i];
    const fieldPath = `allowed_fields[${i}]`;

    if (!isNonEmptyString(field)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldBoundaryPath, fieldPath, "allowed field must be a non-empty string."));
      continue;
    }

    if (seenAllowed.has(field)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldBoundaryPath, fieldPath, `Duplicate allowed field '${field}'.`));
    }
    seenAllowed.add(field);

    if (forbiddenFields.includes(field)) {
      failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", fieldBoundaryPath, fieldPath, `Field '${field}' is listed as both allowed and forbidden.`));
    }
  }

  const seenForbidden = new Set();
  for (let i = 0; i < forbiddenFields.length; i += 1) {
    const field = forbiddenFields[i];
    const fieldPath = `forbidden_fields[${i}]`;

    if (!isNonEmptyString(field)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldBoundaryPath, fieldPath, "forbidden field must be a non-empty string."));
      continue;
    }

    if (seenForbidden.has(field)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldBoundaryPath, fieldPath, `Duplicate forbidden field '${field}'.`));
    }
    seenForbidden.add(field);
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const repoRoot = process.cwd();

  const copySurfacePath = process.argv[2] || path.join(repoRoot, "docs/commercial/COACH_SUMMARY_COPY_SURFACE.json");
  const fieldBoundaryPath = process.argv[3] || path.join(repoRoot, "docs/commercial/COACH_SUMMARY_FIELD_BOUNDARY.json");

  const report = runCoachSummaryExportBanLint({
    copySurfacePath,
    fieldBoundaryPath
  });

  const output = JSON.stringify(report, null, 2);
  if (!report.ok) {
    process.stderr.write(output + "\n");
    process.exit(1);
  }

  process.stdout.write(output + "\n");
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}