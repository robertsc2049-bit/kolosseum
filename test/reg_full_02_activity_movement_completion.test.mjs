import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditRegFull02, REQUIRED_MOVEMENTS } from "../ci/registry/reg_full_02_activity_movement_completion.mjs";

function stage() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-reg-full-02-"));
  for (const rel of ["registries/activity/activity.registry.json", "registries/movement/movement.registry.json"]) {
    const dst = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), ...rel.split("/")), dst);
  }
  return root;
}
function read(root, rel) { return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")); }
function write(root, rel, doc) { fs.writeFileSync(path.join(root, ...rel.split("/")), JSON.stringify(doc, null, 2) + "\n", "utf8"); }
function hasCode(result, code) { return result.errors.some((e) => e.code === code); }

test("REG-FULL-02 closes the exact activity and movement universe", () => {
  const result = auditRegFull02(process.cwd());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.summary, {
    activity_count: 4,
    movement_count: 54,
    activity_to_movement_permissions: 216,
    movement_to_activity_permissions: 216
  });
});

test("REG-FULL-02 rejects a missing movement", () => {
  const root = stage();
  try {
    const rel = "registries/movement/movement.registry.json";
    const doc = read(root, rel);
    delete doc.entries[REQUIRED_MOVEMENTS.at(-1)];
    write(root, rel, doc);
    assert.equal(hasCode(auditRegFull02(root), "MOVEMENT_SET"), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("REG-FULL-02 rejects incomplete activity allowed-movement coverage", () => {
  const root = stage();
  try {
    const rel = "registries/activity/activity.registry.json";
    const doc = read(root, rel);
    doc.entries.powerlifting.allowed_movement_patterns.pop();
    write(root, rel, doc);
    assert.equal(hasCode(auditRegFull02(root), "ACTIVITY_ALLOWED_MOVEMENTS"), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("REG-FULL-02 rejects incomplete reciprocal movement applicability", () => {
  const root = stage();
  try {
    const rel = "registries/movement/movement.registry.json";
    const doc = read(root, rel);
    doc.entries.squat.activity_applicability = ["powerlifting", "general_strength"];
    write(root, rel, doc);
    const result = auditRegFull02(root);
    assert.equal(hasCode(result, "MOVEMENT_ACTIVITY_APPLICABILITY"), true);
    assert.equal(hasCode(result, "RECIPROCAL_COVERAGE"), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("REG-FULL-02 rejects legacy/granular movement aliases", () => {
  const root = stage();
  try {
    const rel = "registries/movement/movement.registry.json";
    const doc = read(root, rel);
    doc.entries.split_squat = { ...doc.entries.single_leg_squat, movement_pattern_id: "split_squat" };
    write(root, rel, doc);
    const result = auditRegFull02(root);
    assert.equal(hasCode(result, "FORBIDDEN_MOVEMENT_ALIAS"), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
