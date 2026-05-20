import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const promptDir = path.join(repoRoot, "docs/agents/prompts");

const requiredPhrases = [
  "Kolosseum v0",
  "Phase 1-6 only",
  "No inference",
  "No defaults",
  "No fallback",
  "No soft failure",
  "No v1 feature activation",
  "No implementation without negative tests"
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".prompt.md")) out.push(full);
  }
  return out;
}

const files = walk(promptDir);
const failures = [];

if (files.length === 0) {
  failures.push({ token: "AGENT_PROMPT_MISSING", file: "docs/agents/prompts", line: 1, details: "No agent prompt files found." });
}

for (const file of files) {
  const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
  const text = fs.readFileSync(file, "utf8");

  for (const phrase of requiredPhrases) {
    if (!text.includes(phrase)) {
      failures.push({ token: "AGENT_PROMPT_REQUIRED_PHRASE_MISSING", file: rel, line: 1, details: `Missing required phrase: ${phrase}` });
    }
  }

  if (!/^# .+/m.test(text)) {
    failures.push({ token: "AGENT_PROMPT_TITLE_MISSING", file: rel, line: 1, details: "Prompt file must have a markdown H1 title." });
  }

  if (!/## Mission/m.test(text) || !/## Authority/m.test(text) || !/## Explicit Non-Authority/m.test(text)) {
    failures.push({ token: "AGENT_PROMPT_SECTION_MISSING", file: rel, line: 1, details: "Prompt file must include Mission, Authority, and Explicit Non-Authority sections." });
  }

  if (!/## Handoff Pack Template/m.test(text)) {
    failures.push({ token: "AGENT_HANDOFF_TEMPLATE_MISSING", file: rel, line: 1, details: "Prompt file must include a handoff pack template." });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: "agent_prompt_lint", prompt_files: files.length }, null, 2));