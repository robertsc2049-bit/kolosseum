import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const scanRoots = ["docs/agents"];
const allowedExtensions = new Set([".md", ".json"]);

const rules = [
  ["AGENT_SCOPE_ACTIVE_PHASE7", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:phase\s*7|truth\s+projection)\b/i, "Agent docs must not activate Phase 7 or truth projection for v0."],
  ["AGENT_SCOPE_ACTIVE_PHASE8", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:phase\s*8|evidence\s+sealing)\b/i, "Agent docs must not activate Phase 8 or evidence sealing for v0."],
  ["AGENT_SCOPE_ACTIVE_EVIDENCE_EXPORT", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:evidence\s+envelope|evidence\s+export|exportable\s+proof|audit\s+export|proof\s+pack)\b/i, "Agent docs must not activate evidence/export/proof packs for v0."],
  ["AGENT_SCOPE_ACTIVE_ORG_RUNTIME", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:org|organisation|organization|team|unit|gym)\s+(?:runtime|execution|managed\s+runtime|managed\s+execution)\b/i, "Agent docs must not activate org/team/unit/gym runtime for v0."],
  ["AGENT_SCOPE_ACTIVE_ANALYTICS", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:analytics|dashboard|ranking|leaderboard|readiness|score|scoring)\b/i, "Agent docs must not activate analytics, dashboards, rankings, or readiness for v0."],
  ["AGENT_SCOPE_ACTIVE_ADVICE", /\b(?:implement|build|create|ship|enable|activate|add|wire)\b.{0,80}\b(?:recommendation|recommend|advice|advise|optimisation|optimization|optimise|optimize)\b/i, "Agent docs must not activate recommendation/advice/optimisation behaviour."],
  ["AGENT_SCOPE_ACTIVE_SAFETY_MEDICAL", /\b(?:implement|build|create|ship|enable|activate|add|wire|claim|promise)\b.{0,80}\b(?:safe|safer|safety|medical|injury|rehab|rehabilitation|readiness|suitability)\b/i, "Agent docs must not activate safety, medical, rehabilitation, readiness, or suitability claims."]
];

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

function lineNo(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

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

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: "agent_scope_guard" }, null, 2));