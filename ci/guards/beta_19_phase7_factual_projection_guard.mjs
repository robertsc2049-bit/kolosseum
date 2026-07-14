// @law: Repo Governance
// @severity: high
// @scope: engine
// DEV NOTE: BETA-19 factual Phase 7 projection and source-isolation guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  pathToFileURL
} from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_19_PHASE7_FACTUAL_PROJECTION::FAIL::${message}`
  );
}

function read(relativePath) {
  const absolutePath =
    path.join(
      root,
      relativePath
    );

  if (
    !fs.existsSync(
      absolutePath
    )
  ) {
    fail(
      `missing::${relativePath}`
    );

    return "";
  }

  return fs.readFileSync(
    absolutePath,
    "utf8"
  );
}

function readJson(relativePath) {
  const content =
    read(relativePath);

  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  }
  catch (error) {
    fail(
      `invalid_json::${relativePath}::${String(error?.message ?? error)}`
    );

    return null;
  }
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

function containsKey(
  value,
  searchedKey
) {
  if (Array.isArray(value)) {
    return value.some(
      (entry) =>
        containsKey(
          entry,
          searchedKey
        )
    );
  }

  if (
    value === null ||
    typeof value !== "object"
  ) {
    return false;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (key === searchedKey) {
      return true;
    }

    if (
      containsKey(
        child,
        searchedKey
      )
    ) {
      return true;
    }
  }

  return false;
}

const files = {
  source:
    "engine/src/phases/beta19Phase7FactualProjection.ts",
  schema:
    "schema/beta19_phase7_rendered_output.schema.json",
  test:
    "test/beta_19_phase7_factual_projection.test.mjs",
  runner:
    "ci/scripts/run_beta_19_phase7_factual_projection_tests.mjs",
  scenarios:
    "test/fixtures/beta_19_phase7_factual_projection/scenarios.json",
  manifest:
    "test/fixtures/beta_19_phase7_factual_projection/manifest.json",
  doc:
    "docs/runtime/BETA_19_PHASE7_FACTUAL_PROJECTION.md",
  v0Core:
    "ci/scripts/kolosseum_v0_test_suite_core.mjs",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json",
  beta18Fixture:
    "test/fixtures/beta_18_phase7_schema_binding/completed_projection.json"
};

const source = {};

for (
  const [name, relativePath]
  of Object.entries(files)
) {
  source[name] =
    read(relativePath);
}

for (const token of [
  "beta19_phase7_factual_projection",
  "validated_phase6_output_only",
  "phase6_echo_or_mechanical_count_only",
  "projection_metadata",
  "program_summary",
  "block_summary",
  "session_list",
  "event_digest",
  "projectBeta19Phase7",
  "validateBeta19Phase7Output",
  "tryProjectBeta19Phase7"
]) {
  if (
    !source.source.includes(token)
  ) {
    fail(
      `source_token_missing::${token}`
    );
  }
}

for (const forbiddenImport of [
  'from "copy/',
  'from "../copy',
  'from "../../copy',
  'from "public/',
  'from "server/',
  'from "src/api',
  "coachNotes",
  "billing",
  "stripe"
]) {
  if (
    source.source.includes(
      forbiddenImport
    )
  ) {
    fail(
      `forbidden_dependency::${forbiddenImport}`
    );
  }
}

if (
  !source.source.includes(
    'from "./beta18Phase7SchemaBinding.js"'
  )
) {
  fail(
    "beta18_schema_binding_dependency_missing"
  );
}

const schema =
  readJson(files.schema);

const requiredSections = [
  "projection_metadata",
  "program_summary",
  "session_list",
  "event_digest"
];

if (
  !schema ||
  schema.additionalProperties !==
    false ||
  JSON.stringify(
    schema.required
  ) !==
  JSON.stringify(
    requiredSections
  )
) {
  fail(
    "rendered_output_schema_not_closed"
  );
}

for (const section of [
  "projection_metadata",
  "program_summary",
  "event_digest"
]) {
  if (
    schema?.properties?.[section]
      ?.additionalProperties !==
      false
  ) {
    fail(
      `section_not_closed::${section}`
    );
  }
}

if (
  schema?.properties
    ?.block_summary
    ?.items
    ?.additionalProperties !==
      false
) {
  fail(
    "section_not_closed::block_summary"
  );
}

if (
  schema?.properties
    ?.session_list
    ?.minItems !== 1 ||
  schema?.properties
    ?.session_list
    ?.maxItems !== 1 ||
  schema?.properties
    ?.session_list
    ?.items
    ?.additionalProperties !==
      false
) {
  fail(
    "session_list_schema_invalid"
  );
}

for (const requiredTest of [
  "completed session projection contains factual sections only",
  "partial session projection echoes partial factual counts",
  "split continue projection mechanically counts continue decision",
  "split skip projection mechanically counts skipped work items",
  "pain flag projection is a factual event count",
  "projection cannot invent block facts",
  "projection cannot invent session facts",
  "projection cannot include coach note"
]) {
  if (
    !source.test.includes(
      requiredTest
    )
  ) {
    fail(
      `required_test_missing::${requiredTest}`
    );
  }
}

for (const token of [
  "npm run build",
  "beta_19_phase7_factual_projection.test.mjs"
]) {
  if (
    !source.runner.includes(token)
  ) {
    fail(
      `runner_token_missing::${token}`
    );
  }
}

for (const token of [
  '"proof:beta-19"',
  "run_beta_19_phase7_factual_projection_tests.mjs",
  "beta_19_phase7_factual_projection_guard.mjs",
  "npm run proof:beta-19"
]) {
  if (
    !source.package.includes(token)
  ) {
    fail(
      `package_entrypoint_missing::${token}`
    );
  }
}

if (
  !source.entrypoints.includes(
    '"proof:beta-19"'
  )
) {
  fail(
    "declared_entrypoint_missing"
  );
}

const exactV0Path =
  "engine/src/phases/beta19Phase7FactualProjection.ts";

const exactV0Count =
  source.v0Core
    .split(
      `"${exactV0Path}"`
    )
    .length - 1;

if (exactV0Count !== 1) {
  fail(
    `v0_exact_exclusion_invalid::${exactV0Count}`
  );
}

if (
  source.v0Core.includes(
    '"engine/src/phases"'
  )
) {
  fail(
    "v0_broad_exclusion_forbidden"
  );
}

for (const token of [
  "required sections",
  "block_summary",
  "cannot create a block",
  "cannot create an additional session",
  "does not read Copy Registry",
  "No directory, wildcard, or broad Phase 7 exclusion"
]) {
  if (
    !source.doc.includes(token)
  ) {
    fail(
      `documentation_token_missing::${token}`
    );
  }
}

const scenarioFixture =
  readJson(files.scenarios);

const manifest =
  readJson(files.manifest);

const expectedScenarioIds = [
  "completed_session",
  "partial_session",
  "split_continue",
  "split_skip",
  "pain_flag"
];

if (
  !scenarioFixture ||
  scenarioFixture.slice_id !==
    "BETA-19" ||
  JSON.stringify(
    scenarioFixture
      .scenarios
      .map(
        (scenario) =>
          scenario.scenario_id
      )
  ) !==
  JSON.stringify(
    expectedScenarioIds
  )
) {
  fail(
    "scenario_fixture_invalid"
  );
}

if (
  !manifest ||
  manifest.slice_id !==
    "BETA-19" ||
  JSON.stringify(
    manifest.scenario_ids
  ) !==
  JSON.stringify(
    expectedScenarioIds
  ) ||
  manifest.fixtures?.length !==
    1
) {
  fail(
    "fixture_manifest_invalid"
  );
}
else if (
  sha256(source.scenarios) !==
    manifest.fixtures[0].sha256
) {
  fail(
    "fixture_manifest_hash_mismatch"
  );
}

if (!failed) {
  const runtimePath =
    path.join(
      root,
      "engine",
      "dist",
      "src",
      "phases",
      "beta19Phase7FactualProjection.js"
    );

  if (
    !fs.existsSync(
      runtimePath
    )
  ) {
    fail(
      "compiled_beta19_module_missing"
    );
  }
  else {
    const runtime =
      await import(
        pathToFileURL(
          runtimePath
        ).href
      );

    const fixture =
      readJson(
        files.beta18Fixture
      );

    const output =
      runtime
        .projectBeta19Phase7(
          fixture.phase7_input
        );

    const rendered =
      JSON.parse(
        output.rendered_output
      );

    const actualSections =
      Object.keys(rendered)
        .sort();

    const expectedSections = [
      "block_summary",
      "event_digest",
      "program_summary",
      "projection_metadata",
      "session_list"
    ];

    if (
      JSON.stringify(
        actualSections
      ) !==
      JSON.stringify(
        expectedSections
      )
    ) {
      fail(
        "compiled_rendered_sections_invalid"
      );
    }

    if (
      rendered.session_list
        ?.length !== 1 ||
      rendered.session_list[0]
        ?.session_id !==
        fixture.phase7_input
          .phase6_output
          .execution_state
          .session_id
    ) {
      fail(
        "compiled_session_projection_invalid"
      );
    }

    if (
      rendered.program_summary
        ?.work_item_count !==
        fixture.phase7_input
          .phase6_output
          .execution_state
          .counts
          .total
    ) {
      fail(
        "compiled_program_count_invalid"
      );
    }

    for (const forbiddenKey of [
      "coach_note",
      "coach_notes",
      "payment_state",
      "product_tier",
      "ui_state",
      "copy_text",
      "recommendation",
      "readiness"
    ]) {
      if (
        containsKey(
          rendered,
          forbiddenKey
        )
      ) {
        fail(
          `compiled_forbidden_key::${forbiddenKey}`
        );
      }
    }

    const contaminated =
      JSON.parse(
        JSON.stringify(
          fixture.phase7_input
        )
      );

    contaminated
      .phase6_output
      .coach_note =
      "not allowed";

    const rejected =
      runtime
        .tryProjectBeta19Phase7(
          contaminated
        );

    if (
      rejected.ok !== false ||
      rejected.failure_token !==
        "phase7_forbidden_input"
    ) {
      fail(
        "compiled_coach_note_gate_failed"
      );
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
      guard: "BETA-19",
      token:
        "CI_BETA_19_PHASE7_FACTUAL_PROJECTION",
      required_section_count:
        requiredSections.length,
      conditional_section_count:
        1,
      scenario_count:
        expectedScenarioIds.length,
      message:
        "Factual Phase 7 projection sections and Phase 6-only source boundary passed."
    })
  );
}
