// DEV NOTE: BETA-16 full app-path integration and browser contract proof.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertBeta16CompileAdmission,
  beta16AppPathContract,
  createBeta16AcknowledgementRecord,
  createBeta16AuthRecord,
  createBeta16Phase1DeclarationRecord,
  stableBeta16AppPathJson
} from "../dist/src/api/beta16_app_path_service.js";

import {
  phase1Validate
} from "../engine/dist/src/phases/phase1.js";

import {
  phase2CanonicaliseAndHash
} from "../engine/dist/src/phases/phase2.js";

import {
  phase3ResolveConstraintsAndLoadRegistries
} from "../engine/dist/src/phases/phase3.js";

import {
  phase4AssembleProgram
} from "../engine/dist/src/phases/phase4.js";

import {
  phase6ProduceSessionOutput
} from "../engine/dist/src/phases/phase6.js";

import {
  applyRuntimeEvents
} from "../engine/dist/src/runtime/apply_runtime_event.js";

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      relativePath,
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const fixture = readJson(
  "test/fixtures/beta_16_app_path_phase1_6/clean_individual_user.json"
);

function createProductPath() {
  const auth =
    createBeta16AuthRecord(
      clone(fixture.auth_input)
    );

  assert.equal(auth.status, 201);
  assert.equal(auth.body.ok, true);

  const acknowledgement =
    createBeta16AcknowledgementRecord(
      clone(
        fixture.acknowledgement_input
      )
    );

  assert.equal(
    acknowledgement.status,
    201
  );

  assert.equal(
    acknowledgement.body.ok,
    true
  );

  const declaration =
    createBeta16Phase1DeclarationRecord(
      clone(fixture.declaration_input)
    );

  assert.equal(declaration.status, 201);
  assert.equal(declaration.body.ok, true);

  const context = {
    auth_record:
      auth.body.auth_record,
    acknowledgement_record:
      acknowledgement.body
        .acknowledgement_record,
    declaration_record:
      declaration.body
        .declaration_record
  };

  const admission =
    assertBeta16CompileAdmission(
      context,
      clone(
        fixture.declaration_input
          .phase1_input
      )
    );

  return {
    auth,
    acknowledgement,
    declaration,
    context,
    admission
  };
}

function compilePhase1To6(phase1Input) {
  const phase1 =
    phase1Validate(
      clone(phase1Input)
    );

  assert.equal(phase1.ok, true);

  const phase2 =
    phase2CanonicaliseAndHash(
      phase1.canonical_input
    );

  assert.equal(phase2.ok, true);

  const phase3 =
    phase3ResolveConstraintsAndLoadRegistries(
      phase1.canonical_input,
      {
        canonical_input_hash:
          phase2.phase2
            .canonical_input_hash
      }
    );

  assert.equal(phase3.ok, true);

  const phase4 =
    phase4AssembleProgram(
      phase1.canonical_input,
      phase3.phase3
    );

  assert.equal(phase4.ok, true);

  const phase6 =
    phase6ProduceSessionOutput(
      phase4.program,
      phase1.canonical_input,
      undefined
    );

  assert.equal(phase6.ok, true);

  return {
    phase1,
    phase2,
    phase3,
    phase4,
    phase6
  };
}

test(
  "BETA-16 exposes the bounded app path through Phase 1 to Phase 6",
  () => {
    assert.equal(
      beta16AppPathContract.surface_id,
      "beta16_app_path_phase1_6"
    );

    assert.equal(
      beta16AppPathContract.phase_range,
      "1-6"
    );

    assert.equal(
      beta16AppPathContract
        .execution_only_ui,
      true
    );

    assert.equal(
      beta16AppPathContract
        .factual_counts_only,
      true
    );

    assert.equal(
      beta16AppPathContract
        .extended_phase_ui,
      false
    );

    assert.equal(
      beta16AppPathContract
        .aggregate_reporting,
      false
    );
  }
);

test(
  "BETA-16 clean beta user records auth acknowledgement and Phase 1 declaration",
  () => {
    const pathResult =
      createProductPath();

    assert.equal(
      pathResult.auth.body
        .auth_record.account_role,
      "athlete"
    );

    assert.equal(
      pathResult.auth.body
        .auth_record
        .product_auth_state_only,
      true
    );

    assert.equal(
      pathResult.acknowledgement
        .body
        .acknowledgement_record
        .accepted,
      true
    );

    assert.equal(
      pathResult.declaration
        .body
        .declaration_record
        .declaration_state,
      "accepted"
    );

    assert.equal(
      pathResult.admission.admitted,
      true
    );

    assert.equal(
      pathResult.admission.phase_range,
      "1-6"
    );

    assert.match(
      pathResult.admission
        .declared_input_sha256,
      /^[a-f0-9]{64}$/u
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        pathResult.admission,
        "engine_phase1_input_sha256"
      ),
      false
    );
  }
);

