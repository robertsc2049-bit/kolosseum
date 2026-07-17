// DEV NOTE: BETA-FIX-01 beta-wide copy registry reconciliation library.
// This library validates copy authority and presentation-copy boundaries only.
// It does not render UI, mutate engine truth, or infer athlete state.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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

export const BETA_COPY_TOKENS = Object.freeze({
  guard: "CI_COPY_GUARD",
  registry: "CI_BETA_COPY_REGISTRY_RECONCILIATION",
  baseline: "CI_BETA_COPY_REGISTRY_BASELINE",
  inlineCopy: "CI_LINT_COPY_INLINE_STRING",
  unknownCopyId: "CI_LINT_COPY_ID_UNKNOWN",
  forbiddenLanguage: "CI_LINT_FORBIDDEN_LANGUAGE_FOUND",
  forbiddenContext: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC",
  duplicateCopyId: "CI_BETA_COPY_ID_DUPLICATE",
  missingRequiredCopyId: "CI_BETA_COPY_ID_REQUIRED_MISSING",
  invalidScope: "CI_BETA_COPY_SCOPE_INVALID",
  subordinateConflict: "CI_BETA_COPY_SUBORDINATE_CONFLICT"
});

const FORBIDDEN_LANGUAGE_RULES = Object.freeze([
  {
    rule_id: "medical_diagnostic_treatment",
    patterns: [
      /\bmedical\b/iu,
      /\bdiagnos(?:e|ed|es|ing|is|tic|tics)?\b/iu,
      /\btreat(?:s|ed|ment|ments|ing)?\b/iu,
      /\bclinical\b/iu,
      /\btherap(?:y|ies|eutic)\b/iu,
      /\brehab(?:ilitation)?\b/iu,
      /\binjur(?:y|ies|ed)\b/iu,
      /\breturn[\s-]+to[\s-]+(?:play|run)\b/iu,
      /\bfitness[\s-]+for[\s-]+duty\b/iu,
      /\boperational[\s-]+readiness\b/iu
    ]
  },
  {
    rule_id: "safety_guarantee",
    patterns: [
      /\bsafe(?:r|ty)?\b/iu,
      /\brisk[\s-]*free\b/iu,
      /\bno\s+risk\b/iu,
      /\bguarantee(?:d|s)?\b/iu
    ]
  },
  {
    rule_id: "readiness_fatigue",
    patterns: [
      /\breadiness\b/iu,
      /\bcompetition[\s-]*ready\b/iu,
      /\bmatch[\s-]*ready\b/iu,
      /\bfatigue\b/iu,
      /\b(?:athlete|user|you|session|programme|program|training)\s+(?:is\s+)?ready\b/iu,
      /\bready\s+(?:to|for)\s+(?:train|compete|play|run|lift)\b/iu
    ]
  },
  {
    rule_id: "suitability",
    patterns: [
      /\bsuitable\b/iu,
      /\bsuitability\b/iu,
      /\bright\s+for\s+you\b/iu,
      /\bappropriate\s+for\b/iu,
      /\bideal\s+for\b/iu
    ]
  },
  {
    rule_id: "optimisation_recommendation",
    patterns: [
      /\boptim(?:ise|ised|ises|ising|isation|ize|ized|izes|izing|ization|al)\b/iu,
      /\bbest\b/iu,
      /\bbetter\s+results?\b/iu,
      /\brecommend(?:s|ed|ing|ation|ations)?\b/iu,
      /\badvis(?:e|ed|es|ing|ory)\b/iu,
      /\byou\s+should\b/iu,
      /\bshould\s+(?:train|perform|use|select|choose|do|avoid)\b/iu
    ]
  },
  {
    rule_id: "protection_prevention_performance",
    patterns: [
      /\bprotect(?:s|ed|ion|ing)?\b/iu,
      /\bprevent(?:s|ed|ion|ing)?\b/iu,
      /\bperformance\b/iu,
      /\bimprov(?:e|es|ed|ement|ements|ing)\b/iu,
      /\bfaster\b/iu,
      /\bstronger\b/iu,
      /\beffective(?:ness)?\b/iu,
      /\brank(?:s|ed|ing)?\b/iu,
      /\binfer(?:s|red|ring|ence|ences)?\b/iu
    ]
  }
]);

