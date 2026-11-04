// Kolosseum states facts and explains them; it doesn't tell a coach what to
// do (legal risk - see the analysis guide's header). Every user-facing string
// in the analysis findings is checked for instructions, and every citation in
// a finding's research line must be a source the analysis guide lists.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const FILES = ["src/api/coach_analysis_metrics.ts", "src/api/team_analysis_metrics.ts", "src/api/injury_metrics.ts", "src/api/forward_load.ts"];

// Phrases that instruct rather than inform.
const ADVICE = [
  /\bconsider\b/iu, /\bshould\b/iu, /\bnext step\b/iu, /\bact on it\b/iu, /\btalk to\b/iu, /\bhave a conversation\b/iu,
  /\blighten\b/iu, /\bhold or reduce\b/iu, /\btake \d+-?\d*% off\b/iu, /\bdon't add\b/iu, /\bkeep progressing\b/iu,
  /\bworth (?:a conversation|correcting|avoiding|watching|asking|progressing)\b/iu, /\bneeds a look\b/iu, /\bkeep an eye on\b/iu,
  /\brefer them\b/iu, /\bplan a lighter\b/iu, /\bbuild (?:it )?(?:up|back)\b/iu, /\btell them\b/iu, /\bcheck they\b/iu
];

// String literals (double-quoted and template) in a TypeScript source file.
function literals(source) {
  const out = [];
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/gu)) out.push(match[1] ?? match[2]);
  return out.filter((text) => /\s/u.test(text) && /[a-z]{3}/u.test(text));
}

test("analysis findings and their research lines state facts, never instructions", () => {
  for (const file of FILES) {
    for (const text of literals(fs.readFileSync(file, "utf8"))) {
      for (const pattern of ADVICE) assert.doesNotMatch(text, pattern, `${file}: "${text}"`);
    }
  }
});

test("every citation in a finding's research line is a source the analysis guide lists", () => {
  const guide = fs.readFileSync("public/app-src/screens/coach/analysisGuide.tsx", "utf8");
  const listed = new Set([...guide.matchAll(/^\s{2}([a-z]+)(\d{4}): \{ cite:/gmu)].map((m) => `${m[1]}${m[2]}`));
  assert.ok(listed.size >= 20, "the guide's SOURCES were read");
  let cited = 0;
  for (const file of FILES) {
    for (const text of literals(fs.readFileSync(file, "utf8"))) {
      for (const group of text.matchAll(/\(([A-Z][^()]*\d{4})\)/gu)) {
        for (const ref of group[1].split(/;\s*/u)) {
          const m = ref.match(/^([A-Z][A-Za-z-]+)(?: & [A-Z][A-Za-z]+)?(?: et al\.)? (\d{4})$/u);
          if (!m) continue;
          cited += 1;
          const key = `${m[1].toLowerCase().replace(/-.*/u, "")}${m[2]}`;
          assert.ok(listed.has(key), `${file}: "${ref}" isn't in the analysis guide's SOURCES`);
        }
      }
    }
  }
  assert.ok(cited >= 10, `citations were found (${cited})`);
});
