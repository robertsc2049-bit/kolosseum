import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: Agent prompt lint.
 *
 * This script enforces the minimum prompt contract for agent prompt files.
 *
 * Boundary:
 * - It does not decide whether an agent prompt is well-written.
 * - It does not grant agent authority.
 * - It does not activate v1, proof-layer, organisation, analytics, advisory, or
 *   recommendation behaviour.
 * - It only verifies that each prompt contains the required v0 boundary phrases
 *   and handoff structure.
 *
 * Failure behaviour:
 * - Missing prompt files fail.
 * - Missing required phrases fail.
 * - Missing required sections fail.
 * - Failures are emitted as structured JSON and exit non-zero.
 */

const repoRoot = process.cwd();

/**
 * DEV NOTE: Prompt location is fixed relative to the repository root.
 *
 * Do not dynamically discover prompt directories. Agent prompt authority needs a
 * stable location so CI and future developers know which files are governed.
 */
const promptDir = path.join(repoRoot, "docs/agents/prompts");

/**
 * DEV NOTE: Required phrases are literal boundary locks.
 *
 * These strings make every agent prompt restate the current v0 constraints:
 * Phase 1-6 only, no inference, no defaults, no fallback, no soft failure, no
 * v1 feature activation, and no implementation without negative tests.
 *
 * Keep this list boring and explicit. Do not replace it with semantic matching,
 * because fuzzy matching weakens the guard and creates room for drift.
 */
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

/**
 * DEV NOTE: Deterministic recursive prompt scan.
 *
 * Missing prompt directory returns an empty set, then the explicit
 * AGENT_PROMPT_MISSING failure below reports the actual contract breach.
 */
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

/**
 * DEV NOTE: Accumulate failures across all prompt files.
 *
 * CI should give a future developer the full prompt-contract drift list in one
 * run instead of forcing repeated fix/run cycles.
 */
const failures = [];

if (files.length === 0) {
  /**
   * DEV NOTE: No prompt files is a hard failure.
   *
   * Agent orchestration without prompt files creates hidden behaviour outside the
   * declared prompt boundary.
   */
  failures.push({ token: "AGENT_PROMPT_MISSING", file: "docs/agents/prompts", line: 1, details: "No agent prompt files found." });
}

for (const file of files) {
  const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
  const text = fs.readFileSync(file, "utf8");

  /**
   * DEV NOTE: Phrase checks are exact substring checks by design.
   *
   * This avoids subjective interpretation. If a prompt does not include the
   * literal locked phrase, it fails and should be corrected explicitly.
   */
  for (const phrase of requiredPhrases) {
    if (!text.includes(phrase)) {
      failures.push({ token: "AGENT_PROMPT_REQUIRED_PHRASE_MISSING", file: rel, line: 1, details: `Missing required phrase: ${phrase}` });
    }
  }

  /**
   * DEV NOTE: Prompt structure must be visible to humans.
   *
   * A future developer should be able to open any agent prompt and immediately
   * see its title, mission, authority, explicit non-authority, and handoff shape.
   */
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

/**
 * DEV NOTE: JSON output is the CI contract.
 *
 * Do not replace this with prose. CI and future tooling need stable structured
 * failure records.
 */
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

/**
 * DEV NOTE: Success output includes the number of prompt files checked.
 *
 * This gives CI logs a quick sanity check without adding behavioural meaning.
 */
console.log(JSON.stringify({ ok: true, checked: "agent_prompt_lint", prompt_files: files.length }, null, 2));
