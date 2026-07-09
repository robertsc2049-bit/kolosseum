// DEV NOTE: BETA-04 Copy Registry guard.
// Purpose: enforce beta user-facing copy through copy IDs and block forbidden
// claim language before beta surfaces can ship.
// Boundary: this script validates copy registry data and scoped beta text files
// only. It does not add product behaviour, render UI, infer user state, alter
// engine output, or decide training actions.
// Failure: emits the BETA-03 CI token report shape and fails closed.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  createCiTokenReport,
  emitCiTokenReport
} from "./ci_token_report.mjs";

export const BETA_COPY_REQUIRED_IDS = Object.freeze([
  "beta.onboarding.title",
  "beta.onboarding.body",
  "beta.declaration.error.required",
  "beta.declaration.error.invalid_scope",
  "beta.session_compile.action",
  "beta.session_compile.unavailable",
  "beta.runtime_execution.start",
  "beta.runtime_execution.record_event",
  "beta.split_return.split",
  "beta.split_return.return",
  "beta.partial_completion.recorded",
  "beta.coach_assignment.assigned",
  "beta.coach_assignment.unassigned",
  "beta.coach_notes.boundary",
  "beta.projection.summary",
  "beta.replay.status",
  "beta.evidence.status",
  "beta.export.action",
  "beta.export.limitation",
  "beta.limitations.scope",
  "beta.limitations.non_claim"
]);

export const TOKEN = Object.freeze({
  guard: "CI_COPY_GUARD",
  registryBaseline: "CI_BETA_COPY_REGISTRY_BASELINE",
  inlineCopy: "CI_LINT_COPY_INLINE_STRING",
  unknownCopyId: "CI_LINT_COPY_ID_UNKNOWN",
  forbiddenLanguage: "CI_LINT_FORBIDDEN_LANGUAGE_FOUND",
  forbiddenClaimSemantic: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"
});

const DEFAULT_REGISTRY_PATH = "src/ui/copy/beta_copy_registry.json";
const DEFAULT_SCOPE_PATH = "ci/locks/beta_copy_scope.json";

const FORBIDDEN_LANGUAGE_RULES = Object.freeze([
  {
    rule_id: "medical_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\bmedical\b/i,
      /\bdiagnos(?:e|is|tic|tics)?\b/i,
      /\btreat(?:s|ed|ment|ing)?\b/i,
      /\bclinical\b/i,
      /\btherapy\b/i,
      /\btherapeutic\b/i,
      /\brehab(?:ilitation)?\b/i,
      /\binjur(?:y|ies|ed)\b/i,
      /\breturn[\s-]?to[\s-]?play\b/i,
      /\breturn[\s-]?to[\s-]?run\b/i,
      /\bfitness[\s-]?for[\s-]?duty\b/i,
      /\boperational readiness\b/i
    ]
  },
  {
    rule_id: "safety_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\bsafe(?:r|ty)?\b/i,
      /\brisk[\s-]?free\b/i,
      /\bno risk\b/i,
      /\bguarantee(?:d|s)?\b/i
    ]
  },
  {
    rule_id: "readiness_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\breadiness\b/i,
      /\bready\b/i,
      /\bcompetition[\s-]?ready\b/i,
      /\bmatch[\s-]?ready\b/i,
      /\bfatigue\b/i
    ]
  },
  {
    rule_id: "suitability_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\bsuitable\b/i,
      /\bsuitability\b/i,
      /\bright for you\b/i,
      /\bappropriate for\b/i,
      /\bideal for\b/i
    ]
  },
  {
    rule_id: "optimisation_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\boptim(?:ise|ize|ised|ized|isation|ization|al)\b/i,
      /\bbest\b/i,
      /\bbetter results?\b/i
    ]
  },
  {
    rule_id: "recommendation_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\brecommend(?:s|ed|ation|ations)?\b/i,
      /\badvis(?:e|ed|ory|es|ing)\b/i,
      /\bshould\b/i
    ]
  },
  {
    rule_id: "protection_prevention_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\bprotect(?:s|ed|ion|ing)?\b/i,
      /\bprevent(?:s|ed|ion|ing)?\b/i
    ]
  },
  {
    rule_id: "performance_claim_language",
    token: TOKEN.forbiddenLanguage,
    patterns: [
      /\bperformance\b/i,
      /\bimprov(?:e|es|ed|ement|ing)\b/i,
      /\bfaster\b/i,
      /\bstronger\b/i
    ]
  }
]);

