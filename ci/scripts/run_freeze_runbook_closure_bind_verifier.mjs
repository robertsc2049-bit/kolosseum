#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_COMPONENTS } from "./run_freeze_governance_closure_gate.mjs";

export const DEFAULT_RUNBOOK_PATH = process.env.KOLOSSEUM_FREEZE_RUNBOOK_PATH || "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md";

function normalizeRel(input) {
  return String(input).replace(/\\/g, "/").trim();
}

function fail(token, file, details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token,
        file,
        details,
        ...extra
      }
    ]
  };
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    runbookPath: DEFAULT_RUNBOOK_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--runbook") {
      args.runbookPath = argv[i + 1];
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function buildRequiredEntries() {
  return Object.entries(DEFAULT_COMPONENTS)
    .map(([component, relPath]) => ({
      component,
      relPath: normalizeRel(relPath)
    }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function verifyFreezeRunbookClosureBind({
  root = process.cwd(),
  runbookPath = DEFAULT_RUNBOOK_PATH
} = {}) {
  const normalizedRunbookPath = normalizeRel(runbookPath);
  const absoluteRunbookPath = path.resolve(root, runbookPath);

  if (!fs.existsSync(absoluteRunbookPath)) {
    return fail(
      "CI_SPINE_MISSING_DOC",
      normalizedRunbookPath,
      "Authoritative freeze runbook is missing."
    );
  }

  const runbookText = fs.readFileSync(absoluteRunbookPath, "utf8").replace(/\r\n/g, "\n");
  const requiredEntries = buildRequiredEntries();
  const missing = [];

  for (const entry of requiredEntries) {
    if (!runbookText.includes(entry.relPath)) {
      missing.push({
        component: entry.component,
        path: entry.relPath
      });
    }
  }

  if (missing.length > 0) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedRunbookPath,
      "Freeze runbook is missing one or more required closure artefact references.",
      { missing_components: missing }
    );
  }

  return {
    ok: true,
    verifier_id: "freeze_runbook_closure_bind_verifier",
    checked_at_utc: new Date().toISOString(),
    runbook_path: normalizedRunbookPath,
    required_closure_components: requiredEntries
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const report = fail("CI_MANIFEST_MISMATCH", "cli", error.message);
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  const result = verifyFreezeRunbookClosureBind(args);

  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main();
}
