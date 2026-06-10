#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const suitePath = path.join(repoRoot, "docs", "v0", "V0_ACTIVE_SCOPE_NEGATIVE_TESTS.json");
const manifestPath = path.join(repoRoot, "docs", "v0", "V0_ACTIVE_SCOPE_MANIFEST.json");

const suite = JSON.parse(fs.readFileSync(suitePath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];

const domainConfig = {
  actor_type: ["allowed_actor_types", "forbidden_actor_types", "V0_FORBIDDEN_ACTOR_TYPE"],
  execution_scope: ["allowed_execution_scopes", "forbidden_execution_scopes", "V0_FORBIDDEN_EXECUTION_SCOPE"],
  activity_id: ["allowed_activities", "forbidden_activity_examples", "V0_FORBIDDEN_ACTIVITY"],
  engine_phase: ["allowed_engine_phases", "forbidden_engine_phases", "V0_FORBIDDEN_PHASE"],
  product_surface: ["allowed_product_surfaces", "forbidden_product_surfaces", "V0_FORBIDDEN_PRODUCT_SURFACE"],
  claim_class: ["allowed_claim_classes", "forbidden_claim_classes", "V0_FORBIDDEN_CLAIM_CLASS"],
  runtime_semantic: [[], "forbidden_runtime_semantics", "V0_FORBIDDEN_RUNTIME_SEMANTIC"],
  coach_authority: ["allowed_coach_authority", "forbidden_coach_authority", "V0_FORBIDDEN_COACH_AUTHORITY"]
};

const semanticRules = [
  /\b(org|organisation|organization|team|unit|gym|federation|state)\s+(runtime|execution|managed|dashboard|governance|control)\b/i,
  /\b(evidence|proof|audit)\s+(export|envelope|envelopes|seal|sealing|download|pack|certificate)\b/i,
  /\b(evidence|proof|audit)[_-](export|envelope|envelopes|seal|sealing|download|pack|certificate)\b/i,
  /\b(readiness|ready|suitability|suitable|prepared|competition-ready|return-ready)\b/i,
  /\b(safe|safety|safer|risk|injury|injuries|rehab|rehabilitation|medical|clinical|therapy|therapeutic|pain-free|prevent|prevention|protect)\b/i,
  /\b(optimi[sz]e|optimal|maximi[sz]e|recommend|recommended|recommendation|best|improve|improvement|boost|enhance|guarantee|proven)\b/i,
  /\b(coach|coaches)\b.{0,40}\b(override|decide|control|approve|correct|enforce|force|modify|change|alter)\b/i,
  /\b(registry|registries)\s+(edit|editing|mutate|mutation|modify|update|author|authoring|override)\b/i,
  /\b(payment|billing|tier|subscription|paid|unpaid)\b.{0,80}\b(engine|compile|legality|determinism|selection|progression|substitution)\b/i
];

function evaluate(test) {
  if (test.domain === "semantic_scan") {
    return semanticRules.some((rule) => rule.test(String(test.input || "")))
      ? "V0_SCOPE_LEAK"
      : null;
  }

  const config = domainConfig[test.domain];
  if (!config) return "V0_UNKNOWN_SCOPE_VALUE";

  const [allowedKey, forbiddenKey, token] = config;
  const value = Object.values(test.input || {})[0];

  const allowed = Array.isArray(allowedKey) ? allowedKey : manifest[allowedKey] || [];
  const forbidden = Array.isArray(forbiddenKey) ? forbiddenKey : manifest[forbiddenKey] || [];

  if (forbidden.includes(value)) return token;
  if (allowed.length > 0 && !allowed.includes(value)) return "V0_UNKNOWN_SCOPE_VALUE";
  return null;
}

for (const test of suite.tests) {
  const token = evaluate(test);
  const ok = token === null;

  if (ok !== test.expected_ok || token !== test.expected_token) {
    failures.push({
      test_id: test.test_id,
      expected_ok: test.expected_ok,
      actual_ok: ok,
      expected_token: test.expected_token,
      actual_token: token
    });
  }
}

const report = {
  ok: failures.length === 0,
  failures
};

const output = JSON.stringify(report, null, 2);

if (!report.ok) {
  console.error(output);
  process.exit(1);
}

console.log(output);