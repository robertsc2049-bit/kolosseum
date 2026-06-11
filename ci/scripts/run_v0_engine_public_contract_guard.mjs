#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const engineEntryRel = "engine/src/index.ts";
const contractRel = "ci/contracts/v0_engine_public_contract.json";

const engineEntryPath = path.join(repoRoot, engineEntryRel);
const contractPath = path.join(repoRoot, contractRel);

function fail(token, details) {
  process.stderr.write(JSON.stringify({ ok: false, token, details }, null, 2) + "\n");
  process.exitCode = 1;
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, "$1");
}

function uniqSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function extractEngineExports(sourceText) {
  const source = stripComments(sourceText);
  const named = [];
  const wildcard = [];

  for (const match of source.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)) {
    named.push(match[1]);
  }

  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    const parts = match[1].split(",");
    for (const rawPart of parts) {
      const part = rawPart.trim();
      if (!part) continue;
      const aliasMatch = part.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      if (aliasMatch) {
        named.push(aliasMatch[1]);
      } else {
        const direct = part.match(/^([A-Za-z_$][\w$]*)$/);
        if (direct) named.push(direct[1]);
      }
    }
  }

  for (const match of source.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
    wildcard.push(match[1]);
  }

  return {
    named_exports: uniqSorted(named),
    wildcard_exports: uniqSorted(wildcard),
  };
}

function extractForbiddenEngineImports(sourceText) {
  const source = stripComments(sourceText);
  const forbidden = [];
  const forbiddenParts = [
    "/ui/",
    "/copy/",
    "/auth/",
    "/billing/",
    "/payment/",
    "/payments/",
    "/dashboard/",
    "/dashboards/",
    "/analytics/",
    "/coach-notes/",
    "/coach_notes/",
    "/claims/"
  ];

  const importPatterns = [
    /import\s+[^"']*["']([^"']+)["']/g,
    /export\s+[^"']*from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = String(match[1] || "").replaceAll("\\", "/");
      const normalised = specifier.startsWith(".") ? "/" + specifier.replace(/^(\.\/|\.\.\/)+/, "") + "/" : "/" + specifier + "/";
      if (forbiddenParts.some((part) => normalised.includes(part))) {
        forbidden.push(specifier);
      }
    }
  }

  return uniqSorted(forbidden);
}

if (!fs.existsSync(engineEntryPath)) {
  fail("v0_engine_entry_missing", `Missing ${engineEntryRel}`);
}

if (!fs.existsSync(contractPath)) {
  fail("v0_engine_contract_missing", `Missing ${contractRel}`);
}

if (process.exitCode) process.exit(process.exitCode);

const engineEntryText = fs.readFileSync(engineEntryPath, "utf8");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

const actual = extractEngineExports(engineEntryText);
const expectedNamed = uniqSorted(contract.named_exports || []);
const expectedWildcard = uniqSorted(contract.wildcard_exports || []);

const forbiddenImports = extractForbiddenEngineImports(engineEntryText);

if (JSON.stringify(actual.named_exports) !== JSON.stringify(expectedNamed)) {
  fail("v0_engine_public_named_exports_drift", {
    expected: expectedNamed,
    actual: actual.named_exports,
  });
}

if (JSON.stringify(actual.wildcard_exports) !== JSON.stringify(expectedWildcard)) {
  fail("v0_engine_public_wildcard_exports_drift", {
    expected: expectedWildcard,
    actual: actual.wildcard_exports,
  });
}

if (forbiddenImports.length > 0) {
  fail("v0_engine_boundary_import_violation", {
    forbiddenImports,
  });
}

if (contract.engine_truth_boundary !== "engine_output_must_not_depend_on_ui_copy_notes_auth_billing_claims_or_analytics") {
  fail("v0_engine_contract_boundary_missing", "engine_truth_boundary is missing or incorrect.");
}

if (contract.drift_policy !== "fail_on_public_export_or_forbidden_dependency_drift") {
  fail("v0_engine_contract_drift_policy_missing", "drift_policy is missing or incorrect.");
}

if (!process.exitCode) {
  process.stdout.write(JSON.stringify({
    ok: true,
    named_exports: actual.named_exports,
    wildcard_exports: actual.wildcard_exports,
  }, null, 2) + "\n");
}