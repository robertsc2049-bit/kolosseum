// Recognised programmes - the programmes coaches already know by name,
// entered as published (product/programmes/kolosseum_programmes_v1.mjs
// notation). Each is named for what it is, with "(based on ...)" in its
// title and "Independent - not endorsed by ..." in its summary; the sets,
// reps, percentages, set-by-set climbs and repeated lifts are the original's.
//
// They are NOT adjusted to Kolosseum's own rules (the volume ranges, the 8-set
// cap, the beginner 85% limit). Where an original goes past them, or the app
// can't hold something exactly (a progression that moves session to session,
// an exercise the library doesn't have), the programme says so in `warnings`
// - on the card, and in the note of the lift it affects. Particularly hard
// programmes (Smolov, the Bulgarian method, German Volume Training, Westside
// max effort) are marked coach-supervised.
//
// Loads are % of the athlete's real max (1RM). Programmes written on a
// "training max" (90% of 1RM: 5/3/1, the Juggernaut Method) are converted
// exactly (65% of the training max is 58.5%). Linear progressions, which add
// weight every session, are written as a weekly % climb from where the
// athlete starts - the warnings say so.

const ex = (id, sets, reps, load, rest, note, extra) => ({ id, sets, reps, load, rest, ...(note ? { note } : {}), ...(extra ?? {}) });
// Set by set: [[sets, reps, value, amrap?], ...] in the load's unit.
const bySet = (id, plan, load, rest, note, extra) => ({ id, plan, load, rest, ...(note ? { note } : {}), ...(extra ?? {}) });
const PCT = { pct: 0 };
const RPE = { rpe: 0 };
let groupCount = 0;
const superset = (...items) => {
  groupCount += 1;
  const id = `recognised_superset_${groupCount}`;
  return items.map((item) => ({ ...item, group: { id, type: "superset", cap: 0, round: 0, rounds: 0 } }));
};
const notEndorsed = (author) => `Independent - not endorsed by ${author}.`;
const round05 = (value) => Math.round(value * 2) / 2;
const SUPERVISED = "Coach-supervised: stop and tell your coach if a joint aches.";

// A programme from its parts; warnings go on the card (summary) and listing.
const programme = ({ key, title, basedOn, author, summary, description, levels, activityIds = [], days, next, warnings = [], blocks, activity = "general_strength" }) => ({
  key,
  template_name: `${title} (based on ${basedOn})`,
  activity_id: activity,
  description: `${description}${warnings.length ? ` Warnings: ${warnings.join(" ")}` : ""}`,
  listing: {
    title: `${title} (based on ${basedOn})`,
    summary: `${summary}${warnings.length ? " Warning: see the programme notes before you start." : ""} Based on ${basedOn}. ${notEndorsed(author || "its authors")}`,
    levels, activity_ids: activityIds, days_per_week: days, ...(next ? { next } : {}),
    ...(warnings.length ? { warnings } : {})
  },
  blocks
});
const LINEAR = "The original adds weight every session; here it's a weekly % climb from the max you start with - update your maxes as they rise.";

// ---------------------------------------------------------------------------
// Novice linear progressions (3 days, A/B alternating: A B A, then B A B).
const alternating = (week, day) => (week % 2 === 1 ? ["A", "B", "A"] : ["B", "A", "B"]).map((d) => day(d, week));
const climb = (from, to, weeks = 12) => Array.from({ length: weeks }, (_, i) => round05(from + ((to - from) * i) / (weeks - 1)));
const twelveWeeks = (day) => [
  { name: "Weeks 1-6", block_type: "general", weeks: [1, 2, 3, 4, 5, 6].map((w) => alternating(w, day)) },
  { name: "Weeks 7-12", block_type: "general", weeks: [7, 8, 9, 10, 11, 12].map((w) => alternating(w, day)) }
];

const SS = climb(65, 85);
const startingStrength = programme({
  key: "novice_linear_3x5", title: "Novice linear 3×5", basedOn: "Starting Strength", author: "Mark Rippetoe",
  summary: "Three days a week, two alternating workouts: squat 3×5 every session, bench and press 3×5 in turn, deadlift 1×5, power cleans 5×3 - weight up every session.",
  description: "Phase 2 of the novice progression: workout A is squat 3x5, bench press 3x5, deadlift 1x5; workout B is squat 3x5, press 3x5, power clean 5x3; A and B alternate.",
  levels: ["beginner"], days: 3, next: "texas_method", warnings: [LINEAR],
  blocks: twelveWeeks((day, w) => day === "A"
    ? { title: "Workout A", items: [ex("back_squat", 3, 5, { pct: SS[w - 1] }, 300, LINEAR), ex("bench_press", 3, 5, { pct: SS[w - 1] }, 300), ex("deadlift", 1, 5, { pct: SS[w - 1] }, 300)] }
    : { title: "Workout B", items: [ex("back_squat", 3, 5, { pct: SS[w - 1] }, 300, LINEAR), ex("overhead_press", 3, 5, { pct: SS[w - 1] }, 300), ex("power_clean", 5, 3, { pct: round05(SS[w - 1] - 5) }, 180)] })
});

const SL = climb(60, 80);
const strongLifts = programme({
  key: "novice_5x5", title: "Novice 5×5", basedOn: "StrongLifts 5×5", author: "Mehdi Hadim",
  summary: "Three days a week, two alternating workouts: squat 5×5 every session, bench and barbell row 5×5, overhead press 5×5 and deadlift 1×5 - weight up every session.",
  description: "Workout A: squat 5x5, bench press 5x5, barbell row 5x5. Workout B: squat 5x5, overhead press 5x5, deadlift 1x5. A and B alternate.",
  levels: ["beginner"], days: 3, next: "ramping_5x5", warnings: [LINEAR],
  blocks: twelveWeeks((day, w) => day === "A"
    ? { title: "Workout A", items: [ex("back_squat", 5, 5, { pct: SL[w - 1] }, 180, LINEAR), ex("bench_press", 5, 5, { pct: SL[w - 1] }, 180), ex("barbell_row", 5, 5, { pct: SL[w - 1] }, 180)] }
    : { title: "Workout B", items: [ex("back_squat", 5, 5, { pct: SL[w - 1] }, 180, LINEAR), ex("overhead_press", 5, 5, { pct: SL[w - 1] }, 180), ex("deadlift", 1, 5, { pct: SL[w - 1] }, 180)] })
});

const GS = climb(65, 85);
const plus5 = (pct) => [[2, 5, pct], [1, 5, pct, true]];
const greyskull = programme({
  key: "novice_amrap_linear", title: "Novice linear with AMRAP sets", basedOn: "Greyskull LP", author: "John Sheaffer",
  summary: "Three days a week, two alternating workouts: each lift 2×5 then a last set of as many reps as you can (deadlift one all-out set of 5+); 10+ reps on the last set doubles the next jump.",
  description: "Phrak's Greyskull LP. Workout A: overhead press 2x5, 1x5+; chin-up 2x5, 1x5+; squat 2x5, 1x5+. Workout B: bench press 2x5, 1x5+; barbell row 2x5, 1x5+; deadlift 1x5+. A and B alternate. Miss the reps and take 10% off.",
  levels: ["beginner"], days: 3, next: "texas_method", warnings: [LINEAR],
  blocks: twelveWeeks((day, w) => day === "A"
    ? { title: "Workout A", items: [bySet("overhead_press", plus5(GS[w - 1]), PCT, 180, LINEAR), bySet("chin_up", [[2, 5], [1, 5, null, true]], "bw", 180), bySet("back_squat", plus5(GS[w - 1]), PCT, 180)] }
    : { title: "Workout B", items: [bySet("bench_press", plus5(GS[w - 1]), PCT, 180, LINEAR), bySet("barbell_row", plus5(GS[w - 1]), PCT, 180), bySet("deadlift", [[1, 5, GS[w - 1], true]], PCT, 180)] })
});

