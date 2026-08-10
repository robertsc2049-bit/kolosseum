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
    role: index === 0 ? "primary" : "accessory"
  }));
}

function blockOfWeeks(weekCount, namePrefix) {
  return {
    block_id: "",
    order_index: 1,
    name: `${namePrefix} Block`,
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
  };
}

async function registerCoach(baseUrl, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full12cCalendarBinding!2026",
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

async function createEvent(baseUrl, coach, name, eventDateOffset, programmeStartOffset = 1) {
  const created = await request(baseUrl, "POST", "/coach-workspace/events/create", {
    event_id: "",
    event_name: name,
    activity_id: "powerlifting",
    event_type: "powerlifting_meet",
    programme_start_date: dateOnlyFromNow(programmeStartOffset),
    event_date: dateOnlyFromNow(eventDateOffset),
    location: "Mansfield",
    timezone: "Europe/London",
    notes: "FULL-UI-12C binding proof"
  }, { cookie: coach.cookie, csrf: coach.csrf });
  assertStatus(created, 201, `${name}: create`);
  return created.json.event;
}

async function createDraftTemplate(baseUrl, coachUserId, name, weekCount) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-12C event calendar binding proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockOfWeeks(weekCount, name)],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  return saved.json.template;
}

test(
  "FULL-UI-12C binds a programme template to a standalone event, sources dates from it, validates activation and reconstructs after restart",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    let coachUserId = "";
    let otherCoachUserId = "";
    let server = null;

    const cleanup = async () => {
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
        [[coachUserId, otherCoachUserId].filter(Boolean)]
      );
    };

    try {
      server = await listen();
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const coach = await registerCoach(baseUrl, "Full12c Owner Coach", nonce);
      coachUserId = coach.coachUserId;

      const otherCoach = await registerCoach(baseUrl, "Full12c Other Coach", nonce);
      otherCoachUserId = otherCoach.coachUserId;

      // --- Event A: the primary balanced binding + activation proof. ---
      const eventA = await createEvent(baseUrl, coach, "Full12c Autumn Meet", 15);
      assert.equal(eventA.event_compile_summary.required_week_count, 2);

      const templateA = await createDraftTemplate(baseUrl, coachUserId, "Full12c Balanced Programme", 2);

      const bindA = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateA.template_id)}/bind-event`,
        { coach_user_id: coachUserId, event_id: eventA.event_id }
      );
      assertStatus(bindA, 200, "bind template A to event A");
      assert.equal(bindA.json.template.bound_event_id, eventA.event_id);
      assert.equal(bindA.json.template.bound_event_record_sha256, eventA.record_sha256);
      // Date sourcing: the template's event_plan is the event's own plan, not a
      // second independently-typed copy.
      assert.equal(bindA.json.template.event_plan.event_date, eventA.event_plan.event_date);
      assert.equal(
        bindA.json.template.event_plan.programme_start_date,
        eventA.event_plan.programme_start_date
      );
      assert.equal(bindA.json.template.event_compile_summary.allocation_state, "balanced");
      assert.equal(bindA.json.template.event_compile_summary.required_week_count, 2);
      assert.equal(bindA.json.template.event_compile_summary.allocated_week_count, 2);

      const bindingA = await request(
        baseUrl,
        "GET",
        `/templates/${encodeURIComponent(templateA.template_id)}/event-binding?coach_user_id=${encodeURIComponent(coachUserId)}`
      );
      assertStatus(bindingA, 200, "template A event-binding status");
      assert.equal(bindingA.json.bound, true);
      assert.equal(bindingA.json.accessible, true);
      assert.equal(bindingA.json.is_current, true);
      assert.equal(bindingA.json.requires_rebind, false);
      assert.equal(bindingA.json.event_status, "active");

      const completedA = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateA.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(completedA, 200, "complete balanced, bound template A");

      const activatedA = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateA.template_id)}/activate`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activatedA, 200, "activate balanced, bound template A");
      assert.equal(activatedA.json.template.template_status, "active");

      // --- Template B: under-allocated at bind time, blocked at activation,
      //     then fixed with a deterministic block resize (the "fit final
      //     block" operation) without ever touching the event's own date. ---
      const templateB = await createDraftTemplate(baseUrl, coachUserId, "Full12c Under Allocated Programme", 1);

      const bindB = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateB.template_id)}/bind-event`,
        { coach_user_id: coachUserId, event_id: eventA.event_id }
      );
      assertStatus(bindB, 200, "bind template B to event A (under-allocated permitted at bind time)");
      assert.equal(bindB.json.template.event_compile_summary.allocation_state, "under_allocated");
      assert.equal(bindB.json.template.event_compile_summary.week_delta, 1);

      const activateUnbalanced = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateB.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activateUnbalanced, 400, "completion blocked on unbalanced allocation");
      assert.equal(activateUnbalanced.json.details.reason, "event_week_allocation_unbalanced");

      const fitFinalBlockSave = await request(baseUrl, "POST", "/templates", {
        coach_user_id: coachUserId,
        template_id: templateB.template_id,
        template_family_id: templateB.template_family_id,
        template_version: templateB.template_version,
        template_name: templateB.template_name,
        description: templateB.description,
        activity_id: templateB.activity_id,
        // The event_plan and binding fields are echoed back unchanged - an
        // ordinary content save may resize blocks but must never move the
        // pinned event date itself.
        event_plan: bindB.json.template.event_plan,
        bound_event_id: bindB.json.template.bound_event_id,
        bound_event_record_sha256: bindB.json.template.bound_event_record_sha256,
        blocks: [blockOfWeeks(2, "Full12c Under Allocated Programme")],
        updated_at_iso8601: new Date().toISOString()
      });
      assertStatus(fitFinalBlockSave, 201, "deterministic block resize to fit the bound event");
      assert.equal(fitFinalBlockSave.json.template.event_compile_summary.allocation_state, "balanced");
      assert.equal(
        fitFinalBlockSave.json.template.event_plan.event_date,
        eventA.event_plan.event_date,
        "the event date must not move as a side effect of resizing blocks"
      );

      const completeFixed = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateB.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(completeFixed, 200, "completion succeeds once allocation is balanced");

      const activateFixed = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateB.template_id)}/activate`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activateFixed, 200, "activation succeeds once allocation is balanced");

      // A plain content save may not silently change or drop the binding.
      const tamperedSave = await request(baseUrl, "POST", "/templates", {
        coach_user_id: coachUserId,
        template_id: templateA.template_id,
        template_family_id: templateA.template_family_id,
        template_version: templateA.template_version,
        template_name: templateA.template_name,
        description: templateA.description,
        activity_id: templateA.activity_id,
        event_plan: bindA.json.template.event_plan,
        bound_event_id: "",
        bound_event_record_sha256: "",
        blocks: [blockOfWeeks(2, "Full12c Balanced Programme")],
        updated_at_iso8601: new Date().toISOString()
      });
      // templateA is already active, so this is rejected for immutability
      // first - the binding-tamper guard applies to *draft* templates.
      assertStatus(tamperedSave, 400, "cannot edit an active template at all");
      assert.equal(tamperedSave.json.details.reason, "active_or_archived_template_is_immutable");

      // --- Cross-coach isolation: another coach cannot bind their own draft
      //     template to an event they do not own. ---
      const otherTemplate = await createDraftTemplate(baseUrl, otherCoachUserId, "Full12c Foreign Draft", 2);
      const foreignBind = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(otherTemplate.template_id)}/bind-event`,
        { coach_user_id: otherCoachUserId, event_id: eventA.event_id }
      );
      assertStatus(foreignBind, 400, "cross-coach event binding rejected");
      assert.equal(foreignBind.json.details.reason, "event_binding_inaccessible");

      // --- Template C: proves the explicit rebind action after an event
      //     version change, and that activation is blocked until then. ---
      const eventC = await createEvent(baseUrl, coach, "Full12c Rebind Fixture", 20, 2);
      const templateC = await createDraftTemplate(baseUrl, coachUserId, "Full12c Rebind Programme", eventC.event_compile_summary.required_week_count);

      const bindC = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateC.template_id)}/bind-event`,
        { coach_user_id: coachUserId, event_id: eventC.event_id }
      );
      assertStatus(bindC, 200, "bind template C to event C");
      assert.equal(bindC.json.template.event_compile_summary.allocation_state, "balanced");

      const versionedC = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventC.event_id)}/version`,
        {
          event_name: eventC.event_plan.event_name,
          activity_id: eventC.activity_id,
          event_type: eventC.event_plan.event_type,
          programme_start_date: eventC.event_plan.programme_start_date,
          event_date: eventC.event_plan.event_date,
          location: "Mansfield Arena (Confirmed)",
          timezone: eventC.event_plan.timezone,
          notes: "Venue confirmed",
          expected_current_record_sha256: eventC.record_sha256
        },
        { cookie: coach.cookie, csrf: coach.csrf }
      );
      assertStatus(versionedC, 201, "version event C");
      const eventCVersion2Sha = versionedC.json.event.record_sha256;

      const bindingCAfterVersion = await request(
        baseUrl,
        "GET",
        `/templates/${encodeURIComponent(templateC.template_id)}/event-binding?coach_user_id=${encodeURIComponent(coachUserId)}`
      );
      assertStatus(bindingCAfterVersion, 200, "template C event-binding status after event version");
      assert.equal(bindingCAfterVersion.json.is_current, false);
      assert.equal(bindingCAfterVersion.json.requires_rebind, true);
      assert.equal(bindingCAfterVersion.json.event_status, "active");
      // The displayed binding still shows the OLD, pinned location/date facts -
      // the programme calendar was not silently moved.
      assert.equal(bindingCAfterVersion.json.event_plan.location, "Mansfield");

      const activateStaleC = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateC.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activateStaleC, 400, "completion blocked on a stale event binding");
      assert.equal(activateStaleC.json.details.reason, "event_binding_stale_requires_rebind");

      const rebindC = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateC.template_id)}/bind-event`,
        { coach_user_id: coachUserId, event_id: eventC.event_id }
      );
      assertStatus(rebindC, 200, "explicit rebind to the new event version");
      assert.equal(rebindC.json.template.bound_event_record_sha256, eventCVersion2Sha);
      assert.equal(rebindC.json.template.event_plan.location, "Mansfield Arena (Confirmed)");

      const bindingCAfterRebind = await request(
        baseUrl,
        "GET",
        `/templates/${encodeURIComponent(templateC.template_id)}/event-binding?coach_user_id=${encodeURIComponent(coachUserId)}`
      );
      assertStatus(bindingCAfterRebind, 200, "template C event-binding status after rebind");
      assert.equal(bindingCAfterRebind.json.is_current, true);
      assert.equal(bindingCAfterRebind.json.requires_rebind, false);

      const completedC = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateC.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(completedC, 200, "completion succeeds once rebound to the current event version");

      const activatedC = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateC.template_id)}/activate`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activatedC, 200, "activation succeeds once rebound to the current event version");

      // --- Template D: cancelled event blocks activation. ---
      const eventD = await createEvent(baseUrl, coach, "Full12c Cancel Fixture", 25, 3);
      const templateD = await createDraftTemplate(baseUrl, coachUserId, "Full12c Cancel Programme", eventD.event_compile_summary.required_week_count);
      const bindD = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateD.template_id)}/bind-event`,
        { coach_user_id: coachUserId, event_id: eventD.event_id }
      );
      assertStatus(bindD, 200, "bind template D to event D");

      const cancelledD = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventD.event_id)}/cancel`,
        { expected_current_record_sha256: eventD.record_sha256 },
        { cookie: coach.cookie, csrf: coach.csrf }
      );
      assertStatus(cancelledD, 200, "cancel event D");

      const bindingDAfterCancel = await request(
        baseUrl,
        "GET",
        `/templates/${encodeURIComponent(templateD.template_id)}/event-binding?coach_user_id=${encodeURIComponent(coachUserId)}`
      );
      assertStatus(bindingDAfterCancel, 200, "template D event-binding status after cancel");
      assert.equal(bindingDAfterCancel.json.event_status, "cancelled");
      assert.equal(bindingDAfterCancel.json.requires_rebind, true);

      const activateCancelledD = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateD.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activateCancelledD, 400, "completion blocked when the bound event is cancelled");
      assert.equal(activateCancelledD.json.details.reason, "event_binding_event_cancelled");

      // --- Template E: archived event blocks activation, and is a distinct
      //     state from cancellation. ---
      const eventE = await createEvent(baseUrl, coach, "Full12c Archive Fixture", 30, 4);
      const templateE = await createDraftTemplate(baseUrl, coachUserId, "Full12c Archive Programme", eventE.event_compile_summary.required_week_count);
      const bindE = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateE.template_id)}/bind-event`,
        { coach_user_id: coachUserId, event_id: eventE.event_id }
      );
      assertStatus(bindE, 200, "bind template E to event E");

      const archivedE = await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventE.event_id)}/archive`,
        { expected_current_record_sha256: eventE.record_sha256 },
        { cookie: coach.cookie, csrf: coach.csrf }
      );
      assertStatus(archivedE, 200, "archive event E");

      const activateArchivedE = await request(
        baseUrl,
        "POST",
        `/templates/${encodeURIComponent(templateE.template_id)}/complete`,
        { coach_user_id: coachUserId }
      );
      assertStatus(activateArchivedE, 400, "completion blocked when the bound event is archived");
      assert.equal(activateArchivedE.json.details.reason, "event_binding_event_archived");

      // --- Fresh-process reconstruction. ---
      const childScript = `
        import {
          listCoachProgrammeTemplates,
          loadTemplateEventBindingStatus
        } from "./dist/src/api/beta18_programme_template_service.js";

        import {
          pool
        } from "./dist/src/db/pool.js";

        const templates = await listCoachProgrammeTemplates(${JSON.stringify(coachUserId)});

        const bindingA = await loadTemplateEventBindingStatus(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(templateA.template_id)}
        );

        const bindingC = await loadTemplateEventBindingStatus(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(templateC.template_id)}
        );

        const bindingD = await loadTemplateEventBindingStatus(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(templateD.template_id)}
        );

        console.log(
          JSON.stringify({
            template_count: templates.length,
            bindingA,
            bindingC,
            bindingD
          })
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

      assert.ok(afterRestart.template_count >= 5);
      assert.equal(afterRestart.bindingA.bound, true);
      assert.equal(afterRestart.bindingA.is_current, true, "event A was never versioned; the binding must still read as current");
      assert.equal(afterRestart.bindingC.is_current, true);
      assert.equal(afterRestart.bindingC.requires_rebind, false);
      assert.equal(afterRestart.bindingD.event_status, "cancelled");
    }
    finally {
      await closeServer(server);
      await cleanup();
      await pool.end();
    }
  }
);
