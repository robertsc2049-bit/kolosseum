import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
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
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

async function registerCoach(baseUrl, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full09cEventCoach!2026",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(registration, 201, `${label} account registration`);

  const coachUserId = registration.json?.account?.user_id ?? "";
  assert.ok(coachUserId, `${label}: expected registered coach user_id`);
  const cookie = sessionCookie(registration, `${label} account registration`);
  const csrf = registration.json?.csrf_token;
  assert.ok(csrf, `${label}: expected csrf token`);

  const timestamp = new Date().toISOString();
  assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-profile", {
    coach_user_id: coachUserId,
    email: `${coachUserId}@example.com`,
    display_name: label,
    account_role: "coach",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: timestamp
  }), 201, `${label} coach profile`);

  return { coachUserId, cookie, csrf };
}

async function activateTemplate(baseUrl, coachUserId, weekCount, name, timestamp) {
  const template = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-09C persistent lifecycle integration proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [{
      block_id: "",
      order_index: 1,
      name: "Event Block",
      description: "",
      block_type: "strength",
      week_count: weekCount,
      weeks: Array.from({ length: weekCount }, (_, index) => index + 1).map((week) => ({
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
  assertStatus(template, 201, `${name}: programme draft`);
  const templateId = template.json?.template?.template_id;
  assert.ok(templateId, `${name}: expected template_id`);

  assertStatus(await request(
    baseUrl,
    "POST",
    `/templates/${encodeURIComponent(templateId)}/complete`,
    { coach_user_id: coachUserId }
  ), 200, `${name}: programme completion`);

  assertStatus(await request(
    baseUrl,
    "POST",
    `/templates/${encodeURIComponent(templateId)}/activate`,
    { coach_user_id: coachUserId }
  ), 200, `${name}: programme activation`);

  return templateId;
}

test(
  "FULL-UI-09C persists the standalone event lifecycle and reconstructs it after restart",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const athleteUserId = `full_ui_09c_athlete_${nonce}`;
    const relationshipId = `full_ui_09c_relationship_${nonce}`;
    let coachUserId = "";
    let otherCoachUserId = "";
    let blockId = null;
    let server = null;

    const cleanup = async () => {
      if (blockId) {
        await pool.query("DELETE FROM sessions WHERE block_id = $1", [blockId]);
        await pool.query("DELETE FROM blocks WHERE block_id = $1", [blockId]);
      }
      for (const userId of [coachUserId, otherCoachUserId]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `
        DELETE FROM beta_product_records
        WHERE subject_user_id = ANY($1::text[])
           OR actor_user_id = ANY($1::text[])
        `,
        [[coachUserId, otherCoachUserId, athleteUserId].filter(Boolean)]
      );
    };

    try {
      server = await listen();
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const timestamp = new Date().toISOString();

      const coach = await registerCoach(baseUrl, "Full09c Owner Coach", nonce);
      coachUserId = coach.coachUserId;
      const coachCookie = coach.cookie;
      const coachCsrf = coach.csrf;

      const otherCoach = await registerCoach(baseUrl, "Full09c Other Coach", nonce);
      otherCoachUserId = otherCoach.coachUserId;
      const otherCookie = otherCoach.cookie;

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

      assertStatus(await request(baseUrl, "POST", "/sessions/beta-auth", {
        user_id: athleteUserId,
        email: `${athleteUserId}@example.com`,
        display_name: "Full09c Event Athlete",
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

      // --- Past-date validation: creating an event with a past event_date is rejected. ---
      const pastEvent = await request(baseUrl, "POST", "/coach-workspace/events/create", {
        event_id: "",
        event_name: "Should Not Exist",
        activity_id: "powerlifting",
        event_type: "powerlifting_meet",
        programme_start_date: dateOnlyFromNow(0),
        event_date: dateOnlyFromNow(-1),
        location: "Nowhere",
        timezone: "Europe/London",
        notes: ""
      }, { cookie: coachCookie, csrf: coachCsrf });
      assertStatus(pastEvent, 400, "past-dated event rejected");
      assert.equal(pastEvent.json?.details?.reason, "event_date_in_past");

      // --- Create: event A, the primary lifecycle subject. ---
      const eventADate = dateOnlyFromNow(15);
      const createdA = await request(baseUrl, "POST", "/coach-workspace/events/create", {
        event_id: "",
        event_name: "Full09c Autumn Meet",
        activity_id: "powerlifting",
        event_type: "powerlifting_meet",
        programme_start_date: dateOnlyFromNow(1),
        event_date: eventADate,
        location: "Mansfield",
        timezone: "Europe/London",
        notes: "Persistent lifecycle proof"
      }, { cookie: coachCookie, csrf: coachCsrf });
      assertStatus(createdA, 201, "event A create");
      const eventAId = createdA.json?.event?.event_id;
      assert.ok(eventAId, "expected event A id");
      assert.equal(createdA.json?.event?.event_status, "active");
      assert.equal(createdA.json?.event?.cancellation_state, "not_cancelled");
      assert.equal(createdA.json?.event?.archive_state, "not_archived");
      assert.equal(createdA.json?.event?.event_version, 1);
      const eventARequiredWeeks = Number(createdA.json?.event?.event_compile_summary?.required_week_count);
      assert.ok(eventARequiredWeeks > 0, "expected a positive required week count");
      let eventARecordSha = createdA.json?.event?.record_sha256;
      assert.ok(eventARecordSha, "expected event A record_sha256");

      // --- Create: event C, a distinct event sharing event A's date (conflict fixture). ---
      const createdC = await request(baseUrl, "POST", "/coach-workspace/events/create", {
        event_id: "",
        event_name: "Full09c Conflicting Meet",
        activity_id: "powerlifting",
        event_type: "powerlifting_meet",
        programme_start_date: dateOnlyFromNow(3),
        event_date: eventADate,
        location: "Nottingham",
        timezone: "Europe/London",
        notes: "Date-conflict fixture"
      }, { cookie: coachCookie, csrf: coachCsrf });
      assertStatus(createdC, 201, "event C create");
      const eventCId = createdC.json?.event?.event_id;
      assert.ok(eventCId && eventCId !== eventAId, "expected a distinct event C id");

      // --- Create: event D, archived independently of event A's cancellation. ---
      const createdD = await request(baseUrl, "POST", "/coach-workspace/events/create", {
        event_id: "",
        event_name: "Full09c Spring Camp",
        activity_id: "general_strength",
        event_type: "strength_event",
        programme_start_date: dateOnlyFromNow(2),
        event_date: dateOnlyFromNow(20),
        location: "Leeds",
        timezone: "Europe/London",
        notes: "Archive-only fixture"
      }, { cookie: coachCookie, csrf: coachCsrf });
      assertStatus(createdD, 201, "event D create");
      const eventDId = createdD.json?.event?.event_id;
      const eventDSha = createdD.json?.event?.record_sha256;
      assert.ok(eventDId, "expected event D id");

      // --- Event library: search, status, activity and date-scope filters. ---
      const librarySearch = await request(
        baseUrl,
        "GET",
        "/coach-workspace/events/library?search=autumn",
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(librarySearch, 200, "event library search");
      assert.deepEqual(
        librarySearch.json?.events?.map((event) => event.event_id),
        [eventAId]
      );
      assert.equal(librarySearch.json?.events?.[0]?.linked_athlete_count, 0);

      const libraryActivity = await request(
        baseUrl,
        "GET",
        "/coach-workspace/events/library?activity_id=general_strength",
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(libraryActivity, 200, "event library activity filter");
      assert.deepEqual(
        libraryActivity.json?.events?.map((event) => event.event_id),
        [eventDId]
      );

      const libraryFuture = await request(
        baseUrl,
        "GET",
        "/coach-workspace/events/library?date_scope=future&status=active",
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(libraryFuture, 200, "event library future+active filter");
      const futureIds = new Set(libraryFuture.json?.events?.map((event) => event.event_id));
      assert.ok(futureIds.has(eventAId) && futureIds.has(eventCId) && futureIds.has(eventDId));

      // --- Stable event-detail route recovers the same server-backed event. ---
      const detailBeforeLink = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(detailBeforeLink, 200, "event A detail before link");
      assert.equal(detailBeforeLink.json?.route_id, "coach_event_detail");
      assert.equal(detailBeforeLink.json?.detail?.event?.event_id, eventAId);
      // The manifest's event_metadata function claims "display location,
      // timezone, notes, activity and type" - the two fields most likely to
      // be silently dropped (they're not on the coach's own event list card
      // by default) must round-trip through the detail read exactly as
      // submitted at creation.
      assert.equal(detailBeforeLink.json?.detail?.event?.event_plan?.timezone, "Europe/London");
      assert.equal(detailBeforeLink.json?.detail?.event?.event_plan?.notes, "Persistent lifecycle proof");
      assert.equal(detailBeforeLink.json?.detail?.linked_athletes?.length, 0);
      assert.equal(detailBeforeLink.json?.detail?.event_versions?.length, 1);
      assert.deepEqual(detailBeforeLink.json?.detail?.historical_preservation, {
        event_versions_retained: 1,
        link_records_retained: 0,
        assignment_records_retained: 0,
        session_records_retained: 0
      });

      // --- Non-owner rejection: a second coach cannot read or act on event A. ---
      const foreignDetail = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: otherCookie }
      );
      assertStatus(foreignDetail, 403, "non-owner event detail rejected");
      assert.equal(foreignDetail.json?.details?.reason, "event_ownership_denied");

      const foreignCancel = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/cancel`,
        { expected_current_record_sha256: eventARecordSha },
        { cookie: otherCookie, csrf: otherCoach.csrf }
      );
      assertStatus(foreignCancel, 403, "non-owner cancel rejected");

      // --- Immutable future-event version creation. ---
      const staleVersion = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/version`,
        {
          event_name: "Full09c Autumn Meet (Revised)",
          activity_id: "powerlifting",
          event_type: "powerlifting_meet",
          programme_start_date: dateOnlyFromNow(1),
          event_date: eventADate,
          location: "Mansfield Arena",
          timezone: "Europe/London",
          notes: "Venue confirmed",
          expected_current_record_sha256: eventARecordSha
        },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(staleVersion, 201, "event A version 2");
      assert.equal(staleVersion.json?.event?.event_version, 2);
      assert.equal(staleVersion.json?.event?.event_plan?.location, "Mansfield Arena");
      eventARecordSha = staleVersion.json?.event?.record_sha256;

      const repeatedVersion = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/version`,
        {
          event_name: "Full09c Autumn Meet (Revised Again)",
          activity_id: "powerlifting",
          event_type: "powerlifting_meet",
          programme_start_date: dateOnlyFromNow(1),
          event_date: eventADate,
          location: "Mansfield Arena",
          timezone: "Europe/London",
          notes: "Stale write must be rejected",
          expected_current_record_sha256: eventARecordSha
        },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      // Using the true current hash, so this call must succeed; the stale-write
      // proof below reuses version 2's now-superseded hash instead.
      assertStatus(repeatedVersion, 201, "event A version 3 (still current hash)");
      const eventAVersion3Sha = repeatedVersion.json?.event?.record_sha256;
      assert.equal(repeatedVersion.json?.event?.event_version, 3);

      const staleWriteAttempt = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/version`,
        {
          event_name: "Full09c Autumn Meet (Conflicting Edit)",
          activity_id: "powerlifting",
          event_type: "powerlifting_meet",
          programme_start_date: dateOnlyFromNow(1),
          event_date: eventADate,
          location: "Somewhere Else",
          timezone: "Europe/London",
          notes: "Should be rejected as stale",
          expected_current_record_sha256: staleVersion.json?.event?.record_sha256
        },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(staleWriteAttempt, 409, "stale-write version rejected");
      assert.equal(staleWriteAttempt.json?.details?.reason, "event_stale_write");
      eventARecordSha = eventAVersion3Sha;

      const detailAfterVersions = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(detailAfterVersions, 200, "event A detail after versioning");
      assert.equal(detailAfterVersions.json?.detail?.event_versions?.length, 3);
      assert.equal(detailAfterVersions.json?.detail?.event?.event_version, 3);
      assert.deepEqual(
        detailAfterVersions.json?.detail?.event_versions?.map((version) => version.event_version).sort(),
        [1, 2, 3]
      );

      // --- Link athlete from the event-detail surface (without a programme). ---
      const linkNoTemplate = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/athletes/${encodeURIComponent(athleteUserId)}/link`,
        { template_id: "", request_id: "" },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(linkNoTemplate, 201, "link athlete (no programme) from event detail");
      assert.equal(linkNoTemplate.json?.link?.link_state, "linked");
      assert.equal(linkNoTemplate.json?.link?.assignment_id, null);
      assert.equal(linkNoTemplate.json?.assignment, null);

      const detailAfterLink = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(detailAfterLink, 200, "event A detail after link");
      assert.equal(detailAfterLink.json?.detail?.linked_athletes?.length, 1);
      assert.equal(detailAfterLink.json?.detail?.linked_athletes?.[0]?.athlete_user_id, athleteUserId);
      const linkedLifecycle = detailAfterLink.json?.detail?.lifecycle_records?.find(
        (record) => record.lifecycle_action === "athlete_linked"
      );
      assert.ok(linkedLifecycle, "expected an athlete_linked lifecycle record");
      assert.notEqual(linkedLifecycle.lifecycle_action, "historical_record");

      // --- Conflict validation from the event-detail link surface. ---
      const conflictFromDetail = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventCId)}/athletes/${encodeURIComponent(athleteUserId)}/link`,
        { template_id: "", request_id: "" },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(conflictFromDetail, 409, "same-day conflict rejected from event-detail surface");
      assert.equal(conflictFromDetail.json?.details?.reason, "event_link_date_conflict");

      // --- Unlink athlete from the event-detail surface; history is preserved, not deleted. ---
      const unlinkFromDetail = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/athletes/${encodeURIComponent(athleteUserId)}/unlink`,
        {},
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(unlinkFromDetail, 200, "unlink athlete from event detail");
      assert.equal(unlinkFromDetail.json?.link?.link_state, "unlinked");

      const detailAfterUnlink = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(detailAfterUnlink, 200, "event A detail after unlink");
      assert.equal(detailAfterUnlink.json?.detail?.linked_athletes?.length, 0);
      assert.equal(detailAfterUnlink.json?.detail?.link_history?.length, 2, "linked + unlinked rows both retained");

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
          source_note: "FULL-UI-09C lifecycle integration proof"
        })),
        expected_current_record_sha256: null
      }, { cookie: coachCookie, csrf: coachCsrf }), 201, "strength profile");

      // --- Link athlete WITH a programme, from the athlete-profile surface, and reach a real session. ---
      const templateId = await activateTemplate(
        baseUrl,
        coachUserId,
        eventARequiredWeeks,
        "Full09c Event Programme",
        timestamp
      );

      const profileAssignment = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
        request_id: `full_ui_09c_request_${nonce}`,
        // A fresh timestamp, not the value captured at test start: this link record's
        // ordering must come after the earlier unlink's server-clock time, or the
        // conflict check below would (correctly, but confusingly) see it as stale.
        requested_at_iso8601: new Date().toISOString(),
        coach_user_id: coachUserId,
        athlete_user_id: athleteUserId,
        template_id: templateId,
        activity_id: "powerlifting",
        event_id: eventAId
      }, { cookie: coachCookie, csrf: coachCsrf });
      assertStatus(profileAssignment, 201, "link athlete with programme from athlete profile");
      assert.equal(profileAssignment.json?.event_link?.event_id, eventAId);
      assert.equal(profileAssignment.json?.event_link?.template_id, templateId);
      assert.equal(profileAssignment.json?.event_link?.lifecycle_action, "athlete_linked");
      assert.equal(profileAssignment.json?.event_link?.immutable_link_history, true);

      // --- Conflict validation from the athlete-profile surface (previously bypassed). ---
      const otherTemplateId = await activateTemplate(
        baseUrl,
        coachUserId,
        eventARequiredWeeks,
        "Full09c Conflict Programme",
        timestamp
      );
      const profileConflict = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
        request_id: `full_ui_09c_conflict_request_${nonce}`,
        requested_at_iso8601: new Date().toISOString(),
        coach_user_id: coachUserId,
        athlete_user_id: athleteUserId,
        template_id: otherTemplateId,
        activity_id: "powerlifting",
        event_id: eventCId
      }, { cookie: coachCookie, csrf: coachCsrf });
      assertStatus(profileConflict, 409, "same-day conflict rejected from athlete-profile surface");
      assert.equal(profileConflict.json?.details?.reason, "event_link_date_conflict");

      const detailAfterProfileLink = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(detailAfterProfileLink, 200, "event A detail after profile link");
      assert.equal(detailAfterProfileLink.json?.detail?.linked_athletes?.length, 1);
      assert.equal(
        detailAfterProfileLink.json?.detail?.linked_athletes?.[0]?.linked_programme?.template_id,
        templateId
      );
      const profileLinkLifecycle = detailAfterProfileLink.json?.detail?.lifecycle_records?.filter(
        (record) => record.lifecycle_action === "athlete_linked"
      );
      assert.ok(profileLinkLifecycle.length >= 2, "expected both link actions in the lifecycle trail");

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
      assert.equal(compile.json?.beta_path?.event_id, eventAId);

      // --- Cancel event A; assignment and session history must survive. ---
      const cancelled = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/cancel`,
        { expected_current_record_sha256: eventARecordSha },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(cancelled, 200, "cancel event A");
      assert.equal(cancelled.json?.event?.event_status, "cancelled");
      assert.equal(cancelled.json?.event?.cancellation_state, "cancelled");
      assert.equal(cancelled.json?.event?.archive_state, "not_archived");
      eventARecordSha = cancelled.json?.event?.record_sha256;

      const detailAfterCancel = await request(
        baseUrl,
        "GET",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}`,
        undefined,
        { cookie: coachCookie }
      );
      assertStatus(detailAfterCancel, 200, "event A detail after cancel");
      assert.equal(detailAfterCancel.json?.detail?.event?.event_status, "cancelled");
      assert.ok(detailAfterCancel.json?.detail?.historical_preservation?.assignment_records_retained >= 1);
      assert.ok(detailAfterCancel.json?.detail?.historical_preservation?.session_records_retained >= 1);
      assert.ok(detailAfterCancel.json?.detail?.linked_athletes?.length === 1, "unlink is not implied by cancellation");

      // --- Archive is a distinct terminal state, not an alias of cancellation. ---
      const archivedAfterCancel = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventAId)}/archive`,
        { expected_current_record_sha256: eventARecordSha },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(archivedAfterCancel, 200, "archive already-cancelled event A");
      assert.equal(archivedAfterCancel.json?.event?.event_status, "archived");
      assert.equal(archivedAfterCancel.json?.event?.cancellation_state, "cancelled");
      assert.equal(archivedAfterCancel.json?.event?.archive_state, "archived");

      const archivedD = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventDId)}/archive`,
        { expected_current_record_sha256: eventDSha },
        { cookie: coachCookie, csrf: coachCsrf }
      );
      assertStatus(archivedD, 200, "archive event D directly");
      assert.equal(archivedD.json?.event?.event_status, "archived");
      assert.equal(archivedD.json?.event?.cancellation_state, "not_cancelled");
      assert.equal(archivedD.json?.event?.archive_state, "archived");
      assert.notEqual(
        archivedD.json?.event?.cancellation_state,
        cancelled.json?.event?.cancellation_state,
        "an archived-only event must not carry a cancelled state"
      );

      // --- Fresh-process reconstruction: a brand-new Node process reconnects and reads the same facts. ---
      const childScript = `
        import {
          loadStandaloneEventDetail,
          loadStandaloneEventLibrary
        } from "./dist/src/api/full_ui_09c_event_lifecycle_service.js";

        import {
          pool
        } from "./dist/src/db/pool.js";

        const detail = await loadStandaloneEventDetail(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(eventAId)}
        );

        const library = await loadStandaloneEventLibrary(
          ${JSON.stringify(coachUserId)}
        );

        console.log(
          JSON.stringify({ detail, library })
        );

        await pool.end();
      `;

      const child = spawnSync(
        process.execPath,
        ["--input-type=module", "--eval", childScript],
        {
          cwd: process.cwd(),
          env: process.env,
          encoding: "utf8"
        }
      );

      assert.equal(child.status, 0, child.stderr || child.stdout);

      const outputLine = child.stdout
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .at(-1);

      const afterRestart = JSON.parse(outputLine);

      assert.equal(afterRestart.detail.event.event_status, "archived");
      assert.equal(afterRestart.detail.event.cancellation_state, "cancelled");
      assert.equal(afterRestart.detail.event.archive_state, "archived");
      // 3 explicit edits (create + 2 versions) plus the cancel and archive transitions,
      // each an immutable append to the same event history.
      assert.equal(afterRestart.detail.event_versions.length, 5);
      assert.equal(afterRestart.detail.link_history.length, 3, "linked, unlinked and re-linked rows all retained");
      assert.equal(afterRestart.detail.linked_athletes.length, 1);
      assert.ok(afterRestart.detail.historical_preservation.assignment_records_retained >= 1);
      assert.ok(afterRestart.detail.historical_preservation.session_records_retained >= 1);

      const restartedEventIds = new Set(afterRestart.library.map((event) => event.event_id));
      assert.ok(
        restartedEventIds.has(eventAId) &&
        restartedEventIds.has(eventCId) &&
        restartedEventIds.has(eventDId),
        "expected all three fixture events to survive process restart"
      );
    }
    finally {
      await closeServer(server);
      await cleanup();
      await pool.end();
    }
  }
);