// r/bodyweightfitness Recommended Routine: three strength pairs (3 x 5-8),
// then the core triplet (3 x 8-12); move up a rung at 3 x 8.
const RR_WARNING = "Kolosseum's library doesn't have every rung (scapular pulls, negatives, shrimp squats, pseudo-planche push-ups): the nearest exercise is used, and the coach moves the athlete up the ladder when they reach 3x8.";
const rrSession = (title) => ({ title, items: [
  ...superset(ex("assisted_pull_up", 3, [5, 8], "bw", 90, "Pull-up ladder: assisted/negative pull-up, then pull-up. Move up at 3x8."), ex("air_squat", 3, [5, 8], "bw", 90, "Squat ladder: assisted squat, squat, split squat, Bulgarian split squat, shrimp squat.")),
  ...superset(ex("assisted_dip", 3, [5, 8], "bw", 90, "Dip ladder: support hold (to 60 s), negative dip, dip."), ex("single_leg_rdl", 3, [5, 8], "bw", 90, "Hinge ladder: bodyweight RDL, single-leg RDL, banded Nordic curl, Nordic curl.")),
  ...superset(ex("inverted_row", 3, [5, 8], "bw", 90, "Row ladder: vertical row, incline row, inverted row, wide row."), ex("incline_push_up", 3, [5, 8], "bw", 90, "Push-up ladder: wall, incline, push-up, diamond, pseudo-planche push-up.")),
  ex("front_plank", 3, { seconds: 30 }, "bw", 60, "Anti-extension: plank to 30 s, then kneeling and full ab rollouts (3x8-12)."),
  ex("pallof_press", 3, [8, 12], "bw", 60, "Anti-rotation: banded Pallof press."),
  ex("reverse_hyper", 3, [8, 12], "bw", 60, "Extension: bodyweight reverse hyperextension.")
] });
const recommendedRoutine = programme({
  key: "bodyweight_fundamentals", title: "Bodyweight fundamentals", basedOn: "the r/bodyweightfitness Recommended Routine", author: "r/bodyweightfitness",
  summary: "Three full-body sessions a week: three strength pairs (pull-up and squat, dip and hinge, row and push-up) at 3×5-8, then the core triplet at 3×8-12, moving up each ladder at 3×8.",
  description: "Strength pairs as supersets, 90 s rest: pull-up + squat, dip + hinge, row + push-up progressions, 3x5-8 each; core triplet 3x8-12: anti-extension, anti-rotation, extension.",
  levels: ["beginner"], days: 3, next: "novice_linear_3x5", warnings: [RR_WARNING],
  blocks: [{ name: "Ladders", block_type: "general", weeks: Array.from({ length: 12 }, () => [rrSession("Full body 1"), rrSession("Full body 2"), rrSession("Full body 3")]) }]
});

// ---------------------------------------------------------------------------
// 5/3/1 (training max = 90% of 1RM). Three work sets a week, % of 1RM:
const W531 = [
  [[1, 5, 58.5], [1, 5, 67.5], [1, 5, 76.5, true]],
  [[1, 3, 63], [1, 3, 72], [1, 3, 81, true]],
  [[1, 5, 67.5], [1, 3, 76.5], [1, 1, 85.5, true]]
];
const DELOAD_531 = [[1, 5, 36], [1, 5, 45], [1, 5, 54]];
const CYCLE_NOTE = "After each cycle raise the training max: 2.5 kg (5 lb) on bench and press, 5 kg (10 lb) on squat and deadlift - update the athlete's maxes.";

const fslWeek = (week) => {
  const wave = W531[(week - 1) % 3];
  const main = (lift) => bySet(lift, [...wave, [5, 5, wave[0][2]]], PCT, 180, `5/3/1 then First Set Last 5x5. ${CYCLE_NOTE}`);
  return [
    { title: "Day 1", items: [main("back_squat"), main("bench_press"), ex("hanging_leg_raise", 5, 10, "bw", 60), ex("chin_up", 5, 10, "bw", 60), ex("push_up", 5, 15, "bw", 60)] },
    { title: "Day 2", items: [main("deadlift"), main("overhead_press"), ex("triceps_dip", 5, 10, "bw", 60), ex("inverted_row", 5, 10, "bw", 60), ex("bulgarian_split_squat", 5, 10, { rpe: 7 }, 60)] },
    { title: "Day 3", items: [main("bench_press"), main("back_squat"), ex("hanging_leg_raise", 5, 10, "bw", 60), ex("pull_up", 5, 10, "bw", 60), ex("push_up", 5, 15, "bw", 60)] }
  ];
};
const fiveThreeOneBeginners = programme({
  key: "wave_531_full_body", title: "Wave 5s/3s/1s full body", basedOn: "5/3/1 for Beginners", author: "Jim Wendler",
  summary: "Three full-body days a week: squat, bench, deadlift and press in a 3-week 5s / 3s / 5-3-1 wave from a 90% training max, 5×5 First Set Last after each, and push, pull and single-leg or core work.",
  description: "Day 1 squat and bench, day 2 deadlift and press, day 3 bench and squat - each 5/3/1 then FSL 5x5 - plus 50-100 reps of push, pull and single-leg/core work. No deload in the 3-week cycle.",
  levels: ["beginner", "amateur"], days: 3, next: "wave_531_bbb",
  warnings: ["Week 3's top set is 85.5% for 1+ reps - past Kolosseum's usual beginner limit (85%, no singles).", CYCLE_NOTE],
  blocks: [1, 2, 3, 4].map((cycle) => ({ name: `Cycle ${cycle}`, block_type: "general", weeks: [1, 2, 3].map(fslWeek) }))
});

const bbbWeek = (week) => {
  const deload = (week - 1) % 4 === 3;
  const wave = deload ? DELOAD_531 : W531[(week - 1) % 4];
  const main = (lift) => bySet(lift, wave, PCT, 180, deload ? "Deload: 40/50/60% of the training max." : `5/3/1: the last set as many as you can. ${CYCLE_NOTE}`);
  const bbb = (lift) => ex(lift, 5, 10, { pct: deload ? 36 : 45 }, 90, "Boring But Big: 5x10 at 50% of the training max (40% in the deload).");
  return [
    { title: "Press", items: [main("overhead_press"), bbb("overhead_press"), ex("chin_up", 5, 10, "bw", 90)] },
    { title: "Deadlift", items: [main("deadlift"), bbb("deadlift"), ex("hanging_leg_raise", 5, 15, "bw", 60)] },
    { title: "Bench", items: [main("bench_press"), bbb("bench_press"), ex("single_arm_dumbbell_row", 5, 10, { rpe: 7 }, 60)] },
    { title: "Squat", items: [main("back_squat"), bbb("back_squat"), ex("lying_leg_curl", 5, 10, { rpe: 7 }, 60)] }
  ];
};
const fiveThreeOneBbb = programme({
  key: "wave_531_bbb", title: "Wave 5s/3s/1s with 5×10", basedOn: "5/3/1 Boring But Big", author: "Jim Wendler",
  summary: "Four days a week, one main lift a day in the 4-week 5/3/1 wave (5s, 3s, 5/3/1, deload) from a 90% training max, then 5×10 of the same lift at 50% and one assistance exercise for 5×10.",
  description: "Press, deadlift, bench and squat days: 5/3/1 work sets, Boring But Big 5x10 of the same lift at 50% of the training max, then chin-ups 5x10, hanging leg raises 5x15, dumbbell rows 5x10 or leg curls 5x10.",
  levels: ["amateur", "pro"], days: 4, next: "rep_waves",
  warnings: ["Boring But Big is 5x10 at 45% of max and the deload goes down to 36% - below Kolosseum's usual 50% floor.", CYCLE_NOTE],
  blocks: [1, 2, 3].map((cycle) => ({ name: `Cycle ${cycle}`, block_type: "volume", weeks: [1, 2, 3, 4].map(bbbWeek) }))
});

// ---------------------------------------------------------------------------
// GZCLP: T1 5x3+ -> 6x2+ -> 10x1+, T2 3x10 -> 3x8 -> 3x6, T3 2x15 + 15+.
const GZ = { t1: [[5, 3], [6, 2], [10, 1]], t2: [[3, 10], [3, 8], [3, 6]] };
const gzclpWeek = (week) => {
  const stage = week <= 4 ? 0 : week <= 8 ? 1 : 2;
  const step = (week - 1) % 4;
  const t1Pct = [75, 82.5, 87.5][stage] + step * 2.5;
  const t2Pct = [62.5, 67.5, 72.5][stage] + step * 2.5;
  const [s1, r1] = GZ.t1[stage];
  const [s2, r2] = GZ.t2[stage];
  const T1 = (lift) => bySet(lift, [[s1 - 1, r1, t1Pct], [1, r1, t1Pct, true]], PCT, 180, "T1: the last set as many as you can. Fail the reps and move to the next stage (5x3+, 6x2+, 10x1+).");
  const T2 = (lift) => ex(lift, s2, r2, { pct: t2Pct }, 120, "T2: add weight each time you make every rep; fail and move to the next stage (3x10, 3x8, 3x6).");
  const T3 = (lift) => bySet(lift, [[2, 15, 8], [1, 15, 8, true]], RPE, 90, "T3: the last set as many as you can; 25+ reps and you add weight.");
  return [
    { title: "Day 1", items: [T1("back_squat"), T2("bench_press"), T3("lat_pulldown")] },
    { title: "Day 2", items: [T1("overhead_press"), T2("deadlift"), T3("barbell_row")] },
    { title: "Day 3", items: [T1("bench_press"), T2("back_squat"), T3("lat_pulldown")] },
    { title: "Day 4", items: [T1("deadlift"), T2("overhead_press"), T3("barbell_row")] }
  ];
};
const gzclp = programme({
  key: "tiered_linear", title: "Tiered T1/T2/T3 progression", basedOn: "GZCLP", author: "Cody Lefever",
  summary: "Four days a week: a heavy T1 lift (5×3+, then 6×2+, then 10×1+), a T2 volume lift (3×10, 3×8, 3×6) and a T3 accessory for 2×15 and 15+.",
  description: "Day 1 T1 squat, T2 bench, T3 lat pulldown; day 2 T1 press, T2 deadlift, T3 row; day 3 T1 bench, T2 squat; day 4 T1 deadlift, T2 press.",
  levels: ["beginner", "amateur"], days: 4, next: "wave_531_bbb",
  warnings: ["The original changes stage when you fail the reps; here the stages change every 4 weeks - move on sooner or later as the athlete fails.", "T3 accessories are set by effort (RPE 8) - the original uses the weight that makes 15 reps.", "T1 work reaches 87.5-95% (10 singles) - past Kolosseum's usual beginner limit."],
  blocks: [{ name: "Stage 1", block_type: "volume", weeks: [1, 2, 3, 4].map(gzclpWeek) }, { name: "Stage 2", block_type: "strength", weeks: [5, 6, 7, 8].map(gzclpWeek) }, { name: "Stage 3", block_type: "peak", weeks: [9, 10, 11, 12].map(gzclpWeek) }]
});

