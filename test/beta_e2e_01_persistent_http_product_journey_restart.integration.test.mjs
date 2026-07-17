// DEV NOTE: BETA-E2E-01 persistent HTTP product-journey restart gate.
// Every product operation and readback in this proof crosses the HTTP boundary.
// Database configuration is process infrastructure only; this test imports no
// application service, database client or engine implementation.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import {
  spawn
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";

function repoRoot() {
  const currentFile =
    fileURLToPath(
      import.meta.url
    );

  return path.resolve(
    path.dirname(currentFile),
    ".."
  );
}

function delay(milliseconds) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

async function getFreePort() {
  return await new Promise(
    (resolve, reject) => {
      const server =
        net.createServer();

      server.once(
        "error",
        reject
      );

      server.listen(
        0,
        "127.0.0.1",
        () => {
          const address =
            server.address();

          assert.ok(
            address &&
            typeof address === "object",
            "Expected allocated TCP address"
          );

          const port =
            address.port;

          server.close(
            (error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve(port);
            }
          );
        }
      );
    }
  );
}

function spawnNode(
  argumentsList,
  options
) {
  const child =
    spawn(
      process.execPath,
      argumentsList,
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ],
        ...options
      }
    );

  let stdout = "";
  let stderr = "";

  child.stdout.on(
    "data",
    (chunk) => {
      stdout +=
        chunk.toString("utf8");
    }
  );

  child.stderr.on(
    "data",
    (chunk) => {
      stderr +=
        chunk.toString("utf8");
    }
  );

  return {
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

async function waitForExit(
  child
) {
  if (child.exitCode !== null) {
    return {
      code: child.exitCode,
      signal:
        child.signalCode ?? null
    };
  }

  return await new Promise(
    (resolve) => {
      child.once(
        "exit",
        (code, signal) => {
          resolve({
            code,
            signal:
              signal ?? null
          });
        }
      );
    }
  );
}

async function waitForHealth(
  processRecord,
  baseUrl,
  timeoutMilliseconds = 15000
) {
  const deadline =
    Date.now() +
    timeoutMilliseconds;

  let lastError = null;

  while (
    Date.now() <
    deadline
  ) {
    if (
      processRecord.child
        .exitCode !== null
    ) {
      const exit =
        await waitForExit(
          processRecord.child
        );

      throw new Error(
        [
          "Server exited before health became ready.",
          `exit_code=${String(exit.code)}`,
          `signal=${String(exit.signal)}`,
          "stdout:",
          processRecord.stdout ||
            "<empty>",
          "stderr:",
          processRecord.stderr ||
            "<empty>"
        ].join("\n")
      );
    }

    try {
      const response =
        await fetch(
          `${baseUrl}/health`
        );

      if (response.ok) {
        return;
      }

      lastError =
        new Error(
          `Health returned ${response.status}`
        );
    }
    catch (error) {
      lastError = error;
    }

    await delay(120);
  }

  throw new Error(
    [
      "Server did not become healthy.",
      `base_url=${baseUrl}`,
      `last_error=${
        lastError?.message ??
        String(lastError)
      }`,
      "stdout:",
      processRecord.stdout ||
        "<empty>",
      "stderr:",
      processRecord.stderr ||
        "<empty>"
    ].join("\n")
  );
}

async function startServer(
  root,
  environment
) {
  const mainModule =
    path.join(
      root,
      "dist",
      "src",
      "main.js"
    );

  await fs.access(mainModule);

  const port =
    await getFreePort();

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const processRecord =
    spawnNode(
      [mainModule],
      {
        cwd: root,
        env: {
          ...environment,
          PORT: String(port)
        }
      }
    );

  await waitForHealth(
    processRecord,
    baseUrl
  );

  return {
    ...processRecord,
    baseUrl,
    port
  };
}

async function stopServer(
  server
) {
  if (
    !server?.child ||
    server.child.exitCode !== null
  ) {
    return;
  }

  if (
    process.platform === "win32"
  ) {
    server.child.kill();
  }
  else {
    server.child.kill(
      "SIGTERM"
    );
  }

  await Promise.race([
    waitForExit(
      server.child
    ),
    delay(3000)
  ]);

  if (
    server.child.exitCode === null
  ) {
    server.child.kill(
      "SIGKILL"
    );

    await Promise.race([
      waitForExit(
        server.child
      ),
      delay(2000)
    ]);
  }
}

async function restartServer(
  currentServer,
  root,
  environment
) {
  await stopServer(
    currentServer
  );

  return await startServer(
    root,
    environment
  );
}

async function requestJson(
  baseUrl,
  method,
  route,
  body
) {
  const headers = {};

  if (
    typeof body !==
    "undefined"
  ) {
    headers[
      "content-type"
    ] = "application/json";
  }

  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method,
        headers,
        body:
          typeof body ===
          "undefined"
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
    // Raw response remains available for assertion output.
  }

  return {
    response,
    text,
    json
  };
}

