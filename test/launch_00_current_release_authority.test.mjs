import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const boundaryPath = path.join(repoRoot, "docs", "releases", "PUBLIC_LAUNCH_RELEASE_BOUNDARY.json");
const fixtureDir = path.join(repoRoot, "ci", "fixtures", "launch_00_current_release_authority_negative");
const guardPath = path.join(repoRoot, "scripts", "launch_00_current_release_authority_guard.mjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runGuard(candidateBoundaryPath = null) {
  const args = [guardPath];
  if (candidateBoundaryPath) args.push("--boundary", candidateBoundaryPath);
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function mutateBoundary(boundary, mutation) {
  const candidate = structuredClone(boundary);
  if (mutation.append_public_area) {
    candidate.product_areas.public_launch_candidate.push(mutation.append_public_area);
  }
  if (mutation.append_public_actor) {
    candidate.actors.public.push(mutation.append_public_actor);
  }
  if (mutation.append_permitted_activity) {
    candidate.activities.permitted.push(mutation.append_permitted_activity);
  }
  return candidate;
}

test("LAUNCH-00 canonical current release authority passes", () => {
  const result = runGuard();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /LAUNCH_00_CURRENT_RELEASE_AUTHORITY: PASS/u);
});

for (const fixtureName of [
  "excluded_product_area_activation.json",
  "excluded_actor_activation.json",
  "unsupported_activity_activation.json"
]) {
  test(`LAUNCH-00 rejects ${fixtureName}`, () => {
    const fixture = readJson(path.join(fixtureDir, fixtureName));
    const boundary = readJson(boundaryPath);
    const mutated = mutateBoundary(boundary, fixture.mutation ?? {});
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-launch-00-"));
    const candidatePath = path.join(tempDir, "PUBLIC_LAUNCH_RELEASE_BOUNDARY.json");
    fs.writeFileSync(candidatePath, `${JSON.stringify(mutated, null, 2)}\n`, "utf8");

    try {
      const result = runGuard(candidatePath);
      assert.notEqual(result.status, 0, "negative fixture unexpectedly passed");
      assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(fixture.expected_token, "u"));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
}

test("LAUNCH-00 boundary remains preparation authority until LAUNCH-10", () => {
  const boundary = readJson(boundaryPath);
  assert.equal(boundary.release.activation_state, "not_yet_authorised");
  assert.equal(boundary.release.final_acceptance_gate, "LAUNCH-10");
  assert.equal(boundary.release.final_acceptance_statement, "PUBLIC_LAUNCH_ACCEPTANCE: GO");
  assert.equal(boundary.supersession.does_not_itself_authorise_public_launch, true);
});