const FORBIDDEN_CONTEXT_RULES = Object.freeze([
  {
    rule_id: "personalised_claim_context",
    token: TOKEN.forbiddenClaimSemantic,
    patterns: [
      /\bdesigned\s+for\s+you\b/i,
      /\bchosen\s+for\s+you\b/i,
      /\bselected\s+for\s+you\b/i,
      /\bbased\s+on\s+your\s+needs\b/i
    ]
  },
  {
    rule_id: "avoidance_claim_context",
    token: TOKEN.forbiddenClaimSemantic,
    patterns: [
      /\bhelps\s+avoid\b/i,
      /\bhelps\s+reduce\b/i,
      /\bkeeps\s+you\b/i
    ]
  }
]);

function normalizeRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

function excerptAt(text, index, length = 160) {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + length);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function failure(token, message, relPath, extra = {}) {
  return {
    token,
    message,
    source: "ci/scripts/run_beta_copy_registry_guard.mjs",
    location: relPath ? { path: normalizeRel(relPath), ...(Number.isInteger(extra.line) ? { line: extra.line } : {}) } : undefined,
    details: Object.fromEntries(
      Object.entries(extra).filter(([key, value]) => key !== "line" && value !== undefined)
    )
  };
}

function scanForbiddenText({ text, relPath, context }) {
  const failures = [];

  for (const rule of FORBIDDEN_LANGUAGE_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match) {
        failures.push(failure(rule.token, "Forbidden beta copy language found.", relPath, {
          rule_id: rule.rule_id,
          context,
          line: lineNumberAt(text, match.index),
          excerpt: excerptAt(text, match.index)
        }));
      }
    }
  }

  for (const rule of FORBIDDEN_CONTEXT_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match) {
        failures.push(failure(rule.token, "Forbidden contextual beta claim found.", relPath, {
          rule_id: rule.rule_id,
          context,
          line: lineNumberAt(text, match.index),
          excerpt: excerptAt(text, match.index)
        }));
      }
    }
  }

  return failures;
}

