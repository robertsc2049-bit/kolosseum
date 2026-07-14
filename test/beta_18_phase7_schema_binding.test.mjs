// DEV NOTE: BETA-18 Phase 7 closed schema, binding, and Phase 6 isolation proof.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  beta18Phase7SchemaBindingContract,
  projectBeta18Phase7,
  tryProjectBeta18Phase7,
  validateBeta18Phase7Input,
  validateBeta18Phase7Output
} from "../engine/dist/src/phases/beta18Phase7SchemaBinding.js";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../engine/dist/src/phases/betaCanonical.js";

import {
  materialiseBeta12Phase5
} from "../engine/dist/src/phases/beta12Phase5Materialisation.js";

import {
  appendBeta13Phase6EventLog
} from "../engine/dist/src/runtime/beta13_phase6_event_schema.js";

import {
  replayBeta14Phase6RuntimeEvents
} from "../engine/dist/src/runtime/beta14_phase6_runtime_reducer.js";

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      relativePath,
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

function expectToken(
  action,
  expectedToken
) {
  assert.throws(
    action,
    (error) =>
      error?.failure_token ===
      expectedToken
  );
}

function rehashState(state) {
  const payload = clone(state);

  delete payload.reducer_state_hash;

  return {
    ...payload,
    reducer_state_hash:
      betaCanonicalHash(payload)
  };
}

const fixture = readJson(
  "test/fixtures/beta_18_phase7_schema_binding/completed_projection.json"
);

test(
  "BETA-18 exposes a closed Phase 7 schema and binding contract",
  () => {
    assert.equal(
      beta18Phase7SchemaBindingContract
        .slice_id,
      "BETA-18"
    );

    assert.equal(
      beta18Phase7SchemaBindingContract
        .input_source,
      "phase6_output_only"
    );

    assert.equal(
      beta18Phase7SchemaBindingContract
        .projection_hash_policy,
      "computed_sha256"
    );

    assert.deepEqual(
      beta18Phase7SchemaBindingContract
        .binding_echoes,
      [
        "canonical_input_hash",
        "selection_hash",
        "execution_status",
        "execution_state"
      ]
    );
  }
);

test(
  "BETA-18 projects exact factual Phase 6 truth deterministically",
  () => {
    const first =
      projectBeta18Phase7(
        clone(
          fixture.phase7_input
        )
      );

    const second =
      projectBeta18Phase7(
        clone(
          fixture.phase7_input
        )
      );

    assert.equal(
      betaCanonicalJson(first),
      betaCanonicalJson(second)
    );

    assert.equal(
      first.phase7_projection_id,
      fixture.phase7_input
        .phase7_projection_id
    );

    assert.equal(
      first.canonical_input_hash,
      fixture.phase7_input
        .phase6_output
        .canonical_input_hash
    );

    assert.equal(
      first.selection_hash,
      fixture.phase7_input
        .phase6_output
        .selection_hash
    );

    assert.equal(
      first.execution_status,
      fixture.phase7_input
        .phase6_output
        .execution_status
    );

    assert.deepEqual(
      first.execution_state,
      fixture.phase7_input
        .phase6_output
        .execution_state
    );

    assert.equal(
      first.content_format,
      "application/json"
    );

    assert.match(
      first.projection_hash,
      /^[a-f0-9]{64}$/u
    );

    assert.deepEqual(
      validateBeta18Phase7Output(
        fixture.phase7_input,
        first
      ),
      first
    );
  }
);

test(
  "BETA-18 accepts the actual Phase 5 binding and BETA-14 Phase 6 reducer state",
  () => {
    const phase4Value = readJson(
      "test/fixtures/beta_12_phase5/powerlifting.json"
    );

    const phase5 =
      materialiseBeta12Phase5(
        phase4Value
      );

    assert.equal(
      phase5.ok,
      true
    );

    const session =
      phase5.phase5
        .executable_session;

    let events = [];

    for (const raw of [
      {
        event_type:
          "SESSION_START"
      },
      {
        event_type:
          "WORK_ITEM_START",
        work_item_id:
          session.planned_items[0]
            .item_id
      },
      {
        event_type:
          "WORK_ITEM_DONE",
        work_item_id:
          session.planned_items[0]
            .item_id
      },
      {
        event_type:
          "SESSION_END",
        end_code:
          "completed"
      }
    ]) {
      events =
        appendBeta13Phase6EventLog(
          session,
          events,
          session.session_id,
          raw
        );
    }

    const executionState =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    const input = {
      phase7_projection_id:
        "beta18_actual_chain_001",
      content_format:
        "application/json",
      phase6_output: {
        canonical_input_hash:
          phase5.phase5
            .canonical_input_hash,
        selection_hash:
          phase5.phase5
            .selection_hash,
        execution_status:
          executionState.status,
        execution_state:
          executionState
      }
    };

    const output =
      projectBeta18Phase7(
        input
      );

    assert.equal(
      output.canonical_input_hash,
      phase5.phase5
        .canonical_input_hash
    );

    assert.equal(
      output.selection_hash,
      phase5.phase5
        .selection_hash
    );

    assert.equal(
      output.execution_status,
      "completed"
    );

    assert.equal(
      output.execution_state
        .reducer_state_hash,
      executionState
        .reducer_state_hash
    );
  }
);

