#!/usr/bin/env node

// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const mode = args.has("--broad") ? "broad" : "active";

const manifestPath = path.join(repoRoot, "docs", "v0", "V0_ACTIVE_SCOPE_MANIFEST.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];

const allowlisted = new Set((manifest.scan_targets.allowlisted_scope_docs || []).map((p) => p.replace(/\\/g, "/")));
const activeDocsMarker = manifest.scan_targets.active_docs_marker || "v0_scope_guard: active_surface";
const activeTestMarker = manifest.scan_targets.active_test_marker || "v0_scope_guard: active_surface";
const activeFixtureMarker = manifest.scan_targets.active_fixture_marker || "v0_scope_guard: active_surface";

const domainMap = [
  ["actor_type", "allowed_actor_types", "forbidden_actor_types", "V0_FORBIDDEN_ACTOR_TYPE"],
  ["execution_scope", "allowed_execution_scopes", "forbidden_execution_scopes", "V0_FORBIDDEN_EXECUTION_SCOPE"],
  ["activity_id", "allowed_activities", "forbidden_activity_examples", "V0_FORBIDDEN_ACTIVITY"],
  ["engine_phase", "allowed_engine_phases", "forbidden_engine_phases", "V0_FORBIDDEN_PHASE"],
  ["product_surface", "allowed_product_surfaces", "forbidden_product_surfaces", "V0_FORBIDDEN_PRODUCT_SURFACE"],
  ["claim_class", "allowed_claim_classes", "forbidden_claim_classes", "V0_FORBIDDEN_CLAIM_CLASS"],
  ["runtime_event", "allowed_runtime_events", [], "V0_SCOPE_LEAK"],
  ["runtime_semantic", [], "forbidden_runtime_semantics", "V0_FORBIDDEN_RUNTIME_SEMANTIC"],
  ["coach_authority", "allowed_coach_authority", "forbidden_coach_authority", "V0_FORBIDDEN_COACH_AUTHORITY"]
];

const controlledKeys = new Map([
  ["actor_type", "actor_type"],
  ["actorType", "actor_type"],
  ["execution_scope", "execution_scope"],
  ["executionScope", "execution_scope"],
  ["activity_id", "activity_id"],
  ["activityId", "activity_id"],
  ["phase", "engine_phase"],
  ["engine_phase", "engine_phase"],
  ["enginePhase", "engine_phase"],
  ["product_surface", "product_surface"],
  ["productSurface", "product_surface"],
  ["claim_class", "claim_class"],
  ["claimClass", "claim_class"],
  ["runtime_event", "runtime_event"],
  ["runtimeEvent", "runtime_event"],
  ["runtime_semantic", "runtime_semantic"],
  ["runtimeSemantic", "runtime_semantic"],
  ["coach_authority", "coach_authority"],
  ["coachAuthority", "coach_authority"]
]);

const semanticRules = [
  ["V0_SCOPE_LEAK", "organisation runtime", /\b(org|organisation|organization|team|unit|gym|federation|state)\s+(runtime|execution|managed|dashboard|governance|control)\b/i],
  ["V0_SCOPE_LEAK", "evidence export", /\b(evidence|proof|audit)\s+(export|envelope|envelopes|seal|sealing|download|pack|certificate)\b/i],
  ["V0_SCOPE_LEAK", "evidence export token", /\b(evidence|proof|audit)[_-](export|envelope|envelopes|seal|sealing|download|pack|certificate)\b/i],
  ["V0_SCOPE_LEAK", "readiness or suitability", /\b(readiness|ready|suitability|suitable|prepared|competition-ready|return-ready)\b/i],
  ["V0_SCOPE_LEAK", "safety medical rehab", /\b(safe|safety|safer|risk|injury|injuries|rehab|rehabilitation|medical|clinical|therapy|therapeutic|pain-free|prevent|prevention|protect)\b/i],
  ["V0_SCOPE_LEAK", "optimisation or recommendation", /\b(optimi[sz]e|optimal|maximi[sz]e|recommend|recommended|recommendation|best|improve|improvement|boost|enhance|guarantee|proven)\b/i],
  ["V0_SCOPE_LEAK", "coach override authority", /\b(coach|coaches)\b.{0,40}\b(override|decide|control|approve|correct|enforce|force|modify|change|alter)\b/i],
  ["V0_SCOPE_LEAK", "registry mutation", /\b(registry|registries)\s+(edit|editing|mutate|mutation|modify|update|author|authoring|override)\b/i],
  ["V0_SCOPE_LEAK", "payment affecting engine behaviour", /\b(payment|billing|tier|subscription|paid|unpaid)\b.{0,80}\b(engine|compile|legality|determinism|selection|progression|substitution)\b/i]
];

const extensions = new Set(manifest.scan_targets.extensions || []);
const excludes = manifest.scan_targets.exclude_paths || [];
const roots = mode === "active"
  ? (manifest.scan_targets.active_surface_paths || manifest.scan_targets.paths || [])
  : (manifest.scan_targets.paths || []);

function normalise(p) {
  return p.replace(/\\/g, "/");
}

function shouldSkipPath(filePath) {
  const rel = normalise(path.relative(repoRoot, filePath));

  if (allowlisted.has(rel)) return true;

  const parts = normalise(filePath).split("/");
  return excludes.some((excluded) => parts.includes(excluded));
}

function isNegativeTest(filePath, text) {
  const normal = normalise(filePath);
  const hasNegativeMarker = text.includes("v0_scope_negative_test: true");

  if (!hasNegativeMarker) return false;

  return (
    normal.includes("tests/negative") ||
    normal.includes("fixtures/negative") ||
    normal.includes("__tests__/negative") ||
    normal.includes("__tests__") ||
    normal.endsWith(".test.ts") ||
    normal.endsWith(".test.tsx") ||
    normal.endsWith(".test.mjs") ||
    normal.endsWith(".test.js")
  );
}

function isActiveModeEligible(filePath, text) {
  if (mode === "broad") return true;

  const rel = normalise(path.relative(repoRoot, filePath));

  if (rel.startsWith("docs/")) return text.includes(activeDocsMarker);
  if (rel.startsWith("tests/")) return text.includes(activeTestMarker);
  if (rel.startsWith("fixtures/")) return text.includes(activeFixtureMarker);

  return true;
}

function lineCol(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function excerptAt(text, index) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + 120);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function pushFailure(token, domain, value, file, text, index, details) {
  const lc = lineCol(text, index);
  failures.push({
    token,
    domain,
    value,
    file: normalise(path.relative(repoRoot, file)),
    line: lc.line,
    column: lc.column,
    excerpt: excerptAt(text, index),
    details
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scanExactForbidden(file, text) {
  for (const [domain, allowedKey, forbiddenKey, token] of domainMap) {
    const forbidden = Array.isArray(forbiddenKey) ? forbiddenKey : manifest[forbiddenKey] || [];

    for (const value of forbidden) {
      const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegex(value)}([^A-Za-z0-9_]|$)`, "g");
      let match;

      while ((match = pattern.exec(text)) !== null) {
        pushFailure(token, domain, value, file, text, match.index, `Forbidden v0 ${domain} found.`);
      }
    }
  }
}

function scanSemantic(file, text) {
  for (const [token, domain, regex] of semanticRules) {
    const match = regex.exec(text);
    if (match) {
      pushFailure(token, domain, match[0], file, text, match.index, `Forbidden v0 semantic pattern found: ${domain}.`);
    }
  }
}

function scanStructuredJson(file, text) {
  if (!file.endsWith(".json")) return;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }

  walk(parsed);

  function walk(value) {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item));
      return;
    }

    if (!value || typeof value !== "object") return;

    for (const [key, child] of Object.entries(value)) {
      const domain = controlledKeys.get(key);

      if (domain && typeof child === "string") {
        const spec = domainMap.find((item) => item[0] === domain);
        if (spec) {
          const [, allowedKey, forbiddenKey, forbiddenToken] = spec;
          const allowed = Array.isArray(allowedKey) ? allowedKey : manifest[allowedKey] || [];
          const forbidden = Array.isArray(forbiddenKey) ? forbiddenKey : manifest[forbiddenKey] || [];
          const rawIndex = text.indexOf(child);

          if (forbidden.includes(child)) {
            pushFailure(forbiddenToken, domain, child, file, text, rawIndex >= 0 ? rawIndex : 0, `Forbidden controlled value for ${domain}.`);
          } else if (allowed.length > 0 && !allowed.includes(child)) {
            pushFailure("V0_UNKNOWN_SCOPE_VALUE", domain, child, file, text, rawIndex >= 0 ? rawIndex : 0, `Unknown controlled value for ${domain}.`);
          }
        }
      }

      walk(child);
    }
  }
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (shouldSkipPath(full)) continue;

    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      out.push(full);
    }
  }

  return out;
}

const files = roots.flatMap((root) => collectFiles(path.join(repoRoot, root)));
const scannedFiles = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");

  if (!isActiveModeEligible(file, text)) {
    continue;
  }

  if (isNegativeTest(file, text)) {
    continue;
  }

  scannedFiles.push(normalise(path.relative(repoRoot, file)));

  scanExactForbidden(file, text);
  scanSemantic(file, text);
  scanStructuredJson(file, text);
}

const report = {
  ok: failures.length === 0,
  mode,
  candidate_files_found: files.length,
  files_scanned: scannedFiles.length,
  scanned_files: scannedFiles,
  failures
};

const output = JSON.stringify(report, null, 2);

if (!report.ok) {
  console.error(output);
  process.exit(1);
}

console.log(output);
