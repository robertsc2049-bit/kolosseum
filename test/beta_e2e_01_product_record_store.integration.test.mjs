
// DEV NOTE: BETA-E2E-01 HTTP-backed product-record persistence proof.
// This foundation test may query its own isolated database records directly.
// The final product-journey gate must use HTTP-only readback after restart.

import assert from "node:assert/strict";
import test from "node:test";

import {
  app
} from "../dist/src/server.js";

import {
  pool
} from "../dist/src/db/pool.js";

import {
  loadBeta16StoredCompileContext,
  loadBeta17StoredCoachContext,
  loadLatestBeta17StoredAssignment
} from "../dist/src/api/beta_product_record_store.js";

async function listen() {
  return await new Promise(
    (resolve, reject) => {
      const server =
        app.listen(
          0,
          "127.0.0.1",
          () => resolve(server)
        );

      server.once(
        "error",
        reject
      );
    }
  );
}

async function closeServer(
  server
) {
  if (!server) {
    return;
  }

  await new Promise(
    (resolve, reject) => {
      server.close(
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    }
  );
}

async function postJson(
  baseUrl,
  route,
  body
) {
  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json"
        },
        body: JSON.stringify(body)
      }
    );

  const text =
    await response.text();

  let json = null;

  try {
    json =
      text.length > 0
        ? JSON.parse(text)
        : null;
  }
  catch {
    // Raw text remains available for assertion output.
  }

  return {
    response,
    text,
    json
  };
}

function assertCreated(
  result,
  label
) {
  assert.equal(
    result.response.status,
    201,
    `${label}: expected 201, received ${result.response.status}. raw=${result.text}`
  );

  assert.equal(
    result.json?.ok,
    true,
    `${label}: expected ok=true. raw=${result.text}`
  );
}