// ---------------------------------------------------------------------------
// Texas Method: Monday volume (5x5 at 90% of Friday), Wednesday recovery
// (squat 2x5 at 80% of Monday), Friday intensity (a 5-rep best). Bench and
// press swap each week.
const TX_FRI = climb(85, 92.5);
const texasWeek = (week) => {
  const fri = TX_FRI[week - 1];
  const mon = round05(fri * 0.9);
  const [heavy, light] = week % 2 === 1 ? ["bench_press", "overhead_press"] : ["overhead_press", "bench_press"];
  return [
    { title: "Volume day", items: [ex("back_squat", 5, 5, { pct: mon }, 300, "90% of Friday's weight."), ex(heavy, 5, 5, { pct: mon }, 240), ex("deadlift", 1, 5, { pct: round05(mon + 5) }, 300)] },
    { title: "Recovery day", items: [ex("back_squat", 2, 5, { pct: round05(mon * 0.8) }, 180, "80% of Monday's weight."), ex(light, 3, 5, { pct: round05(mon - 5) }, 180), ex("chin_up", 3, [5, 10], "bw", 120), ex("back_extension", 5, 10, "bw", 60)] },
    { title: "Intensity day", items: [ex("back_squat", 1, 5, { pct: fri }, 300, "A new 5-rep best."), ex(heavy, 1, 5, { pct: fri }, 300, "A new 5-rep best."), ex("power_clean", 5, 3, { pct: round05(fri - 15) }, 180)] }
  ];
};
const texasMethod = programme({
  key: "texas_method", title: "Volume, recovery and intensity days", basedOn: "the Texas Method", author: "Glenn Pendlay and Mark Rippetoe",
  summary: "Three days a week past the novice stage: Monday 5×5 at 90% of Friday, Wednesday light, Friday one heavy set of 5 for a new best; bench and press swap weekly.",
  description: "Monday: squat 5x5, bench or press 5x5, deadlift 1x5. Wednesday: squat 2x5 at 80% of Monday, the other press 3x5, chin-ups 3 sets, back extensions 5x10. Friday: squat 1x5, bench or press 1x5, power cleans 5x3.",
  levels: ["amateur"], days: 3, next: "wave_531_bbb", warnings: ["The original adds a little to Friday's set every week; here as a weekly % climb - update the athlete's maxes as they rise."],
  blocks: [{ name: "Weeks 1-6", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6].map(texasWeek) }, { name: "Weeks 7-12", block_type: "strength", weeks: [7, 8, 9, 10, 11, 12].map(texasWeek) }]
});

// Madcow 5x5 (after Bill Starr): 12.5% jumps to a top set of 5 on Monday,
// Wednesday light, Friday a triple 2.5% over Monday's top then a set of 8.
const MADCOW_TOP = [77.5, 80, 82.5, 85, 86, 87, 88, 89];
const madcowWeek = (week) => {
  const top = MADCOW_TOP[week - 1];
  const at = (share) => round05(top * share);
  const ramp5 = [[1, 5, at(0.5)], [1, 5, at(0.625)], [1, 5, at(0.75)], [1, 5, at(0.875)], [1, 5, top]];
  const wedSquat = [[1, 5, at(0.5)], [1, 5, at(0.625)], [2, 5, at(0.75)]];
  const ramp4 = [[1, 5, at(0.625)], [1, 5, at(0.75)], [1, 5, at(0.875)], [1, 5, top]];
  const friday = [[1, 5, at(0.5)], [1, 5, at(0.625)], [1, 5, at(0.75)], [1, 5, at(0.875)], [1, 3, at(1.025)], [1, 8, at(0.75)]];
  return [
    { title: "Monday", items: [bySet("back_squat", ramp5, PCT, 180), bySet("bench_press", ramp5, PCT, 180), bySet("barbell_row", ramp5, PCT, 180), ex("back_extension", 2, [10, 12], { rpe: 8 }, 60), ex("weighted_crunch", 4, [10, 12], { rpe: 8 }, 60)] },
    { title: "Wednesday", items: [bySet("back_squat", wedSquat, PCT, 180, "Light: the first three of Monday's sets, the third twice."), bySet("incline_bench_press", ramp4, PCT, 150, "Or overhead press."), bySet("deadlift", ramp4, PCT, 180), ex("weighted_crunch", 3, [10, 12], { rpe: 8 }, 60)] },
    { title: "Friday", items: [bySet("back_squat", friday, PCT, 180, "A triple 2.5% over Monday's top set, then 8 at the third set's weight."), bySet("bench_press", friday, PCT, 180), bySet("barbell_row", friday, PCT, 180), ex("dip", 3, [5, 8], { rpe: 8 }, 90), ex("barbell_curl", 3, 8, { rpe: 8 }, 60), ex("barbell_skullcrusher", 3, 8, { rpe: 8 }, 60)] }
  ];
};
const madcow = programme({
  key: "ramping_5x5", title: "Ramping weekly 5×5", basedOn: "Madcow 5×5", author: "after Bill Starr",
  summary: "Three days a week: Monday ramps sets of 5 to a top set, Wednesday is light with incline and deadlifts, Friday ramps to a triple over Monday's top and a back-off 8 - a new best every week.",
  description: "Monday squat, bench and row 5x5 in 12.5% jumps; Wednesday squat 4x5 (light), incline bench 4x5, deadlift 4x5; Friday squat, bench and row 4 ramp sets, a triple, then 1x8; weighted hyperextensions, sit-ups, dips, curls and triceps extensions.",
  levels: ["amateur"], days: 3, next: "wave_531_bbb", warnings: ["Weekly top sets are written as % of max; the original adds about 2.5% each week from the athlete's 5RM - update maxes as they rise.", "Ramp sets start below Kolosseum's usual 50% floor."],
  blocks: [{ name: "Build to a best", block_type: "strength", weeks: [1, 2, 3, 4].map(madcowWeek) }, { name: "Beat it", block_type: "strength", weeks: [5, 6, 7, 8].map(madcowWeek) }]
});

