// Recognised programmes - the programmes coaches already know by name,
// written in the Kolosseum notation (kolosseum_programmes_v1.mjs) so a coach
// can start from one. Each is named for what it is, with the programme it's
// based on credited in its title and summary; none is the official product,
// and none is endorsed by its author (that's said in every summary). The
// training structures - sets, reps, percentages and progressions - are the
// widely published methods; the reasoning is in
// docs/programmes/KOLOSSEUM_PROGRAMMES_V1.md.
//
// Loads are % of the athlete's real max (1RM). Programmes written around a
// "training max" (90% of 1RM: 5/3/1, the Juggernaut Method) are converted, so
// 85% of a training max is written as 77.5% of max. Climbing work sets use a
// % range ({ pct, pct_max }) with the per-set percentages in the note: the
// builder holds each exercise once a session.
//
// Left out on purpose: Smolov, the Bulgarian method and German Volume
// Training (10 x 10) - each needs more than the builder's 8 sets or daily
// near-maximal work no unsupervised athlete should be handed.

const ex = (id, sets, reps, load, rest, note) => ({ id, sets, reps, load, rest, ...(note ? { note } : {}) });
const range = (pct, pct_max) => ({ pct, pct_max });
const AMRAP = "Last set: as many good reps as you can, stopping one short of failure - log them; they update your max.";
const notEndorsed = (author) => `Independent - not endorsed by ${author}.`;

// ---------------------------------------------------------------------------
// Novice linear progressions (beginner, any sport, 3 days a week, 12 weeks).
// Two sessions, A and B, alternate (A B A, B A B). The weight goes up every
// session while every rep is clean; the weekly % is a guide for setting it,
// with one reset week (7) as the programmes advise when progress stalls.
const NOVICE_PCT = [65, 67.5, 70, 72.5, 75, 77.5, 70, 77.5, 80, 82.5, 85, 85];
const FIVES_PCT = [62.5, 65, 67.5, 70, 72.5, 75, 67.5, 75, 77.5, 80, 80, 82.5];
const ADD = "Add a little weight every session while every rep is clean (2.5 kg on squats and deadlifts, 1-2.5 kg on presses).";
const alternating = (week, dayFn) => (week % 2 === 1 ? ["A", "B", "A"] : ["B", "A", "B"]).map((day) => dayFn(day, week));
const novice = (key, template_name, title, summary, description, dayFn, next) => ({
  key, template_name, activity_id: "general_strength", description,
  listing: { title, summary, levels: ["beginner"], activity_ids: [], days_per_week: 3, ...(next ? { next } : {}) },
  blocks: [
    { name: "Linear progression", block_type: "general", weeks: [1, 2, 3, 4, 5, 6].map((w) => alternating(w, dayFn)) },
    { name: "Reset and push on", block_type: "general", weeks: [7, 8, 9, 10, 11, 12].map((w) => alternating(w, dayFn)) }
  ]
});

const linear3x5 = novice(
  "novice_linear_3x5", "Novice linear 3x5",
  "Novice linear 3×5 (based on Starting Strength)",
  `Three days a week, alternating two sessions: squats every session, bench and overhead press in turn, deadlifts, power cleans and chin-ups - adding weight every session. Based on Mark Rippetoe's Starting Strength. ${notEndorsed("Mark Rippetoe or Starting Strength")}`,
  "A novice linear progression in the style of Starting Strength: squat 3x5 every session, bench press and overhead press alternating at 3x5, deadlift 1x5 and power cleans 5x3, chin-ups from week 1. Weight goes up every session; week 7 resets 10% and builds back past it.",
  (day, week) => {
    const pct = NOVICE_PCT[week - 1];
    return day === "A"
      ? { title: "Day A", items: [ex("back_squat", 3, 5, { pct }, 240, ADD), ex("bench_press", 3, 5, { pct }, 180), ex("deadlift", 1, 5, { pct }, 240)] }
      : { title: "Day B", items: [ex("back_squat", 3, 5, { pct }, 240, ADD), ex("overhead_press", 3, 5, { pct }, 180), ex("power_clean", 5, 3, { rpe: 6 }, 120, "Fast and crisp: a weight you can move fast for every rep."), ex("chin_up", 3, [5, 8], "bw", 120)] };
  },
  "texas_method"
);

const novice5x5 = novice(
  "novice_5x5", "Novice 5x5",
  "Novice 5×5 (based on StrongLifts 5×5)",
  `Three days a week, alternating two sessions of three lifts: squats every session at 5×5, bench, rows and overhead press at 5×5, deadlifts 1×5 - adding weight every session. Based on Mehdi Hadim's StrongLifts 5×5. ${notEndorsed("Mehdi Hadim or StrongLifts")}`,
  "A novice 5x5 in the style of StrongLifts: workout A is squat, bench press and barbell row at 5x5; workout B is squat and overhead press at 5x5 and deadlift 1x5. Weight goes up every session; week 7 resets and builds back past it.",
  (day, week) => {
    const pct = FIVES_PCT[week - 1];
    return day === "A"
      ? { title: "Workout A", items: [ex("back_squat", 5, 5, { pct }, 180, ADD), ex("bench_press", 5, 5, { pct }, 180), ex("barbell_row", 5, 5, { pct: pct - 5 }, 150)] }
      : { title: "Workout B", items: [ex("back_squat", 5, 5, { pct }, 180, ADD), ex("overhead_press", 5, 5, { pct }, 180), ex("deadlift", 1, 5, { pct: pct + 2.5 }, 240)] };
  },
  "ramping_5x5"
);

const noviceAmrap = novice(
  "novice_amrap_linear", "Novice linear with AMRAP sets",
  "Novice linear with AMRAP sets (based on Greyskull LP)",
  `Three days a week, alternating two sessions: two sets of 5 then a last set of as many reps as you can, which decides the next jump. Presses alternate, squats and deadlifts alternate, chin-ups and rows every week. Based on John Sheaffer's Greyskull LP. ${notEndorsed("John Sheaffer or Greyskull")}`,
  "A novice linear progression in the style of Greyskull LP: main lifts 2x5 then a 5+ set; more than 10 reps on the last set doubles the next jump, fewer than 5 resets the weight 10%. Presses alternate every session; squat and deadlift alternate.",
  (day, week) => {
    const pct = NOVICE_PCT[week - 1];
    const plus = "Two sets of 5, then as many as you can (stop one short of failure). 10+ reps: double the next jump; under 5: take 10% off.";
    return day === "A"
      ? { title: "Day A", items: [ex("overhead_press", 3, 5, { pct }, 180, plus), ex("chin_up", 3, [5, 8], "bw", 120), ex("back_squat", 3, 5, { pct }, 240, plus), ex("dumbbell_curl", 2, 10, { rpe: 7 }, 60)] }
      : { title: "Day B", items: [ex("bench_press", 3, 5, { pct }, 180, plus), ex("barbell_row", 3, 5, { pct: pct - 5 }, 150, plus), ex("deadlift", 1, 5, { pct: Math.min(pct + 2.5, 85) }, 240, "One set of 5 or more - stop one short of failure."), ex("cable_triceps_pressdown", 2, 12, { rpe: 7 }, 60)] };
  },
  "texas_method"
);

