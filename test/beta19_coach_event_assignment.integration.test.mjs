import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function request(baseUrl, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function dateOnlyFromNow(offset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function workItems() {
  return [
    ["back_squat", 75],
    ["bench_press", 75],
    ["deadlift", 70],
    ["overhead_press", 65]
  ].map(([exerciseId, percent], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: index === 0 ? 4 : 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 5 : 8,
    rep_max: index === 0 ? 5 : 8,
    load_mode: "percent_1rm",
    percent_1rm: percent,
    weight_value: 20,
    weight_unit: "kg",
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory"
  }));
}

test("standalone coach event links through athlete profile and reaches compile output", async () => {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const coachUserId = `beta19_event_coach_${nonce}`;
  const athleteUserId = `beta19_event_athlete_${nonce}`;
  const relationshipId = `beta19_event_relationship_${nonce}`;
  let blockId = null;
  let server = null;

  const cleanup = async () => {
    if (blockId) {
      await pool.query("DELETE FROM sessions WHERE block_id = $1", [blockId]);
      await pool.query("DELETE FROM blocks WHERE block_id = $1", [blockId]);
    }
    await pool.query(
      `
      DELETE FROM beta_product_records
      WHERE subject_user_id = ANY($1::text[])
         OR actor_user_id = ANY($1::text[])
      `,
      [[coachUserId, athleteUserId]]
    );
  };

  try {
    await cleanup();
    server = await listen();
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const timestamp = new Date().toISOString();
    const phase1Input = {
      consent_granted: true,
      engine_version: "EB2-1.0.0",
      enum_bundle_version: "EB2-1.0.0",
      phase1_schema_version: "1.0.0",
      actor_type: "athlete",
      execution_scope: "individual",
      activity_id: "powerlifting",
      nd_mode: false,
      instruction_density: "standard",
      exposure_prompt_density: "standard",
      bias_mode: "none"
    };

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-profile", {
      coach_user_id: coachUserId,
      email: `${coachUserId}@example.com`,
      display_name: "Event Workspace Coach",
      account_role: "coach",
      account_state: "active",
      accepted_terms_version: "terms_v1",
      created_at_iso8601: timestamp
    }), 201, "coach profile");

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-auth", {
      user_id: athleteUserId,
      email: `${athleteUserId}@example.com`,
      display_name: "Event Workspace Athlete",
      account_role: "athlete",
      account_state: "active",
      accepted_terms_version: "terms_v1",
      created_at_iso8601: timestamp
    }), 201, "athlete auth");

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-acknowledgement", {
      acknowledgement_id: `ack_${nonce}`,
      user_id: athleteUserId,
      beta_id: "september_beta_2026",
      accepted: true,
      jurisdiction_acknowledged: true,
      accepted_at_iso8601: timestamp,
      copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
    }), 201, "acknowledgement");

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-declaration", {
      declaration_id: `declaration_${nonce}`,
      user_id: athleteUserId,
      phase1_input: phase1Input,
      jurisdiction_acknowledged: true,
      declared_at_iso8601: timestamp,
      accepted_terms_version: "terms_v1",
      copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
    }), 201, "declaration");

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: relationshipId,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      relationship_state: "accepted",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: timestamp,
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp,
      revoked_at_iso8601: null,
      expires_at_iso8601: null
    }), 201, "relationship");

    assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      preferred_weight_unit: "kg",
      load_rounding_increment: 2.5,
      bodyweight: 90,
      bodyweight_unit: "kg",
      benchmarks: [
        ["back_squat", 160],
        ["bench_press", 110],
        ["deadlift", 200],
        ["overhead_press", 70]
      ].map(([exerciseId, value]) => ({
        benchmark_id: "",
        exercise_id: exerciseId,
        value,
        unit: "kg",
        basis: "tested_1rm",
        effective_date: dateOnlyFromNow(0),
        source_note: "Standalone event integration proof"
      })),
      expected_current_record_sha256: null
    }), 201, "strength profile");

    const event = await request(baseUrl, "POST", "/coach-workspace/events", {
      coach_user_id: coachUserId,
      event_id: "",
      event_name: "Standalone Test Meet",
      activity_id: "powerlifting",
      event_type: "powerlifting_meet",
      programme_start_date: dateOnlyFromNow(1),
      event_date: dateOnlyFromNow(15),
      location: "Mansfield",
      timezone: "Europe/London",
      notes: "Factual integration event",
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp
    });
    assertStatus(event, 201, "standalone event");
    const eventId = event.json?.event?.event_id;
    assert.ok(eventId);
    assert.equal(event.json?.event?.event_compile_summary?.required_week_count, 2);

    const template = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "Two Week Event Programme",
      description: "Standalone event assignment integration proof.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [{
        block_id: "",
        order_index: 1,
        name: "Two Week Block",
        description: "",
        block_type: "strength",
        week_count: 2,
        weeks: [1, 2].map((week) => ({
          week_id: "",
          order_index: week,
          sessions: [{
            session_id: "",
            order_index: 1,
            title: `Week ${week} Session`,
            work_items: workItems()
          }]
        }))
      }],
      updated_at_iso8601: timestamp
    });
    assertStatus(template, 201, "programme draft");
    const templateId = template.json?.template?.template_id;
    assert.ok(templateId);

    assertStatus(await request(
      baseUrl,
      "POST",
      `/templates/${encodeURIComponent(templateId)}/activate`,
      { coach_user_id: coachUserId }
    ), 200, "programme activation");

    const assignment = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `request_${nonce}`,
      requested_at_iso8601: timestamp,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: eventId
    });
    assertStatus(assignment, 201, "profile assignment");
    assert.equal(assignment.json?.event_link?.event_id, eventId);
    assert.equal(assignment.json?.event_link?.template_id, templateId);

    const links = await request(
      baseUrl,
      "GET",
      `/coach-workspace/athlete-event-links?coach_user_id=${encodeURIComponent(coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`
    );
    assertStatus(links, 200, "athlete event links");
    assert.equal(links.json?.links?.length, 1);

    const compile = await request(
      baseUrl,
      "POST",
      "/blocks/compile?create_session=true&beta_path=true",
      {
        phase1_input: phase1Input,
        beta_user_id: athleteUserId,
        beta_coach_user_id: coachUserId
      }
    );
    assertStatus(compile, 201, "event-linked compile");
    blockId = compile.json?.block_id ?? null;
    assert.equal(compile.json?.beta_path?.event_id, eventId);
    assert.equal(compile.json?.beta_path?.event_plan?.event_name, "Standalone Test Meet");
    assert.equal(compile.json?.beta_path?.event_compile_summary?.required_week_count, 2);
    assert.equal(compile.json?.beta_path?.template_week_index_global, 1);
  }
  finally {
    await closeServer(server);
    await cleanup();
    await pool.end();
  }
});
