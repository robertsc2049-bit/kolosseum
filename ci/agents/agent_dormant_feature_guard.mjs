import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "docs/agents/AGENT_REGISTRY.json");
const failures = [];

if (!fs.existsSync(registryPath)) {
  failures.push({ token: "AGENT_REGISTRY_MISSING", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: "Agent registry is required." });
} else {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const active = new Set(registry.active_agents ?? []);
  const dormant = new Set(registry.dormant_agents ?? []);
  const dangerous = new Set(registry.dangerous_agents ?? []);

  for (const agent of active) {
    if (dormant.has(agent)) failures.push({ token: "AGENT_ACTIVE_DORMANT_CONFLICT", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} appears in both active and dormant agents.` });
    if (dangerous.has(agent)) failures.push({ token: "AGENT_ACTIVE_DANGEROUS_CONFLICT", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} appears in both active and dangerous agents.` });
  }

  for (const agent of ["Evidence Envelope Agent", "Truth Projection Agent", "Export/Audit Pack Agent", "Organisation Runtime Agent", "Team Runtime Agent", "Gym Runtime Agent", "Analytics Dashboard Agent"]) {
    if (!dormant.has(agent)) failures.push({ token: "AGENT_DORMANT_CLASSIFICATION_MISSING", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} must be classified as dormant.` });
  }

  for (const agent of ["Optimisation Agent", "Readiness Agent", "Safety/Medical Agent", "Coaching Advice Agent", "Outcome Prediction Agent", "Adaptive Progression Agent", "Heuristic Recovery Agent", "Auto-Fallback Agent", "Recommendation Agent"]) {
    if (!dangerous.has(agent)) failures.push({ token: "AGENT_DANGEROUS_CLASSIFICATION_MISSING", file: "docs/agents/AGENT_REGISTRY.json", line: 1, details: `${agent} must be classified as dangerous.` });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: "agent_dormant_feature_guard" }, null, 2));