// Bodyweight fundamentals: pull, dip, squat, hinge, push and row
// progressions, harder every 4 weeks, plus the core triplet.
const BW_STEPS = [
  { pull: "band_assisted_pull_up", dip: "assisted_dip", squat: "goblet_squat", hinge: "glute_bridge", push: "incline_push_up", row: "inverted_row" },
  { pull: "pull_up", dip: "dip", squat: "bulgarian_split_squat", hinge: "single_leg_glute_bridge", push: "push_up", row: "inverted_row" },
  { pull: "chin_up", dip: "dip", squat: "pistol_squat", hinge: "nordic_curl", push: "pike_push_up", row: "rear_delt_inverted_row" }
];
const bodyweightWeek = (week) => {
  const step = BW_STEPS[Math.floor((week - 1) / 4)];
  const reps = week % 4 === 0 ? 5 : [5, 8];
  const sets = week % 4 === 0 ? 2 : 3;
  // Dips and push-ups take turns, and one core exercise a session, so a
  // beginner's pressing and trunk volume stays where they recover from it.
  const session = (title, press, core) => ({ title, items: [
    ex(step.pull, sets, reps, "bw", 90, "Move on to the next step once you get 3 sets of 8."), ex(step.squat, sets, reps, step.squat === "goblet_squat" ? { rpe: 7 } : "bw", 90),
    ex(press, sets, reps, "bw", 90), ex(step.hinge, sets, reps, "bw", 90), ex(step.row, sets, [5, 8], "bw", 90), core
  ] });
  return [
    session("Full body 1", step.dip, ex("front_plank", 2, { seconds: 30 }, "bw", 45)),
    session("Full body 2", step.push, ex("side_plank", 2, { seconds: 20 }, "bw", 45)),
    session("Full body 3", step.dip, ex("dead_bug", 2, 8, "bw", 45))
  ];
};
const bodyweightFundamentals = {
  key: "bodyweight_fundamentals",
  template_name: "Bodyweight fundamentals",
  activity_id: "general_strength",
  description: "Three full-body sessions a week with no equipment beyond a bar, rings or a box: pull-up, squat, hinge and row progressions in 3 sets of 5-8 every session, dips and push-ups in turn, a harder step every 4 weeks, and one core exercise a session (plank, side plank or dead bug). In the style of the r/bodyweightfitness Recommended Routine.",
  listing: { title: "Bodyweight fundamentals (based on the r/bodyweightfitness Recommended Routine)", summary: `New to training, or no gym? Three full-body sessions a week: pull-up, dip, squat, hinge, row and push-up progressions, a harder step every 4 weeks, and core work. Based on the r/bodyweightfitness Recommended Routine. ${notEndorsed("r/bodyweightfitness")}`, levels: ["beginner"], activity_ids: [], days_per_week: 3, next: "novice_linear_3x5" },
  blocks: [
    { name: "Assisted", block_type: "general", weeks: [1, 2, 3, 4].map(bodyweightWeek) },
    { name: "Full range", block_type: "general", weeks: [5, 6, 7, 8].map(bodyweightWeek) },
    { name: "Harder steps", block_type: "general", weeks: [9, 10, 11, 12].map(bodyweightWeek) }
  ]
};

// ---------------------------------------------------------------------------
// 5/3/1 family. Training max = 90% of 1RM; the three work sets per week, in %
// of 1RM: 5s week 58.5/67.5/76.5, 3s week 63/72/81, 5/3/1 week 67.5/76.5/85.5
// (rounded to 2.5). The deload (40/50/60% of TM) is lifted to the 50%
// floor the builder's programmes keep.
const WAVE = [
  { reps: 5, lo: 57.5, hi: 77.5, sets: "5 reps at 57.5%, 67.5%, then 77.5% for 5+" },
  { reps: 3, lo: 62.5, hi: 80, sets: "3 reps at 62.5%, 72.5%, then 80% for 3+" },
  { reps: [1, 5], lo: 67.5, hi: 85, sets: "5 at 67.5%, 3 at 77.5%, then 85% for 1+" },
  { reps: 5, lo: 50, hi: 55, sets: "deload: 5 reps at 50%, 50%, then 55% - no extra reps" }
];
const waveSet = (lift, week, extraSets = 0, extraNote = "") => {
  const w = WAVE[(week - 1) % 4];
  const deload = (week - 1) % 4 === 3;
  return ex(lift, 3 + (deload ? 0 : extraSets), w.reps, range(w.lo, w.hi), 180, `Work sets: ${w.sets} (as many good reps as you can on the last, one short of failure${deload ? "" : " - log them"}).${extraNote}`);
};
const bbbWeek = (week) => {
  const deload = (week - 1) % 4 === 3;
  // Boring But Big: 5 x 10 at 50% (the opposite lift - a squat day's BBB is
  // deadlifts, a press day's is bench).
  const bbb = (lift) => ex(lift, deload ? 3 : 5, 10, { pct: 50 }, 90, "Boring But Big: 5 sets of 10 at 50%, steady.");
  const s = (n) => (deload ? Math.max(2, n - 2) : n);
  return [
    { title: "Press", items: [waveSet("overhead_press", week), bbb("bench_press"), ex("chin_up", s(5), [5, 10], "bw", 90, "50+ reps across the sets."), ex("dumbbell_lateral_raise", s(3), 15, { rpe: 8 }, 60)] },
    { title: "Deadlift", items: [waveSet("deadlift", week), bbb("back_squat"), ex("hanging_leg_raise", s(5), 10, "bw", 60)] },
    { title: "Bench", items: [waveSet("bench_press", week), bbb("overhead_press"), ex("single_arm_dumbbell_row", s(5), 10, { rpe: 8 }, 60)] },
    { title: "Squat", items: [waveSet("back_squat", week), bbb("deadlift"), ex("lying_leg_curl", s(5), 10, { rpe: 8 }, 60), ex("ab_wheel_rollout", s(3), 10, "bw", 60)] }
  ];
};
const wave531Bbb = {
  key: "wave_531_bbb",
  template_name: "Wave 5s/3s/1s with 5x10",
  activity_id: "general_strength",
  description: "Four days a week, one main lift a day in a 4-week wave - 5s, 3s, 5/3/1, deload - from a training max of 90% of your 1RM, each followed by 5x10 at 50% of the opposite lift and 50+ reps of assistance. Three cycles; raise the training max 2.5 kg on presses and 5 kg on squat and deadlift after each. In the style of Jim Wendler's 5/3/1 Boring But Big.",
  listing: { title: "Wave 5s/3s/1s with 5×10 (based on 5/3/1 Boring But Big)", summary: `Four days a week: one main lift a day in a 4-week wave (5s, 3s, 5/3/1, deload) with an all-out last set, then 5×10 of the opposite lift and assistance. Three cycles of steady, long-term progress. Based on Jim Wendler's 5/3/1 Boring But Big. ${notEndorsed("Jim Wendler")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 4, next: "rep_waves" },
  blocks: [1, 2, 3].map((cycle) => ({ name: `Cycle ${cycle}`, block_type: cycle === 3 ? "strength" : "volume", weeks: [1, 2, 3, 4].map((w) => bbbWeek((cycle - 1) * 4 + w)) }))
};
// 5/3/1 for Beginners: three full-body days, two main lifts each, and
// First Set Last - 5 x 5 at the first work set's weight - done in the same
// exercise as 8 sets (3 work sets then 5 back-off sets).
const fslWeek = (week) => {
  const deload = (week - 1) % 4 === 3;
  // First Set Last at 3x5 (the original goes to 5x5): with every lift twice
  // a week, 5x5 takes a beginner's week past what they recover from.
  const fsl = deload ? "" : " Then First Set Last: 3 sets of 5 back at the first set's weight.";
  const main = (lift) => waveSet(lift, week, 3, fsl);
  const s = (n) => (deload ? 2 : n);
  return [
    { title: "Day 1", items: [main("back_squat"), main("bench_press"), ex("chin_up", s(3), [5, 10], "bw", 90), ex("hanging_leg_raise", s(3), 10, "bw", 60)] },
    { title: "Day 2", items: [main("deadlift"), main("overhead_press"), ex("single_arm_dumbbell_row", s(3), 10, { rpe: 7 }, 60), ex("dead_bug", s(2), 8, "bw", 45)] },
    { title: "Day 3", items: [main("bench_press"), main("back_squat"), ex("inverted_row", s(3), 10, "bw", 60), ex("ab_wheel_rollout", s(3), 8, "bw", 60)] }
  ];
};
const wave531Fsl = {
  key: "wave_531_full_body",
  template_name: "Wave 5s/3s/1s full body",
  activity_id: "general_strength",
  description: "Three full-body days a week, two main lifts a day in the 5s / 3s / 5-3-1 wave from a training max of 90%, then 3x5 at the first work set's weight (First Set Last - the original goes to 5x5; 3x5 keeps a twice-a-week beginner recoverable), and pull and core work. Three 4-week cycles. In the style of Jim Wendler's 5/3/1 for Beginners.",
  listing: { title: "Wave 5s/3s/1s full body (based on 5/3/1 for Beginners)", summary: `Three full-body days a week: squat, bench, deadlift and press twice a week in a 4-week wave, 3×5 back-off sets, and pull and core work. Three cycles. Based on Jim Wendler's 5/3/1 for Beginners. ${notEndorsed("Jim Wendler")}`, levels: ["beginner", "amateur"], activity_ids: [], days_per_week: 3, next: "wave_531_bbb" },
  blocks: [1, 2, 3].map((cycle) => ({ name: `Cycle ${cycle}`, block_type: "general", weeks: [1, 2, 3, 4].map((w) => fslWeek((cycle - 1) * 4 + w)) }))
};

// ---------------------------------------------------------------------------
// Tiered T1/T2/T3 (GZCLP): heavy T1 5x3 -> 6x2 -> 8x1 stages, T2 3x10 ->
// 3x8 -> 3x6, T3 3x15+ - four days, each main lift once as T1 and once as T2.
const gzclpWeek = (week) => {
  const stage = week <= 4 ? 0 : week <= 8 ? 1 : 2;
  const step = (week - 1) % 4;
  const t1 = [[5, 3, 80], [6, 2, 85], [8, 1, 87.5]][stage];
  const t2 = [[3, 10, 62.5], [3, 8, 67.5], [3, 6, 72.5]][stage];
  const t1pct = t1[2] + step * 2.5;
  const t2pct = t2[2] + step * 2.5;
  const T1 = (lift) => ex(lift, t1[0], t1[1], { pct: Math.min(t1pct, 92.5) }, 210, `T1: ${t1[0]}x${t1[1]}, the last set as many as you can. Miss the reps and move to the next stage.`);
  const T2 = (lift) => ex(lift, t2[0], t2[1], { pct: t2pct }, 150, "T2: add weight each time you make every rep.");
  const T3 = (lift) => ex(lift, 3, 15, { rpe: 8 }, 60, "T3: the last set as many as you can; 25+ reps and you add weight.");
  return [
    { title: "Day 1 - squat / bench", items: [T1("back_squat"), T2("bench_press"), T3("lat_pulldown")] },
    { title: "Day 2 - press / deadlift", items: [T1("overhead_press"), T2("deadlift"), T3("single_arm_dumbbell_row")] },
    { title: "Day 3 - bench / squat", items: [T1("bench_press"), T2("back_squat"), T3("lat_pulldown")] },
    { title: "Day 4 - deadlift / press", items: [T1("deadlift"), T2("overhead_press"), T3("single_arm_dumbbell_row")] }
  ];
};
const tieredLinear = {
  key: "tiered_linear",
  template_name: "Tiered T1/T2/T3 progression",
  activity_id: "general_strength",
  description: "Four days a week: a heavy T1 lift (5x3, then 6x2, then 8x1 as you stall), a T2 lift for volume (3x10, 3x8, 3x6) and a T3 accessory for 3x15+, each of squat, bench, deadlift and press once as T1 and once as T2. In the style of Cody Lefever's GZCLP.",
  listing: { title: "Tiered T1/T2/T3 progression (based on GZCLP)", summary: `Four days a week: a heavy main lift, a volume lift and a high-rep accessory, moving to the next set-and-rep stage each time you stall. Built for lifters coming off their first linear programme. Based on Cody Lefever's GZCLP. ${notEndorsed("Cody Lefever")}`, levels: ["amateur"], activity_ids: [], days_per_week: 4, next: "wave_531_bbb" },
  blocks: [
    { name: "Stage 1", block_type: "volume", weeks: [1, 2, 3, 4].map(gzclpWeek) },
    { name: "Stage 2", block_type: "strength", weeks: [5, 6, 7, 8].map(gzclpWeek) },
    { name: "Stage 3", block_type: "peak", weeks: [9, 10, 11, 12].map(gzclpWeek) }
  ]
};

// ---------------------------------------------------------------------------
// Texas Method: Monday volume (5x5 at ~90% of Friday), Wednesday recovery,
// Friday intensity (a new 5-rep best). Bench and press swap each week.
const TX_FRI = [82.5, 83.5, 85, 85, 86, 87.5, 82.5, 87.5, 88.5, 90, 90, 85];
const texasWeek = (week) => {
  const fri = TX_FRI[week - 1];
  const mon = Math.round((fri * 0.9) / 2.5) * 2.5;
  const [heavyPress, lightPress] = week % 2 === 1 ? ["bench_press", "overhead_press"] : ["overhead_press", "bench_press"];
  return [
    { title: "Volume day", items: [ex("back_squat", 5, 5, { pct: mon }, 240), ex(heavyPress, 5, 5, { pct: mon }, 180), ex("deadlift", 1, 5, { pct: mon + 5 }, 240), ex("chin_up", 3, [5, 8], "bw", 120)] },
    { title: "Recovery day", items: [ex("back_squat", 2, 5, { pct: Math.round((mon * 0.8) / 2.5) * 2.5 }, 180, "Light: it's for recovery, not training."), ex(lightPress, 3, 5, { pct: mon - 7.5 }, 150), ex("chin_up", 3, [5, 8], "bw", 90), ex("back_extension", 3, 10, "bw", 60)] },
    { title: "Intensity day", items: [ex("back_squat", 1, 5, { pct: fri }, 300, "Work up to one heavy set of 5 - a new best."), ex(heavyPress, 1, 5, { pct: fri }, 240, "Work up to one heavy set of 5."), ex("power_clean", 5, 3, { rpe: 7 }, 150), ex("barbell_row", 3, 8, { rpe: 7 }, 90)] }
  ];
};
const texasMethod = {
  key: "texas_method",
  template_name: "Volume, recovery and intensity days",
  activity_id: "general_strength",
  description: "Three days a week for a lifter who can no longer add weight every session: Monday is volume (5x5 at about 90% of Friday's weight), Wednesday a light recovery day, Friday intensity - one heavy set of 5 for a new best. Bench and press swap week to week; week 7 eases off before the second push. In the style of the Texas Method (Glenn Pendlay and Mark Rippetoe).",
  listing: { title: "Volume, recovery and intensity days (based on the Texas Method)", summary: `Past novice gains? Three days a week: a volume day, a light recovery day and a heavy day aiming at a new 5-rep best every week. Based on the Texas Method (Glenn Pendlay, Mark Rippetoe). ${notEndorsed("Glenn Pendlay's estate or Mark Rippetoe")}`, levels: ["amateur"], activity_ids: [], days_per_week: 3, next: "wave_531_bbb" },
  blocks: [
    { name: "Weekly progression", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6].map(texasWeek) },
    { name: "Second push", block_type: "strength", weeks: [7, 8, 9, 10, 11, 12].map(texasWeek) }
  ]
};

