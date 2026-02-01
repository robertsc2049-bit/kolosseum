import fs from "node:fs";
import { spawnSync } from "node:child_process";

function runCliWithFile(path) {
  const p = spawnSync("node", ["dist/src/run_pipeline_cli.js", path], { encoding: "utf8" });

  let out;
  try {
    out = JSON.parse(p.stdout);
  } catch {
    throw new Error(`stdout not JSON\nstatus=${p.status}\nstdout=\n${p.stdout}\nstderr=\n${p.stderr}`);
  }
  return out;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function main() {
  // Use a stable existing fixture input
  const inputPath = "test/fixtures/golden/inputs/vanilla_minimal.json";
  assert(fs.existsSync(inputPath), `missing fixture: ${inputPath}`);

  // Ensure dist exists (repo expects build step)
  assert(fs.existsSync("dist/src/run_pipeline_cli.js"), "missing dist runner; run npm run build");

  const out = runCliWithFile(inputPath);

  assert(out.ok === true, "expected ok=true");
  assert(out.session && typeof out.session === "object", "expected session object");
  assert(Array.isArray(out.session.exercises), "expected session.exercises array");

  // New contract expectation for richness: at least 4 exercises
  assert(out.session.exercises.length >= 4, `expected >=4 exercises, got ${out.session.exercises.length}`);

  // Keep the first two legacy expectations stable for the minimal demo
  const e0 = out.session.exercises[0]?.exercise_id;
  const e1 = out.session.exercises[1]?.exercise_id;
  assert(typeof e0 === "string" && typeof e1 === "string", "expected first two exercise_id strings");

  console.log("PASS test/phase4_rich_plan_minimum.test.mjs");
})();
