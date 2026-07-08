import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function readText(relativePath) {
  return fs.readFileSync(relativePath, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertIncludes(text, expected, label) {
  assert.equal(
    text.includes(expected),
    true,
    `${label} must include: ${expected}`
  );
}

// DEV NOTE: S-V0-11 registry law documentation binding.
// Documentation is useful only if it points future developers back to the
// canonical guards and tests. This proof intentionally checks docs for links
// to the executable surfaces rather than treating README text as new law.
test("S-V0-11 registry README binds documentation to canonical guard and test surfaces", () => {
  const readme = readText("registries/README.md");

  for (const required of [
    "This README explains the registry boundary for future developers. It does not create new engine law.",
    "Canonical docs define law. DEV NOTE comments explain boundaries. Tests prove behaviour.",
    "ci/guards/registry_schema_presence_guard.mjs",
    "ci/guards/registry_bundle_guard.mjs",
    "ci/guards/registry_law_guard.mjs",
    "ci/scripts/schema_guard.mjs",
    "scripts/bundle_writer.cjs",
    "test/s_v0_10_registry_bundle_closure.test.mjs",
    "docs/release/V0_REGISTRY_BUNDLE_CLOSURE.md"
  ]) {
    assertIncludes(readme, required, "registry README");
  }
});

test("S-V0-11 registry README documents required registry boundary topics", () => {
  const readme = readText("registries/README.md");

  for (const heading of [
    "## Schema validity",
    "## FK closure",
    "## Frozen store and bundle closure",
    "## No registry fallback",
    "## v0/v1 boundary",
    "## CI binding"
  ]) {
    assertIncludes(readme, heading, "registry README");
  }

  for (const required of [
    "Every active registry domain in `registries/registry_index.json` must have a matching schema",
    "Registry references are closed-world references.",
    "Missing targets are build failures, not warnings.",
    "The registry bundle is a committed generated artefact.",
    "The bundle must match the current registry index and active registry files exactly.",
    "Registry loading must not use fallback, approximate, guessed, closest-match, inferred, or partial registry behaviour.",
    "Future v1 registry content may be documented or scaffolded only where it is clearly excluded from active v0 execution."
  ]) {
    assertIncludes(readme, required, "registry README");
  }
});

test("S-V0-11 registry README active v0 domains match registry_index order", () => {
  const readme = readText("registries/README.md");
  const index = readJson("registries/registry_index.json");

  assert.deepEqual(
    index.order,
    ["activity", "movement", "exercise", "program"],
    "registry_index.order must stay locked to active v0 domains"
  );

  for (const registryName of index.order) {
    assertIncludes(readme, `- \`${registryName}\``, "registry README active domain list");
  }
});

test("S-V0-11 registry guard scripts retain Registry Law headers", () => {
  const guardFiles = [
    "ci/guards/registry_schema_presence_guard.mjs",
    "ci/guards/registry_bundle_guard.mjs",
    "ci/guards/registry_law_guard.mjs"
  ];

  for (const guardFile of guardFiles) {
    const text = readText(guardFile);
    assertIncludes(text, "// @law: Registry Law", guardFile);
    assertIncludes(text, "// @severity: high", guardFile);
    assertIncludes(text, "// @scope: registry", guardFile);
    assertIncludes(text, "DEV NOTE: CI guard surface.", guardFile);
  }
});

test("S-V0-11 registry guards remain wired into lint fast path", () => {
  const packageJson = readJson("package.json");
  const lintFast = String(packageJson.scripts?.["lint:fast"] || "");

  assert.match(lintFast, /ci\/guards\/registry_schema_presence_guard\.mjs/);
  assert.match(lintFast, /ci\/guards\/registry_bundle_guard\.mjs/);
  assert.match(lintFast, /ci\/guards\/registry_law_guard\.mjs/);
});
