// DEV NOTE: BETA-17 coach-managed path, permission and engine-isolation proof.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  beta17CoachManagedContract,
  buildBeta17CoachArtefactView,
  createBeta17AssignmentRecord,
  createBeta17CoachNoteRecord,
  createBeta17CoachProfileRecord,
  createBeta17RelationshipRecord,
  stableBeta17CoachManagedJson
} from "../dist/src/api/beta17_coach_managed_service.js";

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

const fixture = readJson(
  "test/fixtures/beta_17_coach_managed_path/clean_coach_managed_path.json"
);

const beta16Fixture = readJson(
  "test/fixtures/beta_16_app_path_phase1_6/clean_individual_user.json"
);

function createProfile() {
  const result =
    createBeta17CoachProfileRecord(
      clone(
        fixture.coach_profile_input
      )
    );

  assert.equal(result.status, 201);
  return result.body.coach_profile;
}

function createRelationship(input) {
  const result =
    createBeta17RelationshipRecord(
      clone(input)
    );

  assert.equal(result.status, 201);
  return result.body.relationship;
}

function acceptedContext() {
  return {
    coachProfile: createProfile(),
    relationship:
      createRelationship(
        fixture
          .accepted_relationship_input
      )
  };
}

function compilePhase1To6(
  phase1Input
) {
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
  "BETA-17 exposes a bounded coach-managed product path",
  () => {
    assert.equal(
      beta17CoachManagedContract
        .surface_id,
      "beta17_coach_managed_path"
    );

    assert.equal(
      beta17CoachManagedContract
        .execution_scope,
      "coach_managed"
    );

    assert.equal(
      beta17CoachManagedContract
        .coach_state_engine_visible,
      false
    );

    assert.equal(
      beta17CoachManagedContract
        .notes_non_binding,
      true
    );
  }
);

test(
  "BETA-17 active coach profile remains product-auth state only",
  () => {
    const profile = createProfile();

    assert.equal(
      profile.account_role,
      "coach"
    );

    assert.equal(
      profile.account_state,
      "active"
    );

    assert.equal(
      profile.product_auth_state_only,
      true
    );

    assert.equal(
      profile.engine_visible,
      false
    );

    assert.equal(
      profile
        .can_edit_athlete_declaration,
      false
    );

    assert.equal(
      profile.can_alter_registries,
      false
    );

    assert.equal(
      profile
        .can_override_engine_decisions,
      false
    );
  }
);

test(
  "BETA-17 records invited and accepted individual relationships",
  () => {
    const invited =
      createRelationship(
        fixture
          .invited_relationship_input
      );

    assert.equal(
      invited.relationship_state,
      "invited"
    );

    const accepted =
      createRelationship(
        fixture
          .accepted_relationship_input
      );

    assert.equal(
      accepted.relationship_state,
      "accepted"
    );

    assert.equal(
      accepted.engine_visible,
      false
    );
  }
);

