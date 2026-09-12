// DEV NOTE: FULL-UI-86 athlete-position-overridden notification persistent
// proof. FULL-UI-85's two direct-override tiers (a team coach or an org
// owner unilaterally changing an athlete's declared position, no athlete
// confirmation needed) previously left the athlete with zero signal that
// their own declaration had changed - unlike the softer 1:1 propose/confirm
// tier, which already notifies via activity_change_proposed/applied. Proves:
// a team-coach override creates exactly one notification for the athlete,
// unread, correctly deep-linking to their own Today view, carrying the
// overriding role and new position as factual payload; an org-owner
// override produces a second, independent notification; marking one read
// persists and repeated reads never duplicate; and everything survives a
// fresh-process restart. Every step crosses only public HTTP routes.

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

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `full86_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Full86 ${label} Owner`,
    password: `Full86${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `full86_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Full86 ${label} Coach`,
    email,
    password: `Full86${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} coach registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerAthlete(baseUrl, nonce, label, activityId) {
  const email = `full86_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Full86 ${label} Athlete`,
    email,
    password: `Full86${label}Athlete!2026`,
    activity_id: activityId,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

function accessibilityPreferences() {
  return { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false };
}

async function completeAthleteOnboarding(baseUrl, athlete, activityId, position) {
  const draft = await request(
    baseUrl, "PATCH", "/account/onboarding/draft",
    {
      current_stage: "review",
      fields: {
        activity_id: activityId,
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

  const confirm = await request(baseUrl, "POST", "/account/onboarding/confirm", { review_confirmed: true }, { cookie: athlete.cookie, csrf: athlete.csrf });
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

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

async function getNotifications(baseUrl, actor) {
  const result = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: actor.cookie });
  assertStatus(result, 200, "read notifications");
  return result.json.notifications.filter((entry) => entry.notification_type === "athlete_position_overridden");
}

test(
  "FULL-UI-86 athlete-position-overridden notification: a team-coach direct override notifies the athlete, an org-owner direct override produces a second independent notification, correct deep link/payload, starts unread, mark-read persists without duplicating, fresh-process restart",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];
    const orgIds = [];

    const cleanup = async () => {
      for (const orgId of orgIds) {
        await pool.query("DELETE FROM product_org_audit_records WHERE org_id = $1", [orgId]).catch(() => {});
        await pool.query("DELETE FROM product_org_coach_memberships WHERE org_id = $1", [orgId]).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE org_id = $1", [orgId]).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      const productUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (productUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])`,
          [productUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [productUserIds]
        ).catch(() => {});
      }
      for (const userId of productUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await closeServer(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    let address = server.address();
    let baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await registerOrgOwner(baseUrl, nonce, "owner");
    orgOwnerUserIds.push(owner.userId);

    const coachTeam = await registerCoach(baseUrl, nonce, "team");
    coachUserIds.push(coachTeam.userId);

    const athleteA = await registerAthlete(baseUrl, nonce, "a", "rugby_union");
    athleteUserIds.push(athleteA.userId);

    await completeAthleteOnboarding(baseUrl, athleteA, "rugby_union", "prop");

    const teamOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Full86 Rugby Team", activity_id: "rugby_union", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(teamOrg, 201, "create shared-mode rugby team org");
    const teamOrgId = teamOrg.json?.organisation?.org_id;
    orgIds.push(teamOrgId);

    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
      { coach_email: coachTeam.email, request_id: `invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coachTeam to the rugby team org");
    await acceptOrgInvite(baseUrl, coachTeam, invite.json?.membership?.membership_id, `accept_${nonce}`);

    await connectRelationship(baseUrl, coachTeam.userId, athleteA.userId, `rel_${nonce}_team_a`);

    // ============================================================
    // Before any override, the athlete has zero of these notifications.
    // ============================================================
    const beforeAny = await getNotifications(baseUrl, athleteA);
    assert.equal(beforeAny.length, 0, "expected no athlete_position_overridden notification before any override");

    // ============================================================
    // A team-coach direct override notifies the athlete: exactly one
    // notification, unread, deep-linking to Today, carrying the
    // overriding role and new position as factual payload.
    // ============================================================
    const teamOverride = await request(
      baseUrl, "POST",
      `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
      { position: "hooker" }, { cookie: coachTeam.cookie, csrf: coachTeam.csrf }
    );
    assertStatus(teamOverride, 200, "coachTeam directly overrides athleteA's position");

    const afterTeamOverride = await getNotifications(baseUrl, athleteA);
    assert.equal(afterTeamOverride.length, 1, "expected exactly one notification after the team-coach override");
    const teamNotification = afterTeamOverride[0];
    assert.equal(teamNotification.deep_link.route_id, "athlete_today");
    assert.equal(teamNotification.target_available, true);
    assert.equal(teamNotification.notification_payload.overridden_by_role, "coach");
    assert.equal(teamNotification.notification_payload.new_position, "hooker");
    assert.equal(teamNotification.read_at_iso8601, null, "expected the notification to start unread");

    // The overriding coach never receives this notification themselves.
    const coachOwnNotifications = await getNotifications(baseUrl, coachTeam);
    assert.equal(coachOwnNotifications.length, 0, "expected the overriding coach to never receive this notification");

    // ============================================================
    // Marking it read persists, and repeated reads never duplicate
    // the derived notification.
    // ============================================================
    const markRead = await request(
      baseUrl, "POST", `/account/notifications/${encodeURIComponent(teamNotification.notification_id)}/read`, {},
      { cookie: athleteA.cookie, csrf: athleteA.csrf }
    );
    assertStatus(markRead, 200, "athlete marks the notification read");

    const afterMarkRead = await getNotifications(baseUrl, athleteA);
    assert.equal(afterMarkRead.length, 1, "expected still exactly one notification after repeated reads");
    assert.notEqual(afterMarkRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // An org-owner direct override produces a second, independent
    // notification, correctly attributed to the org owner's role.
    // ============================================================
    const ownerOverride = await request(
      baseUrl, "POST",
      `/org/organisations/${encodeURIComponent(teamOrgId)}/athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
      { position: "lock" }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(ownerOverride, 200, "org owner directly overrides athleteA's position");

    const afterOwnerOverride = await getNotifications(baseUrl, athleteA);
    assert.equal(afterOwnerOverride.length, 2, "expected a second, independent notification after the org-owner override");
    const ownerNotification = afterOwnerOverride.find((entry) => entry.notification_payload.overridden_by_role === "org_owner");
    assert.ok(ownerNotification, "expected an org_owner-attributed notification");
    assert.equal(ownerNotification.notification_payload.new_position, "lock");
    assert.equal(ownerNotification.read_at_iso8601, null, "expected the second notification to start unread independently");
    assert.notEqual(
      afterOwnerOverride.find((entry) => entry.notification_payload.overridden_by_role === "coach")?.read_at_iso8601,
      null,
      "expected the first notification's read state to be unaffected by the second override"
    );

    // ============================================================
    // Fresh-process restart: both notifications reconstruct
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    await closeServer(server);
    server = await listen();
    address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const afterRestart = await getNotifications(baseUrl, athleteA);
    assert.equal(afterRestart.length, 2);
    assert.ok(afterRestart.some((entry) => entry.notification_payload.overridden_by_role === "coach" && entry.read_at_iso8601 !== null));
    assert.ok(afterRestart.some((entry) => entry.notification_payload.overridden_by_role === "org_owner" && entry.read_at_iso8601 === null));
  }
);