test(
  "BETA-18 missing projection ID fails with registered token",
  () => {
    const missing = clone(
      fixture.phase7_input
    );

    delete missing
      .phase7_projection_id;

    const empty = clone(
      fixture.phase7_input
    );

    empty.phase7_projection_id = "";

    for (const candidate of [
      missing,
      empty
    ]) {
      const result =
        tryProjectBeta18Phase7(
          candidate
        );

      assert.equal(
        result.ok,
        false
      );

      assert.equal(
        result.failure_token,
        "phase7_projection_id_missing"
      );
    }
  }
);

test(
  "BETA-18 canonical hash echo mismatch fails closed",
  () => {
    const output =
      clone(
        projectBeta18Phase7(
          fixture.phase7_input
        )
      );

    output.canonical_input_hash =
      sha256(
        "different_canonical_hash"
      );

    expectToken(
      () =>
        validateBeta18Phase7Output(
          fixture.phase7_input,
          output
        ),
      "phase7_binding_mismatch"
    );
  }
);

test(
  "BETA-18 selection hash echo mismatch fails closed",
  () => {
    const output =
      clone(
        projectBeta18Phase7(
          fixture.phase7_input
        )
      );

    output.selection_hash =
      sha256(
        "different_selection_hash"
      );

    expectToken(
      () =>
        validateBeta18Phase7Output(
          fixture.phase7_input,
          output
        ),
      "phase7_binding_mismatch"
    );
  }
);

test(
  "BETA-18 execution status echo mismatch fails closed",
  () => {
    const output =
      clone(
        projectBeta18Phase7(
          fixture.phase7_input
        )
      );

    output.execution_status =
      "partial";

    expectToken(
      () =>
        validateBeta18Phase7Output(
          fixture.phase7_input,
          output
        ),
      "phase7_binding_mismatch"
    );
  }
);

test(
  "BETA-18 execution state echo mismatch fails closed",
  () => {
    const output =
      clone(
        projectBeta18Phase7(
          fixture.phase7_input
        )
      );

    output.execution_state =
      rehashState({
        ...output.execution_state,
        ended_by_event_id:
          "different_event_id"
      });

    expectToken(
      () =>
        validateBeta18Phase7Output(
          fixture.phase7_input,
          output
        ),
      "phase7_binding_mismatch"
    );
  }
);

test(
  "BETA-18 Phase 6 status must bind to reducer-state status",
  () => {
    const input = clone(
      fixture.phase7_input
    );

    input.phase6_output
      .execution_status =
      "partial";

    const result =
      tryProjectBeta18Phase7(
        input
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "phase7_binding_mismatch"
    );
  }
);

test(
  "BETA-18 rejects product coach payment organisation UI and copy state",
  () => {
    const forbidden = {
      coach_notes: [
        "non-binding note"
      ],
      payment_state: "paid",
      product_tier: "coach_pro",
      org_metadata: {
        organisation_id:
          "org_001"
      },
      ui_state: {
        expanded: true
      },
      copy_id:
        "BETA18_COPY_NOT_ALLOWED",
      copy_text:
        "User-facing text"
    };

    for (
      const [field, value]
      of Object.entries(forbidden)
    ) {
      const input = clone(
        fixture.phase7_input
      );

      input.phase6_output[field] =
        value;

      const result =
        tryProjectBeta18Phase7(
          input
        );

      assert.equal(
        result.ok,
        false,
        field
      );

      assert.equal(
        result.failure_token,
        "phase7_forbidden_input",
        field
      );
    }
  }
);

