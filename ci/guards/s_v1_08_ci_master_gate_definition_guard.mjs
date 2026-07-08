// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-08 CI master gate definition guard.
 * Purpose: proves the v1 CI master gate doc and manifest exist, name the
 * required gate categories, and reuse existing checks before any broad workflow
 * expansion.
 * Boundary: documentation and manifest marker checks only. This guard does not
 * execute release gates, alter workflows, change package behaviour, change
 * runtime behaviour, change engine behaviour, add registry content, implement
 * auth, implement proof, or declare v1 complete.
 * Determinism: reads fixed repository files and exact marker strings without
 * network, clock, database, runtime, workflow, or GitHub state.
 * Failure: emits CI_V1_CI_MASTER_GATE_DEFINITION when the gate definition drifts.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-08";
const TOKEN = "CI_V1_CI_MASTER_GATE_DEFINITION";

const FILES = {
  doc: "docs/v1/V1_CI_MASTER_GATE.md",
  manifest: "docs/v1/V1_CI_MASTER_GATE.json",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  commandGuide: "docs/dev/COMMAND_GUIDE.md",
  ciFailureGuide: "docs/dev/CI_FAILURE_GUIDE.md",
  activeBoundary: "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  v1ReleaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  v1NotInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  v0ManifestMd: "docs/release/V0_COMPLETION_GATE_MANIFEST.md",
  v0ManifestJson: "docs/v0/V0_COMPLETION_GATE_MANIFEST.json",
  guardIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256",
  packageJson: "package.json"
};

const REQUIRED_CATEGORIES = [
  "v0_closure",
  "v1_boundary",
  "registry",
  "copy_claims",
  "auth_permissions",
  "proof_replay_export",
  "no_coupling_engine_truth"
];

const REQUIRED_DOC_MARKERS = [
  "Status: active v1 CI gate-definition document.",
  "Slice: S-V1-08.",
  "docs/v1/V1_CI_MASTER_GATE.json",
  "V1 completion is blocked unless every required gate category is complete, green, and mapped to an existing check or a deliberately sliced future check.",
  "Do not create expensive duplicate CI.",
  "v0 closure",
  "v1 boundary",
  "registry",
  "copy and claims",
  "auth and permissions",
  "proof, replay, and export",
  "no-coupling and engine truth",
  "npm.cmd run lint:fast",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256",
  "S-V1-08 does not:"
];

const REQUIRED_COMMAND_GUIDE_MARKERS = [
  "S-V1-08:CI-MASTER-GATE-COMMANDS:START",
  "docs/v1/V1_CI_MASTER_GATE.md",
  "docs/v1/V1_CI_MASTER_GATE.json",
  "node ci/guards/s_v1_08_ci_master_gate_definition_guard.mjs",
  "npm.cmd run lint:fast",
  "v0 closure, v1 boundary, registry, copy/claims, auth/permissions, proof/replay/export, and no-coupling/engine-truth"
];

const REQUIRED_FAILURE_GUIDE_MARKERS = [
  "S-V1-08:CI-MASTER-GATE-FAILURE-PATH:START",
  "docs/v1/V1_CI_MASTER_GATE.md",
  "docs/v1/V1_CI_MASTER_GATE.json",
  "broad duplicate workflows",
  "v0 closure, v1 boundary, registry, copy/claims, auth/permissions, proof/replay/export, and no-coupling/engine-truth"
];

const REQUIRED_ACCEPTANCE_MARKERS = [
  "S-V1-08:CI-MASTER-GATE-ACCEPTANCE-POINTER:START",
  "V1 completion is blocked unless the v1 CI master gate definition is satisfied.",
  "docs/v1/V1_CI_MASTER_GATE.md",
  "docs/v1/V1_CI_MASTER_GATE.json",
  "ci/guards/s_v1_08_ci_master_gate_definition_guard.mjs",
  "v0 closure",
  "v1 boundary",
  "registry",
  "copy and claims",
  "auth and permissions",
  "proof, replay, and export",
  "no-coupling and engine truth"
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

function readRequiredText(relPath) {
  const absPath = path.join(ROOT, relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required v1 CI master gate file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function assertMarkers(relPath, markers) {
  const text = readRequiredText(relPath);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required v1 CI master gate marker is missing.", {
        path: relPath,
        marker
      });
    }
  }
}

