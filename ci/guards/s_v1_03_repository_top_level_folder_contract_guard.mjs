// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-03 repository top-level folder contract guard.
 * Purpose: proves the developer repo map contains explicit top-level folder ownership markers.
 * Boundary: checks documentation markers only; it does not inspect or alter product behaviour.
 * Determinism: reads fixed repo files and exact marker strings without network, clock, or runtime state.
 * Failure: emits CI_V1_REPOSITORY_TOP_LEVEL_FOLDER_CONTRACT when the handover contract drifts.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-03";
const TOKEN = "CI_V1_REPOSITORY_TOP_LEVEL_FOLDER_CONTRACT";
const REPO_MAP_PATH = "docs/dev/REPO_MAP.md";

const REQUIRED_MARKERS = [
  "# Repository Map",
  "## Top-Level Folder Contract",
  "Status: developer navigation contract for S-V1-03.",
  "This contract is navigation and boundary documentation only. It does not create product behaviour.",
  "No folder contract may create new product behaviour, product routes, storage behaviour, UI behaviour, payment behaviour, auth behaviour, registry content, or engine behaviour.",
  "### Deterministic engine boundary",
  "The deterministic engine boundary is explicit: `engine/` owns deterministic compile/execution truth and must not consume auth, billing, UI, coach notes, commercial copy, dashboards, marketplace, messaging, organisation, team, gym, or EPOS state.",
  "### Top-level folder ownership",
  "### Placement rule",
  "### Non-authority rule",
  "It is a developer handover map only."
];

const REQUIRED_FOLDER_MARKERS = [
  "- `.github/` owns GitHub workflow definitions and pull-request automation policy.",
  "- `artifacts/` owns generated or captured local proof artefacts where explicitly permitted by slice law.",
  "- `ci/` owns executable guards, fixtures, CI contracts, CI scripts, guard metadata, and release checks.",
  "- `claims/` owns claim-control material only where already governed by copy and claim guards.",
  "- `cli/` owns command-line entry surfaces and must not bypass engine or API contracts.",
  "- `contracts/` owns machine-readable or human-readable contracts that pin expected shapes and boundaries.",
  "- `copy/` owns copy-registry material and claim-safe text surfaces; it must not create engine truth.",
  "- `db/` owns database migrations, schema helpers, and persistence support; it must not reinterpret engine decisions.",
  "- `dist/` owns built output and must not be edited as source.",
  "- `docs/` owns product, release, developer, architecture, proof, and operating documents; docs explain and point to authority but do not silently create behaviour.",
  "- `engine/` owns deterministic engine source and engine-public contracts only.",
  "- `examples/` owns example inputs or usage notes; examples must not become hidden acceptance law.",
  "- `fixtures/` owns shared test and proof fixtures where explicitly referenced by tests or guards.",
  "- `githooks/` and `.githooks/` own local Git hook support only.",
  "- `out/`, `previews/`, and `tmp/` own local or generated output and must not become source authority.",
  "- `public/` owns static public assets and public-facing static surfaces.",
  "- `registries/` owns registry data, registry indexes, registry bundles, and registry classifications; registry content must remain closed-world and validated.",
  "- `replay/` owns replay suites, replay envelopes, and replay proof inputs/outputs.",
  "- `scripts/` owns repository automation, generators, maintenance scripts, and helper commands.",
  "- `server/` owns API routing, transport, persistence orchestration, and product-facing adapters outside the engine.",
  "- `shared/` owns shared contracts and helpers used across boundaries; shared code must not become a dumping ground for hidden product behaviour.",
  "- `src/` owns application and package source according to the local module boundary.",
  "- `support/` owns support documents or support-surface material where explicitly scoped.",
  "- `test/` and `tests/` own executable test suites and test wrappers.",
  "- `test_support/` owns test helpers only.",
  "- `tools/` owns developer utilities and utility-surface build helpers; tools must not create active app capability without a named slice.",
  "- `ui/` owns presentation surfaces and UI contracts; UI may present factual outputs but must not create engine truth."
];

const REQUIRED_POINTERS = [
  "1. `REPO_BOUNDARY_MAP.md`",
  "2. `docs/dev/REPO_MAP.md`",
  "3. `docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md`",
  "4. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`",
  "5. the closest existing guard or test pattern"
];

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exitCode = 1;
}

function repoPath(relPath) {
  return path.join(ROOT, relPath);
}

function assertFileContainsMarkers(relPath, markers, markerType) {
  const absPath = repoPath(relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required repository folder contract file is missing.", {
      path: relPath
    });
    return;
  }

  const text = fs.readFileSync(absPath, "utf8");

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required repository folder contract marker is missing.", {
        path: relPath,
        marker_type: markerType,
        marker
      });
    }
  }
}

assertFileContainsMarkers(REPO_MAP_PATH, REQUIRED_MARKERS, "contract");
assertFileContainsMarkers(REPO_MAP_PATH, REQUIRED_FOLDER_MARKERS, "folder");
assertFileContainsMarkers(REPO_MAP_PATH, REQUIRED_POINTERS, "placement_pointer");

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-03 repository top-level folder contract guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  path: REPO_MAP_PATH,
  folder_marker_count: REQUIRED_FOLDER_MARKERS.length,
  message: "Repository top-level folder contract passed."
}, null, 2));
