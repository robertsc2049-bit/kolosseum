// @law: Repo Governance
// @severity: medium
// @scope: repo
// DEV NOTE: BETA-12 deterministic Phase 5 materialisation contract guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_12_PHASE5_MATERIALISATION::FAIL::${message}`
  );
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    fail(`missing::${relativePath}`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function fileHash(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const source = read(
  "engine/src/phases/beta12Phase5Materialisation.ts"
);

const phase5Source = read(
  "engine/src/phases/phase5.ts"
);

const indexSource = read(
  "engine/src/index.ts"
);

const testSource = read(
  "test/beta_12_phase5_materialisation.test.mjs"
);

const runnerSource = read(
  "ci/scripts/run_beta_12_phase5_materialisation_tests.mjs"
);

const packageSource = read("package.json");

for (const token of [
  "canonical_input_hash",
  "constraint_hash",
  "enumeration_hash",
  "selection_hash",
  "selected_candidate",
  "executable_session",
  "materialised_program",
  "deepFreeze",
  "beta12_session_",
  "beta12_block_",
  "beta12_item_"
]) {
  if (!source.includes(token)) {
    fail(`source_token_missing::${token}`);
  }
}

const lowerSource = source.toLowerCase();

for (const forbidden of [
  "math.random",
  "date.now",
  "new date",
  "randomuuid",
  "performance.now",
  "pickbestsubstitute",
  "score",
  "rank",
  "optim",
  "payment",
  "coach_note",
  "nd_mode"
]) {
  if (lowerSource.includes(forbidden)) {
    fail(`forbidden_source_token::${forbidden}`);
  }
}

const betaRoute = phase5Source.indexOf(
  "hasBeta12Phase5Materialisation(program)"
);

const legacyCandidateBuild = phase5Source.indexOf(
  "const candidates = buildCandidateList(program)"
);

if (
  betaRoute < 0 ||
  legacyCandidateBuild < 0 ||
  betaRoute > legacyCandidateBuild
) {
  fail("beta_route_must_precede_legacy_adjustment");
}

if (
  !indexSource.includes(
    "p5Raw?.materialised_program ?? p4.program"
  )
) {
  fail("phase6_materialised_program_handoff_missing");
}

for (const token of [
  "identical input produces byte-stable materialisation",
  "tie handling selects canonical structural identity",
  "payment state has no Phase 5 effect",
  "coach notes have no Phase 5 effect",
  "ND mode has no Phase 5 engine effect",
  "materialised programme is executable by Phase 6",
  "Phase 5 output is deeply frozen"
]) {
  if (!testSource.includes(token)) {
    fail(`test_missing::${token}`);
  }
}

for (const token of [
  "npm run build",
  "beta_12_phase5_materialisation.test.mjs"
]) {
  if (!runnerSource.includes(token)) {
    fail(`runner_token_missing::${token}`);
  }
}

for (const token of [
  "node ci/scripts/run_beta_12_phase5_materialisation_tests.mjs",
  "node ci/guards/beta_12_phase5_materialisation_guard.mjs"
]) {
  if (!packageSource.includes(token)) {
    fail(`package_entrypoint_missing::${token}`);
  }
}

const fixtureRoot = path.join(
  root,
  "test",
  "fixtures",
  "beta_12_phase5"
);

const manifestPath = path.join(
  fixtureRoot,
  "manifest.json"
);

if (!fs.existsSync(manifestPath)) {
  fail("fixture_manifest_missing");
}
else {
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  );

  const names = manifest.fixtures
    .map((entry) => entry.file)
    .sort();

  const activities = manifest.fixtures
    .map((entry) => entry.activity_id)
    .sort();

  if (
    JSON.stringify(names) !==
    JSON.stringify([
      "general_strength.json",
      "powerlifting.json",
      "rugby_union.json"
    ])
  ) {
    fail("fixture_file_set_invalid");
  }

  if (
    JSON.stringify(activities) !==
    JSON.stringify([
      "general_strength",
      "powerlifting",
      "rugby_union"
    ])
  ) {
    fail("fixture_activity_set_invalid");
  }

  for (const entry of manifest.fixtures) {
    const fixturePath = path.join(
      fixtureRoot,
      entry.file
    );

    if (!fs.existsSync(fixturePath)) {
      fail(`fixture_missing::${entry.file}`);
      continue;
    }

    const content = fs.readFileSync(
      fixturePath,
      "utf8"
    );

    if (fileHash(content) !== entry.sha256) {
      fail(`fixture_hash_mismatch::${entry.file}`);
    }
  }
}

if (!failed) {
  const materialiserPath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "phases",
    "beta12Phase5Materialisation.js"
  );

  const canonicalPath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "phases",
    "betaCanonical.js"
  );

  if (
    !fs.existsSync(materialiserPath) ||
    !fs.existsSync(canonicalPath)
  ) {
    fail("compiled_runtime_missing");
  }
  else {
    const runtime = await import(
      pathToFileURL(materialiserPath).href
    );

    const canonical = await import(
      pathToFileURL(canonicalPath).href
    );

    for (const fixtureName of [
      "general_strength.json",
      "powerlifting.json",
      "rugby_union.json"
    ]) {
      const input = JSON.parse(
        fs.readFileSync(
          path.join(fixtureRoot, fixtureName),
          "utf8"
        )
      );

      const first =
        runtime.materialiseBeta12Phase5(input);

      const second =
        runtime.materialiseBeta12Phase5(input);

      if (
        canonical.betaCanonicalJson(first) !==
        canonical.betaCanonicalJson(second)
      ) {
        fail(
          `runtime_byte_instability::${fixtureName}`
        );

        continue;
      }

      if (
        first.ok !== true ||
        first.phase5.canonical_input_hash !==
          input.canonical_input_hash ||
        first.phase5.constraint_hash !==
          input.constraint_hash ||
        first.phase5.enumeration_hash !==
          input.enumeration_hash
      ) {
        fail(
          `runtime_binding_output_invalid::${fixtureName}`
        );

        continue;
      }

      const expectedSelectionHash =
        canonical.betaCanonicalHash({
          canonical_input_hash:
            input.canonical_input_hash,
          constraint_hash:
            input.constraint_hash,
          enumeration_hash:
            input.enumeration_hash,
          selected_candidate:
            first.phase5.selected_candidate
        });

      if (
        first.phase5.selection_hash !==
        expectedSelectionHash
      ) {
        fail(
          `selection_hash_invalid::${fixtureName}`
        );
      }

      if (
        !Object.isFrozen(first) ||
        !Object.isFrozen(first.phase5) ||
        !Object.isFrozen(
          first.phase5.executable_session
        ) ||
        !Object.isFrozen(
          first.materialised_program
        )
      ) {
        fail(
          `runtime_output_not_frozen::${fixtureName}`
        );
      }

      if (
        first.materialised_program
          .planned_items.length !== 1
      ) {
        fail(
          `runtime_session_not_executable::${fixtureName}`
        );
      }
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
else {
  console.log(
    JSON.stringify({
      ok: true,
      guard: "BETA-12",
      token:
        "CI_BETA_12_PHASE5_MATERIALISATION",
      message:
        "Phase 5 deterministic materialisation contract passed."
    })
  );
}