// ---------------------------------------------------------------------------
// The Juggernaut Method 2.0: 10s, 8s, 5s, 3s waves, each accumulation,
// intensification (ramp, then work sets), realisation (ramp to an all-out
// set) and deload; % of 1RM.
const JM = {
  10: { acc: [[4, 10, 54], [1, 10, 54, true]], int: [[1, 5, 49.5], [1, 5, 56], [2, 10, 61], [1, 10, 61, true]], real: [[1, 5, 45], [1, 3, 54], [1, 1, 63], [1, 10, 68, true]] },
  8: { acc: [[4, 8, 59], [1, 8, 59, true]], int: [[1, 5, 54], [1, 3, 60], [2, 8, 65], [1, 8, 65, true]], real: [[1, 5, 45], [1, 3, 54], [1, 1, 63], [1, 8, 72, true]] },
  5: { acc: [[5, 5, 63], [1, 5, 63, true]], int: [[1, 5, 54], [1, 3, 63], [3, 5, 70], [1, 5, 70, true]], real: [[1, 5, 45], [1, 3, 54], [1, 2, 63], [1, 1, 72], [1, 5, 77, true]] },
  3: { acc: [[6, 3, 68], [1, 3, 68, true]], int: [[1, 5, 54], [1, 3, 63], [1, 1, 68], [4, 3, 74], [1, 3, 74, true]], real: [[1, 5, 45], [1, 3, 54], [1, 2, 63], [1, 1, 72], [1, 3, 81, true]] }
};
const juggWeek = (wave, phase) => {
  const plan = phase === 3 ? DELOAD_531 : JM[wave][["acc", "int", "real"][phase]];
  const note = phase === 3 ? "Deload." : phase === 2 ? "Realisation: the last set as many as you can - the reps over the target raise the next wave's training max." : "The last set as many as you can.";
  const main = (lift) => bySet(lift, plan, PCT, 180, note);
  return [
    { title: "Squat", items: [main("back_squat"), ex("leg_press", 3, 10, { rpe: 8 }, 90), ex("lying_leg_curl", 3, 12, { rpe: 8 }, 60), ex("ab_wheel_rollout", 3, 12, "bw", 60)] },
    { title: "Bench", items: [main("bench_press"), ex("incline_dumbbell_press", 3, 10, { rpe: 8 }, 90), ex("single_arm_dumbbell_row", 3, 10, { rpe: 8 }, 60), ex("face_pull", 3, 15, { rpe: 8 }, 60)] },
    { title: "Overhead press", items: [main("overhead_press"), ex("dumbbell_lateral_raise", 3, 12, { rpe: 8 }, 60), ex("chin_up", 3, 8, "bw", 90), ex("cable_triceps_pressdown", 3, 12, { rpe: 8 }, 60)] },
    { title: "Deadlift", items: [main("deadlift"), ex("barbell_row", 3, 10, { rpe: 8 }, 90), ex("hanging_leg_raise", 3, 12, "bw", 60), ex("dumbbell_curl", 3, 12, { rpe: 8 }, 60)] }
  ];
};
const juggernaut = programme({
  key: "rep_waves", title: "Rep waves 10s, 8s, 5s, 3s", basedOn: "the Juggernaut Method 2.0", author: "Chad Wesley Smith",
  summary: "Sixteen weeks, four days a week: 10s, 8s, 5s and 3s waves on squat, bench, press and deadlift - accumulation, intensification, an all-out realisation set and a deload in each.",
  description: "Each wave: accumulation (sets with the last all out), intensification (ramp, then work sets), realisation (ramp to one all-out set), deload. Assistance per day as listed.",
  levels: ["amateur", "pro"], days: 4, next: "wave_531_bbb", warnings: ["Ramp sets and the deload go below Kolosseum's usual 50% floor.", "Assistance is set by effort (RPE 8)."],
  blocks: [10, 8, 5, 3].map((wave) => ({ name: `${wave}s wave`, block_type: wave >= 8 ? "volume" : wave === 5 ? "strength" : "peak", weeks: [0, 1, 2, 3].map((phase) => juggWeek(wave, phase)) }))
});

// ---------------------------------------------------------------------------
// Tactical Barbell Operator: 6-week waves; squat, bench and weighted pull-up
// three days, deadlift in place of the pull-up on day 2.
const OPERATOR = [[[3, 5], 5, 70], [[3, 5], 5, 80], [[3, 4], 3, 90], [[3, 5], 5, 75], [[3, 5], 3, 85], [[3, 4], [1, 2], 95]];
const operatorWeek = (week) => {
  const [sets, reps, pct] = OPERATOR[(week - 1) % 6];
  const main = (lift) => ex(lift, sets, reps, { pct }, 180);
  const pull = ex("pull_up", sets, reps, { rpe: pct >= 90 ? 9 : pct >= 80 ? 8 : 7 }, 150, `Weighted pull-up at ${pct}% of its max - written as effort here (the library loads a pull-up by bodyweight).`);
  return [
    { title: "Day 1", items: [main("back_squat"), main("bench_press"), pull] },
    { title: "Day 2", items: [main("back_squat"), main("bench_press"), main("deadlift")] },
    { title: "Day 3", items: [main("back_squat"), main("bench_press"), pull] }
  ];
};
const operator = programme({
  key: "three_lift_waves", title: "Three-lift strength waves", basedOn: "Tactical Barbell Operator", author: "K. Black",
  summary: "Three sessions a week alongside conditioning: squat, bench and weighted pull-ups (deadlift on day 2) in 6-week waves - 70, 80, 90, 75, 85, 95% for 3-5 sets.",
  description: "Week 1 70% 3-5x5, week 2 80% 3-5x5, week 3 90% 3-4x3, week 4 75% 3-5x5, week 5 85% 3-5x3, week 6 95% 3-4x1-2.",
  levels: ["amateur", "pro"], days: 3, next: "easy_strength_40_day", warnings: ["Weighted pull-ups are set by effort (RPE) - the original uses % of the weighted pull-up max."],
  blocks: [1, 2].map((wave) => ({ name: `Wave ${wave}`, block_type: "strength", weeks: [1, 2, 3, 4, 5, 6].map((w) => operatorWeek((wave - 1) * 6 + w)) }))
});

// Easy Strength, 40 days: five days a week, five movements, about 10 reps each.
const EASY = [[2, 5], [2, 5], [5, 2], [2, 5], [1, 10]];
const easyWeek = () => EASY.map(([sets, reps], d) => ({ title: `Day ${d + 1}`, items: [
  ex("deadlift", sets, reps, { rpe: 6 }, 120, "Never close to a limit."), ex("bench_press", sets, reps, { rpe: 6 }, 120), ex("pull_up", sets, Math.min(reps, 5), "bw", 90),
  ex("ab_wheel_rollout", 1, 5, "bw", 60), ex("farmers_carry", 1, { metres: 30 }, { rpe: 6 }, 60)
] }));
const easyStrength = programme({
  key: "easy_strength_40_day", title: "Easy strength, 40 days", basedOn: "Easy Strength", author: "Dan John and Pavel Tsatsouline",
  summary: "Forty short sessions, five a week: a hinge, a press, a pull, an ab rollout and a loaded carry, about 10 reps each, never close to a limit.",
  description: "The 40-day workout: the same five movements every day, 2x5 most days, 5x2 or 1x10 on others, always easy.",
  levels: ["amateur", "pro"], days: 5, next: "three_lift_waves", warnings: ["Loads are written as RPE 6 - the original simply says easy, never near a limit."],
  blocks: [{ name: "Forty days", block_type: "general", weeks: Array.from({ length: 8 }, easyWeek) }]
});

// ---------------------------------------------------------------------------
// Size and strength splits (rep ranges as published; loads by effort).
const EFFORT = "Rep ranges as published; the weight is set by effort (RPE 8) since the original gives none.";
const r8 = { rpe: 8 };
const phulWeek = () => [
  { title: "Upper power", items: [ex("bench_press", [3, 4], [3, 5], { rpe: 9 }, 180), ex("incline_dumbbell_press", [3, 4], [6, 10], r8, 120), ex("barbell_row", [3, 4], [3, 5], { rpe: 9 }, 180), ex("lat_pulldown", [3, 4], [6, 10], r8, 90), ex("overhead_press", [2, 3], [5, 8], r8, 120), ex("barbell_curl", [2, 3], [6, 10], r8, 60), ex("barbell_skullcrusher", [2, 3], [6, 10], r8, 60)] },
  { title: "Lower power", items: [ex("back_squat", [3, 4], [3, 5], { rpe: 9 }, 240), ex("deadlift", [3, 4], [3, 5], { rpe: 9 }, 240), ex("leg_press", [3, 5], [10, 15], r8, 120), ex("lying_leg_curl", [3, 4], [6, 10], r8, 60), ex("standing_calf_raise", 4, [6, 10], r8, 60)] },
  { title: "Upper hypertrophy", items: [ex("incline_bench_press", [3, 4], [8, 12], r8, 90), ex("dumbbell_fly", [3, 4], [8, 12], r8, 60), ex("seated_cable_row", [3, 4], [8, 12], r8, 60), ex("single_arm_dumbbell_row", [3, 4], [8, 12], r8, 60), ex("dumbbell_lateral_raise", [3, 4], [8, 12], r8, 60), ex("incline_dumbbell_curl", [3, 4], [8, 12], r8, 60), ex("overhead_cable_triceps_extension", [3, 4], [8, 12], r8, 60)] },
  { title: "Lower hypertrophy", items: [ex("front_squat", [3, 4], [8, 12], r8, 120), ex("walking_lunge", [3, 4], [8, 12], r8, 90), ex("leg_extension", [3, 4], [10, 15], r8, 60), ex("seated_leg_curl", [3, 4], [10, 15], r8, 60), ex("seated_calf_raise", [3, 4], [8, 12], r8, 45), ex("leg_press_calf_raise", [3, 4], [8, 12], r8, 45)] }
];
const phul = programme({
  key: "power_hypertrophy_upper_lower", title: "Power and hypertrophy upper/lower", basedOn: "PHUL", author: "Brandon Campbell",
  summary: "Four days a week: upper and lower power days (3-5 reps on the big lifts) and upper and lower hypertrophy days (8-15 reps).",
  description: "Upper power, lower power, upper hypertrophy, lower hypertrophy, each exercise with its published set and rep ranges.",
  levels: ["amateur", "pro"], days: 4, next: "power_hypertrophy_5_day", warnings: [EFFORT, "Barbell lunges are walking lunges here."],
  blocks: [{ name: "Twelve weeks", block_type: "volume", weeks: Array.from({ length: 12 }, phulWeek) }]
});

