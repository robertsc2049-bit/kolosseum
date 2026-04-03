import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_INPUTS = Object.freeze({
  operator_runbook: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
  rollback_runbook: "docs/releases/V1_ROLLBACK_RUNBOOK.md",
  proof_index: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
  handoff_index: "docs/releases/V1_HANDOFF_INDEX.md"
});

const REPO_PATH_PATTERN = /\b(?:docs\/releases|ci\/scripts)\/[A-Za-z0-9._\/-]+\b/g;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(token, details, pathValue = null) {
  const failure = { token, details };
  if (pathValue !== null) {
    failure.path = pathValue;
  }
  return {
    ok: false,
    failures: [failure]
  };
}

function normalizePathString(value) {
  return value.replace(/\\/g, "/");
}

function toRepoRelativePath(value) {
  if (path.isAbsolute(value)) {
    return normalizePathString(path.relative(process.cwd(), value));
  }
  return normalizePathString(value);
}

function readUtf8File(filePath) {
  if (!fs.existsSync(filePath)) {
    return fail("CI_MANIFEST_MISMATCH", "Required minimality input is missing.", filePath);
  }

  try {
    return {
      ok: true,
      content: fs.readFileSync(filePath, "utf8")
    };
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", `Unable to read required input: ${error.message}`, filePath);
  }
}

function extractRepoPathsFromMarkdown(markdownText) {
  const matches = markdownText.match(REPO_PATH_PATTERN) ?? [];
  return [...new Set(matches.map((entry) => normalizePathString(entry)))].sort();
}

function collectRepoPathsDeep(value, out = new Set()) {
  if (typeof value === "string") {
    const matches = value.match(REPO_PATH_PATTERN) ?? [];
    for (const match of matches) {
      out.add(normalizePathString(match));
    }
    return out;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectRepoPathsDeep(entry, out);
    }
    return out;
  }

  if (isPlainObject(value)) {
    for (const nested of Object.values(value)) {
      collectRepoPathsDeep(nested, out);
    }
    return out;
  }

  return out;
}

function parseProofIndexJson(filePath) {
  const rawResult = readUtf8File(filePath);
  if (!rawResult.ok) {
    return rawResult;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawResult.content);
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", `Proof index contains invalid JSON: ${error.message}`, filePath);
  }

  if (!isPlainObject(parsed)) {
    return fail("CI_MANIFEST_MISMATCH", "Proof index must be a JSON object.", filePath);
  }

  return {
    ok: true,
    paths: [...collectRepoPathsDeep(parsed)].sort()
  };
}

function validateInputs(inputs) {
  const requiredKeys = ["operator_runbook", "rollback_runbook", "proof_index", "handoff_index"];
  for (const key of requiredKeys) {
    if (!(key in inputs)) {
      return fail("CI_MANIFEST_MISMATCH", `Missing required input mapping '${key}'.`);
    }
    if (typeof inputs[key] !== "string" || inputs[key].trim().length === 0) {
      return fail("CI_MANIFEST_MISMATCH", `Input mapping '${key}' must be a non-empty string.`);
    }
  }
  return { ok: true };
}

export function verifyFreezeOperatorHandoffMinimality(inputs = DEFAULT_INPUTS) {
  const validation = validateInputs(inputs);
  if (!validation.ok) {
    return validation;
  }

  const operatorRunbookResult = readUtf8File(inputs.operator_runbook);
  if (!operatorRunbookResult.ok) {
    return operatorRunbookResult;
  }

  const rollbackRunbookResult = readUtf8File(inputs.rollback_runbook);
  if (!rollbackRunbookResult.ok) {
    return rollbackRunbookResult;
  }

  const handoffIndexResult = readUtf8File(inputs.handoff_index);
  if (!handoffIndexResult.ok) {
    return handoffIndexResult;
  }

  const proofIndexResult = parseProofIndexJson(inputs.proof_index);
  if (!proofIndexResult.ok) {
    return proofIndexResult;
  }

  const operatorPaths = extractRepoPathsFromMarkdown(operatorRunbookResult.content);
  const rollbackPaths = extractRepoPathsFromMarkdown(rollbackRunbookResult.content);
  const proofPaths = proofIndexResult.paths;
  const handoffPaths = extractRepoPathsFromMarkdown(handoffIndexResult.content);

  const sufficiencySet = new Set([
    toRepoRelativePath(inputs.operator_runbook),
    toRepoRelativePath(inputs.rollback_runbook),
    toRepoRelativePath(inputs.proof_index),
    ...operatorPaths,
    ...rollbackPaths,
    ...proofPaths
  ]);

  const handoffSet = new Set(handoffPaths);

  for (const declaredPath of [...handoffSet].sort()) {
    if (!fs.existsSync(declaredPath)) {
      return fail(
        "CI_MANIFEST_MISMATCH",
        `Handoff index declares non-existent path: ${declaredPath}.`,
        declaredPath
      );
    }

    if (!sufficiencySet.has(declaredPath)) {
      return fail(
        "extra_operator_surface",
        `Handoff index contains extra operator surface outside lawful sufficiency set: ${declaredPath}.`,
        declaredPath
      );
    }
  }

  return {
    ok: true,
    operator_runbook: toRepoRelativePath(inputs.operator_runbook),
    rollback_runbook: toRepoRelativePath(inputs.rollback_runbook),
    proof_index: toRepoRelativePath(inputs.proof_index),
    handoff_index: toRepoRelativePath(inputs.handoff_index),
    sufficiency_count: sufficiencySet.size,
    declared_count: handoffSet.size
  };
}

function parseArgs(argv) {
  const args = { ...DEFAULT_INPUTS };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--operator-runbook") {
      args.operator_runbook = next;
      index += 1;
      continue;
    }

    if (token === "--rollback-runbook") {
      args.rollback_runbook = next;
      index += 1;
      continue;
    }

    if (token === "--proof-index") {
      args.proof_index = next;
      index += 1;
      continue;
    }

    if (token === "--handoff-index") {
      args.handoff_index = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

export function runCli(argv = process.argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const result = fail("CI_MANIFEST_MISMATCH", error.message, "cli");
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    return 1;
  }

  const result = verifyFreezeOperatorHandoffMinimality(args);
  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    return 1;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return 0;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (entrypointPath === modulePath) {
  process.exit(runCli(process.argv));
}
