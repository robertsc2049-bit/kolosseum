// A powerlifter's coach assigns a two-block programme and records her
// maxes. "My programme" (GET /account/onboarding/my-programme) shows both
// blocks, every session in order with the weight worked out from her max,
// and moves her along as she finishes a session; the session itself is
// called by its programme name, in the session screen and in her history.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];

function client(baseUrl) {
  const jar = new Map();
  let csrf = "";
  async function req(method, route, body) {
    const headers = { origin: baseUrl };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (csrf && method !== "GET") headers["x-kolosseum-csrf"] = csrf;
    const response = await fetch(baseUrl + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
    }
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, json, text };
  }
  async function refresh() {
    const detail = await req("GET", "/account/detail");
    csrf = detail.json?.csrf_token ?? csrf;
    return detail.json;
  }
  return { req, refresh };
}

function ok(result, status, label) {
  assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}. raw=${result.text}`);
  return result;
}

function item(exerciseId, index, percent) {
  return {
    work_item_id: "", order_index: index + 1, exercise_id: exerciseId, planned_sets: 5, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
    load_mode: percent ? "percent_1rm" : "rpe", percent_1rm: percent ?? 75, weight_value: 20, weight_unit: "kg", rpe_value: 7, rest_seconds: 240,
    role: index ? "accessory" : "primary", coaching_notes: index ? "" : "Belt on for the top sets.", segment: "working", group_id: "", group_type: "straight"
  };
}

const session = (title, items, order) => ({ session_id: "", order_index: order, title, coaching_notes: "", work_items: items });
const blocks = [
  { block_id: "", order_index: 1, name: "Accumulation", description: "", block_type: "volume", week_count: 1,
    weeks: [{ week_id: "", order_index: 1, sessions: [
      session("Squat day", [item("back_squat", 0, 72.5), item("barbell_row", 1),
        // 3-4 sets at 100-110 kg: a set range and a fixed-weight range.
        { ...item("romanian_deadlift", 2), set_mode: "range", planned_sets: 3, planned_sets_max: 4, load_mode: "fixed_weight", load_range_mode: "range", weight_value: 100, weight_value_max: 110 }], 1),
      // 70-75% of a 100 kg max: a % range, worked out as 70-75 kg.
      session("Bench day", [{ ...item("bench_press", 0, 70), load_range_mode: "range", percent_1rm_max: 75 }], 2)] }] },
  { block_id: "", order_index: 2, name: "Intensification", description: "", block_type: "strength", week_count: 1,
    weeks: [{ week_id: "", order_index: 1, sessions: [session("Heavy squat", [item("back_squat", 0, 85)], 1)] }] }
];

test("a coached powerlifter sees her whole programme with her weights, and it moves her on as she trains", { timeout: 120000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  testContext.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const userId of userIds) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `my_programme_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "MyProgrammeTest!2026", date_of_birth: "1994-06-06",
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", ...extra
    }), 201, `register ${name}`);
    const detail = await c.refresh();
    userIds.push(detail.account.user_id);
    return { email, userId: detail.account.user_id };
  };

  const coach = client(baseUrl);
  const coachAccount = await register(coach, "coach", "coach");
  for (const [method, route, body] of [
    ["PATCH", "/account/coach-onboarding/profile", { display_name: "Coach", email: coachAccount.email }],
    ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }],
    ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }],
    ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]
  ]) await coach.req(method, route, body);
  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `Meet prep ${nonce}`, description: "", activity_id: "powerlifting", blocks,
    updated_at_iso8601: new Date().toISOString()
  }), 201, "save programme");
  const templateId = saved.json.template.template_id;
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");

  const backwards = await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `Backwards ${nonce}`, description: "", activity_id: "powerlifting",
    blocks: [{ ...blocks[0], weeks: [{ week_id: "", order_index: 1, sessions: [session("Day", [{ ...item("back_squat", 0, 70), set_mode: "range", planned_sets: 4, planned_sets_max: 3 }], 1)] }], week_count: 1 }],
    updated_at_iso8601: new Date().toISOString()
  });
  assert.equal(backwards.status, 400);
  assert.match(backwards.text, /set_range_order_invalid/u);
  // 1-30 sets: 20 x 400 m style interval work fits, 31 sets does not.
  const setsTemplate = (name, sets) => coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `${name} ${nonce}`, description: "", activity_id: "powerlifting",
    blocks: [{ ...blocks[0], weeks: [{ week_id: "", order_index: 1, sessions: [session("Day", [{ ...item("back_squat", 0, 60), planned_sets: sets }], 1)] }], week_count: 1 }],
    updated_at_iso8601: new Date().toISOString()
  });
  const thirty = await setsTemplate("Thirty", 30);
  assert.equal(thirty.status, 201, thirty.text);
  const thirtyOne = await setsTemplate("Thirty-one", 31);
  assert.equal(thirtyOne.status, 400);
  assert.match(thirtyOne.text, /planned_sets_invalid/u);

  const athlete = client(baseUrl);
  const athleteAccount = await register(athlete, "athlete", "lifter", { activity_id: "powerlifting" });
  const fields = {
    activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true,
    jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true,
    accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard"
  };
  for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
  ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, "confirm onboarding");
  assert.equal(ok(await athlete.req("GET", "/account/onboarding/my-programme"), 200, "before any programme").json.status, "none");

  ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: athleteAccount.email }), 201, "invite");
  await athlete.refresh();
  const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
  const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
  ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, "accept");
  ok(await coach.req("POST", "/coach-workspace/athlete-assignment", {
    request_id: `my_programme_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
    athlete_user_id: athleteAccount.userId, template_id: templateId, activity_id: "powerlifting", event_id: ""
  }), 201, "assign");
  await coach.refresh();
  ok(await coach.req("POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coachAccount.userId, athlete_user_id: athleteAccount.userId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 74, bodyweight_unit: "kg",
    benchmarks: [["back_squat", 160], ["bench_press", 100]].map(([exercise_id, value]) => ({ benchmark_id: "", exercise_id, value, unit: "kg", basis: "tested_1rm", effective_date: new Date().toISOString().slice(0, 10), source_note: "" })),
    expected_current_record_sha256: null
  }), 201, "her maxes");

  const before = ok(await athlete.req("GET", "/account/onboarding/my-programme"), 200, "my programme").json;
  assert.equal(before.status, "active");
  assert.equal(before.source, "coach");
  assert.equal(before.programme.total_sessions, 3);
  assert.deepEqual(before.blocks.map((b) => [b.name, b.weeks.map((w) => w.week_number)]), [["Accumulation", [1]], ["Intensification", [2]]]);
  const [squatDay, benchDay] = before.blocks[0].weeks[0].sessions;
  assert.deepEqual([squatDay.title, squatDay.state, benchDay.state], ["Squat day", "current", "upcoming"]);
  const squat = squatDay.exercises.find((e) => e.exercise_id === "back_squat");
  assert.deepEqual([squat.sets, squat.reps, squat.load, squat.rest_seconds, squat.notes], [5, "5", "115 kg", 240, "Belt on for the top sets."], "72.5% of a 160 kg max, to the nearest 2.5 kg - the weight only, never the %");
  assert.equal(squatDay.exercises.find((e) => e.exercise_id === "barbell_row").load, "RPE 7");
  const rdl = squatDay.exercises.find((e) => e.exercise_id === "romanian_deadlift");
  assert.deepEqual([rdl.sets, rdl.sets_max, rdl.load], [3, 4, "100–110 kg"], "a set range and a fixed-weight range");
  assert.equal(benchDay.exercises.find((e) => e.exercise_id === "bench_press").load, "70–75 kg", "a % range is a weight range from her max");
  assert.equal(before.blocks[1].weeks[0].sessions[0].exercises.find((e) => e.exercise_id === "back_squat").load, "135 kg");

  // Her cover: who it is for and from, when it started, her bodyweight -
  // never the maxes or the % behind the weights.
  assert.equal(before.cover.athlete_name, "lifter");
  assert.equal(before.cover.coach_name, "Coach");
  assert.equal(before.cover.bodyweight.value, 74);
  assert.equal(before.cover.started_on, new Date().toISOString().slice(0, 10));
  assert.equal("maxes" in before.cover, false, "no maxes on the athlete's cover");
  assert.equal(JSON.stringify(before).includes('"percent"'), false, "no % anywhere in the athlete's copy");

  // The coach's copy of the same programme keeps both.
  const coachCopy = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/programme-print`), 200, "coach copy").json;
  const coachSquat = coachCopy.blocks[0].weeks[0].sessions[0].exercises.find((e) => e.exercise_id === "back_squat");
  assert.deepEqual([coachSquat.load, coachSquat.percent], ["115 kg", 72.5]);
  const coachBench = coachCopy.blocks[0].weeks[0].sessions[1].exercises.find((e) => e.exercise_id === "bench_press");
  assert.deepEqual([coachBench.load, coachBench.percent, coachBench.percent_max], ["70–75 kg", 70, 75]);
  assert.deepEqual(coachCopy.cover.maxes.map((m) => [m.name, m.value, m.basis]), [["Back squat", 160, "Tested 1RM"], ["Bench press", 100, "Tested 1RM"]]);
  assert.deepEqual(coachCopy.cover.bodyweight_history.map((b) => b.value), [74]);
  assert.equal((await athlete.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/programme-print`)).status, 403, "the athlete can't fetch the coach's copy");

  // She trains Squat day: the session screen and her history call it that.
  const detail = await athlete.refresh();
  const created = ok(await athlete.req("POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: detail.bootstrap.declaration_record.engine_phase1_input, beta_user_id: athleteAccount.userId, beta_coach_user_id: coachAccount.userId
  }), 201, "session").json;
  const sessionId = created.session_id;
  assert.equal(ok(await athlete.req("GET", `/sessions/${sessionId}/state`), 200, "state").json.session_title, "Squat day");
  // The session carries the ranges: the sets to do and the most, the weight range.
  const sessionRdl = created.planned_session.exercises.find((e) => e.exercise_id === "romanian_deadlift");
  assert.deepEqual([sessionRdl.sets, sessionRdl.set_range, sessionRdl.intensity], [3, { minimum: 3, maximum: 4 }, { type: "load", value: 100, maximum: 110, unit: "kg" }]);
  ok(await athlete.req("POST", `/sessions/${sessionId}/start`, {}), 200, "start");
  for (const exercise of created.planned_session.exercises) {
    ok(await athlete.req("POST", `/sessions/${sessionId}/events`, { event: { type: "COMPLETE_EXERCISE", exercise_id: exercise.exercise_id } }), 201, `complete ${exercise.exercise_id}`);
  }
  const history = ok(await athlete.req("POST", "/sessions/beta-athlete-history", { athlete_user_id: athleteAccount.userId }), 200, "history").json;
  const listed = (history.sessions ?? history.records ?? []).find((s) => s.session_id === sessionId);
  assert.equal(listed?.session_title, "Squat day", JSON.stringify(Object.keys(history)));

  const after = ok(await athlete.req("GET", "/account/onboarding/my-programme"), 200, "after training").json;
  const [doneDay, nextDay] = after.blocks[0].weeks[0].sessions;
  assert.deepEqual([doneDay.state, nextDay.state, after.completed_sessions, after.current.session_index], ["done", "current", 1, 1]);
  assert.ok(doneDay.date, "the done day carries the date she trained it");

  // The coach's Analysis: she is on the roster, her trends come back with
  // findings and every section; the athlete cannot read it.
  const roster = ok(await coach.req("GET", "/coach-workspace/analysis"), 200, "analysis roster").json;
  assert.ok(roster.athletes.some((entry) => entry.athlete_user_id === athleteAccount.userId));
  const analysis = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/analysis?weeks=8`), 200, "athlete analysis").json;
  assert.equal(analysis.weeks, 8);
  assert.deepEqual(Object.keys(analysis.analysis).sort(), ["adherence", "baseline", "execution", "exercises", "load", "markers", "pain", "readiness", "strength", "volume", "weeks"]);
  assert.equal(analysis.analysis.weeks.length, 8);
  assert.ok(Array.isArray(analysis.findings));
  assert.equal(analysis.analysis.volume.rows.at(-1).sets >= 0, true);
  assert.equal((await athlete.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/analysis`)).status >= 400, true, "coach-only");

  // Load a coach can trust: the athlete rates the finished session (how
  // hard, how long) and logs a team practice; the coach's analysis then
  // counts it as measured gym load plus sport load.
  ok(await athlete.req("POST", "/account/onboarding/session-load", { session_id: sessionId, srpe: 7, minutes: 65 }), 200, "rate the session");
  assert.equal(ok(await athlete.req("GET", `/account/onboarding/session-load/${sessionId}`), 200, "read the rating").json.report.minutes, 65);
  assert.equal((await athlete.req("POST", "/account/onboarding/session-load", { session_id: sessionId, srpe: 11, minutes: 65 })).status, 400, "effort is 0-10");
  assert.equal((await athlete.req("POST", "/account/onboarding/session-load", { session_id: "not_mine", srpe: 5, minutes: 30 })).status, 404, "only their own sessions");
  const practiceDay = new Date().toISOString().slice(0, 10);
  const practice = { date: practiceDay, kind: "practice", minutes: 90, srpe: 6, note: "Team session", client_request_id: "ot_integration_1" };
  const addedPractice = ok(await athlete.req("POST", "/account/onboarding/other-training", practice), 200, "log practice").json;
  assert.equal(addedPractice.added, true);
  assert.equal(ok(await athlete.req("POST", "/account/onboarding/other-training", practice), 200, "log it again").json.added, false, "the same request is logged once");
  assert.equal((await athlete.req("POST", "/account/onboarding/other-training", { ...practice, kind: "nap", client_request_id: "ot_integration_2" })).status, 400);
  assert.equal(ok(await athlete.req("GET", "/account/onboarding/other-training"), 200, "list").json.entries.length, 1);
  const withLoad = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/analysis?weeks=4`), 200, "analysis with load sources").json.analysis;
  const thisWeek = withLoad.load.rows.at(-1);
  assert.equal(thisWeek.sport_load, 540, "90 minutes x 6");
  assert.equal(withLoad.load.quality.measured, 1, "the rated session is measured");
  assert.ok(withLoad.load.sessions.some((row) => row.kind === "practice" && row.note === "Team session"));
  ok(await athlete.req("POST", "/account/onboarding/other-training/remove", { id: addedPractice.entry.id }), 200, "remove");
  assert.equal(ok(await athlete.req("GET", "/account/onboarding/other-training"), 200, "list after").json.entries.length, 0);
  assert.equal((await coach.req("GET", "/account/onboarding/other-training")).status >= 400, true, "athlete-only");

  // Progress reports: a weekly one for this week at least, and one for the programme.
  const reports = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports`), 200, "report list").json;
  assert.deepEqual(Object.keys(reports.reports).sort(), ["block", "cycle", "programme", "week", "year"]);
  assert.ok(reports.reports.week.length >= 1);
  const week = reports.reports.week[0];
  const weekly = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports/week/${week.id}`), 200, "weekly report").json;
  assert.equal(weekly.period.weeks, 1);
  assert.equal(typeof weekly.summary.sessions.completed, "number");
  assert.ok(Array.isArray(weekly.findings));
  assert.equal((await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports/week/1999-01-04`)).status, 404);
  assert.equal((await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports/decade/x`)).status, 404);
  assert.equal((await athlete.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports`)).status >= 400, true, "coach-only");

  // From a set date; the athlete's copy (no estimated maxes); sending it once.
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
  const custom = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports/custom/${from}_${today}`), 200, "custom report").json;
  assert.equal(custom.period.from, from);
  assert.ok(Array.isArray(custom.summary.exercises));
  assert.ok(Array.isArray(custom.summary.session_log));
  assert.equal((await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports/custom/${today}_${from}`)).status, 404, "from after to");
  const copy = ok(await coach.req("GET", `/coach-workspace/athletes/${athleteAccount.userId}/reports/week/${week.id}/athlete-copy`), 200, "athlete copy").json;
  assert.equal(/e1rm|estimated|acute_chronic|findings/u.test(JSON.stringify(copy.report)), false, "athlete copy has no coach-only numbers");
  const sendBody = { message: "Good week - keep the squat depth.", client_request_id: "rpt_integration_1" };
  const sent = ok(await coach.req("POST", `/coach-workspace/athletes/${athleteAccount.userId}/reports/week/${week.id}/send`, sendBody), 200, "send report").json;
  assert.equal(sent.sent, true);
  const again = ok(await coach.req("POST", `/coach-workspace/athletes/${athleteAccount.userId}/reports/week/${week.id}/send`, sendBody), 200, "send again").json;
  assert.equal(again.sent, false, "the same request is not sent twice");
  assert.equal((await coach.req("POST", `/coach-workspace/athletes/${athleteAccount.userId}/reports/week/${week.id}/send`, { message: "x".repeat(2001), client_request_id: "rpt_integration_2" })).status, 400);
  const received = ok(await athlete.req("GET", "/account/onboarding/progress-reports"), 200, "athlete reports").json;
  assert.equal(received.reports.length, 1);
  assert.equal(received.reports[0].report.coach.message, "Good week - keep the squat depth.");
  assert.equal((await coach.req("GET", "/account/onboarding/progress-reports")).status >= 400, true, "athlete-only");

  // It is hers alone: a coach gets nothing from it.
  assert.notEqual((await coach.req("GET", "/account/onboarding/my-programme")).status, 200);
});