test(
  "BETA-16 compile admission is byte-stable for identical explicit records",
  () => {
    const first = createProductPath();
    const second = createProductPath();

    assert.equal(
      stableBeta16AppPathJson(
        first.admission
      ),
      stableBeta16AppPathJson(
        second.admission
      )
    );
  }
);

test(
  "BETA-16 clean Phase 1 input materialises a Phase 6 session",
  () => {
    const compiled =
      compilePhase1To6(
        fixture.declaration_input
          .phase1_input
      );

    assert.equal(
      compiled.phase6.session.status,
      "ready"
    );

    assert.equal(
      Array.isArray(
        compiled.phase6.session.exercises
      ),
      true
    );

    assert.equal(
      compiled.phase6.session.exercises
        .length > 0,
      true
    );
  }
);

test(
  "BETA-16 Phase 6 execution completes through factual runtime events",
  () => {
    const compiled =
      compilePhase1To6(
        fixture.declaration_input
          .phase1_input
      );

    const exercises =
      compiled.phase6.session.exercises;

    const events = exercises.map(
      (exercise) => ({
        type: "COMPLETE_EXERCISE",
        exercise_id:
          exercise.exercise_id
      })
    );

    const state = applyRuntimeEvents(
      compiled.phase6.session,
      events
    );

    assert.equal(
      state.completed_exercises.length,
      exercises.length
    );

    assert.equal(
      state.remaining_exercises.length,
      0
    );

    assert.equal(
      state.dropped_exercises.length,
      0
    );
  }
);

test(
  "BETA-16 split and return continue preserve execution",
  () => {
    const compiled =
      compilePhase1To6(
        fixture.declaration_input
          .phase1_input
      );

    const exercises =
      compiled.phase6.session.exercises;

    const events = [
      {
        type: "SPLIT_SESSION"
      },
      {
        type: "RETURN_CONTINUE"
      },
      ...exercises.map(
        (exercise) => ({
          type: "COMPLETE_EXERCISE",
          exercise_id:
            exercise.exercise_id
        })
      )
    ];

    const state = applyRuntimeEvents(
      compiled.phase6.session,
      events
    );

    assert.equal(
      state.completed_exercises.length,
      exercises.length
    );

    assert.equal(
      state.remaining_exercises.length,
      0
    );
  }
);

test(
  "BETA-16 split and return skip expose factual partial counts",
  () => {
    const compiled =
      compilePhase1To6(
        fixture.declaration_input
          .phase1_input
      );

    const exercises =
      compiled.phase6.session.exercises;

    assert.equal(
      exercises.length >= 2,
      true
    );

    const state = applyRuntimeEvents(
      compiled.phase6.session,
      [
        {
          type: "COMPLETE_EXERCISE",
          exercise_id:
            exercises[0].exercise_id
        },
        {
          type: "SPLIT_SESSION"
        },
        {
          type: "RETURN_SKIP"
        }
      ]
    );

    assert.equal(
      state.completed_exercises.length,
      1
    );

    assert.equal(
      state.remaining_exercises.length,
      0
    );

    assert.equal(
      state.dropped_exercises.length,
      exercises.length - 1
    );
  }
);

test(
  "BETA-16 compile admission rejects mismatched Phase 1 input",
  () => {
    const pathResult =
      createProductPath();

    const changed =
      clone(
        fixture.declaration_input
          .phase1_input
      );

    changed.activity_id =
      "general_strength";

    assert.throws(
      () =>
        assertBeta16CompileAdmission(
          pathResult.context,
          changed
        ),
      (error) =>
        error?.failure_token ===
          "beta16_app_path_invalid" &&
        error?.reason ===
          "compile_phase1_input_mismatch"
    );
  }
);