for (const relPath of Object.values(FILES)) {
  readRequiredText(relPath);
}

assertMarkers(FILES.doc, REQUIRED_DOC_MARKERS);
assertMarkers(FILES.commandGuide, REQUIRED_COMMAND_GUIDE_MARKERS);
assertMarkers(FILES.ciFailureGuide, REQUIRED_FAILURE_GUIDE_MARKERS);
assertMarkers(FILES.acceptanceGate, REQUIRED_ACCEPTANCE_MARKERS);

let manifest;
try {
  manifest = JSON.parse(readRequiredText(FILES.manifest));
} catch (error) {
  fail("V1 CI master gate manifest JSON is invalid.", {
    path: FILES.manifest,
    error: String(error.message || error)
  });
  manifest = null;
}

if (manifest) {
  if (manifest.schema_version !== "kolosseum.v1.ci_master_gate.v1.0.0") {
    fail("Manifest schema_version is wrong.", {
      expected: "kolosseum.v1.ci_master_gate.v1.0.0",
      actual: manifest.schema_version
    });
  }

  if (manifest.slice !== "S-V1-08") {
    fail("Manifest slice is wrong.", {
      expected: "S-V1-08",
      actual: manifest.slice
    });
  }

  if (manifest.current_primary_local_gate !== "npm.cmd run lint:fast") {
    fail("Manifest primary local gate is wrong.", {
      expected: "npm.cmd run lint:fast",
      actual: manifest.current_primary_local_gate
    });
  }

  if (!Array.isArray(manifest.required_gate_categories)) {
    fail("Manifest required_gate_categories must be an array.");
  } else {
    const categoryIds = manifest.required_gate_categories.map((category) => category.category_id);

    for (const categoryId of REQUIRED_CATEGORIES) {
      if (!categoryIds.includes(categoryId)) {
        fail("Manifest is missing a required gate category.", { category_id: categoryId });
      }
    }

    for (const category of manifest.required_gate_categories) {
      if (!category.category_id || !category.category_title || !category.purpose) {
        fail("Manifest category is missing required identity fields.", {
          category
        });
        continue;
      }

      if (!Array.isArray(category.required_existing_checks) || category.required_existing_checks.length === 0) {
        fail("Manifest category must name at least one existing check or record.", {
          category_id: category.category_id
        });
      }
    }
  }

  const manifestString = JSON.stringify(manifest);
  const requiredStrings = [
    "node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs",
    "node ci/guards/v1_boundary_guard_scaffolding_guard.mjs",
    "node ci/guards/v1_registry_content_production_contract_guard.mjs",
    "node ci/scripts/lint_sales_claims.mjs",
    "node ci/guards/s_v1_04_app_engine_boundary_contract_guard.mjs",
    "node ci/guards/evidence_seal_guard.mjs",
    "node ci/scripts/run_v0_no_coupling_engine_boundary_guard.mjs",
    "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
    "docs/v1/V1_RELEASE_BOUNDARY.md",
    "docs/v1/V1_ACCEPTANCE_GATE.md",
    "docs/v1/V1_NOT_IN_SCOPE.md"
  ];

  for (const requiredString of requiredStrings) {
    if (!manifestString.includes(requiredString)) {
      fail("Manifest is missing required check or record reference.", {
        reference: requiredString
      });
    }
  }
}

const packageJsonText = readRequiredText(FILES.packageJson);
if (!packageJsonText.includes("node ci/guards/s_v1_08_ci_master_gate_definition_guard.mjs")) {
  fail("S-V1-08 guard must be registered in the existing lint:fast guard chain.");
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-08 CI master gate definition guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  categories_checked: REQUIRED_CATEGORIES.length,
  message: "V1 CI master gate definition passed."
}, null, 2));