const FORBIDDEN_CONTEXT_RULES = Object.freeze([
  {
    rule_id: "personalised_claim_context",
    patterns: [
      /\bdesigned\s+for\s+you\b/iu,
      /\bchosen\s+for\s+you\b/iu,
      /\bselected\s+for\s+you\b/iu,
      /\bbased\s+on\s+your\s+needs\b/iu
    ]
  },
  {
    rule_id: "avoidance_claim_context",
    patterns: [
      /\bhelps\s+avoid\b/iu,
      /\bhelps\s+reduce\b/iu,
      /\bkeeps\s+you\b/iu
    ]
  }
]);

function norm(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asciiSort(values) {
  return [...values].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\n/u).length;
}

function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function failure(token, message, relPath, details = {}) {
  const line = Number.isInteger(details.line) ? details.line : null;
  const cleanDetails = Object.fromEntries(
    Object.entries(details).filter(([key, value]) => key !== "line" && value !== undefined)
  );

  return {
    token,
    message,
    source: "ci/lib/beta_copy_registry_guard_lib.mjs",
    location: relPath
      ? { path: norm(relPath), ...(line ? { line } : {}) }
      : undefined,
    details: cleanDetails
  };
}

function readText(root, relPath) {
  return fs.readFileSync(path.join(root, norm(relPath)), "utf8");
}

function readJson(root, relPath) {
  return JSON.parse(readText(root, relPath));
}

function exists(root, relPath) {
  return fs.existsSync(path.join(root, norm(relPath)));
}

function entriesFromRegistry(value) {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.entries)) return value.entries;
  return null;
}

export function scanBetaCopyText(text, relPath, context = "registry_text") {
  const failures = [];
  const value = String(text ?? "");

  for (const rule of FORBIDDEN_LANGUAGE_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(value);
      if (match) {
        failures.push(failure(
          BETA_COPY_TOKENS.forbiddenLanguage,
          "Forbidden beta copy language found.",
          relPath,
          {
            rule_id: rule.rule_id,
            context,
            line: lineNumberAt(value, match.index),
            match: match[0]
          }
        ));
      }
    }
  }

  for (const rule of FORBIDDEN_CONTEXT_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(value);
      if (match) {
        failures.push(failure(
          BETA_COPY_TOKENS.forbiddenContext,
          "Forbidden contextual beta claim found.",
          relPath,
          {
            rule_id: rule.rule_id,
            context,
            line: lineNumberAt(value, match.index),
            match: match[0]
          }
        ));
      }
    }
  }

  return failures;
}

function collectPrefixFiles(root, prefixes) {
  const out = [];
  const allowed = /\.(?:html|js|mjs|cjs|ts|tsx|jsx)$/iu;

  function visit(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(target);
      } else if (entry.isFile() && allowed.test(entry.name)) {
        out.push(norm(path.relative(root, target)));
      }
    }
  }

  for (const prefix of prefixes) {
    const target = path.join(root, norm(prefix));
    if (fs.existsSync(target)) visit(target);
  }

  return asciiSort(new Set(out));
}

function extractCopyReferences(text) {
  const patterns = [
    /\bbeta(?:\.[a-z0-9_-]+){2,}\b/giu,
    /\bBETA16_COPY_[A-Z0-9_]+\b/gu,
    /\bBETA17_COPY_[A-Z0-9_]+\b/gu,
    /\bPHASE7_[A-Z0-9_]+\b/gu
  ];
  const out = [];
  for (const pattern of patterns) {
    for (const match of String(text).matchAll(pattern)) out.push(match[0]);
  }
  return [...new Set(out)];
}

