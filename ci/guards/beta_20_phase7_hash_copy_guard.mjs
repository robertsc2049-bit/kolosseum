// @law: Repo Governance
// @severity: high
// @scope: engine
// DEV NOTE: BETA-20 Phase 7 rendered-byte, Copy Registry, and render-stack guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  pathToFileURL
} from "node:url";

import {
  buildBeta20Phase7CopyReferences,
  lintBeta20Phase7CopyRegistry,
  lintBeta20RenderStackContract,
  validateBeta20Phase7CopyReferences
} from "../lib/beta20_phase7_copy_guard_lib.mjs";

const root =
  process.cwd();

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_20_PHASE7_HASH_COPY_GUARD::FAIL::${message}`
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
    .update(
      content,
      "utf8"
    )
    .digest("hex");
}

const files = {
  source:
    "engine/src/phases/beta20Phase7HashCopyGuard.ts",
  copy:
    "copy/beta_20_phase7_projection_copy.json",
  renderContract:
    "engine/contracts/beta20_phase7_render_stack.json",
  guardLibrary:
    "ci/lib/beta20_phase7_copy_guard_lib.mjs",
  test:
    "test/beta_20_phase7_hash_copy_guard.test.mjs",
  runner:
    "ci/scripts/run_beta_20_phase7_hash_copy_guard_tests.mjs",
  cases:
    "test/fixtures/beta_20_phase7_hash_copy_guard/cases.json",
  manifest:
    "test/fixtures/beta_20_phase7_hash_copy_guard/manifest.json",
  documentation:
    "docs/runtime/BETA_20_PHASE7_HASH_COPY_GUARD.md",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json",
  v0Core:
    "ci/scripts/kolosseum_v0_test_suite_core.mjs",
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

for (
  const token
  of [
    "beta20_phase7_hash_copy_guard",
    "canonical_rendered_output_utf8_bytes_only",
    "BETA20_PHASE7_SECTION_ORDER",
    "canonicaliseBeta20RenderedOutput",
    "hashBeta20RenderedOutputBytes",
    "assertBeta20ProjectionCopyClaimSafe",
    "projectBeta20Phase7",
    "validateBeta20Phase7Output",
    "application/json"
  ]
) {
  if (
    !source.source.includes(
      token
    )
  ) {
    fail(
      `source_token_missing::${token}`
    );
  }
}

for (
  const token
  of [
    "PHASE7_PROJECTION_METADATA_LABEL",
    "PHASE7_PROGRAM_SUMMARY_LABEL",
    "PHASE7_BLOCK_SUMMARY_LABEL",
    "PHASE7_SESSION_LIST_LABEL",
    "PHASE7_EVENT_DIGEST_LABEL",
    "PHASE7_FACTUAL_BOUNDARY_LABEL"
  ]
) {
  if (
    !source.copy.includes(
      token
    )
  ) {
    fail(
      `copy_id_missing::${token}`
    );
  }
}

const copyRegistry =
  readJson(files.copy);

const copyLint =
  lintBeta20Phase7CopyRegistry(
    copyRegistry
  );

if (!copyLint.ok) {
  for (
    const failure
    of copyLint.failures
  ) {
    fail(
      `copy_registry::${failure.reason}::${failure.copy_id ?? ""}::${failure.term ?? ""}`
    );
  }
}

try {
  validateBeta20Phase7CopyReferences(
    buildBeta20Phase7CopyReferences()
  );
}
catch (error) {
  fail(
    `copy_reference_contract::${String(error?.reason ?? error?.message ?? error)}`
  );
}

const renderContract =
  readJson(
    files.renderContract
  );

const packageJson =
  readJson(
    files.package
  );

const renderLint =
  lintBeta20RenderStackContract(
    renderContract,
    packageJson
  );

if (!renderLint.ok) {
  for (
    const failure
    of renderLint.failures
  ) {
    fail(
      `render_contract::${failure.reason}`
    );
  }
}

for (
  const requiredTest
  of [
    "identical Phase 6 input gives identical projection bytes and hash",
    "changed Phase 6 fact changes projection bytes and hash",
    "inline projection copy fails",
    "forbidden copy language fails",
    "unsupported content format fails",
    "unpinned PDF font and render stack fails if PDF exists"
  ]
) {
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

for (
  const token
  of [
    "npm run build",
    "beta_20_phase7_hash_copy_guard.test.mjs"
  ]
) {
  if (
    !source.runner.includes(
      token
    )
  ) {
    fail(
      `runner_token_missing::${token}`
    );
  }
}

for (
  const token
  of [
    '"proof:beta-20"',
    "run_beta_20_phase7_hash_copy_guard_tests.mjs",
    "beta_20_phase7_hash_copy_guard.mjs",
    "npm run proof:beta-20"
  ]
) {
  if (
    !source.package.includes(
      token
    )
  ) {
    fail(
      `package_entrypoint_missing::${token}`
    );
  }
}

if (
  !source.entrypoints.includes(
    '"proof:beta-20"'
  )
) {
  fail(
    "declared_entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "engine/src/phases/beta20Phase7HashCopyGuard.ts",
    "engine/contracts/beta20_phase7_render_stack.json"
  ]
) {
  const count =
    source.v0Core
      .split(
        `"${exactPath}"`
      )
      .length - 1;

  if (count !== 1) {
    fail(
      `v0_exact_exclusion_invalid::${exactPath}::${count}`
    );
  }
}

if (
  source.v0Core.includes(
    '"engine/src/phases"'
  ) ||
  source.v0Core.includes(
    '"engine/contracts"'
  )
) {
  fail(
    "v0_broad_exclusion_forbidden"
  );
}

for (
  const token
  of [
    "JSON-only beta format",
    "SHA-256 over the exact UTF-8 bytes",
    "Copy Registry identifiers only",
    "Inline copy",
    "unpinned PDF",
    "No directory, wildcard"
  ]
) {
  if (
    !source.documentation.includes(
      token
    )
  ) {
    fail(
      `documentation_token_missing::${token}`
    );
  }
}

const manifest =
  readJson(files.manifest);

if (
  !manifest ||
  manifest.slice_id !==
    "BETA-20" ||
  manifest.fixtures?.length !==
    3
) {
  fail(
    "fixture_manifest_invalid"
  );
}
else {
  for (
    const fixture
    of manifest.fixtures
  ) {
    const content =
      read(
        fixture.file
      );

    if (
      sha256(content) !==
      fixture.sha256
    ) {
      fail(
        `fixture_hash_mismatch::${fixture.file}`
      );
    }
  }
}

if (!failed) {
  const compiledPath =
    path.join(
      root,
      "engine",
      "dist",
      "src",
      "phases",
      "beta20Phase7HashCopyGuard.js"
    );

  if (
    !fs.existsSync(
      compiledPath
    )
  ) {
    fail(
      "compiled_beta20_module_missing"
    );
  }
  else {
    const runtime =
      await import(
        pathToFileURL(
          compiledPath
        ).href
      );

    const fixture =
      readJson(
        files.beta18Fixture
      );

    const first =
      runtime
        .projectBeta20Phase7(
          fixture.phase7_input
        );

    const second =
      runtime
        .projectBeta20Phase7(
          JSON.parse(
            JSON.stringify(
              fixture.phase7_input
            )
          )
        );

    if (
      first.rendered_output !==
        second.rendered_output ||
      first.projection_hash !==
        second.projection_hash
    ) {
      fail(
        "compiled_projection_not_byte_stable"
      );
    }

    if (
      first.projection_hash !==
      sha256(
        first.rendered_output
      )
    ) {
      fail(
        "compiled_hash_not_rendered_bytes"
      );
    }

    const rendered =
      JSON.parse(
        first.rendered_output
      );

    const actualOrder =
      Object.keys(rendered);

    const expectedOrder = [
      "projection_metadata",
      "program_summary",
      "block_summary",
      "session_list",
      "event_digest"
    ];

    if (
      JSON.stringify(actualOrder) !==
      JSON.stringify(expectedOrder)
    ) {
      fail(
        "compiled_section_order_invalid"
      );
    }

    try {
      runtime
        .assertBeta20ProjectionCopyClaimSafe({
          ...rendered,
          title:
            "Session summary"
        });

      fail(
        "compiled_inline_copy_gate_failed"
      );
    }
    catch (error) {
      if (
        error?.failure_token !==
          "phase7_output_invalid"
      ) {
        fail(
          "compiled_inline_copy_failure_token_invalid"
        );
      }
    }

    const unsupported =
      JSON.parse(
        JSON.stringify(
          fixture.phase7_input
        )
      );

    unsupported.content_format =
      "application/pdf";

    const result =
      runtime
        .tryProjectBeta20Phase7(
          unsupported
        );

    if (
      result.ok !== false ||
      result.failure_token !==
        "phase7_input_invalid"
    ) {
      fail(
        "compiled_unsupported_content_format_gate_failed"
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
      guard: "BETA-20",
      token:
        "CI_BETA_20_PHASE7_HASH_COPY_GUARD",
      content_format:
        "application/json",
      copy_entry_count: 6,
      pdf_enabled: false,
      message:
        "Phase 7 canonical rendered bytes, byte-source hash, Copy Registry, claim boundary, and JSON-only render stack passed."
    })
  );
}