export function validateBetaCopyRegistry(registry, relPath = DEFAULT_REGISTRY_PATH) {
  const failures = [];

  if (!isPlainObject(registry)) {
    return [failure(TOKEN.registryBaseline, "Beta copy registry must be a JSON object.", relPath)];
  }

  if (registry.schema_version !== "kolosseum.beta.copy_registry.v1") {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy registry schema_version is invalid.", relPath, {
      expected: "kolosseum.beta.copy_registry.v1",
      actual: registry.schema_version
    }));
  }

  if (registry.registry_id !== "beta_copy_registry_baseline") {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy registry_id is invalid.", relPath, {
      expected: "beta_copy_registry_baseline",
      actual: registry.registry_id
    }));
  }

  if (registry.closed_world !== true) {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy registry must be closed_world=true.", relPath));
  }

  if (!Array.isArray(registry.required_copy_ids)) {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy registry required_copy_ids must be an array.", relPath));
  }

  if (!Array.isArray(registry.entries)) {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy registry entries must be an array.", relPath));
    return failures;
  }

  const required = new Set(BETA_COPY_REQUIRED_IDS);
  const declaredRequired = new Set(registry.required_copy_ids ?? []);
  const seen = new Set();

  for (const requiredId of required) {
    if (!declaredRequired.has(requiredId)) {
      failures.push(failure(TOKEN.unknownCopyId, "Beta required copy ID is missing from required_copy_ids.", relPath, {
        copy_id: requiredId
      }));
    }
  }

  for (const declaredId of declaredRequired) {
    if (!required.has(declaredId)) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy required_copy_ids contains an undeclared baseline ID.", relPath, {
        copy_id: declaredId
      }));
    }
  }

  for (const [index, entry] of registry.entries.entries()) {
    if (!isPlainObject(entry)) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy entry must be an object.", relPath, {
        entry_index: index
      }));
      continue;
    }

    const copyId = typeof entry.copy_id === "string" ? entry.copy_id.trim() : "";
    const text = typeof entry.text === "string" ? entry.text : "";

    if (!copyId) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy entry missing copy_id.", relPath, {
        entry_index: index
      }));
      continue;
    }

    if (seen.has(copyId)) {
      failures.push(failure(TOKEN.registryBaseline, "Duplicate beta copy ID.", relPath, {
        copy_id: copyId
      }));
    }

    seen.add(copyId);

    if (!required.has(copyId)) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy entry is outside the closed baseline ID set.", relPath, {
        copy_id: copyId
      }));
    }

    if (!text.trim()) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy entry text must be non-empty.", relPath, {
        copy_id: copyId
      }));
    }

    if (!Array.isArray(entry.params)) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy entry params must be an array.", relPath, {
        copy_id: copyId
      }));
    }

    failures.push(...scanForbiddenText({
      text,
      relPath,
      context: `copy_id:${copyId}`
    }));
  }

  for (const requiredId of required) {
    if (!seen.has(requiredId)) {
      failures.push(failure(TOKEN.unknownCopyId, "Beta required copy ID is missing from entries.", relPath, {
        copy_id: requiredId
      }));
    }
  }

  return failures;
}

function shouldIgnoreLiteral({ literal, line, registryIds }) {
  const value = String(literal ?? "").trim();
  const sourceLine = String(line ?? "").trim();

  if (!value) return true;
  if (registryIds.has(value)) return true;
  if (/^(import|export)\s/.test(sourceLine)) return true;
  if (/^(\.{1,2}\/|\/|node:|[A-Za-z]:)/.test(value)) return true;
  if (/^[a-z0-9_.:/@-]+$/i.test(value) && !/\s/.test(value)) return true;
  if (sourceLine.includes("copy_id") && registryIds.has(value)) return true;
  if (sourceLine.includes("copyId") && registryIds.has(value)) return true;
  if (sourceLine.includes("BETA_COPY") && registryIds.has(value)) return true;
  if (value === "BETA_USER_COPY_SURFACE") return true;

  return false;
}

function scanInlineCopy({ text, relPath, registryIds }) {
  const failures = [];
  const literalPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const lines = text.split(/\n/);
  let match;

  while ((match = literalPattern.exec(text)) !== null) {
    const literal = match[2] ?? "";
    const line = lineNumberAt(text, match.index);
    const sourceLine = lines[line - 1] ?? "";

    if (shouldIgnoreLiteral({ literal, line: sourceLine, registryIds })) {
      continue;
    }

    if (/[A-Za-z]/.test(literal) && /\s/.test(literal)) {
      failures.push(failure(TOKEN.inlineCopy, "Inline beta user-facing copy found outside the Copy Registry.", relPath, {
        line,
        excerpt: literal.replace(/\s+/g, " ").trim()
      }));
    }
  }

  return failures;
}

function walkFiles(root, relPrefix) {
  const out = [];
  const start = path.join(root, relPrefix);

  if (!fs.existsSync(start)) {
    return out;
  }

  function visit(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
      } else if (entry.isFile() && /\.(mjs|js|ts|tsx|jsx|json|md)$/i.test(entry.name)) {
        out.push(abs);
      }
    }
  }

  visit(start);
  return out;
}