// Madcow 5x5: ramped sets of 5 to a top set on Monday, a lighter Wednesday,
// and on Friday a triple 2.5% over Monday's top set. The top set goes up 2.5%
// a week; week 5 is a lighter week, then it climbs past the old best.
const MADCOW_TOP = [77.5, 80, 82.5, 85, 75, 85, 87.5, 90];
// The first ramp set: about 62.5% of the top set, never under 50% of max.
const rampStart = (top) => Math.max(50, Math.round((top * 0.625) / 2.5) * 2.5);
const madcowWeek = (week) => {
  const top = MADCOW_TOP[week - 1];
  const ramp = (sets, lift, t = top, extra = "") => ex(lift, sets, 5, range(rampStart(t), t), 180, `Ramp sets of 5 in even jumps up to a top set at ${t}%.${extra}`);
  return [
    { title: "Monday - heavy", items: [ramp(5, "back_squat"), ramp(5, "bench_press"), ramp(5, "barbell_row"), ex("back_extension", 2, 10, "bw", 60), ex("hanging_leg_raise", 3, 10, "bw", 60)] },
    { title: "Wednesday - light", items: [ramp(4, "back_squat", Math.round((top * 0.8) / 2.5) * 2.5, " Light day - stop at the third Monday set's weight."), ramp(4, "overhead_press"), ramp(4, "deadlift"), ex("front_plank", 3, { seconds: 30 }, "bw", 45)] },
    { title: "Friday - top triple", items: [
      ex("back_squat", 6, [3, 8], range(rampStart(top), Math.min(top + 2.5, 92.5)), 210, `Ramp 4 sets of 5 to Monday's top, a triple at ${Math.min(top + 2.5, 92.5)}%, then one set of 8 at the third set's weight.`),
      ex("bench_press", 6, [3, 8], range(rampStart(top), Math.min(top + 2.5, 92.5)), 180, "Same as the squat: ramp, a triple, then 8 back down."),
      ramp(5, "barbell_row"), ex("barbell_curl", 3, 10, { rpe: 7 }, 60), ex("cable_triceps_pressdown", 3, 10, { rpe: 7 }, 60)
    ] }
  ];
};
const ramping5x5 = {
  key: "ramping_5x5",
  template_name: "Ramping weekly 5x5",
  activity_id: "general_strength",
  description: "Three days a week, one heavy week's worth of progress at a time: Monday ramps sets of 5 to a top set, Wednesday is lighter with deadlifts and presses, Friday ramps to a triple just over Monday's best and finishes with a back-off 8. Week 5 eases off, then the top sets climb past their old best. In the style of Madcow 5x5 (after Bill Starr).",
  listing: { title: "Ramping weekly 5×5 (based on Madcow 5×5)", summary: `For lifters stalling on a novice 5×5: three days a week of ramped sets to a heavy top set, a lighter mid-week day, and a heavy triple on Friday, progressing weekly. Based on Madcow 5×5, after Bill Starr. ${notEndorsed("its authors")}`, levels: ["amateur"], activity_ids: [], days_per_week: 3, next: "wave_531_bbb" },
  blocks: [
    { name: "Build to a best", block_type: "strength", weeks: [1, 2, 3, 4].map(madcowWeek) },
    { name: "Reset and beat it", block_type: "strength", weeks: [5, 6, 7, 8].map(madcowWeek) }
  ]
};