const SPEED = "Speed work: 6 fast triples at 65-70% of your 3-5 rep max (about 57.5% of max), short rest.";
const phatWeek = () => [
  { title: "Upper power", items: [ex("pendlay_row", 3, [3, 5], { rpe: 9 }, 180), ex("pull_up", 2, [6, 10], r8, 120, "Weighted."), ex("chin_up", 2, [6, 10], r8, 120, "Rack chins."), ex("dumbbell_bench_press", 3, [3, 5], { rpe: 9 }, 180), ex("dip", 2, [6, 10], r8, 120, "Weighted."), ex("dumbbell_overhead_press", 3, [6, 10], r8, 90), ex("barbell_curl", 3, [6, 10], r8, 60), ex("barbell_skullcrusher", 3, [6, 10], r8, 60)] },
  { title: "Lower power", items: [ex("back_squat", 3, [3, 5], { rpe: 9 }, 240), ex("hack_squat", 2, [6, 10], r8, 120), ex("leg_extension", 2, [6, 10], r8, 60), ex("stiff_leg_deadlift", 3, [5, 8], r8, 120), ex("glute_ham_raise", 2, [6, 10], r8, 90), ex("standing_calf_raise", 3, [6, 10], r8, 60), ex("seated_calf_raise", 2, [6, 10], r8, 60)] },
  { title: "Back and shoulders hypertrophy", items: [ex("pendlay_row", 6, 3, { pct: 57.5 }, 60, SPEED), ex("chin_up", 3, [8, 12], r8, 90, "Rack chins."), ex("seated_cable_row", 3, [8, 12], r8, 60), ex("single_arm_dumbbell_row", 2, [12, 15], r8, 60), ex("lat_pulldown", 2, [15, 20], r8, 60, "Close grip."), ex("dumbbell_overhead_press", 3, [8, 12], r8, 60), ex("upright_row", 2, [12, 15], r8, 60), ex("dumbbell_lateral_raise", 3, [12, 20], r8, 45)] },
  { title: "Lower hypertrophy", items: [ex("back_squat", 6, 3, { pct: 57.5 }, 60, SPEED), ex("hack_squat", 3, [8, 12], r8, 90), ex("leg_press", 2, [12, 15], r8, 90), ex("leg_extension", 3, [15, 20], r8, 60), ex("romanian_deadlift", 3, [8, 12], r8, 90), ex("lying_leg_curl", 2, [12, 15], r8, 60), ex("seated_leg_curl", 2, [15, 20], r8, 60), ex("donkey_calf_raise", 4, [10, 15], r8, 45), ex("seated_calf_raise", 3, [15, 20], r8, 45)] },
  { title: "Chest and arms hypertrophy", items: [ex("dumbbell_bench_press", 6, 3, { pct: 57.5 }, 60, SPEED), ex("incline_dumbbell_press", 3, [8, 12], r8, 90), ex("machine_chest_press", 3, [12, 15], r8, 60), ex("cable_fly", 2, [15, 20], r8, 60, "Incline cable fly."), ex("preacher_curl", 3, [8, 12], r8, 60), ex("concentration_curl", 2, [12, 15], r8, 45), ex("spider_curl", 2, [15, 20], r8, 45), ex("overhead_cable_triceps_extension", 3, [8, 12], r8, 45, "Seated triceps extension."), ex("cable_triceps_pressdown", 2, [12, 15], r8, 45), ex("dumbbell_kickback", 2, [15, 20], r8, 45, "Cable kickback.")] }
];
const phat = programme({
  key: "power_hypertrophy_5_day", title: "Power and hypertrophy, 5 days", basedOn: "PHAT", author: "Layne Norton",
  summary: "Five days a week: upper and lower power days (3-5 reps), then back and shoulders, legs, and chest and arms hypertrophy days opening with speed triples.",
  description: "Upper power, lower power, rest, back and shoulders hypertrophy, lower hypertrophy, chest and arms hypertrophy - every exercise with its published sets and rep ranges.",
  levels: ["amateur", "pro"], days: 5, next: "power_hypertrophy_upper_lower",
  warnings: [EFFORT, "Weekly volume runs past Kolosseum's usual per-muscle ranges for some groups.", "Library stand-ins: incline cable fly is cable fly, cable kickback is a dumbbell kickback; weighted pull-ups and dips are noted on the bodyweight exercise."],
  blocks: [{ name: "Twelve weeks", block_type: "volume", weeks: Array.from({ length: 12 }, phatWeek) }]
});

const PPL_PCT = climb(70, 85);
const pplWeek = (week) => {
  const pct = PPL_PCT[week - 1];
  const r812 = [8, 12];
  const pull = (heavy) => ({ title: heavy === "deadlift" ? "Pull - deadlift" : "Pull - row", items: [
    heavy === "deadlift" ? bySet("deadlift", [[1, 5, pct, true]], PCT, 240, LINEAR) : bySet("barbell_row", [[4, 5, pct], [1, 5, pct, true]], PCT, 180, LINEAR),
    ex("lat_pulldown", 3, r812, r8, 90), ex("seated_cable_row", 3, r812, r8, 90), ex("face_pull", 5, [15, 20], r8, 60), ex("hammer_curl", 4, r812, r8, 60), ex("dumbbell_curl", 4, r812, r8, 60)
  ] });
  const push = (heavy) => ({ title: heavy === "bench_press" ? "Push - bench" : "Push - press", items: [
    bySet(heavy, [[4, 5, pct], [1, 5, pct, true]], PCT, 180, LINEAR), ex(heavy === "bench_press" ? "overhead_press" : "bench_press", 3, r812, r8, 120), ex("incline_dumbbell_press", 3, r812, r8, 90),
    ...superset(ex("cable_triceps_pressdown", 3, r812, r8, 60), ex("dumbbell_lateral_raise", 3, [15, 20], r8, 60)),
    ...superset(ex("overhead_cable_triceps_extension", 3, r812, r8, 60), ex("dumbbell_lateral_raise", 3, [15, 20], r8, 60))
  ] });
  const legs = (title) => ({ title, items: [bySet("back_squat", [[2, 5, pct], [1, 5, pct, true]], PCT, 240, LINEAR), ex("romanian_deadlift", 3, r812, r8, 120), ex("leg_press", 3, r812, r8, 90), ex("lying_leg_curl", 3, r812, r8, 60), ex("standing_calf_raise", 5, r812, r8, 60)] });
  return [pull("deadlift"), push("bench_press"), legs("Legs"), pull("barbell_row"), push("overhead_press"), legs("Legs 2")];
};
const redditPpl = programme({
  key: "push_pull_legs_6_day", title: "Push/pull/legs, 6 days", basedOn: "the r/Fitness PPL", author: "Metallicadpa and r/Fitness",
  summary: "Six days a week: pull, push and legs twice each - a main lift for 5s with an all-out last set, then 8-12s, face pulls 5×15-20 and lateral raises supersetted twice per push day.",
  description: "Pull: deadlift 1x5+ or rows 4x5, 1x5+; pulldowns, cable rows 3x8-12; face pulls 5x15-20; hammer and dumbbell curls 4x8-12. Push: bench or press 4x5, 1x5+; the other 3x8-12; incline dumbbell press 3x8-12; pushdowns and overhead extensions 3x8-12, each supersetted with lateral raises 3x15-20. Legs: squat 2x5, 1x5+; RDL, leg press, leg curls 3x8-12; calf raises 5x8-12.",
  levels: ["beginner", "amateur"], days: 6, next: "power_hypertrophy_upper_lower",
  warnings: [LINEAR, EFFORT, "Six days and this much weekly volume runs past Kolosseum's usual per-muscle ranges for shoulders and arms."],
  blocks: [{ name: "Weeks 1-6", block_type: "volume", weeks: [1, 2, 3, 4, 5, 6].map(pplWeek) }, { name: "Weeks 7-12", block_type: "volume", weeks: [7, 8, 9, 10, 11, 12].map(pplWeek) }]
});