function collectScopeFiles(root, scope) {
  const files = new Set();

  for (const relPath of scope.paths ?? []) {
    const normalized = normalizeRel(relPath);
    if (!normalized) continue;
    const abs = path.join(root, normalized);
    if (fs.existsSync(abs)) {
      files.add(abs);
    }
  }

  for (const prefix of scope.path_prefixes ?? []) {
    for (const abs of walkFiles(root, normalizeRel(prefix))) {
      files.add(abs);
    }
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

export function verifyBetaCopyRegistry({
  root = process.cwd(),
  registryPath = DEFAULT_REGISTRY_PATH,
  scopePath = DEFAULT_SCOPE_PATH
} = {}) {
  const registryRel = normalizeRel(registryPath);
  const scopeRel = normalizeRel(scopePath);
  const registryAbs = path.join(root, registryRel);
  const scopeAbs = path.join(root, scopeRel);
  const failures = [];

  if (!fs.existsSync(registryAbs)) {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy registry is missing.", registryRel));
    return { ok: false, guard: "BETA-04", token: TOKEN.guard, failures };
  }

  if (!fs.existsSync(scopeAbs)) {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy scope lock is missing.", scopeRel));
    return { ok: false, guard: "BETA-04", token: TOKEN.guard, failures };
  }

  const registry = readJson(registryAbs);
  const scope = readJson(scopeAbs);

  failures.push(...validateBetaCopyRegistry(registry, registryRel));

  if (!isPlainObject(scope)) {
    failures.push(failure(TOKEN.registryBaseline, "Beta copy scope lock must be a JSON object.", scopeRel));
  } else {
    if (scope.schema_version !== "kolosseum.beta.copy_scope.v1") {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy scope schema_version is invalid.", scopeRel, {
        expected: "kolosseum.beta.copy_scope.v1",
        actual: scope.schema_version
      }));
    }

    if (normalizeRel(scope.registry_path) !== registryRel) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy scope must reference the beta copy registry.", scopeRel, {
        expected: registryRel,
        actual: scope.registry_path
      }));
    }

    if (!Array.isArray(scope.paths)) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy scope paths must be an array.", scopeRel));
    }

    if (!Array.isArray(scope.path_prefixes)) {
      failures.push(failure(TOKEN.registryBaseline, "Beta copy scope path_prefixes must be an array.", scopeRel));
    }
  }

  const registryIds = new Set((registry.entries ?? []).map((entry) => entry.copy_id).filter((value) => typeof value === "string"));
  const scopeFiles = isPlainObject(scope) ? collectScopeFiles(root, scope) : [];

  for (const abs of scopeFiles) {
    const relPath = normalizeRel(path.relative(root, abs));
    const text = readUtf8(abs);

    failures.push(...scanInlineCopy({ text, relPath, registryIds }));
    failures.push(...scanForbiddenText({ text, relPath, context: "beta_scope_file" }));
  }

  return {
    ok: failures.length === 0,
    guard: "BETA-04",
    token: TOKEN.guard,
    registry_path: registryRel,
    scope_path: scopeRel,
    scanned_files: scopeFiles.length,
    required_copy_ids: BETA_COPY_REQUIRED_IDS.length,
    failures
  };
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    registryPath: DEFAULT_REGISTRY_PATH,
    scopePath: DEFAULT_SCOPE_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--registry") {
      args.registryPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--scope") {
      args.scopePath = argv[i + 1];
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = verifyBetaCopyRegistry(args);

  const report = createCiTokenReport({
    guard: "BETA-04",
    token: TOKEN.guard,
    message: result.ok ? "Beta copy registry guard passed." : "Beta copy registry guard failed.",
    failures: result.failures,
    details: {
      registry_path: result.registry_path,
      scope_path: result.scope_path,
      scanned_files: result.scanned_files,
      required_copy_ids: result.required_copy_ids
    }
  });

  emitCiTokenReport(report, { stream: result.ok ? "stdout" : "stderr" });
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
