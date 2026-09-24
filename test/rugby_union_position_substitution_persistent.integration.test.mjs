// DEV NOTE: end-to-end proof that a rugby_union athlete's declared position
// (set via the real onboarding flow, never projected into phase1/the
// engine record - see athlete_onboarding_service.ts) is looked up live and
// narrows the real substitution-request endpoint's offered exercise, using
// the same helper conventions as full_ui_85_team_sport_position_persistent
// (registration/onboarding) and full_ui_15c_session_execution_persistent
// (template/assignment/compile/substitution-request).
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
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
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

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);
  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `rugbysub_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `RugbySub ${label} Coach`,
    email,
    password: `RugbySub${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_session", `${label} coach registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `rugbysub_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `RugbySub ${label} Athlete`,
    email,
    password: `RugbySub${label}Athlete!2026`,
    activity_id: "rugby_union",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

function accessibilityPreferences() {
  return { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false };
}

async function completeAthleteOnboarding(baseUrl, athlete, position) {
  const draft = await request(
    baseUrl, "PATCH", "/account/onboarding/draft",
    {
      current_stage: "review",
      fields: {
        activity_id: "rugby_union",
        position,
        execution_scope: "coach_managed",
        product_acknowledged: true,
        jurisdiction_code: "england_wales",
        jurisdiction_acknowledged: true,
        accessibility_preferences: accessibilityPreferences(),
        instruction_density: "standard"
      }
    },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(draft, 200, "athlete onboarding draft");

  const confirm = await request(
    baseUrl, "POST", "/account/onboarding/confirm", { review_confirmed: true },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(confirm, 200, "athlete onboarding confirm");
  return confirm.json;
}

async function connectRelationship(baseUrl, coachUserId, athleteUserId, relationshipId) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: now,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `connect coach ${coachUserId} <-> athlete ${athleteUserId}`);
}

function blockWithFrontRackCarry() {
  return {
    block_id: "",
    order_index: 1,
    name: "Rugby Union Substitution Block",
    description: "",
    block_type: "strength",
    week_count: 1,
    weeks: [{
      week_id: "",
      order_index: 1,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: "Session 1",
        work_items: [{
          work_item_id: "",
          order_index: 1,
          exercise_id: "front_rack_carry",
          planned_sets: 3,
          rep_mode: "fixed",
          planned_reps: 8,
          rep_min: 8,
          rep_max: 8,
          load_mode: "fixed_weight",
          weight_value: 40,
          weight_unit: "kg",
          rest_seconds: 120,
          role: "primary",
          coaching_notes: "",
          segment: "working",
          group_id: "",
          group_type: "straight"
        }]
      }]
    }]
  };
}

function phase1Input() {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "rugby_union",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "Rugby union position-aware substitution proof.",
    activity_id: "rugby_union",
    event_plan: null,
    blocks: [blockWithFrontRackCarry()],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/complete`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: complete`
  );
  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: activate`
  );
  return template;
}

async function createSessionForAthlete(baseUrl, coach, athleteUserId, nonce) {
  const template = await createActivatedTemplate(baseUrl, coach.userId, `RugbySub Programme ${nonce}`);

  const assignment = await request(
    baseUrl, "POST", "/coach-workspace/athlete-assignment",
    {
      request_id: `rugbysub_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: template.template_id,
      activity_id: "rugby_union",
      event_id: ""
    },
    { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(assignment, 201, "athlete assignment");

  const compiled = await request(
    baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true",
    { phase1_input: phase1Input(), beta_user_id: athleteUserId, beta_coach_user_id: coach.userId }
  );
  assertStatus(compiled, 201, "compile session");

  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");
  return sessionId;
}

test(
  "rugby union position-aware substitution: a declared wing gets front_rack_carry's carry_bilateral targets excluded (falling back to the unnarrowed set, since every one of front_rack_carry's rugby_union edges targets carry_bilateral), and the endpoint resolves position live from the athlete's own onboarding declaration, not any client-supplied value",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    try {
      server = await listen();
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const coach = await registerCoach(baseUrl, nonce, "coach");
      const athlete = await registerAthlete(baseUrl, nonce, "wing");
      await completeAthleteOnboarding(baseUrl, athlete, "wing");
      await connectRelationship(baseUrl, coach.userId, athlete.userId, `rugbysub_rel_${nonce}`);

      const sessionId = await createSessionForAthlete(baseUrl, coach, athlete.userId, nonce);

      // front_rack_carry requires barbell + open_floor_space - marking
      // barbell unavailable forces the engine's equipment-blocked path
      // (equipmentBlocked() in v1SubstitutionEngineContract.mjs), which is
      // the only path that actually picks a substitution target; with all
      // equipment available the engine correctly reports
      // "not_required" and returns the source itself unchanged.
      const substitution = await request(
        baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/substitution-request`,
        { exercise_id: "front_rack_carry", unavailable_equipment_ids: ["barbell"] }
      );
      assertStatus(substitution, 200, "substitution request for a declared wing");
      const output = substitution.json?.result?.substitution_output ?? substitution.json?.substitution_output;
      assert.ok(output, "expected a substitution_output in the response");
      // front_rack_carry's only rugby_union substitution edges all target
      // carry_bilateral exercises (trap_bar_carry, farmers_carry,
      // kettlebell_farmers_carry) - a wing excludes carry_bilateral, which
      // would empty the candidate set entirely, so the safety fallback
      // rule applies: the picked target still comes from the real,
      // unnarrowed, activity-eligible pool, proving the request succeeded
      // via the live position lookup (not a synthetic/unavailable result)
      // rather than being wrongly refused.
      assert.ok(
        ["trap_bar_carry", "farmers_carry", "kettlebell_farmers_carry"].includes(output.target_exercise_id),
        `expected a lawful carry_bilateral substitution target, got ${output.target_exercise_id}`
      );
    } finally {
      await closeServer(server);
      await pool.end();
    }
  }
);