test(
  "BETA-17 accepted coach can record assignment trigger",
  () => {
    const {
      coachProfile,
      relationship
    } = acceptedContext();

    const result =
      createBeta17AssignmentRecord({
        ...clone(
          fixture.assignment_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    assert.equal(result.status, 201);

    const assignment =
      result.body.assignment;

    assert.equal(
      assignment.assignment_status,
      "assigned"
    );

    assert.equal(
      assignment.upstream_contract,
      "S-V1-28"
    );

    assert.equal(
      assignment
        .assignment_mutates_engine_truth,
      false
    );

    assert.equal(
      assignment
        .athlete_declaration_mutated,
      false
    );

    assert.equal(
      assignment.registries_mutated,
      false
    );

    assert.equal(
      assignment
        .engine_decision_overridden,
      false
    );
  }
);

test(
  "BETA-17 accepted coach can view factual artefact records",
  () => {
    const {
      coachProfile,
      relationship
    } = acceptedContext();

    const result =
      buildBeta17CoachArtefactView({
        coach_profile:
          coachProfile,
        relationship,
        athlete_user_id:
          "beta_user_001",
        artefacts: [
          clone(fixture.artefact)
        ]
      });

    assert.equal(result.status, 200);

    const view =
      result.body.artefact_view;

    assert.equal(
      view.artefact_count,
      1
    );

    assert.equal(
      view.artefacts[0]
        .runtime_event_count,
      2
    );

    assert.equal(
      view.read_only,
      true
    );

    assert.equal(
      view.calls_engine,
      false
    );

    assert.equal(
      view.coach_notes_stored_separately,
      true
    );

    assert.equal(
      JSON.stringify(view).includes(
        "note_text"
      ),
      false
    );
  }
);

test(
  "BETA-17 accepted coach can record exact non-binding note",
  () => {
    const {
      coachProfile,
      relationship
    } = acceptedContext();

    const result =
      createBeta17CoachNoteRecord({
        ...clone(
          fixture.note_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    assert.equal(result.status, 201);

    const note =
      result.body.coach_note;

    assert.equal(
      note.note_text,
      fixture.note_input.note_text
    );

    assert.equal(
      note.non_binding,
      true
    );

    assert.equal(
      note
        .stored_separately_from_artefact,
      true
    );

    assert.equal(
      note.included_in_engine_input,
      false
    );

    assert.equal(
      note.included_in_compile_hash,
      false
    );

    assert.equal(
      note.changes_engine_output,
      false
    );
  }
);

test(
  "BETA-17 invited relationship blocks assignment view and note access",
  () => {
    const coachProfile =
      createProfile();

    const relationship =
      createRelationship(
        fixture
          .invited_relationship_input
      );

    const assignment =
      createBeta17AssignmentRecord({
        ...clone(
          fixture.assignment_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    const view =
      buildBeta17CoachArtefactView({
        coach_profile:
          coachProfile,
        relationship,
        athlete_user_id:
          "beta_user_001",
        artefacts: [
          clone(fixture.artefact)
        ]
      });

    const note =
      createBeta17CoachNoteRecord({
        ...clone(
          fixture.note_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    assert.equal(
      assignment.status,
      403
    );

    assert.equal(view.status, 403);
    assert.equal(note.status, 403);
  }
);

test(
  "BETA-17 revoked relationship blocks all future coach access",
  () => {
    const coachProfile =
      createProfile();

    const relationship =
      createRelationship(
        fixture
          .revoked_relationship_input
      );

    const assignment =
      createBeta17AssignmentRecord({
        ...clone(
          fixture.assignment_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    const view =
      buildBeta17CoachArtefactView({
        coach_profile:
          coachProfile,
        relationship,
        athlete_user_id:
          "beta_user_001",
        artefacts: [
          clone(fixture.artefact)
        ]
      });

    const note =
      createBeta17CoachNoteRecord({
        ...clone(
          fixture.note_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    assert.equal(
      assignment.status,
      403
    );

    assert.equal(view.status, 403);
    assert.equal(note.status, 403);
  }
);

test(
  "BETA-17 coach cannot submit declaration registry or engine override state",
  () => {
    const {
      coachProfile,
      relationship
    } = acceptedContext();

    for (const forbidden of [
      {
        phase1_input: {
          actor_type: "coach"
        }
      },
      {
        registry_bundle: {
          changed: true
        }
      },
      {
        engine_override: {
          decision: "replace"
        }
      }
    ]) {
      const result =
        createBeta17AssignmentRecord({
          ...clone(
            fixture.assignment_input
          ),
          coach_profile:
            coachProfile,
          relationship,
          ...forbidden
        });

      assert.equal(
        result.status,
        400
      );

      assert.equal(
        result.body.failure_token,
        "beta17_coach_managed_invalid"
      );
    }
  }
);

test(
  "BETA-17 coach notes do not alter actual Phase 1-6 output",
  () => {
    const phase1Input =
      beta16Fixture
        .declaration_input
        .phase1_input;

    const before =
      compilePhase1To6(
        phase1Input
      );

    const {
      coachProfile,
      relationship
    } = acceptedContext();

    const note =
      createBeta17CoachNoteRecord({
        ...clone(
          fixture.note_input
        ),
        coach_profile:
          coachProfile,
        relationship
      });

    assert.equal(note.status, 201);

    const after =
      compilePhase1To6(
        phase1Input
      );

    assert.equal(
      stableBeta17CoachManagedJson(
        after
      ),
      stableBeta17CoachManagedJson(
        before
      )
    );
  }
);

test(
  "BETA-17 relationship state does not alter actual Phase 1-6 output",
  () => {
    const phase1Input =
      beta16Fixture
        .declaration_input
        .phase1_input;

    const before =
      compilePhase1To6(
        phase1Input
      );

    createRelationship(
      fixture
        .accepted_relationship_input
    );

    createRelationship(
      fixture
        .revoked_relationship_input
    );

    const after =
      compilePhase1To6(
        phase1Input
      );

    assert.equal(
      stableBeta17CoachManagedJson(
        after
      ),
      stableBeta17CoachManagedJson(
        before
      )
    );
  }
);

test(
  "BETA-17 extends existing routes and existing session runner",
  () => {
    const handlers =
      fs.readFileSync(
        "src/api/sessions.handlers.ts",
        "utf8"
      );

    const routes =
      fs.readFileSync(
        "src/api/sessions.routes.ts",
        "utf8"
      );

    const html =
      fs.readFileSync(
        "public/v0-session-runner.html",
        "utf8"
      );

    const browser =
      fs.readFileSync(
        "public/beta17-coach-managed.js",
        "utf8"
      );

    for (const route of [
      "/beta-coach-profile",
      "/beta-coach-relationship",
      "/beta-coach-assignment",
      "/beta-coach-artefacts",
      "/beta-coach-notes"
    ]) {
      assert.equal(
        (
          handlers +
          routes +
          browser
        ).includes(route),
        true,
        route
      );
    }

    assert.equal(
      html.includes(
        'id="beta17CoachManagedPath"'
      ),
      true
    );

    assert.equal(
      html.includes(
        "/ui/beta17-coach-managed.js"
      ),
      true
    );

    assert.equal(
      fs.existsSync(
        "public/beta17.html"
      ),
      false
    );
  }
);

test(
  "BETA-17 all referenced user copy IDs exist in Copy Registry",
  () => {
    const canonical =
      fs.readFileSync(
        "copy/beta_17_coach_managed_path_copy.json",
        "utf8"
      );

    const publicCopy =
      fs.readFileSync(
        "public/beta_17_coach_managed_path_copy.json",
        "utf8"
      );

    assert.equal(
      publicCopy,
      canonical
    );

    const entries =
      JSON.parse(canonical);

    const registered =
      new Set(
        entries.map(
          (entry) =>
            entry.copy_id
        )
      );

    const sources = [
      fs.readFileSync(
        "public/v0-session-runner.html",
        "utf8"
      ),
      fs.readFileSync(
        "public/beta17-coach-managed.js",
        "utf8"
      ),
      fs.readFileSync(
        "src/api/beta17_coach_managed_service.ts",
        "utf8"
      )
    ];

    const referenced =
      new Set();

    for (const source of sources) {
      for (
        const match of source.matchAll(
          /BETA17_COPY_[A-Z0-9_]+/gu
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
  "BETA-17 user copy remains factual and non-advisory",
  () => {
    const text =
      fs.readFileSync(
        "copy/beta_17_coach_managed_path_copy.json",
        "utf8"
      ).toLowerCase();

    for (const forbidden of [
      "recommendation",
      "recommended",
      "readiness",
      "optimal",
      "optimise",
      "optimize",
      "performance score",
      "safety score",
      "risk score",
      "diagnose",
      "prescribe"
    ]) {
      assert.equal(
        text.includes(forbidden),
        false,
        forbidden
      );
    }
  }
);

test(
  "BETA-17 fixture manifest is current",
  () => {
    const manifest = readJson(
      "test/fixtures/beta_17_coach_managed_path/manifest.json"
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
          "beta_17_coach_managed_path",
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
