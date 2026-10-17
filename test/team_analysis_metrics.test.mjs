// Team and organisation analysis: a rugby squad summed up as a team, by
// position and by coach - and a teammate's pain kept to a flag.
import assert from "node:assert/strict";
import test from "node:test";

import { groupFindings, summariseBy, summariseGroup, withoutPainDetail } from "../dist/src/api/team_analysis_metrics.js";

const weeks = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];
// A front-row forward or a back: attendance, load against their usual,
// readiness against their own normal, main lifts, recurring pain.
function player(name, position, coach, { adherence = 100, ratio = 1, z = 0, lifts = ["rising"], pain = [], trained = true, attention = 0 } = {}) {
  return {
    athlete_user_id: `u_${name}`, display_name: name, coach_user_id: coach, position, attention,
    findings: pain.length ? [{ id: `pain_${pain[0]}`, section: "pain", level: "alert", text: `${pain[0]} pain reported in 2 different weeks (Back squat).` }] : [],
    weeks,
    adherence: { latest_pct: trained ? adherence : null, by_week: [100, 100, adherence, null] },
    load: { acute_chronic: trained ? ratio : null, ratio_by_week: [1, 1.05, ratio, null] },
    readiness: { z: trained ? z : null, z_by_week: [0, 0, z, z] },
    strength: lifts.map((status) => ({ name: "Back squat", status })),
    pain: { recurring_areas: pain },
    last_session: trained ? "2026-10-10" : null
  };
}

// 8 forwards and backs after a heavy pre-season week: 3 props jumped in load,
// 3 are low on readiness, one has a recurring knee, one hasn't trained.
const squad = [
  player("Prop A", "prop", "coach_1", { ratio: 1.6, z: -1.4, lifts: ["falling"], pain: ["knee"], attention: 6 }),
  player("Prop B", "prop", "coach_1", { ratio: 1.5, z: -1.2, lifts: ["falling"], attention: 4 }),
  player("Prop C", "prop", "coach_1", { ratio: 1.45, z: -1.1, attention: 2 }),
  player("Hooker", "hooker", "coach_1", { adherence: 50, attention: 3 }),
  player("Fly-half", "fly_half", "coach_2"),
  player("Centre A", "centre", "coach_2"),
  player("Centre B", "centre", "coach_2", { adherence: 67 }),
  player("Wing", "wing", "coach_2", { trained: false, lifts: [] })
];

test("the squad summed up: status, attendance, load against usual, readiness, pain, lifts, week by week", () => {
  const summary = summariseGroup(squad);
  assert.equal(summary.athletes, 8);
  assert.equal(summary.trained, 7);
  assert.deepEqual(summary.status, { needs_a_look: 3, keep_an_eye_on: 1, on_track: 3, no_training: 1 });
  assert.equal(summary.adherence.average_pct, Math.round((100 * 5 + 50 + 67) / 7));
  assert.equal(summary.adherence.under_70, 2);
  assert.equal(summary.load.high, 3);
  assert.equal(summary.readiness.low, 3);
  assert.equal(summary.pain.athletes_with_recurring_pain, 1);
  assert.equal(summary.lifts.falling, 2);
  assert.equal(summary.weekly.length, 4);
  assert.equal(summary.weekly[2].readiness_low, 3);
});

test("the team in plain sentences with next steps: a group-wide load jump and readiness dip, one recurring pain", () => {
  const list = groupFindings(summariseGroup(squad), "the team");
  const byId = Object.fromEntries(list.map((finding) => [finding.id, finding]));
  assert.equal(byId.group_load_high.text, "3 athletes of 7 had a big jump in training load last week (over 1.3× their usual).");
  assert.match(byId.group_load_high.action, /plan or the fixture list/u);
  assert.equal(byId.group_readiness.text, "3 athletes of 7 are well below their normal readiness.");
  assert.equal(byId.group_pain.text, "1 athlete has reported pain in the same area in 2 or more weeks.");
  assert.equal(byId.group_no_training.text, "1 athlete has no sessions logged in the last 8 weeks.");
  assert.ok(list.every((finding) => finding.action), "every finding has a next step");
  assert.equal(JSON.stringify(list).includes("knee"), false, "no pain detail in team findings");
});

