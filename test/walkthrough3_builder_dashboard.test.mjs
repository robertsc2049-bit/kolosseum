// Two phone-walkthrough findings (2026-10-14) in the legacy app.js paths the
// React builder and coach dashboard still drive:
// - a coach's new programme opened with the library's first exercises - with
//   the 556-exercise library sorted A-Z, four sprint drills loaded at % of
//   1RM. New rows now start with no exercise chosen.
// - a coach whose connected athlete had no programme assigned yet saw
//   "Dashboard refreshed with 1 unavailable athlete record set" - nothing was
//   unavailable, there was just nothing assigned to show.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("public/app/app.js", "utf8");
const fnBody = (name) => {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf("\n}\n", start));
};

test("a new programme, session or added exercise starts with no exercise chosen - never the library's first entries", () => {
  const body = fnBody("newTemplateWorkItem");
  assert.match(body, /exercise_id: "",/u);
  assert.doesNotMatch(body, /templateExercises\[/u, "never picks an exercise by its position in the library");
});

test("a connected athlete with no programme assigned yet isn't counted as an unavailable dashboard record", () => {
  const start = app.indexOf('"/sessions/beta-coach-artefacts"');
  const block = app.slice(start, start + 1600);
  assert.match(block, /error\?\.payload\?\.reason === "stored_relationship_or_assignment_access_denied"/u);
  assert.match(block, /failure: null/u);
});
