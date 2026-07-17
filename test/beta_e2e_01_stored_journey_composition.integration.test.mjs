
// DEV NOTE: BETA-E2E-01 stored HTTP journey composition proof.
// Product operations use HTTP. Direct database access is limited to isolated
// fixture cleanup; the final restart gate will contain no DB journey shortcut.

import assert from "node:assert/strict";
import test from "node:test";

import {
  app
} from "../dist/src/server.js";

import {
  pool
} from "../dist/src/db/pool.js";

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

async function requestJson(
  baseUrl,
  method,
  route,
  body
) {
  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method,
        headers: {
          "content-type":
            "application/json"
        },
        body:
          typeof body === "undefined"
            ? undefined
            : JSON.stringify(body)
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
    // Raw response remains in text.
  }

  return {
    response,
    text,
    json
  };
}

function assertStatus(
  result,
  status,
  label
) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

test(
  "BETA-E2E-01 stored records drive compile history and coach artefacts",
  async () => {
    const nonce =
      `${process.pid}_${Date.now()}`;

    const athleteUserId =
      `beta_e2e_subject_${nonce}`;

    const coachUserId =
      `beta_e2e_coach_${nonce}`;

    const unassignedCoachUserId =
      `beta_e2e_unassigned_${nonce}`;

    const relationshipId =
      `beta_e2e_relationship_${nonce}`;

    let blockId = null;
    let server = null;

    const cleanup = async () => {
      if (blockId) {
        await pool.query(
          "DELETE FROM blocks WHERE block_id = $1",
          [
            blockId
          ]
        );
      }

      await pool.query(
        `
        DELETE FROM beta_product_records
        WHERE
          subject_user_id = ANY($1::text[])
          OR actor_user_id = ANY($1::text[])
        `,
        [[
          athleteUserId,
          coachUserId,
          unassignedCoachUserId
        ]]
      );
    };

    try {
      await cleanup();

      server =
        await listen();

      const address =
        server.address();

      assert.ok(
        address &&
        typeof address === "object"
      );

      const baseUrl =
        `http://127.0.0.1:${address.port}`;

      const phase1Input = {
        consent_granted: true,
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
        nd_mode: false,
        instruction_density:
          "standard",
        exposure_prompt_density:
          "standard",
        bias_mode:
          "none"
      };

      const auth =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-auth",
          {
            user_id:
              athleteUserId,
            email:
              `${athleteUserId}@example.com`,
            display_name:
              "Persistent Athlete",
            account_role:
              "athlete",
            account_state:
              "active",
            accepted_terms_version:
              "terms_v1",
            created_at_iso8601:
              "2026-07-17T13:00:00.000Z"
          }
        );

      assertStatus(
        auth,
        201,
        "athlete auth"
      );

      const acknowledgement =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-acknowledgement",
          {
            acknowledgement_id:
              `ack_${nonce}`,
            user_id:
              athleteUserId,
            beta_id:
              "september_beta_2026",
            accepted: true,
            jurisdiction_acknowledged:
              true,
            accepted_at_iso8601:
              "2026-07-17T13:01:00.000Z",
            copy_acknowledgement_id:
              "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
          }
        );

      assertStatus(
        acknowledgement,
        201,
        "acknowledgement"
      );

      const declaration =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-declaration",
          {
            declaration_id:
              `declaration_${nonce}`,
            user_id:
              athleteUserId,
            phase1_input:
              phase1Input,
            jurisdiction_acknowledged:
              true,
            declared_at_iso8601:
              "2026-07-17T13:02:00.000Z",
            accepted_terms_version:
              "terms_v1",
            copy_acknowledgement_id:
              "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
          }
        );

      assertStatus(
        declaration,
        201,
        "declaration"
      );

      for (
        const currentCoachUserId of [
          coachUserId,
          unassignedCoachUserId
        ]
      ) {
        const profile =
          await requestJson(
            baseUrl,
            "POST",
            "/sessions/beta-coach-profile",
            {
              coach_user_id:
                currentCoachUserId,
              email:
                `${currentCoachUserId}@example.com`,
              display_name:
                "Persistent Coach",
              account_role:
                "coach",
              account_state:
                "active",
              accepted_terms_version:
                "terms_v1",
              created_at_iso8601:
                "2026-07-17T13:03:00.000Z"
            }
          );

        assertStatus(
          profile,
          201,
          "coach profile"
        );
      }

      const relationship =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-coach-relationship",
          {
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
              "2026-07-17T13:04:00.000Z",
            created_at_iso8601:
              "2026-07-17T13:04:00.000Z",
            updated_at_iso8601:
              "2026-07-17T13:04:00.000Z",
            revoked_at_iso8601:
              null,
            expires_at_iso8601:
              null
          }
        );

      assertStatus(
        relationship,
        201,
        "relationship"
      );

      const assignment =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-coach-assignment",
          {
            request_id:
              `request_${nonce}`,
            requested_at_iso8601:
              "2026-07-17T13:05:00.000Z",
            coach_user_id:
              coachUserId,
            athlete_user_id:
              athleteUserId,
            template_id:
              "beta_template_powerlifting_001",
            activity_id:
              "powerlifting"
          }
        );

      assertStatus(
        assignment,
        201,
        "stored assignment"
      );

      assert.equal(
        assignment.json?.assignment
          ?.assigned_by_coach_id,
        coachUserId
      );

      const compile =
        await requestJson(
          baseUrl,
          "POST",
          "/blocks/compile?create_session=true&beta_path=true",
          {
            phase1_input:
              phase1Input,
            beta_user_id:
              athleteUserId,
            beta_coach_user_id:
              coachUserId
          }
        );

      assertStatus(
        compile,
        201,
        "stored compile"
      );

      assert.equal(
        compile.json?.beta_path
          ?.admission_source,
        "stored_product_records"
      );

      assert.equal(
        compile.json?.beta_path
          ?.assignment_id,
        assignment.json?.assignment
          ?.assignment_id
      );

      blockId =
        compile.json?.block_id;

      const sessionId =
        compile.json?.session_id;

      assert.equal(
        typeof blockId,
        "string"
      );

      assert.equal(
        typeof sessionId,
        "string"
      );

      const exercises =
        compile.json?.planned_session
          ?.exercises;

      assert.ok(
        Array.isArray(exercises) &&
        exercises.length > 0
      );

      const firstExerciseId =
        exercises[0].exercise_id;

      const start =
        await requestJson(
          baseUrl,
          "POST",
          `/sessions/${sessionId}/start`
        );

      assertStatus(
        start,
        200,
        "session start"
      );

      const completion =
        await requestJson(
          baseUrl,
          "POST",
          `/sessions/${sessionId}/events`,
          {
            event: {
              type:
                "COMPLETE_EXERCISE",
              exercise_id:
                firstExerciseId
            }
          }
        );

      assertStatus(
        completion,
        201,
        "runtime completion"
      );

      const history =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-athlete-history",
          {
            athlete_user_id:
              athleteUserId
          }
        );

      assertStatus(
        history,
        200,
        "athlete history"
      );

      assert.equal(
        history.json?.session_count,
        1
      );

      assert.equal(
        history.json?.sessions?.[0]
          ?.session_id,
        sessionId
      );

      assert.equal(
        history.json?.sessions?.[0]
          ?.assignment_id,
        assignment.json?.assignment
          ?.assignment_id
      );

      assert.equal(
        history.json?.sessions?.[0]
          ?.runtime_event_count,
        2
      );

      const coachArtefacts =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-coach-artefacts",
          {
            coach_user_id:
              coachUserId,
            athlete_user_id:
              athleteUserId
          }
        );

      assertStatus(
        coachArtefacts,
        200,
        "stored coach artefacts"
      );

      assert.equal(
        coachArtefacts.json
          ?.artefact_view
          ?.artefact_count,
        1
      );

      assert.equal(
        coachArtefacts.json
          ?.artefact_view
          ?.artefacts?.[0]
          ?.session_id,
        sessionId
      );

      assert.equal(
        coachArtefacts.json
          ?.artefact_view
          ?.artefacts?.[0]
          ?.runtime_event_count,
        2
      );

      const denied =
        await requestJson(
          baseUrl,
          "POST",
          "/sessions/beta-coach-artefacts",
          {
            coach_user_id:
              unassignedCoachUserId,
            athlete_user_id:
              athleteUserId
          }
        );

      assertStatus(
        denied,
        403,
        "unassigned coach"
      );

      assert.equal(
        denied.json?.ok,
        false
      );
    }
    finally {
      await closeServer(server);
      await cleanup();
      await pool.end();
    }
  }
);
