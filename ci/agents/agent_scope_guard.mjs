import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: Agent scope guard.
 *
 * This script scans only the agent documentation boundary for instructions that
 * would activate v0-excluded scope or prohibited behavioural categories.
 *
 * Boundary:
 * - It does not define product scope.
 * - It does not define engine behaviour.
 * - It does not decide whether an agent is useful.
 * - It only turns declared scope violations into CI-visible JSON failures.
 */

const repoRoot = process.cwd();

/**
 * DEV NOTE: Keep this guard scoped to docs/agents.
 *
 * Wider copy, code, workflow, registry, and engine checks belong in their own
 * dedicated CI gates. Expanding this guard casually will make failure ownership
 * harder for a future developer to understand.
 */
const scanRoots = ["docs/agents"];

/**
 * DEV NOTE: Agent files are expected to be readable markdown or machine-readable
 * JSON. Other artefact types are deliberately ignored to keep this guard stable.
 */
const allowedExtensions = new Set([".md", ".json"]);

/**
 * DEV NOTE: Rules look for activation verbs near excluded concepts.
 *
 * Mentioning a dormant topic for explanation is not the target. The target is
 * wording that tells an agent to implement, enable, wire, ship, or otherwise
 * activate excluded scope inside the current v0 boundary.
 */
const rules = [
  ["AGENT_SCOPE_ACTIVE_PHASE7", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:phase\s*7|truth\s+projection)\b/i, "Agent docs must not activate Phase 7 or truth projection for v0."],
  ["AGENT_SCOPE_ACTIVE_PHASE8", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:phase\s*8|evidence\s+sealing)\b/i, "Agent docs must not activate Phase 8 or evidence sealing for v0."],
  ["AGENT_SCOPE_ACTIVE_EVIDENCE_EXPORT", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:evidence\s+envelope|evidence\s+export|exportable\s+proof|audit\s+export|proof\s+pack)\b/i, "Agent docs must not activate evidence/export/proof packs for v0."],
  ["AGENT_SCOPE_ACTIVE_ORG_RUNTIME", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:org|organisation|organization|team|unit|gym)\s+(?:runtime|execution|managed\s+runtime|managed\s+execution)\b/i, "Agent docs must not activate org/team/unit/gym runtime for v0."],
  ["AGENT_SCOPE_ACTIVE_ANALYTICS", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:analytics|dashboard|ranking|leaderboard|readiness|score|scoring)\b/i, "Agent docs must not activate analytics, dashboards, rankings, or readiness for v0."],
  ["AGENT_SCOPE_ACTIVE_ADVICE", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:recommendation|recommend|advice|advise|optimisation|optimization|optimise|optimize)\b/i, "Agent docs must not activate recommendation/advice/optimisation behaviour."],
  ["AGENT_SCOPE_ACTIVE_SAFETY_MEDICAL", /\b(?:implement|build|create|ship|enable|activate|add|wire|claim|promise)\b.{0,80}\b(?:safe|safer|safety|medical|injury|rehab|rehabilitation|readiness|suitability)\b/i, "Agent docs must not activate safety, medical, rehabilitation, readiness, or suitability claims."]
];

/**
 * DEV NOTE: Deterministic recursive walk.
 *
 * A missing docs/agents folder returns no files so early slices can run this
 * guard before agent documentation exists.
 */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (allowedExtensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/**
 * DEV NOTE: Calculate line numbers from the regex match index so CI output
 * points directly to the source line without adding another parser.
 */
function lineNo(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

/**
 * DEV NOTE: Accumulate all failures before exiting.
 *
 * This lets a developer fix the full drift set in one pass instead of repeatedly
 * running CI for one failure at a time.
 */
const failures = [];

for (const root of scanRoots) {
  for (const file of walk(path.join(repoRoot, root))) {
    const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");

    for (const [token, pattern, details] of rules) {
      const match = pattern.exec(text);
      if (match) failures.push({ token, file: rel, line: lineNo(text, match.index), excerpt: match[0].replace(/\s+/g, " ").slice(0, 240), details });
    }
  }
}

/**
 * DEV NOTE: JSON output is the contract for CI.
 *
 * Do not replace this with prose output. Future tooling needs stable structured
 * failure records.
 */
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

/**
 * DEV NOTE: Success output identifies the guard that ran without adding any
 * behavioural meaning.
 */
console.log(JSON.stringify({ ok: true, checked: "agent_scope_guard" }, null, 2));
