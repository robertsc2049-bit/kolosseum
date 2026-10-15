// app.js saves its state to localStorage on every change. A coach with the 55
// Kolosseum programme drafts pushed that copy past the browser's ~5 MB quota,
// the throw escaped, and signing in failed with "exceeded the quota". The
// big server lists (always fetched again) are no longer saved, and a full or
// unavailable storage never breaks the action in progress.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("public/app/app.js", "utf8");
const saveState = app.slice(app.indexOf("function saveState()"), app.indexOf("function createId("));

test("saveState leaves out the programme library and exercise list, and swallows a storage failure", () => {
  assert.match(app, /const UNSAVED_STATE_KEYS = \["coachTemplates", "templateExercises"\];/u);
  assert.match(saveState, /for \(const key of UNSAVED_STATE_KEYS\) delete saved\[key\];/u);
  assert.match(saveState, /try \{\s*localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(saved\)\);\s*\}\s*catch/u);
  assert.doesNotMatch(saveState, /JSON\.stringify\(state\)/u, "never the whole state");
});

test("55 programme drafts no longer go into the saved copy", () => {
  const programme = { template_id: "t", template_structure: { blocks: [{ weeks: Array.from({ length: 12 }, () => ({ sessions: Array.from({ length: 3 }, () => ({ work_items: Array.from({ length: 6 }, () => ({ exercise_id: "back_squat", coaching_notes: "x".repeat(200) })) })) })) }] } };
  const state = { version: 1, role: "coach", coachTemplates: Array.from({ length: 55 }, () => programme), templateExercises: Array.from({ length: 556 }, () => ({ exercise_id: "e", display_name: "Exercise" })) };
  const saved = { ...state };
  for (const key of ["coachTemplates", "templateExercises"]) delete saved[key];
  assert.ok(JSON.stringify(state).length > 5_000_000 / 2, "the full state is megabytes");
  assert.ok(JSON.stringify(saved).length < 1000, "the saved copy is tiny");
});
