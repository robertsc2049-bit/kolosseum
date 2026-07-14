// DEV NOTE: BETA-20 Phase 7 byte stability, hash, copy, and render tests.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import {
  BETA20_PHASE7_SECTION_ORDER,
  assertBeta20ProjectionCopyClaimSafe,
  beta20Phase7HashCopyGuardContract,
  hashBeta20RenderedOutputBytes,
  projectBeta20Phase7,
  tryProjectBeta20Phase7,
  validateBeta20CanonicalRenderedBytes,
  validateBeta20Phase7Output
} from "../engine/dist/src/phases/beta20Phase7HashCopyGuard.js";

import {
  betaCanonicalHash
} from "../engine/dist/src/phases/betaCanonical.js";

import {
  buildBeta20Phase7CopyReferences,
  lintBeta20Phase7CopyRegistry,
  lintBeta20RenderStackContract,
  validateBeta20Phase7CopyReferences
} from "../ci/lib/beta20_phase7_copy_guard_lib.mjs";

function readJson(path) {
  return JSON.parse(
    fs.readFileSync(
      path,
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest("hex");
}

function baseInput() {
  return clone(
    readJson(
      "test/fixtures/beta_18_phase7_schema_binding/completed_projection.json"
    ).phase7_input
  );
}

function changedPhase6Input() {
  const input =
    baseInput();

  input
    .phase6_output
    .execution_state
    .activity_id =
      "general_strength";

  const statePayload =
    clone(
      input
        .phase6_output
        .execution_state
    );

  delete statePayload
    .reducer_state_hash;

  input
    .phase6_output
    .execution_state
    .reducer_state_hash =
      betaCanonicalHash(
        statePayload
      );

  return input;
}

test(
  "BETA-20 exposes JSON-only rendered-byte hash law",
  () => {
    assert.equal(
      beta20Phase7HashCopyGuardContract
        .slice_id,
      "BETA-20"
    );

    assert.deepEqual(
      beta20Phase7HashCopyGuardContract
        .content_formats,
      [
        "application/json"
      ]
    );

    assert.equal(
      beta20Phase7HashCopyGuardContract
        .projection_hash_source,
      "canonical_rendered_output_utf8_bytes_only"
    );

    assert.equal(
      beta20Phase7HashCopyGuardContract
        .inline_copy_allowed,
      false
    );

    assert.equal(
      beta20Phase7HashCopyGuardContract
        .pdf_enabled,
      false
    );
  }
);

test(
  "BETA-20 identical Phase 6 input gives identical projection bytes and hash",
  () => {
    const input =
      baseInput();

    const first =
      projectBeta20Phase7(
        input
      );

    const second =
      projectBeta20Phase7(
        clone(input)
      );

    assert.equal(
      first.rendered_output,
      second.rendered_output
    );

    assert.equal(
      first.projection_hash,
      second.projection_hash
    );

    assert.equal(
      first.projection_hash,
      sha256(
        first.rendered_output
      )
    );

    assert.equal(
      first.projection_hash,
      hashBeta20RenderedOutputBytes(
        first.rendered_output
      )
    );

    assert.deepEqual(
      validateBeta20Phase7Output(
        input,
        first
      ),
      first
    );
  }
);

test(
  "BETA-20 changed Phase 6 fact changes projection bytes and hash",
  () => {
    const original =
      projectBeta20Phase7(
        baseInput()
      );

    const changed =
      projectBeta20Phase7(
        changedPhase6Input()
      );

    assert.notEqual(
      original.rendered_output,
      changed.rendered_output
    );

    assert.notEqual(
      original.projection_hash,
      changed.projection_hash
    );
  }
);

test(
  "BETA-20 rendered section order is exact and deterministic",
  () => {
    const output =
      projectBeta20Phase7(
        baseInput()
      );

    const parsed =
      JSON.parse(
        output.rendered_output
      );

    assert.deepEqual(
      Object.keys(parsed),
      BETA20_PHASE7_SECTION_ORDER
    );

    assert.deepEqual(
      validateBeta20CanonicalRenderedBytes(
        output.rendered_output
      ),
      parsed
    );
  }
);

test(
  "BETA-20 inline projection copy fails",
  () => {
    const output =
      projectBeta20Phase7(
        baseInput()
      );

    const parsed =
      JSON.parse(
        output.rendered_output
      );

    parsed.title =
      "Session summary";

    assert.throws(
      () =>
        assertBeta20ProjectionCopyClaimSafe(
          parsed
        ),
      (error) =>
        error?.failure_token ===
          "phase7_output_invalid"
    );

    const references =
      clone(
        buildBeta20Phase7CopyReferences()
      );

    references
      .section_label_copy_ids
      .program_summary =
        "Programme summary";

    assert.throws(
      () =>
        validateBeta20Phase7CopyReferences(
          references
        ),
      (error) =>
        error?.reason ===
          "inline_copy_or_unknown_reference_forbidden"
    );
  }
);

test(
  "BETA-20 forbidden copy language fails",
  () => {
    const copyRegistry =
      readJson(
        "copy/beta_20_phase7_projection_copy.json"
      );

    const contaminated =
      clone(
        copyRegistry
      );

    contaminated
      .entries[0]
      .text =
        "Recommended next step";

    const result =
      lintBeta20Phase7CopyRegistry(
        contaminated
      );

    assert.equal(
      result.ok,
      false
    );

    assert.ok(
      result.failures.some(
        (failure) =>
          failure.reason ===
            "claim_term_found" &&
          failure.term ===
            "recommend"
      )
    );
  }
);

test(
  "BETA-20 admitted Copy Registry and copy references pass",
  () => {
    const registry =
      readJson(
        "copy/beta_20_phase7_projection_copy.json"
      );

    const lint =
      lintBeta20Phase7CopyRegistry(
        registry
      );

    assert.equal(
      lint.ok,
      true
    );

    const references =
      buildBeta20Phase7CopyReferences();

    assert.deepEqual(
      validateBeta20Phase7CopyReferences(
        references
      ),
      references
    );

    assert.equal(
      JSON.stringify(
        references
      ).includes(
        "Projection details"
      ),
      false
    );
  }
);

test(
  "BETA-20 unsupported content format fails",
  () => {
    const input =
      baseInput();

    input.content_format =
      "application/pdf";

    const result =
      tryProjectBeta20Phase7(
        input
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "phase7_input_invalid"
    );
  }
);

test(
  "BETA-20 unpinned PDF font and render stack fails if PDF exists",
  () => {
    const contract =
      readJson(
        "engine/contracts/beta20_phase7_render_stack.json"
      );

    const packageJson =
      readJson(
        "package.json"
      );

    const unpinned =
      clone(
        contract
      );

    unpinned
      .content_formats
      .push(
        "application/pdf"
      );

    unpinned.pdf = {
      enabled: true,
      renderer: {
        package:
          "pdfkit",
        exact_version:
          "^0.15.0"
      },
      fonts: [],
      deterministic_metadata:
        false,
      system_fonts_allowed:
        true,
      locale: null,
      timezone: null
    };

    const result =
      lintBeta20RenderStackContract(
        unpinned,
        {
          ...packageJson,
          dependencies: {
            ...packageJson
              .dependencies,
            pdfkit:
              "^0.15.0"
          }
        }
      );

    assert.equal(
      result.ok,
      false
    );

    assert.ok(
      result.failures.some(
        (failure) =>
          failure.reason ===
            "pdf_renderer_not_exactly_pinned"
      )
    );

    assert.ok(
      result.failures.some(
        (failure) =>
          failure.reason ===
            "pdf_fonts_not_hash_pinned"
      )
    );

    assert.ok(
      result.failures.some(
        (failure) =>
          failure.reason ===
            "pdf_environment_not_pinned"
      )
    );
  }
);

test(
  "BETA-20 current render stack is JSON-only and deterministic",
  () => {
    const contract =
      readJson(
        "engine/contracts/beta20_phase7_render_stack.json"
      );

    const packageJson =
      readJson(
        "package.json"
      );

    const result =
      lintBeta20RenderStackContract(
        contract,
        packageJson
      );

    assert.equal(
      result.ok,
      true
    );
  }
);

test(
  "BETA-20 projection hash tamper fails against rendered bytes",
  () => {
    const input =
      baseInput();

    const output =
      clone(
        projectBeta20Phase7(
          input
        )
      );

    output.projection_hash =
      "0".repeat(64);

    assert.throws(
      () =>
        validateBeta20Phase7Output(
          input,
          output
        ),
      (error) =>
        error?.failure_token ===
          "phase7_projection_hash_mismatch"
    );
  }
);

test(
  "BETA-20 fixture manifest is current",
  () => {
    const manifest =
      readJson(
        "test/fixtures/beta_20_phase7_hash_copy_guard/manifest.json"
      );

    assert.equal(
      manifest.slice_id,
      "BETA-20"
    );

    assert.equal(
      manifest.fixtures.length,
      3
    );

    for (
      const fixture
      of manifest.fixtures
    ) {
      const content =
        fs.readFileSync(
          fixture.file,
          "utf8"
        );

      assert.equal(
        sha256(content),
        fixture.sha256
      );
    }
  }
);

test(
  "BETA-20 v0 compatibility uses exact module and render-contract exclusions",
  () => {
    const source =
      fs.readFileSync(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs",
        "utf8"
      );

    for (
      const exactPath
      of [
        "engine/src/phases/beta20Phase7HashCopyGuard.ts",
        "engine/contracts/beta20_phase7_render_stack.json"
      ]
    ) {
      assert.equal(
        source.split(
          `"${exactPath}"`
        ).length - 1,
        1
      );
    }

    assert.equal(
      source.includes(
        '"engine/src/phases"'
      ),
      false
    );

    assert.equal(
      source.includes(
        '"engine/contracts"'
      ),
      false
    );
  }
);
