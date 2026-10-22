// The injury log, worked out: a winger's hamstring strain from out, to
// modified, to back - days lost, severity, the re-injury 5 weeks later, pain
// in the same place, and availability for the team sheet.
import assert from "node:assert/strict";
import test from "node:test";

import { analyseInjuries, injuryFindings, injuryRates, severityOf, worked } from "../dist/src/api/injury_metrics.js";
import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-10-18";
const hamstring = {
  id: "inj1", occurred_on: "2026-08-01", area: "thigh_back", side: "left", type: "muscle", mechanism: "non_contact", context: "match",
  history: [{ on: "2026-08-01", status: "out", expected_return: "2026-08-22" }, { on: "2026-08-15", status: "modified" }],
  returned_on: "2026-08-25"
};

test("severity bands: minimal 1-3 days, mild 4-7, moderate 8-28, severe over 28", () => {
  assert.deepEqual([0, 1, 3, 4, 7, 8, 28, 29].map(severityOf), ["no_time_lost", "minimal", "minimal", "mild", "mild", "moderate", "moderate", "severe"]);
});

test("a left hamstring strain: 14 days out, 10 modified, moderate", () => {
  const row = worked(hamstring, TODAY);
  assert.equal(row.name, "left hamstring (muscle strain)");
  assert.deepEqual([row.status, row.days_lost, row.days_modified, row.severity, row.ongoing, row.expected_return], ["returned", 14, 10, "moderate", false, null]);
});

test("still out: days lost run to today, and the athlete is unavailable for the team sheet", () => {
  const ankle = { id: "inj2", occurred_on: "2026-10-11", area: "ankle", side: "right", type: "ligament", mechanism: "contact", context: "training", history: [{ on: "2026-10-11", status: "out", expected_return: "2026-10-30" }], returned_on: null };
  const a = analyseInjuries([ankle], TODAY, "2026-08-24");
  assert.equal(a.current.days_lost, 7);
  assert.deepEqual(a.availability, { status: "unavailable", reason: "Injury: right ankle (ligament sprain)", until: "2026-10-30" });
  const f = injuryFindings(a, TODAY);
  assert.equal(f[0].id, "injury_out");
  assert.equal(f[0].text, "Out injured: right ankle (ligament sprain), since 11 Oct - expected back around 30 Oct.");
});

test("the same hamstring again 5 weeks after returning is a re-injury, and pain in the same place is flagged", () => {
  const again = { id: "inj3", occurred_on: "2026-09-29", area: "thigh_back", side: "left", type: "muscle", mechanism: "non_contact", context: "training", history: [{ on: "2026-09-29", status: "modified" }], returned_on: "2026-10-06" };
  const a = analyseInjuries([hamstring, again], TODAY, "2026-08-24");
  assert.deepEqual(a.repeats, [{ id: "inj3", kind: "early", earlier: "inj1", gap: 35 }]);
  assert.equal(a.days_lost_window, 0, "the second one was modified, not out; the first ended its out days before the window");
  const ids = injuryFindings(a, TODAY).map((f) => f.id);
  assert.ok(ids.includes("injury_reinjury") && ids.includes("injury_returned"));
  // Knee pain doesn't match a hamstring; a hip pain report doesn't either.
  assert.equal(analyseInjuries([hamstring, again], TODAY, "2026-08-24", ["knee"]).pain_same_area, null);
  const knee = { ...again, id: "inj4", area: "knee", side: "right" };
  assert.equal(analyseInjuries([knee], TODAY, "2026-08-24", ["knee"]).pain_same_area.id, "inj4");
});

test("days lost inside the window only: an injury from before it counts from the window's start", () => {
  const long = { id: "inj5", occurred_on: "2026-08-01", area: "knee", side: "right", type: "ligament", mechanism: "contact", context: "match", history: [{ on: "2026-08-01", status: "out" }], returned_on: "2026-09-01" };
  assert.equal(analyseInjuries([long], TODAY, "2026-08-24").days_lost_window, 8);
  assert.equal(worked(long, TODAY).days_lost, 31);
  assert.equal(worked(long, TODAY).severity, "severe");
});

test("injury rates per 1000 hours: incidence and burden", () => {
  assert.deepEqual(injuryRates(3, 42, 1500), { injuries: 3, days_lost: 42, exposure_hours: 1500, incidence_per_1000h: 2, burden_per_1000h: 28 });
  assert.equal(injuryRates(1, 5, 0).burden_per_1000h, null);
});

test("in the athlete's analysis: injuries come first, with a next step", () => {
  const ankle = { id: "inj2", occurred_on: "2026-10-11", area: "ankle", side: "right", type: "ligament", mechanism: "contact", context: "training", history: [{ on: "2026-10-11", status: "out" }], returned_on: null };
  const a = analyseAthlete({ today: TODAY, weeks: 8, sessions: [], readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id, is_strength_lift: () => false, injuries: [ankle] });
  assert.equal(a.injuries.current.id, "inj2");
  const list = findings(a);
  assert.equal(list[0].id, "injury_out");
  assert.match(list[0].action, /medical team's plan/u);
});

test("injury rates per 1000 hours need 100 hours: one injury in 7 hours is a count, not a rate of 143", () => {
  assert.deepEqual(injuryRates(1, 5, 7), { injuries: 1, days_lost: 5, exposure_hours: 7, incidence_per_1000h: null, burden_per_1000h: null, rates_need_hours: 100 });
  assert.equal(injuryRates(1, 5, 100).incidence_per_1000h, 10);
});