function stripHtmlPresentationText(text) {
  return String(text)
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&[a-z0-9#]+;/giu, " ")
    .replace(/[0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripTemplateTechnical(value) {
  return String(value)
    .replace(/<[^>]+>/gu, " ")
    .replace(/\$\{[\s\S]*?\}/gu, " ")
    .replace(/\\[nrt]/gu, " ")
    .replace(/[^A-Za-z\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function scanInlineSource(text, relPath) {
  const failures = [];
  const source = String(text);

  if (/\.html?$/iu.test(relPath)) {
    const visibleText = stripHtmlPresentationText(source);
    if (/[A-Za-z]/u.test(visibleText)) {
      failures.push(failure(
        BETA_COPY_TOKENS.inlineCopy,
        "Inline HTML presentation copy found outside the Copy Registry.",
        relPath,
        { excerpt: visibleText.slice(0, 180) }
      ));
    }
  }

  const markerPattern = /BETA_USER_COPY_SURFACE\s*\(\s*(["'\x60])([\s\S]*?)\1\s*\)/gu;
  for (const match of source.matchAll(markerPattern)) {
    failures.push(failure(
      BETA_COPY_TOKENS.inlineCopy,
      "Explicit inline beta user-copy marker found.",
      relPath,
      { line: lineNumberAt(source, match.index), excerpt: match[2].slice(0, 180) }
    ));
  }

  const sinkPattern = /(?:\.textContent|\.innerText|\.innerHTML|document\.title)\s*=\s*(["'\x60])([\s\S]*?)\1/gu;
  for (const match of source.matchAll(sinkPattern)) {
    const literal = match[2] ?? "";
    if (/\bcopy\s*\(/u.test(literal) || /\$\{[^}]*copy\s*\(/u.test(literal)) continue;
    const presentation = stripTemplateTechnical(literal);
    if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/u.test(presentation)) {
      failures.push(failure(
        BETA_COPY_TOKENS.inlineCopy,
        "Inline beta presentation-sink copy found.",
        relPath,
        { line: lineNumberAt(source, match.index), excerpt: presentation.slice(0, 180) }
      ));
      failures.push(...scanBetaCopyText(presentation, relPath, "inline_presentation_sink"));
    }
  }

  const attributePattern = /\.setAttribute\s*\(\s*(["'])(?:placeholder|aria-label|title)\1\s*,\s*(["'\x60])([\s\S]*?)\2/gu;
  for (const match of source.matchAll(attributePattern)) {
    const literal = match[3] ?? "";
    if (/\bcopy\s*\(/u.test(literal)) continue;
    const presentation = stripTemplateTechnical(literal);
    if (/[A-Za-z]/u.test(presentation)) {
      failures.push(failure(
        BETA_COPY_TOKENS.inlineCopy,
        "Inline beta attribute copy found.",
        relPath,
        { line: lineNumberAt(source, match.index), excerpt: presentation.slice(0, 180) }
      ));
      failures.push(...scanBetaCopyText(presentation, relPath, "inline_attribute"));
    }
  }

  return failures;
}

function exactSetFailures(actualValues, expectedValues, token, message, relPath, detailKey) {
  const actual = asciiSort(actualValues);
  const expected = asciiSort(expectedValues);
  if (JSON.stringify(actual) === JSON.stringify(expected)) return [];
  return [failure(token, message, relPath, {
    [detailKey]: actual,
    expected
  })];
}

export function validateBetaCopyRegistry({ root, registry, scope, registryPath, scopePath }) {
  const failures = [];

  if (!isRecord(registry)) {
    return [failure(BETA_COPY_TOKENS.registry, "Authoritative beta copy registry must be an object.", registryPath)];
  }

  if (registry.schema_version !== "kolosseum.beta.copy_registry.v2") {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Authoritative registry schema_version is invalid.", registryPath));
  }
  if (registry.registry_id !== "beta_copy_registry_authoritative") {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Authoritative registry_id is invalid.", registryPath));
  }
  if (registry.closed_world !== true) {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Authoritative registry must be closed_world=true.", registryPath));
  }
  if (registry.locale !== "en-GB") {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Authoritative registry locale must be en-GB.", registryPath));
  }
  if (norm(registry.source_authority) !== norm(registryPath)) {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Authoritative registry source_authority is invalid.", registryPath));
  }

  if (!Array.isArray(registry.required_copy_ids) || !Array.isArray(registry.entries)) {
    failures.push(failure(BETA_COPY_TOKENS.baseline, "Baseline required IDs and entries must be arrays.", registryPath));
    return failures;
  }

  failures.push(...exactSetFailures(
    registry.required_copy_ids,
    BETA_COPY_REQUIRED_IDS,
    BETA_COPY_TOKENS.missingRequiredCopyId,
    "Required BETA-04 copy-ID declaration is incomplete.",
    registryPath,
    "actual_required_ids"
  ));

  const allIds = new Set();
  const baselineIds = [];

  for (const [index, entry] of registry.entries.entries()) {
    if (!isRecord(entry) || typeof entry.copy_id !== "string" || typeof entry.text !== "string" || !Array.isArray(entry.params)) {
      failures.push(failure(BETA_COPY_TOKENS.baseline, "Baseline copy entry is malformed.", registryPath, { entry_index: index }));
      continue;
    }
    if (entry.text.trim().length === 0) {
      failures.push(failure(BETA_COPY_TOKENS.baseline, "Baseline copy text is empty.", registryPath, { copy_id: entry.copy_id }));
    }
    if (entry.params.length !== 0) {
      failures.push(failure(BETA_COPY_TOKENS.baseline, "Undeclared baseline copy parameters are forbidden.", registryPath, { copy_id: entry.copy_id }));
    }
    if (allIds.has(entry.copy_id)) {
      failures.push(failure(BETA_COPY_TOKENS.duplicateCopyId, "Duplicate baseline copy ID.", registryPath, { copy_id: entry.copy_id }));
    }
    allIds.add(entry.copy_id);
    baselineIds.push(entry.copy_id);
    failures.push(...scanBetaCopyText(entry.text, registryPath, "copy_id:" + entry.copy_id));
  }

  failures.push(...exactSetFailures(
    baselineIds,
    BETA_COPY_REQUIRED_IDS,
    BETA_COPY_TOKENS.missingRequiredCopyId,
    "Required BETA-04 copy-ID entries are incomplete.",
    registryPath,
    "actual_entry_ids"
  ));

  if (!Array.isArray(registry.subordinate_registries) || registry.subordinate_registries.length === 0) {
    failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate registry declarations are required.", registryPath));
  } else {
    const surfaceIds = new Set();
    for (const subordinate of registry.subordinate_registries) {
      if (!isRecord(subordinate) || typeof subordinate.surface_id !== "string" || typeof subordinate.path !== "string" || !Array.isArray(subordinate.copy_ids)) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate registry declaration is malformed.", registryPath));
        continue;
      }
      if (surfaceIds.has(subordinate.surface_id)) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Duplicate subordinate surface ID.", registryPath, { surface_id: subordinate.surface_id }));
      }
      surfaceIds.add(subordinate.surface_id);

      if (!exists(root, subordinate.path)) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Declared subordinate registry is missing.", subordinate.path));
        continue;
      }

      const bytes = fs.readFileSync(path.join(root, norm(subordinate.path)));
      const actualHash = sha256Bytes(bytes);
      if (actualHash !== subordinate.content_sha256) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate registry checksum mismatch.", subordinate.path, {
          expected: subordinate.content_sha256,
          actual: actualHash
        }));
      }

      if (subordinate.mirror_path) {
        if (!exists(root, subordinate.mirror_path)) {
          failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate public mirror is missing.", subordinate.mirror_path));
        } else {
          const mirrorBytes = fs.readFileSync(path.join(root, norm(subordinate.mirror_path)));
          if (!bytes.equals(mirrorBytes)) {
            failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate public mirror differs from its source registry.", subordinate.mirror_path));
          }
          const mirrorHash = sha256Bytes(mirrorBytes);
          if (mirrorHash !== subordinate.mirror_sha256) {
            failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate mirror checksum mismatch.", subordinate.mirror_path));
          }
        }
      }

      let parsed;
      try {
        parsed = JSON.parse(bytes.toString("utf8"));
      } catch (error) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate registry JSON is invalid.", subordinate.path, { error: String(error.message ?? error) }));
        continue;
      }

      const entries = entriesFromRegistry(parsed);
      if (!entries) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate registry entries are invalid.", subordinate.path));
        continue;
      }

      if (isRecord(parsed) && parsed.surface_id !== subordinate.surface_id) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate object surface_id is invalid.", subordinate.path));
      }

      const actualIds = [];
      const localIds = new Set();
      for (const [index, entry] of entries.entries()) {
        if (!isRecord(entry) || typeof entry.copy_id !== "string" || typeof entry.text !== "string") {
          failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate copy entry is malformed.", subordinate.path, { entry_index: index }));
          continue;
        }
        if (entry.text.trim().length === 0) {
          failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate copy text is empty.", subordinate.path, { copy_id: entry.copy_id }));
        }
        if (Array.isArray(parsed) && entry.surface_id !== subordinate.surface_id) {
          failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate array entry surface_id is invalid.", subordinate.path, { copy_id: entry.copy_id }));
        }
        if (entry.params !== undefined && !Array.isArray(entry.params)) {
          failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate params must be an array when declared.", subordinate.path, { copy_id: entry.copy_id }));
        }
        if (localIds.has(entry.copy_id) || allIds.has(entry.copy_id)) {
          failures.push(failure(BETA_COPY_TOKENS.duplicateCopyId, "Duplicate canonical copy ID across beta registries.", subordinate.path, { copy_id: entry.copy_id }));
        }
        localIds.add(entry.copy_id);
        allIds.add(entry.copy_id);
        actualIds.push(entry.copy_id);
        failures.push(...scanBetaCopyText(entry.text, subordinate.path, "copy_id:" + entry.copy_id));
      }

      if (JSON.stringify(actualIds) !== JSON.stringify(subordinate.copy_ids)) {
        failures.push(failure(BETA_COPY_TOKENS.subordinateConflict, "Subordinate registry introduced or omitted undeclared copy IDs.", subordinate.path, {
          expected: subordinate.copy_ids,
          actual: actualIds
        }));
      }
    }
  }

  if (!Array.isArray(registry.canonical_copy_ids)) {
    failures.push(failure(BETA_COPY_TOKENS.registry, "canonical_copy_ids must be an array.", registryPath));
  } else {
    failures.push(...exactSetFailures(
      registry.canonical_copy_ids,
      [...allIds],
      BETA_COPY_TOKENS.subordinateConflict,
      "canonical_copy_ids does not equal the complete registry union.",
      registryPath,
      "actual_canonical_ids"
    ));
  }

  if (!isRecord(scope)) {
    failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Beta copy scope must be an object.", scopePath));
    return failures;
  }
  if (scope.schema_version !== "kolosseum.beta.copy_scope.v2" || scope.scope_id !== "beta_copy_registry_reconciled_scope") {
    failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Beta copy scope identity is invalid.", scopePath));
  }
  if (norm(scope.registry_path) !== norm(registryPath)) {
    failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Beta copy scope points to the wrong authoritative registry.", scopePath));
  }

  for (const key of ["registry_paths", "inline_scan_paths", "reference_scan_paths", "path_prefixes", "technical_exclusions"]) {
    if (!Array.isArray(scope[key])) failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Beta copy scope array is missing.", scopePath, { field: key }));
  }

  const requiredPrefixes = ["app/beta/", "src/beta/", "src/ui/beta/", "server/beta/", "web/beta/", "client/beta/"];
  if (Array.isArray(scope.path_prefixes)) {
    failures.push(...exactSetFailures(
      scope.path_prefixes.map(norm),
      requiredPrefixes,
      BETA_COPY_TOKENS.invalidScope,
      "Beta copy path-prefix coverage is incomplete.",
      scopePath,
      "actual_prefixes"
    ));
  }

  const explicitPaths = [
    ...(scope.registry_paths ?? []),
    ...(scope.inline_scan_paths ?? []),
    ...(scope.reference_scan_paths ?? [])
  ].map(norm);

  if (new Set(explicitPaths).size !== explicitPaths.length) {
    failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Beta copy scope contains duplicate explicit paths.", scopePath));
  }

  for (const relPath of explicitPaths) {
    if (!exists(root, relPath)) failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Scoped beta copy path is missing.", relPath));
  }

  for (const exclusion of scope.technical_exclusions ?? []) {
    if (!isRecord(exclusion) || typeof exclusion.path !== "string" || typeof exclusion.reason !== "string" || exclusion.reason.trim().length === 0) {
      failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Technical exclusion is malformed.", scopePath));
    }
  }

  const knownIds = new Set(allIds);
  const inlineFiles = new Set([...(scope.inline_scan_paths ?? []).map(norm), ...collectPrefixFiles(root, scope.path_prefixes ?? [])]);
  const referenceFiles = new Set([...(scope.reference_scan_paths ?? []).map(norm), ...inlineFiles]);

  for (const relPath of referenceFiles) {
    if (!exists(root, relPath)) continue;
    const text = readText(root, relPath);
    for (const copyId of extractCopyReferences(text)) {
      if (!knownIds.has(copyId)) {
        failures.push(failure(BETA_COPY_TOKENS.unknownCopyId, "Unknown beta copy-ID reference.", relPath, { copy_id: copyId }));
      }
    }
  }

  for (const relPath of inlineFiles) {
    if (!exists(root, relPath)) continue;
    failures.push(...scanInlineSource(readText(root, relPath), relPath));
  }

  return failures;
}

export function verifyBetaCopyRegistry({
  root = process.cwd(),
  registryPath = "copy/beta_copy_registry.json",
  scopePath = "ci/locks/beta_copy_scope.json"
} = {}) {
  const failures = [];
  const registryRel = norm(registryPath);
  const scopeRel = norm(scopePath);

  if (!exists(root, registryRel)) {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Authoritative beta copy registry is missing.", registryRel));
    return { ok: false, guard: "BETA-FIX-01", token: BETA_COPY_TOKENS.guard, failures };
  }
  if (!exists(root, scopeRel)) {
    failures.push(failure(BETA_COPY_TOKENS.invalidScope, "Authoritative beta copy scope is missing.", scopeRel));
    return { ok: false, guard: "BETA-FIX-01", token: BETA_COPY_TOKENS.guard, failures };
  }

  let registry;
  let scope;
  try {
    registry = readJson(root, registryRel);
    scope = readJson(root, scopeRel);
  } catch (error) {
    failures.push(failure(BETA_COPY_TOKENS.registry, "Beta copy authority JSON cannot be parsed.", registryRel, { error: String(error.message ?? error) }));
    return { ok: false, guard: "BETA-FIX-01", token: BETA_COPY_TOKENS.guard, failures };
  }

  failures.push(...validateBetaCopyRegistry({
    root,
    registry,
    scope,
    registryPath: registryRel,
    scopePath: scopeRel
  }));

  const explicitPathCount = new Set([
    ...(scope.registry_paths ?? []),
    ...(scope.inline_scan_paths ?? []),
    ...(scope.reference_scan_paths ?? [])
  ].map(norm)).size;

  return {
    ok: failures.length === 0,
    guard: "BETA-FIX-01",
    token: BETA_COPY_TOKENS.guard,
    registry_path: registryRel,
    scope_path: scopeRel,
    canonical_copy_id_count: Array.isArray(registry.canonical_copy_ids) ? registry.canonical_copy_ids.length : 0,
    baseline_copy_id_count: Array.isArray(registry.required_copy_ids) ? registry.required_copy_ids.length : 0,
    subordinate_registry_count: Array.isArray(registry.subordinate_registries) ? registry.subordinate_registries.length : 0,
    scoped_explicit_path_count: explicitPathCount,
    scoped_prefix_count: Array.isArray(scope.path_prefixes) ? scope.path_prefixes.length : 0,
    failures
  };
}