const broWeek = () => [
  { title: "Chest", items: [ex("bench_press", 4, 8, r8, 120), ex("incline_dumbbell_press", 3, 10, r8, 90), ex("dip", 3, 8, r8, 90), ex("dumbbell_fly", 3, 10, r8, 60), ex("cable_fly", 3, 12, r8, 60, "Cable crossover.")] },
  { title: "Back", items: [ex("deadlift", 3, 5, r8, 180), ex("barbell_row", 4, 8, r8, 120), ex("lat_pulldown", 3, 10, r8, 90), ex("seated_cable_row", 3, 10, r8, 90), ex("pullover", 3, 12, r8, 60)] },
  { title: "Shoulders", items: [ex("overhead_press", 4, 8, r8, 120), ex("arnold_press", 3, 10, r8, 90), ex("dumbbell_lateral_raise", 4, 12, r8, 60), ex("face_pull", 3, 12, r8, 60), ex("shrug", 4, 10, r8, 60)] },
  { title: "Legs", items: [ex("back_squat", 4, 8, r8, 180), ex("romanian_deadlift", 3, 10, r8, 120), ex("leg_press", 3, 10, r8, 90), ex("leg_extension", 3, 12, r8, 60), ex("seated_leg_curl", 3, 12, r8, 60), ex("standing_calf_raise", 4, 12, r8, 45)] },
  { title: "Arms", items: [ex("barbell_curl", 3, 10, r8, 60), ex("barbell_skullcrusher", 3, 10, r8, 60), ex("hammer_curl", 3, 10, r8, 60), ex("cable_triceps_pressdown", 3, 10, r8, 60), ex("preacher_curl", 3, 12, r8, 60), ex("overhead_cable_triceps_extension", 3, 12, r8, 60)] }
];
const broSplit = programme({
  key: "body_part_split_5_day", title: "Five-day body-part split", basedOn: "the classic bodybuilding split", author: "",
  summary: "The classic bodybuilding week: chest, back, shoulders, legs and arms on their own days, each muscle trained hard once a week.",
  description: "Chest, back, shoulders, legs and arms days with the traditional exercises, sets and reps.",
  levels: ["amateur", "pro"], days: 5, next: "push_pull_legs_6_day", warnings: [EFFORT, "Cable crossovers are cable flies here."],
  blocks: [{ name: "Twelve weeks", block_type: "volume", weeks: Array.from({ length: 12 }, broWeek) }]
});

const arnoldWeek = () => {
  const chestBack = (title) => ({ title, items: [ex("bench_press", 4, 8, r8, 120), ex("incline_dumbbell_press", 3, 10, r8, 90), ex("pullover", 3, 10, r8, 60), ex("chin_up", 4, 8, r8, 90), ex("barbell_row", 4, 10, r8, 90), ex("deadlift", 3, 8, r8, 180), ex("crunch", 3, 15, "bw", 45)] });
  const shouldersArms = (title) => ({ title, items: [ex("overhead_press", 4, 8, r8, 120), ex("dumbbell_lateral_raise", 3, 10, r8, 60), ex("upright_row", 3, 10, r8, 60), ex("barbell_curl", 3, 10, r8, 60), ex("incline_dumbbell_curl", 3, 10, r8, 60), ex("close_grip_bench_press", 3, 10, r8, 90), ex("barbell_skullcrusher", 3, 10, r8, 60), ex("decline_crunch", 3, 15, "bw", 45, "Reverse crunch.")] });
  const legs = (title) => ({ title, items: [ex("back_squat", 4, 8, r8, 180), ex("walking_lunge", 3, 10, r8, 90), ex("good_morning", 3, 10, r8, 90), ex("stiff_leg_deadlift", 3, 10, r8, 90), ex("standing_calf_raise", 4, 12, r8, 45), ex("hanging_leg_raise", 3, 10, "bw", 45)] });
  return [chestBack("Chest and back"), shouldersArms("Shoulders and arms"), legs("Legs"), chestBack("Chest and back 2"), shouldersArms("Shoulders and arms 2"), legs("Legs 2")];
};
const arnoldSplit = programme({
  key: "golden_era_6_day", title: "Golden-era 6-day split", basedOn: "Arnold Schwarzenegger's split", author: "Arnold Schwarzenegger",
  summary: "Six days a week: chest and back, shoulders and arms, and legs, each twice a week, with deadlifts on the chest and back day.",
  description: "Chest and back, shoulders and arms, legs - repeated - with the classic exercises, sets and reps.",
  levels: ["pro"], days: 6, next: "body_part_split_5_day", warnings: [EFFORT, "Six days a week and this volume runs past Kolosseum's usual per-muscle ranges.", "Reverse crunches are decline crunches here."],
  blocks: [{ name: "Twelve weeks", block_type: "volume", weeks: Array.from({ length: 12 }, arnoldWeek) }]
});

// German Volume Training: 10 x 10 at 60%, antagonist supersets, tempo 4-0-2-0.
const GVT = "10 sets of 10, 90 s rest, slow tempo. All 100 reps? Add 4-5% next time.";
const gvtWeek = () => [
  { title: "Chest and back", items: [...superset(ex("decline_dumbbell_press", 10, 10, { pct: 60 }, 90, `${GVT} ${SUPERVISED}`, { tempo: "4-0-2-0" }), ex("chin_up", 10, 10, "bw", 90, GVT, { tempo: "4-0-2-0" })), ...superset(ex("incline_dumbbell_fly", 3, [10, 12], r8, 60), ex("single_arm_dumbbell_row", 3, [10, 12], r8, 60))] },
  { title: "Legs and abs", items: [...superset(ex("back_squat", 10, 10, { pct: 60 }, 90, `${GVT} ${SUPERVISED}`, { tempo: "4-0-2-0" }), ex("lying_leg_curl", 10, 10, { pct: 60 }, 90, GVT, { tempo: "4-0-2-0" })), ...superset(ex("cable_crunch", 3, [15, 20], r8, 60), ex("seated_calf_raise", 3, [15, 20], r8, 60))] },
  { title: "Arms and shoulders", items: [...superset(ex("triceps_dip", 10, 10, "bw", 90, `${GVT} ${SUPERVISED}`, { tempo: "3-0-2-0" }), ex("incline_dumbbell_curl", 10, 10, { pct: 60 }, 90, GVT, { tempo: "3-0-2-0" })), ...superset(ex("dumbbell_reverse_fly", 3, [10, 12], r8, 60), ex("dumbbell_lateral_raise", 3, [10, 12], r8, 60))] }
];
const germanVolume = programme({
  key: "ten_sets_of_ten", title: "Ten sets of ten", basedOn: "German Volume Training", author: "the Poliquin Group",
  summary: "Six weeks of 10 sets of 10 at 60% on one antagonist pair per day - chest and back, legs, arms and shoulders - 90 s rest, slow tempo.",
  description: "Day 1 decline dumbbell press with chin-ups 10x10, then incline flies with one-arm rows 3x10-12; day 2 squats with lying leg curls 10x10, then crunches with calf raises; day 3 dips with incline curls 10x10, then reverse flies with lateral raises.",
  levels: ["amateur", "pro"], days: 3, next: "power_hypertrophy_upper_lower",
  warnings: ["Particularly hard: 100 reps per main lift, far past Kolosseum's 8-set and per-muscle limits. " + SUPERVISED],
  blocks: [{ name: "Ten by ten", block_type: "volume", weeks: Array.from({ length: 6 }, gvtWeek) }]
});

