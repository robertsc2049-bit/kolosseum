#!/usr/bin/env node
/**
 * DEV NOTE: Failure token index guard boundary.
 * Purpose: generate and verify a searchable developer index for failure tokens
 * emitted by CI, engine, runtime, API, guard, and script surfaces.
 * Boundary: this script documents existing tokens only. It must not rename tokens,
 * reinterpret engine behaviour, or create product authority.
 * Determinism: token collection is path-sorted and rendered from committed source
 * text with fixed meaning/cause/fix templates.
 * Failure: missing index, stale generated block, or banned wording sets a
 * non-zero process status with a stable CI_FAILURE_TOKEN_INDEX_* token.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, "docs", "dev", "FAILURE_TOKEN_INDEX.md");

const sourceRoots = [
  "ci/guards",
  "ci/scripts",
  "engine/src",
  "engine/runtime",
  "engine/session",
  "src/api",
  "server/api",
  "shared"
];

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);

const ignoredPathParts = [
  "/node_modules/",
  "/.git/",
  "/dist/",
  "/coverage/",
  "/__fixtures__/",
  "/fixtures/",
  "/golden/",
  "/evidence/",
  "/docs/"
];

const tokenPattern = /(?<![A-Za-z0-9])(?:[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){1,}|[a-z][a-z0-9]+(?:_[a-z0-9]+){1,})(?![A-Za-z0-9])/g;

const contextPattern = /failure|token|throw|Error|die\(|fail\(|process\.exit|console\.error|PHASE|CI_|S\d+_|V0_|REGISTRY|SPINE|SHA256|MISSING|INVALID|UNKNOWN|REFUSED|BOUNDARY|CONTRACT|DRIFT|NO_COUPLING|NOT_FOUND|BAD_REQUEST|INTERNAL_SERVER_ERROR/i;

const ignoredTokens = new Set([
  "accepted_at",
  "actual_sha256",
  "allowed_fields",
  "allowed_surfaces",
  "created_at",
  "document_id",
  "event_id",
  "event_type",
  "expected_token",
  "failure_count",
  "failure_token",
  "file_count",
  "manifest_id",
  "manifest_version",
  "named_exports",
  "output_sha256",
  "phase1_input",
  "phase2_hash",
  "registry_bundle_hash",
  "schema_sha256s",
  "source_file",
  "source_path"
]);

const bannedTokenFragments = [
  "medical",
  "diagnosis",
  "diagnose",
  "optimisation",
  "optimization",
  "recommendation",
  "recommend",
  "readiness",
  "fatigue",
  "injury",
  "risk_score"
];

const bannedDocFragments = [
  "diagnosis",
  "diagnose",
  "optimisation",
  "optimization",
  "recommendation",
  "recommend ",
  "readiness",
  "fatigue",
  "injury",
  "risk score"
];

const highSignalRules = [
  /^CI_[A-Z0-9_]+$/,
  /^PHASE[0-9A-Z_]+$/,
  /^V0_[A-Z0-9_]+$/,
  /^REGISTRY_[A-Z0-9_]+$/,
  /^SPINE_[A-Z0-9_]+$/,
  /^SHA256_[A-Z0-9_]+$/,
  /^ENGINE_[A-Z0-9_]+$/,
  /^BOUNDARY_[A-Z0-9_]+$/,
  /^FREEZE_[A-Z0-9_]+$/,
  /^P[0-9]+_[A-Z0-9_]+$/,
  /^BAD_REQUEST$/,
  /^NOT_FOUND$/,
  /^INTERNAL_SERVER_ERROR$/,
  /^[a-z][a-z0-9]+(?:_[a-z0-9]+){1,}$/
];

function toRepoPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = toRepoPath(path.relative(repoRoot, full));

    if (ignoredPathParts.some((part) => `/${rel}/`.includes(part))) {
      continue;
    }

    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }

    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      out.push(full);
    }
  }

  return out;
}

function containsBannedFragment(value, fragments) {
  const lower = value.toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment));
}

function isHighSignalToken(token) {
  if (ignoredTokens.has(token)) {
    return false;
  }

  if (containsBannedFragment(token, bannedTokenFragments)) {
    return false;
  }

  if (token.length < 4 || token.length > 96) {
    return false;
  }

  return highSignalRules.some((rule) => rule.test(token));
}

function classifyToken(token, file) {
  if (token.startsWith("CI_")) {
    return {
      meaning: "CI guard or script failure token.",
      likelyCause: "A committed contract, guard input, source file, manifest, registry, or generated artefact drifted from the expected shape.",
      safeFix: "Read the emitting guard, restore the intended boundary, then re-run the targeted guard before full gates."
    };
  }

  if (token.startsWith("PHASE")) {
    return {
      meaning: "Engine phase or runtime failure token.",
      likelyCause: "Input, phase output, planned item, runtime event, or phase contract did not match the deterministic engine contract.",
      safeFix: "Fix the engine-visible input or phase contract without adding hidden defaults or product-surface dependencies."
    };
  }

  if (token.startsWith("REGISTRY") || token.includes("_REGISTRY_") || file.includes("registry")) {
    return {
      meaning: "Registry structure, seal, bundle, manifest, or law failure token.",
      likelyCause: "Registry file shape, FK closure, manifest order, seal state, or registry bundle output drifted.",
      safeFix: "Restore the registry source of truth or update the approved manifest/seal path through the relevant registry guard."
    };
  }

  if (token.startsWith("SPINE") || token.includes("_SPINE_")) {
    return {
      meaning: "Documentation spine failure token.",
      likelyCause: "A spine-listed document is missing, stale, or in authority conflict.",
      safeFix: "Restore the referenced document or update the spine/checksum material through the approved docs path."
    };
  }

  if (token.startsWith("SHA256") || token.includes("_SHA256") || token.includes("HASH")) {
    return {
      meaning: "Checksum or canonical hash failure token.",
      likelyCause: "Tracked bytes changed without the matching approved hash/checksum update.",
      safeFix: "Verify the byte change is intentional, then update the pinned hash only through the approved writer or guard path."
    };
  }

  if (token.startsWith("ENGINE") || file.includes("engine")) {
    return {
      meaning: "Engine boundary, export, input, or contract failure token.",
      likelyCause: "Engine public surface, package exports, input contract, or deterministic boundary drifted.",
      safeFix: "Restore the engine boundary or make a deliberate engine-contract slice with matching tests and docs."
    };
  }

  if (token.startsWith("BOUNDARY") || token.includes("_BOUNDARY") || file.includes("boundary")) {
    return {
      meaning: "Boundary protection failure token.",
      likelyCause: "A protected path, forbidden dependency, scope rule, or release boundary was crossed.",
      safeFix: "Move the change back inside the permitted boundary or create a deliberate boundary-change slice."
    };
  }

  if (token.startsWith("FREEZE") || token.includes("_FREEZE_")) {
    return {
      meaning: "Freeze, promotion, proof, or release-control failure token.",
      likelyCause: "A freeze artefact, proof binding, promotion packet, rollback packet, or controlled surface drifted.",
      safeFix: "Restore the frozen artefact set or regenerate through the approved freeze/proof command sequence."
    };
  }

  if (token === "BAD_REQUEST" || token === "NOT_FOUND" || token === "INTERNAL_SERVER_ERROR") {
    return {
      meaning: "HTTP error mapping token.",
      likelyCause: "API input, lookup, persistence, or unknown handler failure mapped to an HTTP response.",
      safeFix: "Fix the request contract or service mapping without leaking internal engine state into transport code."
    };
  }

  if (file.includes("src/api") || file.includes("server/api")) {
    return {
      meaning: "API or server failure token.",
      likelyCause: "Transport input, access check, persistence result, or handler delegation contract failed.",
      safeFix: "Fix the API boundary or delegated service while keeping engine rules inside the engine package."
    };
  }

  return {
    meaning: "Source-level failure or blocked-state token.",
    likelyCause: "The emitting source detected an invalid, missing, unknown, refused, or blocked condition.",
    safeFix: "Read the source file named here, fix the underlying condition, and re-run the targeted guard or test."
  };
}

function collectTokens() {
  const files = sourceRoots
    .flatMap((root) => walk(path.join(repoRoot, root)))
    .sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)));

  const byToken = new Map();

  for (const file of files) {
    const rel = toRepoPath(path.relative(repoRoot, file));
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (!contextPattern.test(line)) {
        continue;
      }

      for (const match of line.matchAll(tokenPattern)) {
        const token = match[0];

        if (!isHighSignalToken(token)) {
          continue;
        }

        if (!byToken.has(token)) {
          byToken.set(token, {
            token,
            sourceFile: rel,
            line: index + 1,
            sourceText: line.trim()
          });
        }
      }
    }
  }

  return [...byToken.values()].sort((a, b) => {
    const tokenOrder = a.token.localeCompare(b.token);
    if (tokenOrder !== 0) {
      return tokenOrder;
    }
    return a.sourceFile.localeCompare(b.sourceFile);
  });
}

function renderIndex(tokens) {
  const lines = [];
  lines.push("<!-- DEV NOTE: Developer documentation surface. This index is generated from committed source tokens. It does not rename tokens or create product, engine, registry, or CI authority. -->");
  lines.push("");
  lines.push("# Failure Token Index");
  lines.push("");
  lines.push("Status: generated developer handover index.");
  lines.push("");
  lines.push("Purpose: make CI, engine, runtime, API, registry, boundary, and guard failures searchable for a future developer.");
  lines.push("");
  lines.push("This file documents existing tokens only. Do not change source tokens just to make this index easier to read.");
  lines.push("");
  lines.push("Regenerate and verify with:");
  lines.push("");
  lines.push("    node ci/scripts/run_failure_token_index_guard.mjs --write");
  lines.push("    node ci/scripts/run_failure_token_index_guard.mjs");
  lines.push("");
  lines.push("## Rules");
  lines.push("");
  lines.push("- Source tokens remain owned by their source files and tests.");
  lines.push("- This index is not engine, product, registry, release, or CI authority.");
  lines.push("- Token meanings below are developer triage descriptions, not user-facing copy.");
  lines.push("- When a token appears, read the source file and the failing guard before editing.");
  lines.push("");
  lines.push("## Indexed tokens");
  lines.push("");
  lines.push("| Token | Source file | Meaning | Likely cause | Safe fix |");
  lines.push("| --- | --- | --- | --- | --- |");

  for (const row of tokens) {
    const classified = classifyToken(row.token, row.sourceFile);
    lines.push(`| \`${row.token}\` | \`${row.sourceFile}\` | ${classified.meaning} | ${classified.likelyCause} | ${classified.safeFix} |`);
  }

  lines.push("");
  lines.push("## Completion rule");
  lines.push("");
  lines.push("The index is current only when `node ci/scripts/run_failure_token_index_guard.mjs` passes from the committed tree.");
  lines.push("");

  return lines.join("\n");
}

function validateNoBannedTokenFragments(tokens) {
  const failures = [];
  for (const row of tokens) {
    const token = row.token.toLowerCase();
    for (const fragment of bannedTokenFragments) {
      if (token.includes(fragment)) {
        failures.push(`${row.token}:${fragment}`);
      }
    }
  }
  return failures;
}

function main() {
  const writeMode = process.argv.includes("--write");
  const tokens = collectTokens();
  const rendered = renderIndex(tokens);
  const bannedDocFailures = validateNoBannedTokenFragments(tokens);

  if (bannedDocFailures.length > 0) {
    console.error(JSON.stringify({
      ok: false,
      token: "CI_FAILURE_TOKEN_INDEX_CLAIM_TERM",
      failures: bannedDocFailures
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (writeMode) {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, rendered, "utf8");
    console.log(JSON.stringify({
      ok: true,
      mode: "write",
      token_count: tokens.length,
      path: "docs/dev/FAILURE_TOKEN_INDEX.md"
    }, null, 2));
    return;
  }

  if (!fs.existsSync(indexPath)) {
    console.error(JSON.stringify({
      ok: false,
      token: "CI_FAILURE_TOKEN_INDEX_MISSING",
      path: "docs/dev/FAILURE_TOKEN_INDEX.md"
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const current = fs.readFileSync(indexPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (current !== rendered) {
    console.error(JSON.stringify({
      ok: false,
      token: "CI_FAILURE_TOKEN_INDEX_STALE",
      path: "docs/dev/FAILURE_TOKEN_INDEX.md",
      expected_token_count: tokens.length
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    token_count: tokens.length,
    path: "docs/dev/FAILURE_TOKEN_INDEX.md"
  }, null, 2));
}

main();