test(
  "BETA-18 closed-world input rejects unknown non-product fields",
  () => {
    const input = clone(
      fixture.phase7_input
    );

    input.phase6_output
      .unexpected_truth =
      "not_allowed";

    const result =
      tryProjectBeta18Phase7(
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
  "BETA-18 invalid reducer hash fails as binding mismatch",
  () => {
    const input = clone(
      fixture.phase7_input
    );

    input.phase6_output
      .execution_state
      .reducer_state_hash =
      sha256(
        "tampered_execution_state"
      );

    const result =
      tryProjectBeta18Phase7(
        input
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "phase7_binding_mismatch"
    );
  }
);

test(
  "BETA-18 projection hash tamper fails closed",
  () => {
    const output = clone(
      projectBeta18Phase7(
        fixture.phase7_input
      )
    );

    output.projection_hash =
      sha256(
        "tampered_projection"
      );

    expectToken(
      () =>
        validateBeta18Phase7Output(
          fixture.phase7_input,
          output
        ),
      "phase7_projection_hash_mismatch"
    );
  }
);

test(
  "BETA-18 rendered output is canonical factual JSON only",
  () => {
    const output =
      projectBeta18Phase7(
        fixture.phase7_input
      );

    const rendered =
      JSON.parse(
        output.rendered_output
      );

    assert.deepEqual(
      Object.keys(rendered).sort(),
      [
        "canonical_input_hash",
        "execution_state",
        "execution_status",
        "selection_hash"
      ]
    );

    const renderedText =
      output.rendered_output
        .toLowerCase();

    for (const forbidden of [
      "coach_note",
      "payment_state",
      "product_tier",
      "org_metadata",
      "ui_state",
      "copy_id",
      "recommendation",
      "readiness",
      "optimal"
    ]) {
      assert.equal(
        renderedText.includes(
          forbidden
        ),
        false,
        forbidden
      );
    }
  }
);

test(
  "BETA-18 JSON schemas are closed-world",
  () => {
    const inputSchema = readJson(
      "schema/beta18_phase7_input.schema.json"
    );

    const outputSchema = readJson(
      "schema/beta18_phase7_output.schema.json"
    );

    assert.equal(
      inputSchema
        .additionalProperties,
      false
    );

    assert.equal(
      inputSchema.properties
        .phase6_output
        .additionalProperties,
      false
    );

    assert.equal(
      inputSchema.$defs
        .execution_state
        .additionalProperties,
      false
    );

    assert.equal(
      outputSchema
        .additionalProperties,
      false
    );

    assert.deepEqual(
      outputSchema.required,
      [
        "phase7_projection_id",
        "canonical_input_hash",
        "selection_hash",
        "execution_status",
        "execution_state",
        "content_format",
        "rendered_output",
        "projection_hash"
      ]
    );
  }
);

test(
  "BETA-18 failure token contract contains the exact closed token set",
  () => {
    const contract = readJson(
      "engine/contracts/beta18_phase7_failure_tokens.json"
    );

    assert.equal(
      contract.token_surface,
      "closed"
    );

    assert.deepEqual(
      contract.valid_failure_tokens,
      [
        "phase7_binding_mismatch",
        "phase7_forbidden_input",
        "phase7_input_invalid",
        "phase7_output_invalid",
        "phase7_projection_hash_mismatch",
        "phase7_projection_id_missing"
      ]
    );
  }
);

test(
  "BETA-18 fixture manifest is current",
  () => {
    const root = path.join(
      "test",
      "fixtures",
      "beta_18_phase7_schema_binding"
    );

    const manifest = readJson(
      path.join(
        root,
        "manifest.json"
      )
    );

    assert.equal(
      manifest.fixtures.length,
      1
    );

    const entry =
      manifest.fixtures[0];

    const content =
      fs.readFileSync(
        path.join(
          root,
          entry.file
        ),
        "utf8"
      );

    assert.equal(
      sha256(content),
      entry.sha256
    );
  }
);

test(
  "BETA-18 v0 compatibility uses exact Phase 7 path exclusions only",
  () => {
    const source =
      fs.readFileSync(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs",
        "utf8"
      );

    for (const exactPath of [
      "engine/src/phases/beta18Phase7SchemaBinding.ts",
      "engine/contracts/beta18_phase7_failure_tokens.json"
    ]) {
      assert.equal(
        source.includes(
          `"${exactPath}"`
        ),
        true,
        exactPath
      );

      assert.equal(
        source.split(
          `"${exactPath}"`
        ).length - 1,
        1,
        exactPath
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

test(
  "BETA-18 source remains independent of product and presentation modules",
  () => {
    const source =
      fs.readFileSync(
        "engine/src/phases/beta18Phase7SchemaBinding.ts",
        "utf8"
      );

    for (const forbiddenImport of [
      "src/api",
      "server/",
      "public/",
      "copy/",
      "billing",
      "stripe",
      "coachNotes"
    ]) {
      assert.equal(
        source.includes(
          `from "${forbiddenImport}`
        ),
        false,
        forbiddenImport
      );
    }

    assert.equal(
      source.includes(
        'from "./betaCanonical.js"'
      ),
      true
    );
  }
);

test(
  "BETA-18 validation does not mutate admitted input",
  () => {
    const input = clone(
      fixture.phase7_input
    );

    const before =
      betaCanonicalJson(input);

    validateBeta18Phase7Input(
      input
    );

    projectBeta18Phase7(
      input
    );

    assert.equal(
      betaCanonicalJson(input),
      before
    );
  }
);