// ---------------------------------------------------------------------------
// Juggernaut Method: four 4-week waves (10s, 8s, 5s, 3s) - accumulation,
// intensification, realisation (an all-out set) and a deload - each % here of
// 1RM (from a 90% training max).
const JUGG = {
  10: [[5, 10, 55], [3, 10, 60], [1, 10, 67.5]],
  8: [[5, 8, 57.5], [3, 8, 65], [1, 8, 72.5]],
  5: [[6, 5, 62.5], [4, 5, 70], [1, 5, 77.5]],
  3: [[7, 3, 67.5], [5, 3, 75], [1, 3, 80]]
};
const juggWeek = (repWave, phase) => {
  const deload = phase === 3;
  const [sets, reps, pct] = deload ? [3, 5, 50] : JUGG[repWave][phase];
  const note = deload ? "Deload: 3 easy sets of 5." : phase === 2 ? `Realisation: warm up, then one set of ${reps}+ at ${pct}% - as many as you can, one short of failure. Your reps over ${reps} raise the next wave's training max.` : `${["Accumulation", "Intensification"][phase]}: ${sets} sets of ${reps}${phase === 1 ? " after a few lighter sets of 3-5" : ""}.`;
  const main = (lift) => ex(lift, sets, reps, { pct }, reps >= 8 ? 150 : 210, note);
  const s = (n) => (deload ? 2 : n);
  return [
    { title: "Squat", items: [main("back_squat"), ex("romanian_deadlift", s(3), 8, { rpe: 7 }, 120), ex("walking_lunge", s(3), 10, { rpe: 7 }, 90), ex("hanging_leg_raise", s(3), 10, "bw", 60)] },
    { title: "Bench", items: [main("bench_press"), ex("pull_up", s(4), [6, 10], "bw", 90), ex("dumbbell_overhead_press", s(3), 10, { rpe: 7 }, 75), ex("face_pull", s(3), 15, { rpe: 7 }, 45)] },
    { title: "Deadlift", items: [main("deadlift"), ex("front_squat", s(3), 6, { rpe: 7 }, 120), ex("glute_ham_raise", s(3), 8, "bw", 75), ex("ab_wheel_rollout", s(3), 10, "bw", 60)] },
    { title: "Overhead press", items: [main("overhead_press"), ex("barbell_row", s(4), 8, { rpe: 7 }, 90), ex("dip", s(3), [8, 12], "bw", 75), ex("dumbbell_curl", s(3), 12, { rpe: 7 }, 45)] }
  ];
};
const repWaves = {
  key: "rep_waves",
  template_name: "Rep waves 10s, 8s, 5s, 3s",
  activity_id: "general_strength",
  description: "Four days a week, one main lift a day, through four 4-week waves - 10s, 8s, 5s, then 3s - each with an accumulation week, an intensification week, a realisation week (one all-out set whose extra reps raise the training max) and a deload. Sixteen weeks from building work capacity to heavy triples. In the style of Chad Wesley Smith's Juggernaut Method.",
  listing: { title: "Rep waves 10s, 8s, 5s, 3s (based on the Juggernaut Method)", summary: `Sixteen weeks, four days a week: waves of 10s, 8s, 5s and 3s on squat, bench, deadlift and press, each ending in an all-out set that sets the next wave's weights. Good for strength athletes and lifters who want size and strength. Based on Chad Wesley Smith's Juggernaut Method. ${notEndorsed("Chad Wesley Smith or Juggernaut Training Systems")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 4, next: "wave_531_bbb" },
  blocks: [10, 8, 5, 3].map((repWave) => ({ name: `${repWave}s wave`, block_type: repWave >= 8 ? "volume" : repWave === 5 ? "strength" : "peak", weeks: [0, 1, 2, 3].map((phase) => juggWeek(repWave, phase)) }))
};

// ---------------------------------------------------------------------------
// Power and hypertrophy upper/lower (PHUL), 4 days.
const PHUL_PCT = [77.5, 80, 82.5, 72.5, 80, 82.5, 85, 75, 82.5, 85, 87.5, 75];
const phulWeek = (week) => {
  const pct = PHUL_PCT[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Upper power", items: [ex("bench_press", s(4), [3, 5], { pct }, 180), ex("incline_dumbbell_press", s(3), [6, 10], { rpe: 8 }, 120), ex("barbell_row", s(4), [3, 5], { pct: pct - 7.5 }, 150), ex("lat_pulldown", s(3), [6, 10], { rpe: 8 }, 90), ex("overhead_press", s(3), [5, 8], { rpe: 8 }, 120), ex("barbell_curl", s(2), [6, 10], { rpe: 8 }, 60), ex("barbell_skullcrusher", s(2), [6, 10], { rpe: 8 }, 60)] },
    { title: "Lower power", items: [ex("back_squat", s(4), [3, 5], { pct }, 210), ex("deadlift", s(3), [3, 5], { pct: pct - 2.5 }, 210), ex("leg_press", s(4), [10, 15], { rpe: 8 }, 120), ex("lying_leg_curl", s(3), [6, 10], { rpe: 8 }, 75), ex("standing_calf_raise", s(4), [6, 10], { rpe: 8 }, 60)] },
    { title: "Upper hypertrophy", items: [ex("incline_bench_press", s(4), [8, 12], { rpe: 8 }, 120), ex("dumbbell_fly", s(3), [8, 12], { rpe: 8 }, 75), ex("seated_cable_row", s(4), [8, 12], { rpe: 8 }, 90), ex("single_arm_dumbbell_row", s(3), [8, 12], { rpe: 8 }, 75), ex("dumbbell_lateral_raise", s(3), [10, 15], { rpe: 8 }, 60), ex("dumbbell_curl", s(3), [8, 12], { rpe: 8 }, 60), ex("cable_triceps_pressdown", s(3), [10, 15], { rpe: 8 }, 60)] },
    { title: "Lower hypertrophy", items: [ex("front_squat", s(3), [8, 12], { rpe: 8 }, 150), ex("barbell_hip_thrust", s(3), [8, 12], { rpe: 8 }, 90), ex("walking_lunge", s(3), [8, 12], { rpe: 8 }, 90), ex("leg_extension", s(3), [10, 15], { rpe: 8 }, 60), ex("seated_leg_curl", s(3), [10, 15], { rpe: 8 }, 60), ex("seated_calf_raise", s(4), [10, 15], { rpe: 8 }, 45)] }
  ];
};
const phul = {
  key: "power_hypertrophy_upper_lower",
  template_name: "Power and hypertrophy upper/lower",
  activity_id: "general_strength",
  description: "Four days a week: an upper and a lower power day (heavy 3-5s on the big lifts) and an upper and a lower hypertrophy day (8-12s and 10-15s), every fourth week lighter. In the style of Brandon Campbell's PHUL.",
  listing: { title: "Power and hypertrophy upper/lower (based on PHUL)", summary: `Strength and size together: four days a week - heavy upper and lower days on the big lifts, and upper and lower days for muscle at higher reps - lighter every fourth week. Based on Brandon Campbell's PHUL. ${notEndorsed("Brandon Campbell")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 4, next: "power_hypertrophy_5_day" },
  blocks: [1, 2, 3].map((wave) => ({ name: `Wave ${wave}`, block_type: wave === 1 ? "volume" : "strength", weeks: [1, 2, 3, 4].map((w) => phulWeek((wave - 1) * 4 + w)) }))
};

// Power and hypertrophy, 5 days (PHAT): an upper and a lower power day, then
// three hypertrophy days - back and shoulders, legs, chest and arms - each
// opening with speed sets of the power day's lift at 65-70%.
const phatWeek = (week) => {
  const pct = PHUL_PCT[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const speed = (lift) => ex(lift, s(6), 3, { pct: 65 }, 60, "Speed work: 6 fast triples at 65% with a minute's rest - move the bar as fast as you can.");
  return [
    { title: "Upper power", items: [ex("pendlay_row", s(3), [3, 5], { pct: pct - 10 }, 180), ex("pull_up", s(2), [6, 10], "bw", 120, "Add weight once 10 are easy."), ex("bench_press", s(3), [3, 5], { pct }, 180), ex("dip", s(2), [6, 10], "bw", 120), ex("dumbbell_overhead_press", s(3), [6, 10], { rpe: 8 }, 90), ex("barbell_curl", s(3), [6, 10], { rpe: 8 }, 60), ex("barbell_skullcrusher", s(3), [6, 10], { rpe: 8 }, 60)] },
    { title: "Lower power", items: [ex("back_squat", s(3), [3, 5], { pct }, 210), ex("hack_squat", s(2), [6, 10], { rpe: 8 }, 120), ex("leg_extension", s(2), [6, 10], { rpe: 8 }, 75), ex("stiff_leg_deadlift", s(3), [5, 8], { rpe: 8 }, 120), ex("lying_leg_curl", s(2), [6, 10], { rpe: 8 }, 75), ex("standing_calf_raise", s(3), [6, 10], { rpe: 8 }, 60)] },
    { title: "Back and shoulders hypertrophy", items: [speed("pendlay_row"), ex("chin_up", s(3), [8, 12], "bw", 90), ex("seated_cable_row", s(3), [8, 12], { rpe: 8 }, 75), ex("single_arm_dumbbell_row", s(2), [12, 15], { rpe: 8 }, 60), ex("dumbbell_lateral_raise", s(3), [12, 20], { rpe: 8 }, 45), ex("shrug", s(2), [12, 15], { rpe: 8 }, 60)] },
    { title: "Legs hypertrophy", items: [speed("back_squat"), ex("hack_squat", s(3), [8, 12], { rpe: 8 }, 90), ex("leg_press", s(2), [12, 15], { rpe: 8 }, 90), ex("leg_extension", s(3), [15, 20], { rpe: 8 }, 60), ex("romanian_deadlift", s(3), [8, 12], { rpe: 8 }, 90), ex("seated_leg_curl", s(2), [12, 15], { rpe: 8 }, 60), ex("seated_calf_raise", s(3), [10, 15], { rpe: 8 }, 45)] },
    { title: "Chest and arms hypertrophy", items: [speed("bench_press"), ex("incline_dumbbell_press", s(3), [8, 12], { rpe: 8 }, 90), ex("cable_fly", s(2), [12, 15], { rpe: 8 }, 60), ex("dumbbell_curl", s(3), [8, 12], { rpe: 8 }, 45), ex("hammer_curl", s(2), [12, 15], { rpe: 8 }, 45), ex("cable_triceps_pressdown", s(3), [8, 12], { rpe: 8 }, 45), ex("overhead_cable_triceps_extension", s(2), [12, 15], { rpe: 8 }, 45)] }
  ];
};
const phat = {
  key: "power_hypertrophy_5_day",
  template_name: "Power and hypertrophy, 5 days",
  activity_id: "general_strength",
  description: "Five days a week: an upper and a lower power day (heavy 3-5s), then back and shoulders, legs, and chest and arms hypertrophy days that open with fast triples at 65% and finish with 8-20 rep work. Every fourth week lighter. In the style of Layne Norton's PHAT.",
  listing: { title: "Power and hypertrophy, 5 days (based on PHAT)", summary: `Five days a week for experienced lifters after size and strength: two heavy power days, then three body-part hypertrophy days opening with speed sets. Lighter every fourth week. Based on Layne Norton's PHAT. ${notEndorsed("Layne Norton")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 5, next: "power_hypertrophy_upper_lower" },
  blocks: [1, 2, 3].map((wave) => ({ name: `Wave ${wave}`, block_type: wave === 1 ? "volume" : "strength", weeks: [1, 2, 3, 4].map((w) => phatWeek((wave - 1) * 4 + w)) }))
};

// Push/pull/legs, 6 days (the r/Fitness PPL): each day twice a week, main
// lifts 5x5 / 4x5 / 3x5 with an all-out last set (deadlift 1x5+), the rest
// 8-12s, 15-20s on face pulls and raises.
const pplWeek = (week) => {
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const pct = [75, 77.5, 80, 70, 77.5, 80, 82.5, 72.5][(week - 1) % 8];
  const plus = lighter ? "Easy week: stop at 5 reps." : "Last set: as many as you can, one short of failure.";
  const pull = (heavy) => ({ title: heavy === "deadlift" ? "Pull - deadlift" : "Pull - row", items: [
    heavy === "deadlift" ? ex("deadlift", 1, 5, { pct: pct + 2.5 }, 240, plus) : ex("barbell_row", s(5), 5, { pct: pct - 7.5 }, 150, plus),
    ex("lat_pulldown", s(3), [8, 12], { rpe: 8 }, 90), ex("seated_cable_row", s(3), [8, 12], { rpe: 8 }, 75), ex("face_pull", s(3), [15, 20], { rpe: 8 }, 45),
    ex("hammer_curl", s(2), [8, 12], { rpe: 8 }, 45), ex("dumbbell_curl", s(3), [8, 12], { rpe: 8 }, 45)
  ] });
  const push = (heavy) => ({ title: heavy === "bench_press" ? "Push - bench" : "Push - press", items: [
    ex(heavy, s(5), 5, { pct }, 180, plus), ex(heavy === "bench_press" ? "overhead_press" : "bench_press", s(2), [8, 12], { rpe: 8 }, 120),
    ex("incline_dumbbell_press", s(3), [8, 12], { rpe: 8 }, 90), ex("cable_triceps_pressdown", s(3), [8, 12], { rpe: 8 }, 45),
    ex("dumbbell_lateral_raise", s(3), [15, 20], { rpe: 8 }, 45), ex("overhead_cable_triceps_extension", s(2), [8, 12], { rpe: 8 }, 45)
  ] });
  const legs = { title: "Legs", items: [
    ex("back_squat", s(3), 5, { pct }, 210, plus), ex("romanian_deadlift", s(3), [8, 12], { rpe: 8 }, 120), ex("leg_press", s(3), [8, 12], { rpe: 8 }, 90),
    ex("lying_leg_curl", s(3), [8, 12], { rpe: 8 }, 60), ex("standing_calf_raise", s(4), [8, 12], { rpe: 8 }, 45)
  ] };
  return [pull("deadlift"), push("bench_press"), legs, pull("barbell_row"), push("overhead_press"), { ...legs, title: "Legs 2" }];
};
const pushPullLegs = {
  key: "push_pull_legs_6_day",
  template_name: "Push/pull/legs, 6 days",
  activity_id: "general_strength",
  description: "Six days a week, each of push, pull and legs twice: a main lift for 5s with an all-out last set (deadlift 1x5+, rows, bench, press, squat), then 8-12s on the accessories and 15-20s on face pulls and lateral raises. Every fourth week lighter. In the style of the r/Fitness push/pull/legs routine (Metallicadpa).",
  listing: { title: "Push/pull/legs, 6 days (based on the Reddit PPL)", summary: `Six days a week for experienced lifters with the time and recovery for it: push, pull and legs twice each, a heavy 5s main lift then plenty of 8-12s for size. Lighter every fourth week. Based on the r/Fitness push/pull/legs routine by Metallicadpa. ${notEndorsed("its author or r/Fitness")}`, levels: ["pro"], activity_ids: [], days_per_week: 6, next: "power_hypertrophy_upper_lower" },
  blocks: [1, 2].map((wave) => ({ name: `Block ${wave}`, block_type: wave === 1 ? "volume" : "strength", weeks: [1, 2, 3, 4].map((w) => pplWeek((wave - 1) * 4 + w)) }))
};

// Five-day body-part split: one muscle group a day, 12-16 hard sets each.
const splitWeek = (week) => {
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Chest", items: [ex("bench_press", s(4), [6, 8], { rpe: 8 }, 150), ex("incline_dumbbell_press", s(3), [8, 10], { rpe: 8 }, 120), ex("dip", s(3), [8, 12], "bw", 90), ex("cable_fly", s(3), [12, 15], { rpe: 8 }, 60), ex("push_up", 2, [10, 20], "bw", 60)] },
    { title: "Back", items: [ex("deadlift", s(3), 5, { rpe: 7 }, 210), ex("pull_up", s(4), [6, 10], "bw", 120), ex("barbell_row", s(3), [8, 10], { rpe: 8 }, 120), ex("seated_cable_row", s(3), [10, 12], { rpe: 8 }, 75), ex("straight_arm_pulldown", s(2), [12, 15], { rpe: 8 }, 60)] },
    { title: "Shoulders", items: [ex("overhead_press", s(4), [6, 8], { rpe: 8 }, 150), ex("arnold_press", s(3), [8, 12], { rpe: 8 }, 90), ex("dumbbell_lateral_raise", s(3), [12, 15], { rpe: 8 }, 60), ex("dumbbell_rear_delt_row", s(2), [12, 15], { rpe: 8 }, 60), ex("shrug", s(3), [10, 12], { rpe: 8 }, 60)] },
    { title: "Legs", items: [ex("back_squat", s(4), [6, 8], { rpe: 8 }, 210), ex("romanian_deadlift", s(3), [8, 10], { rpe: 8 }, 150), ex("leg_press", s(3), [10, 12], { rpe: 8 }, 120), ex("leg_extension", s(3), [12, 15], { rpe: 8 }, 60), ex("lying_leg_curl", s(3), [10, 12], { rpe: 8 }, 60), ex("standing_calf_raise", s(4), [10, 15], { rpe: 8 }, 45)] },
    { title: "Arms", items: [ex("close_grip_bench_press", s(3), [6, 8], { rpe: 8 }, 120), ex("barbell_curl", s(3), [8, 10], { rpe: 8 }, 75), ex("barbell_skullcrusher", s(3), [8, 12], { rpe: 8 }, 60), ex("hammer_curl", s(3), [10, 12], { rpe: 8 }, 60), ex("cable_triceps_pressdown", s(2), [12, 15], { rpe: 8 }, 45), ex("dumbbell_curl", s(2), [12, 15], { rpe: 8 }, 45)] }
  ];
};
const bodyPartSplit = {
  key: "body_part_split_5_day",
  template_name: "Five-day body-part split",
  activity_id: "general_strength",
  description: "The classic bodybuilding split: chest, back, shoulders, legs and arms, one a day, 10-15 hard sets each in 6-15 reps by effort, every fourth week lighter. In the style of the traditional bodybuilding body-part split.",
  listing: { title: "Five-day body-part split (based on the classic bodybuilding split)", summary: `The classic bodybuilding week: chest, back, shoulders, legs and arms on their own days, 10-15 hard sets each, lighter every fourth week. Each muscle trained hard once a week. Based on the traditional bodybuilding body-part split. ${notEndorsed("any one author")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 5, next: "push_pull_legs_6_day" },
  blocks: [1, 2, 3].map((wave) => ({ name: `Block ${wave}`, block_type: "volume", weeks: [1, 2, 3, 4].map((w) => splitWeek((wave - 1) * 4 + w)) }))
};

// Golden-era 6-day split: chest and back, shoulders and arms, legs - each
// twice a week.
const arnoldWeek = (week) => {
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const chestBack = (title) => ({ title, items: [ex("bench_press", s(3), [6, 10], { rpe: 8 }, 120), ex("pull_up", s(4), [6, 10], "bw", 90), ex("incline_bench_press", s(3), [8, 10], { rpe: 8 }, 90), ex("t_bar_row", s(3), [8, 10], { rpe: 8 }, 90), ex("dumbbell_fly", s(2), [10, 12], { rpe: 8 }, 60), ex("straight_arm_pulldown", s(2), [10, 12], { rpe: 8 }, 60), ex("hanging_leg_raise", 3, 12, "bw", 45)] });
  const shouldersArms = (title) => ({ title, items: [ex("overhead_press", s(3), [6, 10], { rpe: 8 }, 120), ex("dumbbell_lateral_raise", s(3), [10, 15], { rpe: 8 }, 60), ex("barbell_curl", s(3), [8, 10], { rpe: 8 }, 60), ex("close_grip_bench_press", s(2), [6, 10], { rpe: 8 }, 90), ex("dumbbell_curl", s(2), [10, 12], { rpe: 8 }, 45), ex("barbell_skullcrusher", s(2), [10, 12], { rpe: 8 }, 45)] });
  const legs = (title) => ({ title, items: [ex("back_squat", s(4), [6, 10], { rpe: 8 }, 180), ex("lying_leg_curl", s(3), [8, 12], { rpe: 8 }, 60), ex("leg_press", s(3), [10, 12], { rpe: 8 }, 90), ex("stiff_leg_deadlift", s(2), [8, 10], { rpe: 7 }, 90), ex("standing_calf_raise", s(4), [10, 15], { rpe: 8 }, 45), ex("ab_wheel_rollout", 3, 10, "bw", 45)] });
  return [chestBack("Chest and back"), shouldersArms("Shoulders and arms"), legs("Legs"), chestBack("Chest and back 2"), shouldersArms("Shoulders and arms 2"), legs("Legs 2")];
};
const goldenEraSplit = {
  key: "golden_era_6_day",
  template_name: "Golden-era 6-day split",
  activity_id: "general_strength",
  description: "Six days a week, the golden-era bodybuilding split: chest and back together, shoulders and arms, then legs - each twice a week - 6-15 reps by effort, every fourth week lighter. In the style of Arnold Schwarzenegger's split.",
  listing: { title: "Golden-era 6-day split (based on Arnold Schwarzenegger's split)", summary: `Six days a week for experienced lifters after size: chest and back, shoulders and arms, and legs, each twice a week, with chest and back paired the golden-era way. Lighter every fourth week. Based on Arnold Schwarzenegger's training split. ${notEndorsed("Arnold Schwarzenegger")}`, levels: ["pro"], activity_ids: [], days_per_week: 6, next: "body_part_split_5_day" },
  blocks: [1, 2].map((wave) => ({ name: `Block ${wave}`, block_type: "volume", weeks: [1, 2, 3, 4].map((w) => arnoldWeek((wave - 1) * 4 + w)) }))
};

// ---------------------------------------------------------------------------
// Three-lift waves (Tactical Barbell Operator): squat, bench and weighted
// pull-ups three days a week (deadlift on day 2), 6-week waves of 70-95%.
const OPERATOR = [[4, 5, 70], [4, 5, 80], [4, 3, 90], [4, 5, 75], [4, 3, 85], [3, 2, 95]];
const operatorWeek = (week) => {
  const [sets, reps, pct] = OPERATOR[(week - 1) % 6];
  const main = (lift) => ex(lift, sets, reps, { pct }, 180, `${sets}x${reps} at ${pct}% - every rep crisp; no grinding.`);
  const pull = ex("pull_up", sets, reps, { rpe: pct >= 90 ? 9 : pct >= 80 ? 8 : 7 }, 150, "Weighted when you can: the same effort as the squat and bench.");
  return [
    { title: "Day 1", items: [main("back_squat"), main("bench_press"), pull] },
    { title: "Day 2", items: [main("back_squat"), main("bench_press"), ex("deadlift", Math.min(sets, 3), reps, { pct }, 240)] },
    { title: "Day 3", items: [main("back_squat"), main("bench_press"), pull] }
  ];
};
const operatorWaves = {
  key: "three_lift_waves",
  template_name: "Three-lift strength waves",
  activity_id: "general_strength",
  description: "Three short strength sessions a week built to sit alongside running, conditioning or a sport: squat, bench press and weighted pull-ups (deadlift on day 2) in 6-week waves from 70% to 95%, never to failure. Two waves. In the style of Tactical Barbell's Operator template (K. Black).",
  listing: { title: "Three-lift strength waves (based on Tactical Barbell Operator)", summary: `For athletes, fighters and anyone who also runs or does conditioning: three short sessions a week of squat, bench and weighted pull-ups (deadlift once), in 6-week waves from 70% to 95%, never to failure. Based on Tactical Barbell's Operator template by K. Black. ${notEndorsed("K. Black or Tactical Barbell")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 3 },
  blocks: [1, 2].map((wave) => ({ name: `Wave ${wave}`, block_type: "strength", weeks: [1, 2, 3, 4, 5, 6].map((w) => operatorWeek((wave - 1) * 6 + w)) }))
};

// Easy Strength, 40 days: five days a week, the same five movements for 2x5
// (some days 5x2 or 1x10), always well short of a limit.
const EASY_PATTERN = [[2, 5], [2, 5], [5, 2], [2, 5], [1, 10]];
const easyWeek = (week) => Array.from({ length: 5 }, (_, d) => {
  const [sets, reps] = EASY_PATTERN[d];
  const rpe = week >= 6 && d === 2 ? 7 : 6;
  const note = "Easy: never close to a limit. If it feels heavy, go lighter today.";
  return { title: `Day ${d + 1}`, items: [
    ex("deadlift", sets, reps, { rpe }, 120, note), ex("bench_press", sets, reps, { rpe }, 120), ex("pull_up", sets, Math.min(reps, 5), "bw", 90),
    ex("ab_wheel_rollout", 1, 5, "bw", 60), ex("farmers_carry", 1, { metres: 30 }, { rpe }, 60)
  ] };
});
const easyStrength = {
  key: "easy_strength_40_day",
  template_name: "Easy strength, 40 days",
  activity_id: "general_strength",
  description: "Forty sessions, five a week: the same five movements every day - a hinge, a press, a pull, an ab rollout and a loaded carry - for about 10 reps each (2x5, 5x2 or 1x10), always comfortably short of a limit. Built for athletes whose sport takes most of their energy. In the style of Dan John and Pavel Tsatsouline's Easy Strength.",
  listing: { title: "Easy strength, 40 days (based on Easy Strength)", summary: `Forty short sessions, five a week, for athletes whose sport comes first: deadlift, bench, pull-up, rollout and a carry, about 10 reps each, never close to a limit - strength that doesn't take from practice. Based on Dan John and Pavel Tsatsouline's Easy Strength. ${notEndorsed("Dan John or Pavel Tsatsouline")}`, levels: ["amateur", "pro"], activity_ids: [], days_per_week: 5, next: "three_lift_waves" },
  blocks: [{ name: "Forty days", block_type: "general", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(easyWeek) }]
};

// ---------------------------------------------------------------------------
// Powerlifting.
// Six-week strength peak (Candito 6 Week): conditioning, hypertrophy, two
// weeks of linear max overload, heavy acclimation, then a test week.
const CANDITO = [
  { name: "Muscular conditioning", sq: [4, 6, 72.5], bp: [4, 6, 72.5], dl: [2, 6, 72.5], acc: 4 },
  { name: "Hypertrophy", sq: [4, 8, 70], bp: [4, 8, 70], dl: [3, 6, 72.5], acc: 4 },
  { name: "Linear max overload", sq: [4, 4, 82.5], bp: [4, 4, 82.5], dl: [3, 4, 82.5], acc: 3 },
  { name: "Linear max overload", sq: [4, 3, 87.5], bp: [4, 3, 87.5], dl: [3, 3, 87.5], acc: 3 },
  { name: "Heavy acclimation", sq: [3, 2, 92.5], bp: [3, 2, 92.5], dl: [2, 2, 92.5], acc: 2 }
];
const canditoWeek = (week) => {
  if (week === 6) return [
    { title: "Test - squat and bench", items: [ex("back_squat", 3, 1, { pct: 95 }, 300, "Work up to a new max, or take 95% if the day isn't there - your call on the day."), ex("bench_press", 3, 1, { pct: 95 }, 300, "Work up to a new max, or 95%.")] },
    { title: "Test - deadlift", items: [ex("deadlift", 2, 1, { pct: 95 }, 300, "Work up to a new max, or 95%."), ex("chest_supported_row", 2, 10, { rpe: 6 }, 90)] }
  ];
  const c = CANDITO[week - 1];
  const reps = c.sq[1] >= 6 ? "Same weight every set; when the last set is easy, add weight next week." : "Add weight from last week if every rep was fast; the last set can be as many as you can.";
  return [
    { title: "Lower - heavy", items: [ex("back_squat", c.sq[0], c.sq[1], { pct: c.sq[2] }, 240, reps), ex("deadlift", c.dl[0], c.dl[1], { pct: c.dl[2] }, 240), ex("bulgarian_split_squat", c.acc - 1, 8, { rpe: 7 }, 90)] },
    { title: "Upper - heavy", items: [ex("bench_press", c.bp[0], c.bp[1], { pct: c.bp[2] }, 210, reps), ex("barbell_row", c.acc, 8, { rpe: 8 }, 120), ex("overhead_press", c.acc - 1, 8, { rpe: 7 }, 120), ex("pull_up", c.acc - 1, [6, 10], "bw", 90)] },
    { title: "Lower - volume", items: [ex("paused_back_squat", c.acc - 1, 5, { pct: c.sq[2] - 12.5 }, 180), ex("romanian_deadlift", c.acc - 1, 8, { rpe: 7 }, 120), ex("lying_leg_curl", 3, 10, { rpe: 8 }, 60), ex("hanging_leg_raise", 3, 10, "bw", 45)] },
    { title: "Upper - volume", items: [ex("paused_bench_press", c.acc, 5, { pct: c.bp[2] - 10 }, 150), ex("dumbbell_overhead_press", c.acc - 1, 10, { rpe: 7 }, 90), ex("single_arm_dumbbell_row", c.acc - 1, 10, { rpe: 8 }, 60), ex("cable_triceps_pressdown", 3, 12, { rpe: 8 }, 45)] }
  ];
};
const canditoPeak = {
  key: "six_week_strength_peak",
  template_name: "Six-week strength peak",
  activity_id: "powerlifting",
  description: "Six weeks to a new squat, bench and deadlift max: a conditioning week of 6s, a hypertrophy week of 8s, two weeks of linear max overload (4s then 3s), a week of heavy doubles, then a test week. Four days, upper/lower. In the style of Jonnie Candito's 6 Week Strength Program.",
  listing: { title: "Six-week strength peak (based on Candito's 6 Week Strength Program)", summary: `Six weeks to new maxes on squat, bench and deadlift: conditioning, hypertrophy, two weeks of heavy 4s and 3s, heavy doubles, then a test week. Four days, upper/lower. Based on Jonnie Candito's 6 Week Strength Program. ${notEndorsed("Jonnie Candito")}`, levels: ["amateur", "pro"], activity_ids: ["powerlifting"], days_per_week: 4, next: "powerlifting_meet_prep" },
  blocks: [
    { name: "Conditioning and hypertrophy", block_type: "volume", weeks: [1, 2].map(canditoWeek) },
    { name: "Max overload", block_type: "strength", weeks: [3, 4].map(canditoWeek) },
    { name: "Acclimation and test", block_type: "peak", weeks: [5, 6].map(canditoWeek) }
  ]
};

// High-frequency competition-lift volume (Sheiko): three days, squat and
// bench (or bench and deadlift) every session in pyramids of 2-5 reps at
// 50-85%, plus the lifts' weak-point variations. Two 4-week preparation
// cycles; the work set % rises cycle to cycle.
const sheikoWeek = (week) => {
  const cycle = week <= 4 ? 0 : 1;
  const step = (week - 1) % 4;
  const top = [75, 80, 85, 70][step] + cycle * 2.5;
  const pyr = (lift, sets, note) => ex(lift, sets, [2, 5], range(50, top), 180, `Pyramid: 5 at 50%, 4 at 60%, 3 at 70%, then sets of 2-3 at ${top}%${note ? ` - ${note}` : ""}.`);
  const light = step === 3;
  const n = (x) => (light ? Math.max(3, x - 2) : x);
  return [
    { title: "Day 1 - squat and bench", items: [pyr("back_squat", n(7)), pyr("bench_press", n(7)), ex("dumbbell_fly", 3, 10, { rpe: 7 }, 60), ex("good_morning", 3, 5, { rpe: 6 }, 90)] },
    { title: "Day 2 - deadlift and bench", items: [pyr("deadlift", n(6)), ex("incline_bench_press", n(4), 4, { pct: Math.min(top - 10, 75) }, 150), ex("lat_pulldown", 4, 10, { rpe: 7 }, 60), ex("deficit_deadlift", n(3), 3, { pct: Math.min(top - 15, 70) }, 150), ex("front_plank", 3, { seconds: 45 }, "bw", 45)] },
    { title: "Day 3 - squat and bench", items: [pyr("paused_back_squat", n(6), "pause 2 s in the hole"), pyr("paused_bench_press", n(6), "pause on the chest"), ex("chest_supported_row", 4, 10, { rpe: 7 }, 60), ex("back_extension", 3, 8, "bw", 60)] }
  ];
};
const sheikoVolume = {
  key: "competition_lift_volume",
  template_name: "High-frequency competition-lift volume",
  activity_id: "powerlifting",
  description: "Three days a week of lots of practice on the competition lifts: squat and bench, or bench and deadlift, every session in pyramids of 2-5 reps from 50% up to 75-87.5%, never to failure, with paused and deficit variations. Two 4-week preparation cycles. In the style of Boris Sheiko's preparatory programmes.",
  listing: { title: "High-frequency competition-lift volume (based on Sheiko)", summary: `For powerlifters who want technique and strength from lots of practice: squat, bench and deadlift several times a week in pyramids of 2-5 reps at 50-85%, never to failure, with paused and deficit work. Two 4-week preparation cycles. Based on Boris Sheiko's programmes. ${notEndorsed("Boris Sheiko")}`, levels: ["amateur", "pro"], activity_ids: ["powerlifting"], days_per_week: 3, next: "powerlifting_meet_prep" },
  blocks: [
    { name: "Preparation 1", block_type: "volume", weeks: [1, 2, 3, 4].map(sheikoWeek) },
    { name: "Preparation 2", block_type: "strength", weeks: [5, 6, 7, 8].map(sheikoWeek) }
  ]
};

// Max effort / dynamic effort (Westside conjugate): four days - max effort
// lower and upper (work up to a heavy single on a rotating variation),
// dynamic effort lower and upper (fast sets at 50-60% in 3-week waves) -
// plus the accessory work that does most of the building.
const ME_LOWER = ["box_squat", "good_morning", "rack_pull", "deficit_deadlift", "front_squat", "sumo_deadlift"];
const ME_UPPER = ["floor_press", "pin_press", "close_grip_bench_press", "incline_bench_press", "paused_bench_press", "spoto_press"];
const conjugateWeek = (week) => {
  const wave = [50, 55, 60][(week - 1) % 3];
  const deload = week % 4 === 0;
  const me = (lift) => ex(lift, 3, 1, { rpe: deload ? 7 : 9 }, 300, deload ? "Lighter week: work up to a comfortable single." : "Max effort: work up in singles to a heavy single (no grinders) - a new best on this variation when the day allows. The variation changes every week.");
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Max effort lower", items: [me(ME_LOWER[(week - 1) % ME_LOWER.length]), ex("glute_ham_raise", s(3), 8, "bw", 90), ex("reverse_hyper", s(3), 10, { rpe: 7 }, 75), ex("hanging_leg_raise", s(4), 12, "bw", 45)] },
    { title: "Max effort upper", items: [me(ME_UPPER[(week - 1) % ME_UPPER.length]), ex("barbell_skullcrusher", s(4), 10, { rpe: 8 }, 75), ex("chest_supported_row", s(4), 10, { rpe: 8 }, 75), ex("dumbbell_rear_delt_row", s(3), 15, { rpe: 8 }, 45), ex("lat_pulldown", s(3), 12, { rpe: 8 }, 60)] },
    { title: "Dynamic effort lower", items: [ex("box_squat", deload ? 6 : 8, 2, { pct: deload ? 50 : wave }, 60, `Speed: 2 reps as fast as you can, a minute's rest (${wave}% this week; bands or chains on top if you have them).`), ex("deadlift", 6, 1, { pct: deload ? 60 : wave + 10 }, 60, "Speed pulls: one fast rep each set."), ex("ab_wheel_rollout", s(3), 10, "bw", 45)] },
    { title: "Dynamic effort upper", items: [ex("bench_press", 8, 3, { pct: deload ? 50 : wave }, 60, `Speed bench: 3 fast reps, a minute's rest, at ${wave}% - change your grip each set.`), ex("close_grip_bench_press", s(3), 8, { rpe: 8 }, 90), ex("barbell_row", s(4), 8, { rpe: 8 }, 75), ex("face_pull", s(3), 15, { rpe: 7 }, 45), ex("hammer_curl", s(3), 12, { rpe: 7 }, 45)] }
  ];
};
const conjugate = {
  key: "max_effort_dynamic_effort",
  template_name: "Max effort / dynamic effort",
  activity_id: "powerlifting",
  description: "Four days a week: a max-effort lower and upper day (work up to a heavy single on a variation that changes every week), a dynamic-effort lower and upper day (fast doubles and triples at 50-60% in 3-week waves), and the accessory work for the posterior chain, triceps and upper back that builds the lifts. Every fourth week lighter. In the style of Louie Simmons' Westside Barbell conjugate method.",
  listing: { title: "Max effort / dynamic effort (based on the Westside conjugate method)", summary: `For experienced powerlifters: two max-effort days working up to a heavy single on a rotating variation, two speed days at 50-60%, and heavy accessory work. Every fourth week lighter. Based on Louie Simmons' Westside Barbell conjugate method. ${notEndorsed("Westside Barbell or the Simmons estate")}`, levels: ["amateur", "pro"], activity_ids: ["powerlifting"], days_per_week: 4, next: "powerlifting_meet_prep" },
  blocks: [1, 2, 3].map((block) => ({ name: `Block ${block}`, block_type: "strength", weeks: [1, 2, 3, 4].map((w) => conjugateWeek((block - 1) * 4 + w)) }))
};

// ---------------------------------------------------------------------------
// Classic Soviet weightlifting cycle: four days, snatch and clean & jerk
// variations in doubles and triples at 70-85% (a heavy single at the peak),
// squats and pulls, preparation -> competition.
const SOVIET = [[70, 3], [72.5, 3], [75, 3], [65, 3], [77.5, 2], [80, 2], [82.5, 2], [70, 2], [82.5, 2], [85, 1], [87.5, 1], [70, 1]];
const sovietWeek = (week) => {
  const [pct, reps] = SOVIET[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const sets = reps === 1 ? 4 : reps === 2 ? 5 : 6;
  const lift = (id, note) => ex(id, s(sets), reps, { pct }, 150, note);
  return [
    { title: "Snatch and squat", items: [lift("snatch", "Doubles and triples at a weight you hit every rep of - misses mean too heavy."), ex("snatch_pull", s(4), 3, { rpe: 8 }, 120, "Heavier than your snatch: finish tall and fast."), ex("back_squat", s(5), reps === 1 ? 2 : 4, { pct: Math.min(pct + 2.5, 87.5) }, 180), ex("back_extension", 3, 10, "bw", 60)] },
    { title: "Clean & jerk and press", items: [lift("clean_and_jerk", "One clean and one jerk per rep."), ex("clean_pull", s(4), 3, { rpe: 8 }, 120), ex("push_press", s(4), 3, { rpe: 7 }, 120), ex("hanging_leg_raise", 3, 10, "bw", 45)] },
    { title: "Power variations and front squat", items: [ex("power_snatch", s(5), 2, { pct: Math.min(pct - 5, 80) }, 120), ex("hang_power_clean", s(4), 2, { pct: Math.min(pct - 5, 80) }, 120), ex("front_squat", s(5), reps === 1 ? 2 : 3, { pct: Math.min(pct, 85) }, 180), ex("good_morning", 3, 6, { rpe: 6 }, 75)] },
    { title: "Snatch, clean & jerk and pulls", items: [ex("snatch", s(sets - 1), Math.min(reps, 2), { pct: pct - 5 }, 150), ex("clean_and_jerk", s(sets - 1), 1, { pct: pct - 2.5 }, 150), ex("snatch_balance", 3, 3, { rpe: 7 }, 90), ex("clean_pull", s(3), 3, { rpe: 8 }, 120)] }
  ];
};
const sovietCycle = {
  key: "soviet_weightlifting_cycle",
  template_name: "Classic Soviet weightlifting cycle",
  activity_id: "olympic_weightlifting",
  description: "Twelve weeks, four days a week, in the classic Soviet pattern: snatch and clean & jerk practised in triples, then doubles, then singles at 70-87.5%, heavy pulls above the lift, back and front squats every week and power variations - most work at 70-85%, very little near a max, every fourth week lighter. In the style of the Soviet system as described by Medvedyev and Vorobyev.",
  listing: { title: "Classic Soviet weightlifting cycle (based on the Soviet system)", summary: `Twelve weeks for weightlifters: snatch and clean & jerk in triples, doubles then singles at 70-87.5%, heavy pulls, squats every week and power variations - lots of quality reps, few near a max. Based on the Soviet system (Medvedyev, Vorobyev). ${notEndorsed("any federation or author")}`, levels: ["amateur", "pro"], activity_ids: ["olympic_weightlifting"], days_per_week: 4, next: "olympic_weightlifting_meet_prep" },
  blocks: [
    { name: "Preparation", block_type: "volume", weeks: [1, 2, 3, 4].map(sovietWeek) },
    { name: "Strength", block_type: "strength", weeks: [5, 6, 7, 8].map(sovietWeek) },
    { name: "Competition", block_type: "peak", weeks: [9, 10, 11, 12].map(sovietWeek) }
  ]
};

// The programme's name in the coach's library is its catalogue title, so the
// programme it's based on travels with it when a coach copies it.
export const RECOGNISED_PROGRAMMES = [
  bodyweightFundamentals, linear3x5, novice5x5, noviceAmrap, wave531Fsl,
  tieredLinear, texasMethod, ramping5x5, wave531Bbb, repWaves, operatorWaves, easyStrength,
  phul, phat, pushPullLegs, bodyPartSplit, goldenEraSplit,
  canditoPeak, sheikoVolume, conjugate, sovietCycle
].map((programme) => ({ ...programme, template_name: programme.listing.title }));