// ---------------------------------------------------------------------------
// Powerlifting.
// Smolov squat routine, 13 weeks (% of 1RM).
const SMOLOV_WEIGHT = "The original adds 10 kg (20 lb) in week 2 and a further 5 kg (10 lb) in week 3 of the base cycle; here written as about +5% and +7.5% of max.";
const smolovDay = (title, plan, note = SUPERVISED) => ({ title, items: [bySet("back_squat", plan, PCT, 240, note)] });
const smolovBase = (bump) => [
  smolovDay("Base day 1", [[4, 9, 70 + bump]]), smolovDay("Base day 2", [[5, 7, 75 + bump]]),
  smolovDay("Base day 3", [[7, 5, 80 + bump]]), smolovDay("Base day 4", [[10, 3, 85 + bump]])
];
const smolov = programme({
  key: "smolov_squat_pro", title: "Thirteen-week squat specialisation", basedOn: "the Smolov squat routine", author: "Sergey Smolov",
  activity: "powerlifting", activityIds: ["powerlifting"],
  summary: "Thirteen weeks of squatting up to four times a week: introduction, the base cycle (4×9, 5×7, 7×5, 10×3 in one week), a test, switching, the intense cycle to 95%, and a final test.",
  description: "Introduction (2 weeks), base mesocycle (3 weeks, then a test), switching phase (2 weeks), intense mesocycle (4 weeks), taper and test.",
  levels: ["pro"], days: 3, next: "powerlifting_meet_prep",
  warnings: ["Particularly hard: squatting up to four days a week at 70-92.5% for 25+ sets, far past Kolosseum's per-muscle ranges and 8-set cap. " + SUPERVISED, SMOLOV_WEIGHT],
  blocks: [
    { name: "Introduction", block_type: "general", weeks: [
      [smolovDay("Intro 1", [[3, 8, 65], [1, 5, 70], [2, 2, 75], [1, 1, 80]]), smolovDay("Intro 2", [[3, 8, 65], [1, 5, 70], [2, 2, 75], [1, 1, 80]]), smolovDay("Intro 3", [[4, 5, 70], [1, 3, 75], [2, 2, 80], [1, 1, 90]])],
      [smolovDay("Intro 4", [[1, 5, 80]]), smolovDay("Intro 5", [[1, 5, 82.5]]), smolovDay("Intro 6", [[1, 5, 85]])]
    ] },
    { name: "Base mesocycle", block_type: "volume", weeks: [smolovBase(0), smolovBase(5), smolovBase(7.5), [smolovDay("Test", [[1, 1, 95]], `Work up to a new max. ${SUPERVISED}`)]] },
    { name: "Switching phase", block_type: "deload", weeks: [
      [smolovDay("Switching 1", [[6, 2, 50]], "Fast, crisp reps."), smolovDay("Switching 2", [[6, 2, 55]], "Fast, crisp reps."), smolovDay("Switching 3", [[5, 3, 55]], "Fast, crisp reps.")],
      [smolovDay("Switching 4", [[5, 3, 55]], "Fast, crisp reps."), smolovDay("Switching 5", [[5, 2, 60]], "Fast, crisp reps."), smolovDay("Switching 6", [[4, 2, 60]], "Fast, crisp reps.")]
    ] },
    { name: "Intense mesocycle", block_type: "peak", weeks: [
      [smolovDay("Intense 1", [[1, 3, 65], [1, 4, 75], [3, 4, 85], [1, 5, 90]]), smolovDay("Intense 2", [[1, 3, 60], [1, 3, 70], [1, 4, 80], [1, 3, 90], [2, 5, 85]]), smolovDay("Intense 3", [[1, 4, 65], [1, 4, 70], [5, 4, 80]])],
      [smolovDay("Intense 4", [[1, 4, 60], [1, 4, 70], [1, 4, 80], [1, 3, 90], [2, 4, 90]]), smolovDay("Intense 5", [[1, 3, 65], [1, 3, 75], [1, 3, 85], [3, 3, 90], [1, 3, 95]]), smolovDay("Intense 6", [[1, 3, 65], [1, 3, 75], [1, 4, 85], [4, 5, 90]])],
      [smolovDay("Intense 7", [[1, 3, 60], [1, 3, 70], [1, 3, 80], [5, 5, 90]]), smolovDay("Intense 8", [[1, 3, 60], [1, 3, 70], [1, 3, 80], [2, 3, 95]]), smolovDay("Intense 9", [[1, 3, 65], [1, 3, 75], [1, 3, 85], [4, 3, 95]])],
      [smolovDay("Intense 10", [[1, 3, 70], [1, 4, 80], [5, 5, 90]]), smolovDay("Intense 11", [[1, 3, 70], [1, 3, 80], [4, 3, 95]]), smolovDay("Intense 12", [[1, 3, 75], [1, 4, 90], [3, 4, 80]])]
    ] },
    { name: "Taper and test", block_type: "deload", weeks: [[smolovDay("Taper", [[1, 3, 70], [1, 3, 80], [2, 5, 90], [3, 4, 95]]), smolovDay("Test", [[1, 1, 95]], `Work up to a new max. ${SUPERVISED}`)]] }
  ]
});

const smolovJrWeek = (bump) => [[6, 6, 70], [7, 5, 75], [8, 4, 80], [10, 3, 85]].map(([sets, reps, pct], d) => ({ title: `Day ${d + 1}`, items: [ex("back_squat", sets, reps, { pct: pct + bump }, 180, SUPERVISED)] }));
const smolovJr = programme({
  key: "smolov_jr_pro", title: "Three-week squat peak", basedOn: "Smolov Jr", author: "Sergey Smolov (the short version)",
  activity: "powerlifting", activityIds: ["powerlifting"],
  summary: "Three weeks, four squat days a week: 6×6 at 70%, 7×5 at 75%, 8×4 at 80% and 10×3 at 85%, heavier each week.",
  description: "The same four days each week, adding 2.5-5 kg (5-10 lb) to every day in weeks 2 and 3. Can be run on the bench press the same way.",
  levels: ["pro"], days: 4, next: "powerlifting_meet_prep",
  warnings: ["Particularly hard: four high-volume squat days a week, past Kolosseum's 8-set cap and per-muscle ranges. " + SUPERVISED, "The original adds 2.5-5 kg a week; here about +2.5% and +5% of max."],
  blocks: [{ name: "Three weeks", block_type: "peak", weeks: [smolovJrWeek(0), smolovJrWeek(2.5), smolovJrWeek(5)] }]
});

// Sheiko #29 (% of each lift's max; accessories by effort).
const S_ACC = { rpe: 7 };
const KNEE = "Deadlift to the knees: pull to knee height, pause, lower.";
const BLOCKS = "From blocks at knee height, % of your deadlift max.";
const sheikoWeeks = [
  [
    { title: "Day 1", items: [bySet("bench_press", [[1, 5, 50], [2, 4, 60], [2, 3, 70], [5, 3, 75]], PCT, 180), bySet("back_squat", [[1, 5, 50], [2, 5, 60], [5, 5, 70]], PCT, 180), bySet("bench_press", [[1, 5, 50], [1, 5, 60], [4, 4, 70]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), ex("good_morning", 5, 5, S_ACC, 90)] },
    { title: "Day 2", items: [bySet("deadlift", [[1, 3, 50], [2, 3, 60], [2, 3, 70], [4, 3, 75]], PCT, 180, KNEE), ex("dumbbell_bench_press", 4, 6, S_ACC, 90), ex("barbell_skullcrusher", 5, 5, S_ACC, 60), bySet("block_pull", [[1, 4, 55], [1, 4, 65], [2, 4, 75], [4, 3, 85]], PCT, 180, BLOCKS), ex("forward_lunge", 5, 5, S_ACC, 90), ex("hanging_leg_raise", 3, 10, "bw", 60)] },
    { title: "Day 3", items: [bySet("bench_press", [[1, 5, 50], [1, 5, 60], [1, 4, 70], [2, 3, 75], [2, 2, 80], [2, 3, 75], [1, 4, 70], [1, 6, 60], [1, 8, 50]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), bySet("back_squat", [[1, 5, 50], [2, 4, 60], [2, 3, 70], [5, 3, 75]], PCT, 180), ex("good_morning", 5, 5, S_ACC, 90)] }
  ],
  [
    { title: "Day 1", items: [bySet("back_squat", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [5, 2, 80]], PCT, 180), bySet("bench_press", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [5, 3, 80]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), ex("barbell_skullcrusher", 5, 10, S_ACC, 60), bySet("front_squat", [[2, 3, 60], [2, 3, 67.5], [4, 2, 72.5]], PCT, 180, "% of your front squat max."), ex("good_morning", 5, 5, S_ACC, 90)] },
    { title: "Day 2", items: [bySet("deadlift", [[1, 3, 50], [1, 3, 60], [2, 3, 70], [4, 2, 75]], PCT, 180, KNEE), bySet("bench_press", [[1, 6, 50], [2, 6, 60], [4, 6, 65]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), bySet("block_pull", [[1, 4, 55], [1, 4, 65], [2, 4, 75], [4, 4, 80]], PCT, 180, BLOCKS), ex("forward_lunge", 5, 5, S_ACC, 90)] },
    { title: "Day 3", items: [bySet("back_squat", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [5, 2, 80]], PCT, 180), bySet("bench_press", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [2, 2, 80], [1, 3, 75], [1, 5, 65], [1, 7, 55]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), bySet("back_squat", [[1, 5, 50], [2, 5, 60], [4, 4, 70]], PCT, 180), ex("good_morning", 5, 5, S_ACC, 90)] }
  ],
  [
    { title: "Day 1", items: [bySet("back_squat", [[1, 5, 55], [1, 4, 65], [2, 3, 75], [4, 2, 85]], PCT, 180), bySet("bench_press", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [6, 3, 80]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), ex("barbell_skullcrusher", 5, 10, S_ACC, 60), bySet("back_squat", [[1, 3, 50], [1, 3, 60], [1, 3, 70], [4, 3, 80]], PCT, 180), ex("good_morning", 5, 5, S_ACC, 90)] },
    { title: "Day 2", items: [bySet("deficit_deadlift", [[2, 3, 45], [2, 3, 52.5], [4, 3, 57.5]], PCT, 180, "% of your deadlift max."), bySet("bench_press", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [3, 2, 80], [2, 2, 85], [2, 3, 80]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), bySet("block_pull", [[1, 4, 60], [2, 4, 70], [2, 3, 80], [3, 2, 90]], PCT, 180, BLOCKS), ex("forward_lunge", 5, 5, S_ACC, 90)] },
    { title: "Day 3", items: [bySet("back_squat", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [6, 3, 80]], PCT, 180), bySet("bench_press", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [7, 3, 80]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), ex("overhead_press", 5, 4, S_ACC, 90), ex("good_morning", 5, 5, S_ACC, 90)] }
  ],
  [
    { title: "Day 1", items: [bySet("back_squat", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [5, 3, 80]], PCT, 180), bySet("bench_press", [[1, 5, 55], [1, 5, 65], [5, 4, 75]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), ex("barbell_skullcrusher", 5, 8, S_ACC, 60), bySet("front_squat", [[2, 5, 60], [2, 4, 62.5], [3, 3, 72.5]], PCT, 180, "% of your front squat max."), ex("good_morning", 5, 5, S_ACC, 90)] },
    { title: "Day 2", items: [bySet("bench_press", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [2, 3, 80], [3, 2, 85]], PCT, 180), bySet("deadlift", [[1, 3, 50], [1, 3, 60], [2, 3, 70], [2, 3, 80], [3, 2, 85], [3, 2, 80]], PCT, 180, KNEE), bySet("bench_press", [[1, 5, 50], [1, 5, 60], [4, 5, 70]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90)] },
    { title: "Day 3", items: [bySet("back_squat", [[1, 5, 50], [1, 4, 60], [2, 3, 70], [6, 3, 80]], PCT, 180), bySet("bench_press", [[1, 6, 50], [1, 5, 60], [2, 4, 70], [2, 3, 80], [2, 2, 85], [2, 3, 80], [1, 4, 70], [1, 6, 60], [1, 8, 50]], PCT, 180), ex("dumbbell_bench_press", 5, 10, S_ACC, 90), ex("barbell_skullcrusher", 5, 8, S_ACC, 60), ex("good_morning", 5, 5, S_ACC, 90), ex("hanging_leg_raise", 3, 10, "bw", 60)] }
  ]
];
const sheiko = programme({
  key: "competition_lift_volume", title: "High-frequency competition-lift volume", basedOn: "Sheiko #29", author: "Boris Sheiko",
  activity: "powerlifting", activityIds: ["powerlifting"],
  summary: "Four weeks, three days a week: squat, bench and deadlift several times a week in pyramids of 2-8 reps at 50-90%, a lift often twice in one session, never to failure.",
  description: "Monthly training plan #29 (preparatory): bench three times a week, squat two to three times, deadlift variations twice, each set at its own % - with dumbbell bench, good mornings, skullcrushers and lunges.",
  levels: ["amateur", "pro"], days: 3, next: "powerlifting_meet_prep",
  warnings: ["Accessories (dumbbell bench, good mornings, skullcrushers, lunges) are set by effort - the original gives fixed weights.", "Front squats are % of a front squat max; deadlifts to the knee, from blocks and from a deficit are % of the deadlift max.", "Bench volume runs past Kolosseum's usual per-muscle ranges and 8-set cap."],
  blocks: [{ name: "Preparatory month", block_type: "volume", weeks: sheikoWeeks }]
});

