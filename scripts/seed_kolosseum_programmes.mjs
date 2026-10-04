#!/usr/bin/env node
// Create the Kolosseum programmes (product/programmes/kolosseum_programmes_v1.mjs)
// in a catalogue author's programme library, through the same API the
// builder uses.
//
// By default each programme is created as a DRAFT, for the author to review
// and edit in the builder, then complete, activate and publish to athletes
// from the programme page. Nothing reaches athletes until then.
//
//   KOLOSSEUM_BASE_URL=http://localhost:3000 \
//   KOLOSSEUM_AUTHOR_EMAIL=... KOLOSSEUM_AUTHOR_PASSWORD=... \
//   node scripts/seed_kolosseum_programmes.mjs [--publish]
//
// --publish (local testing only): also completes, activates and lists each
// programme. Programmes the author already has (same name) are skipped.

import { PROGRAMMES } from "../product/programmes/kolosseum_programmes_v1.mjs";

const base = (process.env.KOLOSSEUM_BASE_URL || "http://localhost:3000").replace(/\/$/u, "");
const email = process.env.KOLOSSEUM_AUTHOR_EMAIL;
const password = process.env.KOLOSSEUM_AUTHOR_PASSWORD;
const publish = process.argv.includes("--publish");
if (!email || !password) {
  console.error("Set KOLOSSEUM_AUTHOR_EMAIL and KOLOSSEUM_AUTHOR_PASSWORD (the catalogue author's account).");
  process.exit(1);
}

let cookie = "";
let csrf = "";
async function call(method, route, body) {
  const headers = { origin: base };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (csrf && method !== "GET") headers["x-kolosseum-csrf"] = csrf;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = response.headers.getSetCookie?.() ?? [];
  const session = set.find((c) => c.startsWith("kolosseum_session="));
  if (session) cookie = session.split(";")[0];
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${text.slice(0, 300)}`);
  return json;
}

// One builder work item from the programme notation.
function workItem(item, index) {
  const reps = item.reps;
  const timed = typeof reps === "object" && !Array.isArray(reps) && "seconds" in reps;
  const distance = typeof reps === "object" && !Array.isArray(reps) && "metres" in reps;
  const range = Array.isArray(reps);
  const fixedReps = typeof reps === "number" ? reps : range ? reps[1] : 5;
  const load = item.load;
  return {
    work_item_id: "", order_index: index + 1, exercise_id: item.id, planned_sets: item.sets,
    prescription_mode: timed ? "duration" : distance ? "distance" : "reps",
    rep_mode: range ? "range" : "fixed", planned_reps: fixedReps, rep_min: range ? reps[0] : fixedReps, rep_max: range ? reps[1] : fixedReps, tempo: "",
    duration_mode: "fixed", planned_duration_seconds: timed ? reps.seconds : 30, duration_min_seconds: timed ? reps.seconds : 30, duration_max_seconds: timed ? reps.seconds : 30,
    distance_mode: "fixed", distance_unit: "meters", planned_distance_value: distance ? reps.metres : 20, distance_min_value: distance ? reps.metres : 20, distance_max_value: distance ? reps.metres : 20,
    load_mode: load === "bw" ? "bodyweight" : "pct" in load ? "percent_1rm" : "rpe" in load ? "rpe" : "fixed_weight",
    percent_1rm: load !== "bw" && "pct" in load ? load.pct : 75,
    weight_value: load !== "bw" && "kg" in load ? load.kg : 20, weight_unit: "kg",
    rpe_value: load !== "bw" && "rpe" in load ? load.rpe : 8, borg_value: 13, cr10_value: 5,
    rest_seconds: item.rest ?? 120, role: index === 0 ? "primary" : "accessory", coaching_notes: "", segment: "working",
    group_id: "", group_type: "straight", group_time_cap_seconds: 0, group_round_seconds: 0, group_total_rounds: 0
  };
}

function templateBody(programme, coachUserId) {
  return {
    coach_user_id: coachUserId, template_version: 1, template_name: programme.template_name, description: programme.description, activity_id: programme.activity_id,
    blocks: programme.blocks.map((block, b) => ({
      block_id: "", order_index: b + 1, name: block.name, description: "", block_type: block.block_type, week_count: block.weeks.length,
      weeks: block.weeks.map((sessions, w) => ({
        week_id: "", order_index: w + 1,
        sessions: sessions.map((session, s) => ({ session_id: "", order_index: s + 1, title: session.title, coaching_notes: "", work_items: session.items.map(workItem) }))
      }))
    })),
    updated_at_iso8601: new Date().toISOString()
  };
}

await call("POST", "/account/sign-in", { email, password });
const detail = await call("GET", "/account/detail");
csrf = detail.csrf_token;
const coachUserId = detail.account?.user_id;
if (detail.account?.actor_type !== "coach") throw new Error("The author must be a coach account.");

// Every exercise must be one the builder offers.
const registry = new Set(((await call("GET", "/templates/exercises")).exercises ?? []).map((e) => e.exercise_id));
const unknown = new Set();
for (const p of PROGRAMMES) for (const b of p.blocks) for (const w of b.weeks) for (const s of w) for (const i of s.items) if (!registry.has(i.id)) unknown.add(`${p.key}: ${i.id}`);
if (unknown.size) throw new Error(`Exercises the builder doesn't offer:\n${[...unknown].join("\n")}`);

const existing = new Set(((await call("GET", `/templates?coach_user_id=${encodeURIComponent(coachUserId)}`)).templates ?? []).map((t) => t.template_name));
for (const programme of PROGRAMMES) {
  if (existing.has(programme.template_name)) {
    console.log(`skip  ${programme.template_name} (already in this library)`);
    continue;
  }
  const saved = await call("POST", "/templates", templateBody(programme, coachUserId));
  let templateId = saved.template.template_id;
  const sessions = programme.blocks.reduce((n, b) => n + b.weeks.reduce((m, w) => m + w.length, 0), 0);
  if (publish) {
    await call("POST", `/templates/${templateId}/complete`, { coach_user_id: coachUserId });
    const active = await call("POST", `/templates/${templateId}/activate`, { coach_user_id: coachUserId });
    templateId = active.template?.template_id ?? templateId;
    await call("PUT", `/templates/${templateId}/catalogue-listing`, programme.listing);
    console.log(`listed ${programme.template_name} (${sessions} sessions)`);
  }
  else {
    console.log(`draft ${programme.template_name} (${sessions} sessions) - review it in the builder, then activate and publish`);
  }
}
