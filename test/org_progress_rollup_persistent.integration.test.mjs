// DEV NOTE: Progress graphs slice 4 - org-wide progress rollup lifecycle
// proof. Proves the single most important boundary in this feature: an
// "individual"-mode ("gym") org's rollup call is rejected outright, and
// the raw HTTP response NEVER contains an athlete_user_id, display_name,
// email, or any progress metric value, anywhere - matching the identical
// zero-athlete-data guarantee test/org_visibility_lifecycle_persistent.
// integration.test.mjs already proves for the athlete-visibility route
// this feature is layered on top of. Also proves a "shared"-mode
// ("team") org's rollup returns real per-athlete insights across every
// coach on the roster, a revoked relationship is excluded entirely
// (mirroring listConnectedCoachAthletes's own accepted-only filter),
// cross-org isolation holds, and an unauthenticated caller is rejected.
// The per-athlete metric computation itself (all 4 metric shapes,
// series included) is already exhaustively proven by
// test/full_ui_36_progress_insights_persistent.integration.test.mjs and
// test/coach_progress_rollup_persistent.integration.test.mjs - this test
// only proves the NEW org-wide aggregation and visibility-mode gate.

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
    accepted_consent_version: "consent_v1"
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
    accepted_consent_version: "consent_v1"
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

async function seedRealSessionData(baseUrl, coach, athlete, nonce) {
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

  assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 200, "start session");
  assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
    type: "COMPLETE_EXERCISE", exercise_id: "back_squat"
  }), 201, "complete back_squat");

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
    // An "individual"-mode ("gym") org: rollup is rejected outright, and
    // the raw HTTP response never mentions any athlete data at all - the
    // single most important guarantee of this whole feature.
    // ============================================================
    const gymOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Prog Individual Gym", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(gymOrg, 201, "create individual-mode org");
    const gymOrgId = gymOrg.json?.organisation?.org_id;

    const gymInvite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `org_prog_invite_${nonce}_gym` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(gymInvite, 201, "invite coachA to gym org");
    await acceptOrgInvite(baseUrl, coachA, gymInvite.json?.membership?.membership_id, `org_prog_accept_${nonce}_gym`);

    await seedRelationship(baseUrl, {
      relationshipId: `org_prog_rel_${nonce}_gym1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    sessionIds.push(await seedRealSessionData(baseUrl, coachA, athlete1, `${nonce}_gym`));

    const gymRollup = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/progress-rollup`, undefined, { cookie: owner.cookie }
    );
    assertStatus(gymRollup, 403, "an individual-mode org's progress rollup is rejected");
    assert.equal(gymRollup.json?.error, "org_progress_rollup_not_available_for_individual_org");
    assert.equal(gymRollup.text.includes("athlete_user_id"), false, "gym-mode rejection must never mention athlete_user_id");
    assert.equal(gymRollup.text.includes(athlete1.userId), false, "gym-mode rejection must never mention the athlete's own id");
    assert.equal(gymRollup.text.includes(athlete1.email), false, "gym-mode rejection must never mention the athlete's email");
    assert.equal(gymRollup.text.includes(athlete1.displayName), false, "gym-mode rejection must never mention the athlete's display name");
    assert.equal(gymRollup.text.includes("adherence"), false, "gym-mode rejection must never mention any progress metric");

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
      org_name: "Org Prog Shared Team", visibility_mode: "shared"
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

    // ============================================================
    // An unauthenticated caller is rejected outright.
    // ============================================================
    const unauthenticatedRollup = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/progress-rollup`, undefined, {}
    );
    assertStatus(unauthenticatedRollup, 401, "an unauthenticated caller cannot read the progress rollup");
  }
);