test(
  "BETA-16 browser uses existing routes and existing session runner screen",
  () => {
    const html = fs.readFileSync(
      "public/v0-session-runner.html",
      "utf8"
    );

    const browser = fs.readFileSync(
      "public/v0-session-runner.js",
      "utf8"
    );

    const sessionsRoutes =
      fs.readFileSync(
        "src/api/sessions.routes.ts",
        "utf8"
      );

    const blocksHandler =
      fs.readFileSync(
        "src/api/blocks.handlers.ts",
        "utf8"
      );

    for (const marker of [
      "/sessions/beta-auth",
      "/sessions/beta-acknowledgement",
      "/sessions/beta-declaration",
      "/blocks/compile?create_session=true&beta_path=true",
      "/start",
      "/events",
      "/state"
    ]) {
      assert.equal(
        (
          browser +
          sessionsRoutes +
          blocksHandler
        ).includes(marker),
        true,
        marker
      );
    }

    assert.equal(
      html.includes(
        "/ui/v0-session-runner.js"
      ),
      true
    );

    assert.equal(
      fs.existsSync(
        "public/beta-16.html"
      ),
      false
    );
  }
);

test(
  "BETA-16 all referenced browser copy IDs exist in Copy Registry",
  () => {
    const canonical =
      fs.readFileSync(
        "copy/beta_16_app_path_phase1_6_copy.json",
        "utf8"
      );

    const publicCopy =
      fs.readFileSync(
        "public/beta_16_app_path_phase1_6_copy.json",
        "utf8"
      );

    assert.equal(publicCopy, canonical);

    const entries =
      JSON.parse(canonical);

    const registered = new Set(
      entries.map(
        (entry) => entry.copy_id
      )
    );

    const sources = [
      fs.readFileSync(
        "public/v0-session-runner.html",
        "utf8"
      ),
      fs.readFileSync(
        "public/v0-session-runner.js",
        "utf8"
      ),
      fs.readFileSync(
        "src/api/beta16_app_path_service.ts",
        "utf8"
      )
    ];

    const referenced = new Set();

    for (const source of sources) {
      for (
        const match of source.matchAll(
          /BETA16_COPY_[A-Z0-9_]+/gu
        )
      ) {
        referenced.add(match[0]);
      }
    }

    for (const copyId of referenced) {
      assert.equal(
        registered.has(copyId),
        true,
        copyId
      );
    }
  }
);

test(
  "BETA-16 Copy Registry and browser remain factual and claim-bounded",
  () => {
    const copyText =
      fs.readFileSync(
        "copy/beta_16_app_path_phase1_6_copy.json",
        "utf8"
      ).toLowerCase();

    const html =
      fs.readFileSync(
        "public/v0-session-runner.html",
        "utf8"
      ).toLowerCase();

    const browser =
      fs.readFileSync(
        "public/v0-session-runner.js",
        "utf8"
      ).toLowerCase();

    for (const forbidden of [
      "dashboard",
      "analytics",
      "readiness",
      "recommendation",
      "recommended",
      "performance",
      "safety score",
      "risk score",
      "optimal",
      "% complete",
      "phase 7",
      "phase 8"
    ]) {
      assert.equal(
        (
          copyText +
          html +
          browser
        ).includes(forbidden),
        false,
        forbidden
      );
    }

    for (const removedInline of [
      "kolosseum v0 session runner",
      "minimal browser runner",
      "compile + create session",
      "no completed exercises yet."
    ]) {
      assert.equal(
        (
          html +
          browser
        ).includes(removedInline),
        false,
        removedInline
      );
    }
  }
);

test(
  "BETA-16 fixture manifest is current",
  () => {
    const manifest = readJson(
      "test/fixtures/beta_16_app_path_phase1_6/manifest.json"
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
          "test",
          "fixtures",
          "beta_16_app_path_phase1_6",
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
  "BETA-16 v0 scope compatibility keeps the app service actively scanned",
  () => {
    const core = fs.readFileSync(
      "ci/scripts/kolosseum_v0_test_suite_core.mjs",
      "utf8"
    );

    const establishedDormantPaths = [
      "src/v1ProofArtefactViewContract.mjs",
      "src/v1GdprExportHandling.mjs",
      "src/v1ExportBoundaryContract.mjs",
      "src/v1AthleteDashboardShell.mjs",
      "src/coachDashboardShell.mjs",
      "src/api/coachDashboardShellApi.mjs"
    ];

    for (
      const dormantPath
      of establishedDormantPaths
    ) {
      assert.equal(
        core.includes(
          JSON.stringify(dormantPath)
        ),
        true,
        dormantPath
      );
    }

    assert.equal(
      core.includes(
        JSON.stringify(
          "src/api/beta16_app_path_service.ts"
        )
      ),
      false
    );
  }
);
