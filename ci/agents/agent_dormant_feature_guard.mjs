import fs from "node:fs";
import path from "node:path";

// DEV NOTE: This guard is a CI-facing scope boundary check, not an agent runtime.
// It reads the authoritative agent registry from the repository root and proves that
// dormant/proof-layer/platform agents remain non-active for the current v0 boundary.
//
// Boundary:
// - Do not add feature execution here.
// - Do not reinterpret agent capability or safety semantics here.
// - Do not soften failures into warnings.
// - Keep emitted tokens stable because CI and developer review depend on them.
const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "docs/agents/AGENT_REGISTRY.json");
const failures = [];

// DEV NOTE: Missing registry is a hard structural failure.
// A future developer should not "skip" this check when the registry is absent;
// absence means the active/dormant/dangerous classification universe cannot be proven.
if (!fs.existsSync(registryPath)) {
  failures.push({ token: "AGENT_REGISTRY_MISSING", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: "Agent registry is required." });
} else {
  // DEV NOTE: These sets are intentionally read as closed classification buckets.
  // The guard does not infer classification from filenames, docs, feature names, or code paths.
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const active = new Set(registry.active_agents ?? []);
  const dormant = new Set(registry.dormant_agents ?? []);
  const dangerous = new Set(registry.dangerous_agents ?? []);

  // DEV NOTE: An agent cannot be both executable and blocked.
  // Active/dormant and active/dangerous conflicts are hard failures because they make
  // the release boundary ambiguous and allow scope drift to hide inside registry wording.
  for (const agent of active) {
    if (dormant.has(agent)) failures.push({ token: "AGENT_ACTIVE_DORMANT_CONFLICT", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} appears in both active and dormant agents.` });
    if (dangerous.has(agent)) failures.push({ token: "AGENT_ACTIVE_DANGEROUS_CONFLICT", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} appears in both active and dangerous agents.` });
  }

  // DEV NOTE: These agents represent proof-layer, organisational, gym/team, export,
  // audit, or dashboard surfaces. They may exist as future design vocabulary, but they
  // must remain dormant until an explicit later release boundary activates them.
  for (const agent of ["Evidence Envelope Agent", "Truth Projection Agent", "Export/Audit Pack Agent", "Organisation Runtime Agent", "Team Runtime Agent", "Gym Runtime Agent", "Analytics Dashboard Agent"]) {
    if (!dormant.has(agent)) failures.push({ token: "AGENT_DORMANT_CLASSIFICATION_MISSING", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} must be classified as dormant.` });
  }

  // DEV NOTE: These agents encode prohibited or high-risk behavioural semantics for
  // Kolosseum: optimisation, readiness, safety/medical advice, recommendation,
  // prediction, recovery, or automatic fallback. They must not become active features
  // through naming drift, registry edits, or accidental product expansion.
  for (const agent of ["Optimisation Agent", "Readiness Agent", "Safety/Medical Agent", "Coaching Advice Agent", "Outcome Prediction Agent", "Adaptive Progression Agent", "Heuristic Recovery Agent", "Auto-Fallback Agent", "Recommendation Agent"]) {
    if (!dangerous.has(agent)) failures.push({ token: "AGENT_DANGEROUS_CLASSIFICATION_MISSING", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} must be classified as dangerous.` });
  }
}

// DEV NOTE: CI consumes the JSON failure report.
// Keep output machine-readable and do not add explanatory prose to stdout/stderr because
// downstream scripts should treat this report as the single failure surface.
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

// DEV NOTE: Success means this guard found no classification drift.
// It does not prove that all agent code is safe; it proves only the registry-level
// dormant/dangerous classification contract checked by this file.
console.log(JSON.stringify({ ok: true, checked: "agent_dormant_feature_guard" }, null, 2));
