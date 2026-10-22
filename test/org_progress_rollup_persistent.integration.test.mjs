// DEV NOTE: Progress graphs slices 4-5 - org-wide progress rollup
// lifecycle proof. Proves the single most important boundary in this
// feature: an "individual"-mode ("gym") org's rollup NEVER contains an
// athlete_user_id, display_name, or email, anywhere in the raw HTTP
// response - matching the identical zero-athlete-identity guarantee
// test/org_visibility_lifecycle_persistent.integration.test.mjs already
// proves for the athlete-visibility route this feature is layered on
// top of - while still proving the aggregate adherence AVERAGE it
// computes from real per-athlete data is genuinely correct, and is
// withheld entirely (not just a zero) below the 3-athlete cohort
// threshold. Also proves a "shared"-mode ("team") org's rollup returns
// real per-athlete insights across every coach on the roster, a revoked
// relationship is excluded entirely (mirroring listConnectedCoachAthletes's
// own accepted-only filter), cross-org isolation holds, and an
// unauthenticated caller is rejected. The per-athlete metric computation
// itself (all 4 metric shapes, series included) is already exhaustively
// proven by test/full_ui_36_progress_insights_persistent.integration.test.mjs
// and test/coach_progress_rollup_persistent.integration.test.mjs - this
// test only proves the NEW org-wide aggregation and visibility-mode gate.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

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

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `org_prog_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Prog ${label} Owner`,
    password: `OrgProg${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_prog_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Prog ${label} Coach`,
    email,
    password: `OrgProg${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    date_of_birth: "1990-01-15", accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Org Prog ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);
  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/accessibility",
    { accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false } },
    { cookie, csrf }
  ), 200, `${label} coach onboarding accessibility`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `org_prog_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Org Prog ${label} Athlete`,
    email,
    password: `OrgProg${label}Athlete!2026`,
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    date_of_birth: "1990-01-15", accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    displayName: `Org Prog ${label} Athlete`
  };
}

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId, state }) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: state === "revoked" ? now : null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

function daysAgoDateOnly(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function workItems() {
  return [{
    work_item_id: "",
    order_index: 1,
    exercise_id: "back_squat",
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: 5,
    rep_min: 5,
    rep_max: 5,
    load_mode: "percent_1rm",
    percent_1rm: 75,
    weight_value: 20,
    weight_unit: "kg",
    rest_seconds: 120,
    role: "primary",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }];
}

function blockWithOneSession() {
  return {
    block_id: "",
    order_index: 1,
    name: "Org Progress Rollup Block",
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
        work_items: workItems()
      }]
    }]
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "Org progress rollup proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockWithOneSession()],
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

async function seedRealSessionData(baseUrl, coach, athlete, nonce, options = {}) {
  const complete = options.complete !== false;
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coach.userId, athlete_user_id: athlete.userId, preferred_weight_unit: "kg", load_rounding_increment: 2.5,
    bodyweight: 90, bodyweight_unit: "kg",
    benchmarks: [{
      benchmark_id: `org_prog_back_squat_${nonce}`, exercise_id: "back_squat", value: 150, unit: "kg", basis: "tested_1rm",
      effective_date: daysAgoDateOnly(0), source_note: "org progress rollup proof", replaces_reference_id: null
    }],
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");

  const template = await createActivatedTemplate(baseUrl, coach.userId, `Org Progress Programme ${nonce}_${athlete.userId}`);

  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
    request_id: `org_prog_assign_${nonce}_${athlete.userId}`, requested_at_iso8601: new Date().toISOString(),
    coach_user_id: coach.userId, athlete_user_id: athlete.userId, template_id: template.template_id,
    activity_id: "powerlifting", event_id: ""
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "athlete assignment");

  const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: {
      consent_granted: true, engine_version: "EB2-1.0.0", enum_bundle_version: "EB2-1.0.0", phase1_schema_version: "1.0.0",
      actor_type: "athlete", execution_scope: "individual", activity_id: "powerlifting", nd_mode: false,
      instruction_density: "standard", exposure_prompt_density: "standard", bias_mode: "none"
    },
    beta_user_id: athlete.userId, beta_coach_user_id: coach.userId
  });
  assertStatus(compiled, 201, "compile session");
  const sessionId = compiled.json.session_id;

  if (complete) {
    assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 200, "start session");
    assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "COMPLETE_EXERCISE", exercise_id: "back_squat"
    }), 201, "complete back_squat");
  }
  // options.complete === false: left "ready" (compiled but never started) -
  // still one real, factual session record, just an incomplete one, so its
  // adherence_percentage is 0, not null.

  return sessionId;
}

test(
  "Org progress rollup: individual-mode org rejected with zero athlete data, shared-mode org returns real per-athlete insights and excludes a revoked relationship, cross-org isolation, unauthenticated rejection",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];
    const sessionIds = [];

    const cleanup = async () => {
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query(
          "DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query(
          "DELETE FROM product_org_coach_memberships WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await registerOrgOwner(baseUrl, nonce, "primary");
    orgOwnerUserIds.push(owner.userId);
    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);

    // ============================================================
    // An "individual"-mode ("gym") org with two coaches:
    // - coachA has only 1 accepted athlete (below the 3-athlete cohort
    //   threshold) - insufficient_cohort must be true and NO per-athlete
    //   data may ever be read for coachA, even though athlete1 genuinely
    //   has real session data seeded below.
    // - coachB has 3 accepted athletes with real, DIFFERENT adherence
    //   outcomes (100%, 100%, 0%) - a genuine, verifiable average
    //   (round((100+100+0)/3) = 67), proving real aggregation happened
    //   rather than reflecting a single athlete's own number.
    // Across both coaches, the raw HTTP response must never mention any
    // athlete's user_id, email or display name, anywhere - the single
    // most important guarantee of this whole feature.
    // ============================================================
    const gymOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Prog Individual Gym", activity_id: "powerlifting", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(gymOrg, 201, "create individual-mode org");
    const gymOrgId = gymOrg.json?.organisation?.org_id;

    const gymInviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `org_prog_invite_${nonce}_gym_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(gymInviteA, 201, "invite coachA to gym org");
    await acceptOrgInvite(baseUrl, coachA, gymInviteA.json?.membership?.membership_id, `org_prog_accept_${nonce}_gym_a`);

    await seedRelationship(baseUrl, {
      relationshipId: `org_prog_rel_${nonce}_gym1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    sessionIds.push(await seedRealSessionData(baseUrl, coachA, athlete1, `${nonce}_gym`));

    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const cohort1 = await registerAthlete(baseUrl, nonce, "cohort1");
    athleteUserIds.push(cohort1.userId);
    const cohort2 = await registerAthlete(baseUrl, nonce, "cohort2");
    athleteUserIds.push(cohort2.userId);
    const cohort3 = await registerAthlete(baseUrl, nonce, "cohort3");
    athleteUserIds.push(cohort3.userId);

    const gymInviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `org_prog_invite_${nonce}_gym_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(gymInviteB, 201, "invite coachB to gym org");
    await acceptOrgInvite(baseUrl, coachB, gymInviteB.json?.membership?.membership_id, `org_prog_accept_${nonce}_gym_b`);

    for (const cohortAthlete of [cohort1, cohort2, cohort3]) {
      await seedRelationship(baseUrl, {
        relationshipId: `org_prog_rel_${nonce}_${cohortAthlete.userId}`,
        coachUserId: coachB.userId, athleteUserId: cohortAthlete.userId, state: "accepted"
      });
    }
    sessionIds.push(await seedRealSessionData(baseUrl, coachB, cohort1, `${nonce}_cohort1`));
    sessionIds.push(await seedRealSessionData(baseUrl, coachB, cohort2, `${nonce}_cohort2`));
    sessionIds.push(await seedRealSessionData(baseUrl, coachB, cohort3, `${nonce}_cohort3`, { complete: false }));

    const gymRollup = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/progress-rollup`, undefined, { cookie: owner.cookie }
    );
    assertStatus(gymRollup, 200, "individual-mode org owner reads the aggregate progress rollup");
    const gymRollupBody = gymRollup.json?.rollup;
    assert.equal(gymRollupBody?.visibility_mode, "individual");

    const coachAAggregate = gymRollupBody?.coaches?.find((entry) => entry.coach_user_id === coachA.userId);
    assert.ok(coachAAggregate, "expected coachA in the aggregate rollup");
    assert.equal(coachAAggregate.active_athlete_count, 1);
    assert.equal(coachAAggregate.insufficient_cohort, true, "1 athlete is below the 3-athlete cohort threshold");
    assert.deepEqual(coachAAggregate.adherence_series, [], "an insufficient-cohort coach gets no series at all, not a suppressed-but-present one");

    const coachBAggregate = gymRollupBody?.coaches?.find((entry) => entry.coach_user_id === coachB.userId);
    assert.ok(coachBAggregate, "expected coachB in the aggregate rollup");
    assert.equal(coachBAggregate.active_athlete_count, 3);
    assert.equal(coachBAggregate.insufficient_cohort, false);
    assert.equal(coachBAggregate.adherence_series.length, 6, "aggregate adherence series has 6 windows");

    const currentAggregateWindow = coachBAggregate.adherence_series[5];
    assert.equal(currentAggregateWindow.contributor_count, 3, "all 3 cohort athletes contributed to the current window");
    assert.equal(
      currentAggregateWindow.average_adherence_percentage, 67,
      "round((100 + 100 + 0) / 3) = 67 - a genuine average, not one athlete's own figure"
    );
    for (const olderWindow of coachBAggregate.adherence_series.slice(0, 5)) {
      assert.equal(olderWindow.contributor_count, 0, "no sessions this far back");
      assert.equal(olderWindow.average_adherence_percentage, null, "no sessions this far back");
    }

    const rawGymResponse = gymRollup.text;
    assert.equal(rawGymResponse.includes("athlete_user_id"), false, "individual mode must never mention athlete_user_id");
    for (const athlete of [athlete1, cohort1, cohort2, cohort3]) {
      assert.equal(rawGymResponse.includes(athlete.userId), false, `individual mode must never mention ${athlete.userId}`);
      assert.equal(rawGymResponse.includes(athlete.email), false, `individual mode must never mention ${athlete.email}`);
      assert.equal(rawGymResponse.includes(athlete.displayName), false, `individual mode must never mention ${athlete.displayName}`);
    }

    // The gym's analysis: averages only, withheld under 3 athletes with
    // logged training (coachA has 1 athlete; coachB 3, of whom 2 trained),
    // never an athlete's identity, never pain.
    const gymAnalysis = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/analysis`, undefined, { cookie: owner.cookie }
    );
    assertStatus(gymAnalysis, 200, "individual-mode org owner reads the analysis");
    const gymAnalysisBody = gymAnalysis.json?.analysis;
    assert.equal(gymAnalysisBody?.visibility_mode, "individual");
    assert.equal(gymAnalysisBody?.min_cohort_size, 3);
    assert.equal(gymAnalysisBody?.summary, null, "2 athletes with logged training across the gym: too few for a summary");
    assert.deepEqual(gymAnalysisBody?.by_coach.map((group) => group.withheld).sort(), [true, true]);
    assert.equal(gymAnalysisBody?.athletes, undefined, "a gym owner never gets an athlete list");
    const rawGymAnalysis = gymAnalysis.text;
    assert.equal(rawGymAnalysis.includes("athlete_user_id"), false);
    assert.equal(/pain/iu.test(rawGymAnalysis), false, "a gym owner never sees pain, not even a count");
    for (const athlete of [athlete1, cohort1, cohort2, cohort3]) {
      assert.equal(rawGymAnalysis.includes(athlete.userId), false);
      assert.equal(rawGymAnalysis.includes(athlete.email), false);
      assert.equal(rawGymAnalysis.includes(athlete.displayName), false);
    }
    // The gym's head coach (coachB, named by the owner) sees the same
    // averages from their coaching workspace - and only them; coachA, not
    // head coach, is refused. Naming someone who isn't an active coach fails.
    const headGymBefore = await request(
      baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(gymOrgId)}/organisation-analysis`, undefined, { cookie: coachB.cookie }
    );
    assert.equal(headGymBefore.response.status, 403, "not head coach yet");
    const notACoach = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/head-coach`, { coach_user_id: cohort1.userId }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assert.equal(notACoach.response.status, 409, "an athlete can't be named head coach");
    assertStatus(await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/head-coach`, { coach_user_id: coachB.userId }, { cookie: owner.cookie, csrf: owner.csrf }
    ), 200, "owner names coachB head coach of the gym");
    const headGym = await request(
      baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(gymOrgId)}/organisation-analysis`, undefined, { cookie: coachB.cookie }
    );
    assertStatus(headGym, 200, "the gym's head coach reads its analysis");
    assert.equal(headGym.json.analysis.visibility_mode, "individual");
    assert.equal(headGym.json.analysis.head_coach_user_id, coachB.userId);
    assert.equal(headGym.text.includes("athlete_user_id"), false);
    assert.equal(/pain/iu.test(headGym.text), false);
    for (const athlete of [athlete1, cohort1, cohort2, cohort3]) {
      assert.equal(headGym.text.includes(athlete.userId), false);
      assert.equal(headGym.text.includes(athlete.displayName), false);
    }
    const notHead = await request(
      baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(gymOrgId)}/organisation-analysis`, undefined, { cookie: coachA.cookie }
    );
    assert.equal(notHead.response.status, 403, "only the head coach");
    const audit = await pool.query("SELECT action_type FROM product_org_audit_records WHERE org_id = $1 AND action_type = 'head_coach_designated'", [gymOrgId]);
    assert.equal(audit.rows.length, 1, "naming the head coach is audited");
    // The owner's own view says who it is.
    const ownerGymView = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/analysis`, undefined, { cookie: owner.cookie });
    assert.equal(ownerGymView.json.analysis.head_coach_user_id, coachB.userId);

    // A gym has no team view for its coaches either.
    const gymTeamView = await request(
      baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(gymOrgId)}/team-analysis`, undefined, { cookie: coachA.cookie }
    );
    assert.equal(gymTeamView.response.status, 403, "a gym's coaches keep their athletes private - no team view");

    // ============================================================
    // A "shared"-mode ("team") org: coachA has an accepted athlete with
    // real session data (athlete1, reused across both orgs - a coach can
    // belong to more than one org), an accepted athlete with no session
    // data yet (athlete2), and a revoked relationship (athlete3, must be
    // excluded from the rollup entirely).
    // ============================================================
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);
    const athlete3 = await registerAthlete(baseUrl, nonce, "3");
    athleteUserIds.push(athlete3.userId);

    const teamOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Prog Shared Team", activity_id: "powerlifting", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(teamOrg, 201, "create shared-mode org");
    const teamOrgId = teamOrg.json?.organisation?.org_id;

    const teamInvite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `org_prog_invite_${nonce}_team` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(teamInvite, 201, "invite coachA to team org");
    await acceptOrgInvite(baseUrl, coachA, teamInvite.json?.membership?.membership_id, `org_prog_accept_${nonce}_team`);

    await seedRelationship(baseUrl, {
      relationshipId: `org_prog_rel_${nonce}_team1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `org_prog_rel_${nonce}_team2`, coachUserId: coachA.userId, athleteUserId: athlete2.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `org_prog_rel_${nonce}_team3`, coachUserId: coachA.userId, athleteUserId: athlete3.userId, state: "revoked"
    });

    const teamRollup = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/progress-rollup`, undefined, { cookie: owner.cookie }
    );
    assertStatus(teamRollup, 200, "shared-mode org owner reads the progress rollup");
    const rollup = teamRollup.json?.rollup;
    assert.equal(rollup?.visibility_mode, "shared");

    const coachAEntry = rollup?.coaches?.find((entry) => entry.coach_user_id === coachA.userId);
    assert.ok(coachAEntry, "expected coachA in the rollup");
    assert.equal(coachAEntry.athletes.length, 2, "expected exactly the two accepted (non-revoked) athletes");

    const revokedEntry = coachAEntry.athletes.find((entry) => entry.athlete_user_id === athlete3.userId);
    assert.equal(revokedEntry, undefined, "a revoked relationship's athlete must never appear in the rollup");

    const withDataEntry = coachAEntry.athletes.find((entry) => entry.athlete_user_id === athlete1.userId);
    assert.ok(withDataEntry, "expected an entry for the athlete with real session data");
    assert.equal(withDataEntry.display_name, athlete1.displayName);
    assert.equal(withDataEntry.email, athlete1.email);
    assert.ok(withDataEntry.insights, "expected non-null insights for the athlete with real data");
    assert.equal(withDataEntry.insights.session_adherence.total_sessions, 1, "adherence: total_sessions");
    assert.equal(withDataEntry.insights.session_adherence.completed_sessions, 1, "adherence: completed_sessions");
    assert.equal(withDataEntry.insights.session_adherence.series.length, 6, "adherence: series has 6 windows");

    const withoutDataEntry = coachAEntry.athletes.find((entry) => entry.athlete_user_id === athlete2.userId);
    assert.ok(withoutDataEntry, "expected an entry for the athlete with no session data");
    assert.ok(withoutDataEntry.insights, "an athlete with zero sessions still gets a real (zero-filled) insights object, not null");
    assert.equal(withoutDataEntry.insights.session_adherence.total_sessions, 0);
    assert.equal(withoutDataEntry.insights.session_adherence.has_sufficient_data, false);

    // The team's analysis, for the owner: every accepted athlete (never the
    // revoked one), the group summed up, by coach.
    const teamAnalysis = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/analysis`, undefined, { cookie: owner.cookie }
    );
    assertStatus(teamAnalysis, 200, "shared-mode org owner reads the analysis");
    const teamAnalysisBody = teamAnalysis.json?.analysis;
    assert.equal(teamAnalysisBody?.visibility_mode, "shared");
    assert.deepEqual(teamAnalysisBody.athletes.map((row) => row.athlete_user_id).sort(), [athlete1.userId, athlete2.userId].sort());
    assert.equal(teamAnalysisBody.summary.athletes, 2);
    assert.equal(teamAnalysisBody.summary.trained, 1, "athlete1 has logged training, athlete2 hasn't");
    assert.ok(Array.isArray(teamAnalysisBody.findings));
    assert.ok(teamAnalysisBody.findings.every((finding) => typeof finding.action === "string"));
    assert.equal(teamAnalysisBody.by_coach[0].key, coachA.userId);

    // ...and for the team's coach, on the Analysis page: their own athletes.
    const coachTeamView = await request(
      baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-analysis`, undefined, { cookie: coachA.cookie }
    );
    assertStatus(coachTeamView, 200, "the team's coach reads the team analysis");
    assert.equal(coachTeamView.json.org.org_name, "Org Prog Shared Team");
    assert.equal(coachTeamView.json.athletes.length, 2);
    assert.ok(coachTeamView.json.athletes.every((row) => row.yours === true), "coachA coaches both");
    const outsiderCoach = await request(
      baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-analysis`, undefined, { cookie: coachB.cookie }
    );
    assert.equal(outsiderCoach.response.status, 403, "a coach who isn't in the team can't see it");

    // A team's head coach can open a teammate who isn't theirs: coachB joins
    // the team with cohort1 (who has training logged); coachA can't open
    // cohort1 until the owner names coachA head coach - and can't again once
    // it's cleared.
    const teamInviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `org_prog_invite_${nonce}_team_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(teamInviteB, 201, "invite coachB to team org");
    await acceptOrgInvite(baseUrl, coachB, teamInviteB.json?.membership?.membership_id, `org_prog_accept_${nonce}_team_b`);
    const openTeammate = () => request(baseUrl, "GET", `/coach-workspace/athletes/${encodeURIComponent(cohort1.userId)}/analysis?weeks=8`, undefined, { cookie: coachA.cookie });
    assert.equal((await openTeammate()).response.status, 403, "a teammate's athlete is closed to a plain team coach");
    const plainTeamView = await request(baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-analysis`, undefined, { cookie: coachA.cookie });
    assert.equal(plainTeamView.json.athletes.find((row) => row.athlete_user_id === cohort1.userId)?.openable, false);
    assert.equal(plainTeamView.json.athletes.find((row) => row.athlete_user_id === cohort1.userId)?.email, undefined, "no email for a teammate you can't open");
    assert.equal(plainTeamView.json.athletes.find((row) => row.athlete_user_id === athlete1.userId)?.email, athlete1.email);
    assertStatus(await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/head-coach`, { coach_user_id: coachA.userId }, { cookie: owner.cookie, csrf: owner.csrf }
    ), 200, "owner names coachA head coach of the team");
    const asHead = await openTeammate();
    assertStatus(asHead, 200, "the head coach opens a teammate in full");
    assert.equal(asHead.json.viewed_as, "head_coach");
    assert.equal(asHead.json.org.org_id, teamOrgId);
    const headTeamView = await request(baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-analysis`, undefined, { cookie: coachA.cookie });
    assert.equal(headTeamView.json.head_coach, true);
    assert.ok(headTeamView.json.athletes.every((row) => row.openable === true));
    assert.equal(headTeamView.json.athletes.find((row) => row.athlete_user_id === cohort1.userId)?.email, cohort1.email, "the head coach can match every athlete by email");

    // Squad entry as head coach: a team session for their own athlete and a
    // teammate's (both kept), a test day (own athletes only), and a GPS
    // import that's only kept once however often it's sent.
    const squadPost = (route, body, cookie = coachA.cookie, csrf = coachA.csrf) => request(baseUrl, "POST", `/coach-workspace/squad/${route}`, body, { cookie, csrf });
    const sessionDay = daysAgoDateOnly(2);
    const squadSession = { date: sessionDay, kind: "practice", minutes: 80, client_request_id: `sq_${nonce}_tue`, entries: [{ athlete_user_id: athlete1.userId, srpe: 7 }, { athlete_user_id: cohort1.userId, srpe: 6 }] };
    const squadSaved = await squadPost("sessions", squadSession);
    assertStatus(squadSaved, 200, "head coach records a squad session");
    assert.equal(squadSaved.json.added, 2, "their own athlete and a teammate's");
    assert.equal((await squadPost("sessions", squadSession)).json.added, 0, "sending it again doesn't double it");
    const loggedForTeammate = await pool.query("SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = 'other_training_session'", [cohort1.userId]);
    assert.ok(loggedForTeammate.rows.some((row) => row.event_payload.recorded_by === coachA.userId && row.event_payload.srpe === 6), "on the teammate's record, marked as recorded by the head coach");
    const testDay = await squadPost("test-day", { test_id: "cmj_cm", date: sessionDay, client_request_id: `td_${nonce}_cmj`, entries: [{ athlete_user_id: athlete1.userId, value: 44.5 }, { athlete_user_id: cohort1.userId, value: 39 }] });
    assertStatus(testDay, 200, "test day");
    assert.equal(testDay.json.added, 1, "test results stay with each athlete's own coach");
    assert.deepEqual(testDay.json.skipped.map((row) => row.athlete_user_id), [cohort1.userId]);
    const gps = { source: "match_v_northside", client_request_id: `xl_${nonce}_match`, rows: [
      { athlete_user_id: cohort1.userId, date: sessionDay, total_distance_m: 6210, hsr_m: 512, sprint_m: 140 },
      { athlete_user_id: athlete1.userId, date: sessionDay, total_distance_m: 99999 },
      { athlete_user_id: athlete1.userId, date: "2099-01-01", total_distance_m: 5000 },
      { athlete_user_id: owner.userId, date: sessionDay, total_distance_m: 5000 }
    ] };
    const imported = await squadPost("external-load", gps);
    assertStatus(imported, 200, "GPS import");
    assert.equal(imported.json.added, 1);
    assert.deepEqual(imported.json.skipped.map((row) => row.reason), ["values_invalid", "date_invalid", "not_your_athlete"]);
    assert.equal((await squadPost("external-load", { ...gps, client_request_id: `xl_${nonce}_again` })).json.added, 0, "the same session from the same source is kept once");
    const teammateAnalysis = await openTeammate();
    const gpsWeek = teammateAnalysis.json.analysis.external.rows.find((row) => row.sessions > 0);
    assert.deepEqual([gpsWeek?.total_distance_m, gpsWeek?.hsr_m], [6210, 512], "the import shows in the teammate's analysis");
    assert.equal((await squadPost("sessions", { ...squadSession, client_request_id: "bad" })).response.status, 400, "a request id is required");
    assert.equal((await squadPost("sessions", squadSession, coachA.cookie, null)).response.status >= 400, true, "a change needs the CSRF token");
    const outsiderSquad = await squadPost("sessions", { ...squadSession, client_request_id: `sq_${nonce}_out` }, coachB.cookie, coachB.csrf);
    assert.deepEqual(outsiderSquad.json.skipped.map((row) => row.athlete_user_id), [athlete1.userId], "coachB isn't head coach: only their own athlete is recorded");

    // The injury log: the head coach records a teammate's hamstring strain;
    // the athlete's own coach sees it in full, the team view shows them out
    // straight away, and the owner sees only that they're unavailable.
    const injuryBase = `/coach-workspace/athletes/${encodeURIComponent(cohort1.userId)}/injuries`;
    const strain = { area: "thigh_back", side: "left", type: "muscle", mechanism: "non_contact", context: "match", status: "out", occurred_on: daysAgoDateOnly(3), client_request_id: `inj_${nonce}_ham` };
    const recorded = await request(baseUrl, "POST", injuryBase, strain, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(recorded, 200, "head coach records an injury");
    assert.equal(recorded.json.added, true);
    assert.equal((await request(baseUrl, "POST", injuryBase, strain, { cookie: coachA.cookie, csrf: coachA.csrf })).json.added, false, "the same request twice is one injury");
    assert.equal((await request(baseUrl, "POST", injuryBase, { ...strain, area: "spleen", client_request_id: `inj_${nonce}_bad` }, { cookie: coachA.cookie, csrf: coachA.csrf })).response.status, 400);
    const injuryId = recorded.json.injury.id;
    const ownCoachView = await request(baseUrl, "GET", `/coach-workspace/athletes/${encodeURIComponent(cohort1.userId)}/analysis?weeks=8`, undefined, { cookie: coachB.cookie });
    assertStatus(ownCoachView, 200, "own coach reads the analysis");
    assert.equal(ownCoachView.json.analysis.injuries.current.name, "left hamstring (muscle strain)");
    assert.equal(ownCoachView.json.findings[0].id, "injury_out");
    const teamNow = await request(baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-analysis`, undefined, { cookie: coachA.cookie });
    const injuredRow = teamNow.json.athletes.find((row) => row.athlete_user_id === cohort1.userId);
    assert.deepEqual(injuredRow.availability, { status: "unavailable", reason: "Injury: left hamstring (muscle strain)", until: null }, "the team view shows it at once (no stale cache)");
    assert.equal(teamNow.json.summary.injuries.out, 1, "the head coach sees the team's injury numbers");
    const plainCoachTeam = await request(baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-analysis`, undefined, { cookie: coachB.cookie });
    const asTeammate = plainCoachTeam.json.athletes.find((row) => row.athlete_user_id === athlete1.userId);
    assert.equal(asTeammate.injuries, undefined, "a plain team coach never sees a teammate's injury log");
    assert.equal(plainCoachTeam.json.summary.injuries, undefined);
    const ownerNow = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/analysis`, undefined, { cookie: owner.cookie });
    const ownerRow = ownerNow.json.analysis.athletes.find((row) => row.athlete_user_id === cohort1.userId);
    assert.deepEqual(ownerRow.availability, { status: "unavailable" }, "the owner sees availability only");
    assert.equal(ownerRow.injuries, undefined);
    assert.ok(!ownerRow.findings.some((finding) => String(finding.id).startsWith("injury_")));
    assert.equal(ownerNow.json.analysis.summary.injuries, undefined);
    assert.ok(!JSON.stringify(ownerNow.json).includes("hamstring"), "nothing about the injury reaches the owner");
    const modified = await request(baseUrl, "POST", `${injuryBase}/${injuryId}/status`, { status: "modified", on: daysAgoDateOnly(1), client_request_id: `inj_${nonce}_mod` }, { cookie: coachB.cookie, csrf: coachB.csrf });
    assertStatus(modified, 200, "own coach moves it to modified");
    const back = await request(baseUrl, "POST", `${injuryBase}/${injuryId}/status`, { status: "returned", on: daysAgoDateOnly(0), client_request_id: `inj_${nonce}_back` }, { cookie: coachB.cookie, csrf: coachB.csrf });
    assertStatus(back, 200, "back to full training");
    const afterReturn = await request(baseUrl, "GET", `/coach-workspace/athletes/${encodeURIComponent(cohort1.userId)}/analysis?weeks=8`, undefined, { cookie: coachB.cookie });
    const row = afterReturn.json.analysis.injuries.rows[0];
    assert.deepEqual([row.status, row.days_lost, row.days_modified, row.severity], ["returned", 2, 1, "minimal"]);
    assert.equal((await request(baseUrl, "POST", `${injuryBase}/${injuryId}/status`, { status: "out", client_request_id: `inj_${nonce}_again` }, { cookie: coachB.cookie, csrf: coachB.csrf })).response.status, 409, "a returned injury is closed - a new one is recorded instead");
    assert.equal((await request(baseUrl, "POST", injuryBase, { ...strain, client_request_id: `inj_${nonce}_nocsrf` }, { cookie: coachA.cookie })).response.status >= 400, true, "a change needs the CSRF token");
    assertStatus(await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/head-coach`, { coach_user_id: null }, { cookie: owner.cookie, csrf: owner.csrf }
    ), 200, "owner clears the head coach");
    assert.equal((await openTeammate()).response.status, 403, "cleared: closed again");
    assert.equal((await request(baseUrl, "POST", `/coach-workspace/athletes/${encodeURIComponent(cohort1.userId)}/injuries`, { area: "knee", type: "ligament", client_request_id: `inj_${nonce}_after` }, { cookie: coachA.cookie, csrf: coachA.csrf })).response.status, 403, "no longer head coach: can't record an injury");
    const crossOwnerHead = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/head-coach`, { coach_user_id: coachA.userId }, { cookie: owner.cookie }
    );
    assert.equal(crossOwnerHead.response.status >= 400, true, "a change needs the CSRF token");

    // ============================================================
    // Cross-org isolation: an unrelated org owner cannot read this org's
    // progress rollup.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);
    const crossOrgRollup = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/progress-rollup`, undefined, { cookie: otherOwner.cookie }
    );
    assertStatus(crossOrgRollup, 403, "an unrelated org owner cannot read another org's progress rollup");
    const crossOrgAnalysis = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/analysis`, undefined, { cookie: otherOwner.cookie }
    );
    assertStatus(crossOrgAnalysis, 403, "an unrelated org owner cannot read another org's analysis");
    const crossOrgHead = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/head-coach`, { coach_user_id: coachA.userId }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
    );
    assert.equal(crossOrgHead.response.status, 403, "an unrelated owner can't name a head coach");

    // ============================================================
    // An unauthenticated caller is rejected outright.
    // ============================================================
    const unauthenticatedRollup = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/progress-rollup`, undefined, {}
    );
    assertStatus(unauthenticatedRollup, 401, "an unauthenticated caller cannot read the progress rollup");
    const unauthenticatedAnalysis = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/analysis`, undefined, {}
    );
    assertStatus(unauthenticatedAnalysis, 401, "an unauthenticated caller cannot read the analysis");
  }
);
