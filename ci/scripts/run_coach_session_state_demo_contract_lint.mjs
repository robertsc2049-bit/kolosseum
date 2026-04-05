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

export function runCoachSessionStateDemoContractLint({
  fieldRegistryPath,
  copySurfacePath
}) {
  const failures = [];

  const registryDoc = readJson(fieldRegistryPath);
  const copyDoc = readJson(copySurfacePath);

  const fields = Array.isArray(registryDoc.fields) ? registryDoc.fields : [];
  const phrases = Array.isArray(copyDoc.phrases) ? copyDoc.phrases : [];
  const demoFields = Array.isArray(copyDoc.demo_fields) ? copyDoc.demo_fields : [];

  const forbiddenPatterns = [
    {
      pattern_id: "forbidden_inference",
      regex: "\\b(likely|probably|suggests|appears to|seems to|indicates that|implies)\\b",
      token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
    },
    {
      pattern_id: "forbidden_readiness_risk_safety",
      regex: "\\b(readiness|ready|risk|risky|unsafe|safe|safer|safety|danger|fatigued|fatigue|overreaching|recovery)\\b",
      token: "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"
    },
    {
      pattern_id: "forbidden_judgement",
      regex: "\\b(good session|bad session|poor adherence|underperformed|behind plan|declining|improving|regressing|struggling)\\b",
      token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
    },
    {
      pattern_id: "forbidden_intervention",
      regex: "\\b(should intervene|needs intervention|needs correction|should step in|recommend|recommended|next action)\\b",
      token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
    },
    {
      pattern_id: "forbidden_scoring_compliance",
      regex: "\\b(score|scored|rating|rated|compliance|adherence score|performance score)\\b",
      token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
    }
  ].map((entry) => ({
    ...entry,
    compiled: new RegExp(entry.regex, "i")
  }));

  const allowedPaths = new Set();
  const seenFieldIds = new Set();
  const seenPaths = new Set();

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const fieldPath = `fields[${i}]`;

    if (!isNonEmptyString(field.field_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldRegistryPath, `${fieldPath}.field_id`, "field_id must be a non-empty string."));
      continue;
    }

    if (seenFieldIds.has(field.field_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldRegistryPath, `${fieldPath}.field_id`, `Duplicate field_id '${field.field_id}'.`));
    }
    seenFieldIds.add(field.field_id);

    if (!isNonEmptyString(field.path)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldRegistryPath, `${fieldPath}.path`, "path must be a non-empty string."));
      continue;
    }

    if (seenPaths.has(field.path)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldRegistryPath, `${fieldPath}.path`, `Duplicate field path '${field.path}'.`));
    }
    seenPaths.add(field.path);
    allowedPaths.add(field.path);

    if (field.allowed !== true) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", fieldRegistryPath, `${fieldPath}.allowed`, "All registered demo fields in this slice must be allowed=true."));
    }
  }

  const seenDemoFields = new Set();
  for (let i = 0; i < demoFields.length; i += 1) {
    const demoField = demoFields[i];
    const demoFieldPath = `demo_fields[${i}]`;

    if (!isNonEmptyString(demoField)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", copySurfacePath, demoFieldPath, "demo field path must be a non-empty string."));
      continue;
    }

    if (seenDemoFields.has(demoField)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", copySurfacePath, demoFieldPath, `Duplicate demo field '${demoField}'.`));
    }
    seenDemoFields.add(demoField);

    if (!allowedPaths.has(demoField)) {
      failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", copySurfacePath, demoFieldPath, `Demo field '${demoField}' is not pinned in the field registry.`));
    }
  }

  const expectedPhrases = new Set([
    "Session active.",
    "Session complete.",
    "Execution state: partial.",
    "Work items done: 4 of 6.",
    "Pain flags recorded: 1.",
    "Split entered: yes.",
    "Return decision: continue."
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
        failures.push(makeFailure(rule.token, copySurfacePath, phrasePath, `Phrase '${phrase}' matches forbidden state wording pattern '${rule.pattern_id}'.`));
      }
    }

    if (!expectedPhrases.has(phrase)) {
      failures.push(makeFailure("CI_LINT_COPY_INLINE_STRING", copySurfacePath, phrasePath, `Phrase '${phrase}' is not in the allowed coach session state copy set.`));
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const repoRoot = process.cwd();

  const fieldRegistryPath = process.argv[2] || path.join(repoRoot, "docs/commercial/COACH_SESSION_STATE_FIELD_REGISTRY.json");
  const copySurfacePath = process.argv[3] || path.join(repoRoot, "docs/commercial/COACH_SESSION_STATE_COPY_SURFACE.json");

  const report = runCoachSessionStateDemoContractLint({
    fieldRegistryPath,
    copySurfacePath
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