test("by position: the props stand out from the backs", () => {
  const groups = summariseBy(squad, (row) => row.position, (key) => key);
  const props = groups.find((group) => group.key === "prop");
  assert.equal(props.athletes, 3);
  assert.equal(props.summary.load.high, 3);
  assert.ok(props.findings.some((finding) => finding.id === "group_load_high" && finding.level === "alert"));
  const centres = groups.find((group) => group.key === "centre");
  assert.equal(centres.findings.some((finding) => finding.id === "group_load_high"), false);
});

test("a gym owner's per-coach view: averages only, withheld under 3 athletes, never pain", () => {
  const groups = summariseBy([...squad.slice(0, 4), squad[4]], (row) => row.coach_user_id, (key) => key, { includePain: false, minSize: 3 });
  const coach1 = groups.find((group) => group.key === "coach_1");
  const coach2 = groups.find((group) => group.key === "coach_2");
  assert.equal(coach1.summary.pain, undefined, "no pain, not even a count");
  assert.deepEqual(coach2, { key: "coach_2", label: "coach_2", athletes: 1, withheld: true });
  const text = JSON.stringify(groups);
  for (const name of ["Prop A", "u_Prop", "knee"]) assert.equal(text.includes(name), false, `no ${name}`);
});

test("a teammate's row for someone who isn't their coach: pain is a flag, never the area", () => {
  const row = withoutPainDetail(squad[0]);
  assert.deepEqual(row.pain, { recurring: true });
  assert.equal(JSON.stringify(row).includes("knee"), false);
  assert.equal(row.findings[0].text, "Recurring pain reported - the detail is with their coach.");
  assert.deepEqual(withoutPainDetail(squad[4]).pain, { recurring: false });
});

test("squad testing: everyone's CMJ side by side, ranked, against the squad and their position", async () => {
  const { squadTesting } = await import("../dist/src/api/team_analysis_metrics.js");
  const cmj = (name, position, value) => ({ athlete_user_id: `u_${name}`, display_name: name, position, tests_latest: { cmj_cm: { value, date: "2026-10-13" } } });
  const rows = [cmj("Prop A", "prop", 38), cmj("Prop B", "prop", 40), cmj("Wing", "wing", 52), cmj("Centre", "centre", 47), { athlete_user_id: "u_x", display_name: "No test", position: "wing", tests_latest: {} }];
  const [test1] = squadTesting(rows);
  assert.equal(test1.test_id, "cmj_cm");
  assert.equal(test1.athletes, 4);
  assert.equal(test1.average, 44.3);
  assert.equal(test1.swc_source, "typical", "under 10 athletes: the test's typical smallest worthwhile change");
  assert.equal(test1.swc, 1.5);
  assert.deepEqual(test1.best, { display_name: "Wing", value: 52 });
  assert.deepEqual(test1.results.map((r) => [r.display_name, r.percentile]), [["Wing", 100], ["Centre", 67], ["Prop B", 33], ["Prop A", 0]]);
  assert.equal(test1.results.find((r) => r.display_name === "Prop B").vs_position, 1, "1 cm above the props' average");
  // 10+ athletes: the squad's own smallest worthwhile change (0.2 x SD).
  const big = Array.from({ length: 12 }, (_, i) => cmj(`P${i}`, "back", 40 + i));
  const [bigTest] = squadTesting(big);
  assert.equal(bigTest.swc_source, "squad");
  assert.equal(bigTest.swc, Math.round(0.2 * bigTest.sd * 10) / 10);
});

test("availability: counted for the team, the reason only for whoever may see it", () => {
  const rows = [
    { ...squad[0], availability: { status: "unavailable", reason: "Head injury stand-down", until: "2026-10-25" } },
    { ...squad[1], availability: { status: "modified", reason: "Pain flagged: your knee" } },
    { ...squad[4], availability: { status: "available" } }
  ];
  const summary = summariseGroup(rows);
  assert.deepEqual(summary.availability, { unavailable: 1, modified: 1, available: 1 });
  const finding = groupFindings(summary).find((f) => f.id === "group_availability");
  assert.equal(finding.text, "1 athlete unavailable, 1 athlete on modified training today.");
  assert.deepEqual(withoutPainDetail(rows[0]).availability, { status: "unavailable" }, "no reason for a teammate or the owner");
  assert.equal(summariseGroup(rows, { includePain: false }).availability, undefined, "a gym owner gets no availability counts");
});