function assertStatus(
  result,
  expectedStatus,
  label
) {
  assert.equal(
    result.response.status,
    expectedStatus,
    `${label}: expected ${expectedStatus}, received ${result.response.status}. raw=${result.text}`
  );

  assert.ok(
    result.json &&
    typeof result.json ===
      "object",
    `${label}: expected JSON object. raw=${result.text}`
  );
}

function assertOk(
  result,
  label
) {
  assert.equal(
    result.json?.ok,
    true,
    `${label}: expected ok=true. raw=${result.text}`
  );
}

function snapshotReadback(
  state,
  events,
  history,
  coachArtefacts
) {
  return {
    state:
      state.json,
    events:
      events.json,
    history:
      history.json,
    coach_artefacts:
      coachArtefacts.json
  };
}

test(
  "BETA-E2E-01 complete HTTP product journey survives a fresh process restart",
  async (testContext) => {
    const root =
      repoRoot();

    const databaseUrl =
      process.env.DATABASE_URL;

    assert.ok(
      typeof databaseUrl ===
        "string" &&
      databaseUrl.trim().length > 0,
      "BETA-E2E-01 restart gate requires DATABASE_URL"
    );

    const environment = {
      ...process.env,
      DATABASE_URL:
        databaseUrl
    };

    delete environment.SMOKE_NO_DB;

    const nonce =
      crypto
        .randomUUID()
        .replaceAll("-", "");

    const athleteUserId =
      `beta_e2e_restart_athlete_${nonce}`;

    const coachUserId =
      `beta_e2e_restart_coach_${nonce}`;

    const unassignedCoachUserId =
      `beta_e2e_restart_unassigned_${nonce}`;

    const relationshipId =
      `beta_e2e_restart_relationship_${nonce}`;

    const phase1Input = {
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
    };

    let server =
      await startServer(
        root,
        environment
      );

    testContext.after(
      async () => {
        await stopServer(
          server
        );
      }
    );

    const firstProcessId =
      server.child.pid;

    const auth =
      await requestJson(
        server.baseUrl,
        "POST",
        "/sessions/beta-auth",
        {
          user_id:
            athleteUserId,
          email:
            `${athleteUserId}@example.com`,
          display_name:
            "Restart Gate Athlete",
          account_role:
            "athlete",
          account_state:
            "active",
          accepted_terms_version:
            "terms_v1",
          created_at_iso8601:
            "2026-07-17T14:00:00.000Z"
        }
      );

    assertStatus(
      auth,
      201,
      "athlete auth"
    );

    assertOk(
      auth,
      "athlete auth"
    );

    const acknowledgement =
      await requestJson(
        server.baseUrl,
        "POST",
        "/sessions/beta-acknowledgement",
        {
          acknowledgement_id:
            `beta_e2e_restart_ack_${nonce}`,
          user_id:
            athleteUserId,
          beta_id:
            "september_beta_2026",
          accepted:
            true,
          jurisdiction_acknowledged:
            true,
          accepted_at_iso8601:
            "2026-07-17T14:01:00.000Z",
          copy_acknowledgement_id:
            "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
        }
      );

    assertStatus(
      acknowledgement,
      201,
      "acknowledgement"
    );

    assertOk(
      acknowledgement,
      "acknowledgement"
    );

    const declaration =
      await requestJson(
        server.baseUrl,
        "POST",
        "/sessions/beta-declaration",
        {
          declaration_id:
            `beta_e2e_restart_declaration_${nonce}`,
          user_id:
            athleteUserId,
          phase1_input:
            phase1Input,
          jurisdiction_acknowledged:
            true,
          declared_at_iso8601:
            "2026-07-17T14:02:00.000Z",
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

    assertOk(
      declaration,
      "declaration"
    );

    for (
      const currentCoachUserId of [
        coachUserId,
        unassignedCoachUserId
      ]
    ) {
      const coachProfile =
        await requestJson(
          server.baseUrl,
          "POST",
          "/sessions/beta-coach-profile",
          {
            coach_user_id:
              currentCoachUserId,
            email:
              `${currentCoachUserId}@example.com`,
            display_name:
              "Restart Gate Coach",
            account_role:
              "coach",
            account_state:
              "active",
            accepted_terms_version:
              "terms_v1",
            created_at_iso8601:
              "2026-07-17T14:03:00.000Z"
          }
        );

      assertStatus(
        coachProfile,
        201,
        "coach profile"
      );

      assertOk(
        coachProfile,
        "coach profile"
      );
    }

    const relationship =
      await requestJson(
        server.baseUrl,
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
            "2026-07-17T14:04:00.000Z",
          created_at_iso8601:
            "2026-07-17T14:04:00.000Z",
          updated_at_iso8601:
            "2026-07-17T14:04:00.000Z",
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

    assertOk(
      relationship,
      "relationship"
    );

    const assignment =
      await requestJson(
        server.baseUrl,
        "POST",
        "/sessions/beta-coach-assignment",
        {
          request_id:
            `beta_e2e_restart_assignment_request_${nonce}`,
          requested_at_iso8601:
            "2026-07-17T14:05:00.000Z",
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

    assertOk(
      assignment,
      "stored assignment"
    );

    const assignmentId =
      assignment.json
        ?.assignment
        ?.assignment_id;

    assert.equal(
      typeof assignmentId,
      "string",
      "Assignment response must contain assignment_id"
    );

    const compile =
      await requestJson(
        server.baseUrl,
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
      assignmentId
    );

    const sessionId =
      compile.json?.session_id;

    assert.equal(
      typeof sessionId,
      "string",
      "Compile response must contain session_id"
    );

    const exercises =
      compile.json
        ?.planned_session
        ?.exercises;

    assert.ok(
      Array.isArray(exercises) &&
      exercises.length > 0,
      "Compile response must contain exercises"
    );

    const firstExerciseId =
      exercises[0]?.exercise_id;

    assert.equal(
      typeof firstExerciseId,
      "string",
      "First exercise must have an exercise_id"
    );

    const start =
      await requestJson(
        server.baseUrl,
        "POST",
        `/sessions/${sessionId}/start`,
        {}
      );

    assertStatus(
      start,
      200,
      "session start"
    );

    const completion =
      await requestJson(
        server.baseUrl,
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
      "exercise completion"
    );

    const stateBefore =
      await requestJson(
        server.baseUrl,
        "GET",
        `/sessions/${sessionId}/state`
      );

    assertStatus(
      stateBefore,
      200,
      "state before restart"
    );

    const eventsBefore =
      await requestJson(
        server.baseUrl,
        "GET",
        `/sessions/${sessionId}/events`
      );

    assertStatus(
      eventsBefore,
      200,
      "events before restart"
    );

    assert.equal(
      eventsBefore.json
        ?.events
        ?.length,
      2,
      "Expected start and completion events before restart"
    );

    const historyBefore =
      await requestJson(
        server.baseUrl,
        "POST",
        "/sessions/beta-athlete-history",
        {
          athlete_user_id:
            athleteUserId
        }
      );

    assertStatus(
      historyBefore,
      200,
      "history before restart"
    );

    assert.equal(
      historyBefore.json
        ?.session_count,
      1
    );

    assert.equal(
      historyBefore.json
        ?.sessions?.[0]
        ?.session_id,
      sessionId
    );

    assert.equal(
      historyBefore.json
        ?.sessions?.[0]
        ?.assignment_id,
      assignmentId
    );

    const artefactsBefore =
      await requestJson(
        server.baseUrl,
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
      artefactsBefore,
      200,
      "coach artefacts before restart"
    );

    assert.equal(
      artefactsBefore.json
        ?.artefact_view
        ?.artefact_count,
      1
    );

    assert.equal(
      artefactsBefore.json
        ?.artefact_view
        ?.artefacts?.[0]
        ?.session_id,
      sessionId
    );

    const beforeRestart =
      snapshotReadback(
        stateBefore,
        eventsBefore,
        historyBefore,
        artefactsBefore
      );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    assert.notEqual(
      server.child.pid,
      firstProcessId,
      "Restart must use a new operating-system process"
    );

    const stateAfter =
      await requestJson(
        server.baseUrl,
        "GET",
        `/sessions/${sessionId}/state`
      );

    assertStatus(
      stateAfter,
      200,
      "state after restart"
    );

    const eventsAfter =
      await requestJson(
        server.baseUrl,
        "GET",
        `/sessions/${sessionId}/events`
      );

    assertStatus(
      eventsAfter,
      200,
      "events after restart"
    );

    const historyAfter =
      await requestJson(
        server.baseUrl,
        "POST",
        "/sessions/beta-athlete-history",
        {
          athlete_user_id:
            athleteUserId
        }
      );

    assertStatus(
      historyAfter,
      200,
      "history after restart"
    );

    const artefactsAfter =
      await requestJson(
        server.baseUrl,
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
      artefactsAfter,
      200,
      "coach artefacts after restart"
    );

    const afterRestart =
      snapshotReadback(
        stateAfter,
        eventsAfter,
        historyAfter,
        artefactsAfter
      );

    assert.deepEqual(
      afterRestart,
      beforeRestart,
      "Persistent HTTP readbacks changed across fresh-process restart"
    );

    const denied =
      await requestJson(
        server.baseUrl,
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
      "unassigned coach after restart"
    );

    assert.equal(
      denied.json?.ok,
      false
    );

    assert.match(
      String(
        denied.json?.reason
      ),
      /relationship|assignment|access_denied/u
    );
  }
);