test(
  "BETA-E2E-01 existing beta HTTP endpoints persist immutable product records",
  async () => {
    const nonce =
      `${process.pid}_${Date.now()}`;

    const athleteUserId =
      `beta_e2e_athlete_${nonce}`;

    const coachUserId =
      `beta_e2e_coach_${nonce}`;

    const acknowledgementId =
      `beta_e2e_ack_${nonce}`;

    const declarationId =
      `beta_e2e_declaration_${nonce}`;

    const relationshipId =
      `beta_e2e_relationship_${nonce}`;

    const requestId =
      `beta_e2e_assignment_request_${nonce}`;

    const authInput = {
      user_id: athleteUserId,
      email:
        `${athleteUserId}@example.com`,
      display_name:
        "BETA E2E Athlete",
      account_role:
        "athlete",
      account_state:
        "active",
      accepted_terms_version:
        "terms_v1",
      created_at_iso8601:
        "2026-07-17T12:00:00.000Z"
    };

    const acknowledgementInput = {
      acknowledgement_id:
        acknowledgementId,
      user_id:
        athleteUserId,
      beta_id:
        "september_beta_2026",
      accepted:
        true,
      jurisdiction_acknowledged:
        true,
      accepted_at_iso8601:
        "2026-07-17T12:01:00.000Z",
      copy_acknowledgement_id:
        "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
    };

    const declarationInput = {
      declaration_id:
        declarationId,
      user_id:
        athleteUserId,
      phase1_input: {
        consent_granted:
          true,
        engine_version:
          "EB2-1.0.0",
        enum_bundle_version:
          "EB2-1.0.0",
        phase1_schema_version:
          "1.0.0",
        actor_type:
          "athlete",
        execution_scope:
          "individual",
        activity_id:
          "powerlifting",
        nd_mode:
          false,
        instruction_density:
          "standard",
        exposure_prompt_density:
          "standard",
        bias_mode:
          "none"
      },
      jurisdiction_acknowledged:
        true,
      declared_at_iso8601:
        "2026-07-17T12:02:00.000Z",
      accepted_terms_version:
        "terms_v1",
      copy_acknowledgement_id:
        "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
    };

    const coachProfileInput = {
      coach_user_id:
        coachUserId,
      email:
        `${coachUserId}@example.com`,
      display_name:
        "BETA E2E Coach",
      account_role:
        "coach",
      account_state:
        "active",
      accepted_terms_version:
        "terms_v1",
      created_at_iso8601:
        "2026-07-17T12:03:00.000Z"
    };

    const relationshipInput = {
      relationship_id:
        relationshipId,
      coach_user_id:
        coachUserId,
      athlete_user_id:
        athleteUserId,
      relationship_state:
        "accepted",
      relationship_scope:
        "individual_coach_athlete",
      accepted_at_iso8601:
        "2026-07-17T12:04:00.000Z",
      created_at_iso8601:
        "2026-07-17T12:04:00.000Z",
      updated_at_iso8601:
        "2026-07-17T12:04:00.000Z",
      revoked_at_iso8601:
        null,
      expires_at_iso8601:
        null
    };

    const cleanup = async () => {
      await pool.query(
        `
        DELETE FROM beta_product_records
        WHERE
          subject_user_id = $1
          OR actor_user_id = $1
          OR subject_user_id = $2
          OR actor_user_id = $2
        `,
        [
          athleteUserId,
          coachUserId
        ]
      );
    };

    let server = null;

    try {
      await cleanup();

      server =
        await listen();

      const address =
        server.address();

      assert.ok(
        address &&
        typeof address === "object",
        "Expected TCP server address"
      );

      const baseUrl =
        `http://127.0.0.1:${address.port}`;

      const auth =
        await postJson(
          baseUrl,
          "/sessions/beta-auth",
          authInput
        );

      assertCreated(
        auth,
        "athlete auth"
      );

      const acknowledgement =
        await postJson(
          baseUrl,
          "/sessions/beta-acknowledgement",
          acknowledgementInput
        );

      assertCreated(
        acknowledgement,
        "beta acknowledgement"
      );

      const declaration =
        await postJson(
          baseUrl,
          "/sessions/beta-declaration",
          declarationInput
        );

      assertCreated(
        declaration,
        "Phase 1 declaration"
      );

      const coachProfile =
        await postJson(
          baseUrl,
          "/sessions/beta-coach-profile",
          coachProfileInput
        );

      assertCreated(
        coachProfile,
        "coach profile"
      );

      const relationship =
        await postJson(
          baseUrl,
          "/sessions/beta-coach-relationship",
          relationshipInput
        );

      assertCreated(
        relationship,
        "coach-athlete relationship"
      );

      const assignment =
        await postJson(
          baseUrl,
          "/sessions/beta-coach-assignment",
          {
            request_id:
              requestId,
            requested_at_iso8601:
              "2026-07-17T12:05:00.000Z",
            coach_profile:
              coachProfile.json
                .coach_profile,
            relationship:
              relationship.json
                .relationship,
            athlete_user_id:
              athleteUserId,
            template_id:
              "beta_template_powerlifting_001",
            activity_id:
              "powerlifting"
          }
        );

      assertCreated(
        assignment,
        "programme assignment"
      );

      const repeatedAuth =
        await postJson(
          baseUrl,
          "/sessions/beta-auth",
          authInput
        );

      assertCreated(
        repeatedAuth,
        "idempotent repeated auth"
      );

      const compileContext =
        await loadBeta16StoredCompileContext(
          athleteUserId
        );

      assert.ok(
        compileContext,
        "Stored BETA-16 context should exist"
      );

      assert.equal(
        compileContext.auth_record
          .record_sha256,
        auth.json.auth_record
          .record_sha256
      );

      assert.equal(
        compileContext
          .acknowledgement_record
          .record_sha256,
        acknowledgement.json
          .acknowledgement_record
          .record_sha256
      );

      assert.equal(
        compileContext
          .declaration_record
          .record_sha256,
        declaration.json
          .declaration_record
          .record_sha256
      );

      const coachContext =
        await loadBeta17StoredCoachContext(
          coachUserId,
          athleteUserId
        );

      assert.ok(
        coachContext,
        "Stored BETA-17 coach context should exist"
      );

      assert.equal(
        coachContext.coach_profile
          .record_sha256,
        coachProfile.json
          .coach_profile
          .record_sha256
      );

      assert.equal(
        coachContext.relationship
          .record_sha256,
        relationship.json
          .relationship
          .record_sha256
      );

      const storedAssignment =
        await loadLatestBeta17StoredAssignment(
          coachUserId,
          athleteUserId
        );

      assert.ok(
        storedAssignment,
        "Stored assignment should exist"
      );

      assert.equal(
        storedAssignment.record_sha256,
        assignment.json.assignment
          .record_sha256
      );

      const rows =
        await pool.query(
          `
          SELECT
            record_type,
            record_id,
            record_sha256
          FROM beta_product_records
          WHERE
            subject_user_id = $1
            OR actor_user_id = $1
            OR subject_user_id = $2
            OR actor_user_id = $2
          ORDER BY record_type
          `,
          [
            athleteUserId,
            coachUserId
          ]
        );

      const recordTypes =
        rows.rows.map(
          (row) => row.record_type
        );

      assert.deepEqual(
        recordTypes,
        [
          "beta16_acknowledgement",
          "beta16_auth",
          "beta16_phase1_declaration",
          "beta17_assignment_trigger",
          "beta17_coach_profile",
          "beta17_coach_relationship"
        ]
      );

      const authCount =
        await pool.query(
          `
          SELECT count(*) AS count
          FROM beta_product_records
          WHERE
            record_type = 'beta16_auth'
            AND record_id = $1
          `,
          [
            athleteUserId
          ]
        );

      assert.equal(
        Number(
          authCount.rows[0].count
        ),
        1,
        "Repeated identical record must remain idempotent"
      );
    }
    finally {
      await closeServer(server);
      await cleanup();
      await pool.end();
    }
  }
);