// Westside conjugate: max effort upper and lower (a 1-3RM on a rotating
// variation, then a back-off set), dynamic effort upper (9 x 3) and lower
// (box squat 10 x 2, speed pulls 6 x 1), in 3-week waves.
const ME_UPPER = ["close_grip_bench_press", "incline_bench_press", "bench_press"];
const ME_LOWER = ["front_squat", "deficit_deadlift", "good_morning"];
const ME = "Max effort: work up to a 1-3 rep max (RPE 10), then one back-off set of as many reps as you can at about 70% of it.";
const westsideWeek = (week) => {
  const w = (week - 1) % 3;
  const me = (lift) => [ex(lift, 3, [1, 3], { rpe: 10 }, 240, `${ME} ${SUPERVISED}`), bySet(lift, [[1, 8, 7, true]], RPE, 180, "Back-off: about 70% of today's top set, as many reps as you can.")];
  return [
    { title: "Max effort upper", items: [...me(ME_UPPER[w]), ex("incline_dumbbell_press", 4, 8, r8, 90), ex("barbell_row", 4, 8, r8, 90), ex("cable_triceps_pressdown", 3, 12, r8, 60), ex("face_pull", 3, 15, r8, 60), ex("hanging_leg_raise", 3, 12, "bw", 60)] },
    { title: "Max effort lower", items: [...me(ME_LOWER[w]), ex("romanian_deadlift", 4, 8, r8, 120), ex("lying_leg_curl", 4, 10, r8, 60), ex("lat_pulldown", 3, 10, r8, 60), ex("ab_wheel_rollout", 3, 10, "bw", 60)] },
    { title: "Dynamic effort upper", items: [ex("bench_press", 9, 3, { pct: [55, 60, 65][w] }, 60, "Speed bench: 3 sets each close, medium and wide grip, as fast as you can."), ex("dumbbell_overhead_press", 3, 15, r8, 60), ex("dumbbell_overhead_triceps_extension", 3, 15, r8, 60), ex("seated_cable_row", 3, 15, r8, 60), ex("dumbbell_lateral_raise", 3, 15, r8, 45), ex("hanging_leg_raise", 3, 15, "bw", 45)] },
    { title: "Dynamic effort lower", items: [ex("box_squat", 10, 2, { pct: [60, 65, 70][w] }, 60, "Speed: fast doubles, a minute's rest."), ex("deadlift", 6, 1, { pct: [65, 70, 75][w] }, 60, "Speed pulls."), ex("leg_press", 3, 15, r8, 90), ex("lying_leg_curl", 3, 15, r8, 60), ex("barbell_row", 3, 12, r8, 60), ex("hanging_leg_raise", 3, 20, "bw", 45)] }
  ];
};
const westside = programme({
  key: "max_effort_dynamic_effort", title: "Max effort / dynamic effort", basedOn: "the Westside conjugate method", author: "Westside Barbell",
  activity: "powerlifting", activityIds: ["powerlifting"],
  summary: "Four days a week: max-effort upper and lower days working up to a 1-3 rep max on a variation that changes weekly, and speed days (bench 9×3, box squat 10×2, speed pulls) in 3-week waves.",
  description: "Max effort upper (close-grip, incline, then flat bench rotating), max effort lower (front squat, deficit deadlift, good morning rotating), dynamic effort upper and lower, with the accessory work.",
  levels: ["amateur", "pro"], days: 4, next: "powerlifting_meet_prep",
  warnings: ["Particularly hard: true max-effort work (RPE 10) twice a week, past Kolosseum's usual RPE 9 ceiling. " + SUPERVISED, "Speed work is 9-10 sets, past Kolosseum's usual 8-set cap.", "Accessories are set by effort (RPE 8)."],
  blocks: [1, 2, 3, 4].map((wave) => ({ name: `Wave ${wave}`, block_type: "strength", weeks: [1, 2, 3].map((w) => westsideWeek((wave - 1) * 3 + w)) }))
});

// ---------------------------------------------------------------------------
// The Bulgarian method (Ivan Abadjiev's principles - not one fixed published
// programme): few lifts, trained to a daily maximum, every day.
const bulgarianWeek = () => Array.from({ length: 6 }, (_, d) => {
  const power = d % 2 === 1;
  const max = (id) => [ex(id, 4, 1, { rpe: 10 }, 150, `Work up in singles to today's maximum. ${SUPERVISED}`), ex(id, 2, 2, { rpe: 8 }, 120, "Back-off doubles, about 10% lighter.")];
  return { title: `Day ${d + 1}`, items: [...max(power ? "power_snatch" : "snatch"), ...max(power ? "power_clean" : "clean_and_jerk"), ...max(d % 2 === 0 ? "front_squat" : "back_squat")] };
});
const bulgarian = programme({
  key: "bulgarian_daily_max_pro", title: "Daily-max weightlifting", basedOn: "the Bulgarian method", author: "Ivan Abadjiev",
  activity: "olympic_weightlifting", activityIds: ["olympic_weightlifting"],
  summary: "Six days a week to a daily maximum single in the snatch, the clean & jerk and a squat, then back-off doubles - few lifts, maximum frequency.",
  description: "The Bulgarian method is a set of principles (Ivan Abadjiev), not one published programme: snatch, clean & jerk and front squat taken to a daily maximum, every training day, with power variations on alternate days.",
  levels: ["pro"], days: 6, next: "olympic_weightlifting_meet_prep",
  warnings: ["Particularly hard: a maximal single (RPE 10) in three lifts six days a week, past every Kolosseum limit. " + SUPERVISED, "The method is principles, not a fixed programme: this follows its core."],
  blocks: [{ name: "Daily max", block_type: "peak", weeks: Array.from({ length: 8 }, bulgarianWeek) }]
});

export const RECOGNISED_PROGRAMMES = [
  recommendedRoutine, startingStrength, strongLifts, greyskull, fiveThreeOneBeginners,
  gzclp, texasMethod, madcow, fiveThreeOneBbb, juggernaut, operator, easyStrength,
  phul, phat, redditPpl, broSplit, arnoldSplit, germanVolume,
  smolov, smolovJr, sheiko, westside, bulgarian
];
