// Kolosseum programmes v1 - drafts for coach review.
// The reasoning behind each programme is in
// docs/programmes/KOLOSSEUM_PROGRAMMES_V1.md. scripts/seed_kolosseum_programmes.mjs
// turns these into programmes in the builder (as drafts, by default).
//
// Notation, per exercise:
//   ex(exercise_id, sets, reps, load, rest_seconds?)
//   reps: 5 | [8, 12] (a range) | { seconds: 30 } | { metres: 10 }
//   load: { pct: 70 } (% of 1RM) | { rpe: 8 } | "bw" (bodyweight) | { kg: 4 } (fixed weight)
//   note: a coaching note shown with the exercise (optional)
// group(type, options, items): exercises done together as one timed piece -
//   "for_time" or "amrap" with { cap: seconds }, "emom" with { round: seconds,
//   rounds }. Members are listed in order; every member gets the group.
// Main lifts use % of 1RM: the athlete's own setting turns it into weights
// built from what they lift (the beginner default), % of their max, or RPE.
//
// listing.next: the programme (by key) an athlete is offered when they
// finish this one - off-season build -> in-season, and back.

export const ex = (id, sets, reps, load, rest, note) => ({ id, sets, reps, load, rest, ...(note ? { note } : {}) });

let groupCount = 0;
export const group = (type, options, items) => {
  groupCount += 1;
  const id = `${type}_${groupCount}`;
  return items.map((item) => ({ ...item, group: { id, type, cap: options.cap ?? 0, round: options.round ?? 0, rounds: options.rounds ?? 0 } }));
};

// A list of per-week values, e.g. a % wave, picked by week number (1-based).
const at = (values, week) => values[(week - 1) % values.length];

// ---------------------------------------------------------------------------
// 1. Beginner full-body - beginner, any sport, 3 days a week, 12 weeks.
// Two sessions, A and B, alternate (A B A, B A B, ...). Main lifts climb
// 2.5% a week from 65%, with lighter weeks 4 and 8.
const BEGINNER_PCT = [65, 67.5, 70, 60, 70, 72.5, 75, 65, 75, 77.5, 80, 82.5];
const beginnerDay = (day, week) => {
  const pct = BEGINNER_PCT[week - 1];
  return day === "A"
    ? { title: "Day A", items: [
        ex("back_squat", 3, 5, { pct }, 180),
        ex("bench_press", 3, 5, { pct }, 180),
        ex("barbell_row", 3, 8, { pct: pct - 5 }, 120),
        ex("romanian_deadlift", 2, 8, { pct: pct - 10 }, 120),
        ex("front_plank", 3, { seconds: 30 }, "bw", 60)
      ] }
    : { title: "Day B", items: [
        ex("back_squat", 3, 5, { pct }, 180),
        ex("overhead_press", 3, 5, { pct }, 180),
        ex("deadlift", 1, 5, { pct }, 180),
        ex("lat_pulldown", 3, 10, { rpe: 7 }, 90),
        ex("dead_bug", 3, 8, "bw", 60)
      ] };
};
const beginnerFullBody = {
  key: "beginner_full_body",
  template_name: "Beginner full-body",
  activity_id: "general_strength",
  description: "Three full-body days a week on the main lifts. Two sessions alternate (A and B); the weight goes up a little whenever you make every rep.",
  listing: { title: "Beginner full-body", summary: "New to lifting? Three full-body sessions a week on the main lifts, adding a little weight every time you make all your reps. Works alongside any sport.", levels: ["beginner"], activity_ids: [], days_per_week: 3, next: "intermediate_upper_lower" },
  blocks: [{ name: "Foundation", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const order = week % 2 === 1 ? ["A", "B", "A"] : ["B", "A", "B"];
    return order.map((day) => beginnerDay(day, week));
  }) }]
};

// ---------------------------------------------------------------------------
// 2. Intermediate upper/lower - amateur, any sport, 4 days a week, 8 weeks.
// Heavy and volume days for each half of the body; two 4-week waves (three
// building weeks and a deload), the second 2.5% heavier.
const wave = (start) => [start, start + 2.5, start + 5, start - 10, start + 2.5, start + 5, start + 7.5, start - 7.5];
const UL = { bench: wave(75), squat: wave(75), row: wave(70), ohp: wave(70), rdl: wave(65), deadlift: wave(72.5), front: wave(62.5) };
const intermediateWeek = (week) => {
  const p = (k) => ({ pct: UL[k][week - 1] });
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Upper 1 - strength", items: [
      ex("bench_press", s(4), 5, p("bench"), 180), ex("barbell_row", s(4), 6, p("row"), 150), ex("overhead_press", s(3), 6, p("ohp"), 150),
      ex("pull_up", s(3), [6, 8], { rpe: 8 }, 120), ex("cable_triceps_pressdown", s(3), 12, { rpe: 8 }, 75)
    ] },
    { title: "Lower 1 - strength", items: [
      ex("back_squat", s(4), 5, p("squat"), 180), ex("romanian_deadlift", s(3), 8, p("rdl"), 150), ex("bulgarian_split_squat", s(3), 8, { rpe: 8 }, 90),
      ex("lying_leg_curl", s(3), 10, { rpe: 8 }, 75), ex("side_plank", s(3), { seconds: 30 }, "bw", 60)
    ] },
    { title: "Upper 2 - volume", items: [
      ex("incline_dumbbell_press", s(4), 10, { rpe: 8 }, 120), ex("seated_cable_row", s(4), 10, { rpe: 8 }, 90), ex("dumbbell_overhead_press", s(3), 10, { rpe: 8 }, 90),
      ex("dumbbell_lateral_raise", s(3), 15, { rpe: 8 }, 60), ex("face_pull", s(3), 15, { rpe: 7 }, 60)
    ] },
    { title: "Lower 2 - volume", items: [
      ex("deadlift", s(3), 5, p("deadlift"), 180), ex("front_squat", s(3), 8, p("front"), 150), ex("walking_lunge", s(3), 10, { rpe: 8 }, 90),
      ex("barbell_hip_thrust", s(3), 10, { rpe: 8 }, 90), ex("standing_calf_raise", s(3), 15, { rpe: 8 }, 60)
    ] }
  ];
};
const intermediateUpperLower = {
  key: "intermediate_upper_lower",
  template_name: "Intermediate upper/lower",
  activity_id: "general_strength",
  description: "Four days a week: a heavy and a volume day for the upper and lower body. Two 4-week waves, each building for three weeks then easing off.",
  listing: { title: "Intermediate upper/lower", summary: "Past the beginner stage? Four days a week - a heavy day and a volume day for upper and lower body - in two 4-week waves that build then ease off.", levels: ["amateur", "pro"], activity_ids: [], days_per_week: 4 },
  blocks: [
    { name: "Wave 1", block_type: "strength", weeks: [1, 2, 3, 4].map(intermediateWeek) },
    { name: "Wave 2", block_type: "strength", weeks: [5, 6, 7, 8].map(intermediateWeek) }
  ]
};

// ---------------------------------------------------------------------------
// 3. Powerlifting meet prep - amateur and pro, powerlifting, 4 days a week, 12
// weeks. Accumulation (volume) -> intensification (heavier triples) ->
// realisation (doubles and singles) -> taper and openers.
const PL = {
  // [sets, reps, %] per week for the competition lifts.
  squat: [[5, 6, 65], [5, 6, 67.5], [5, 6, 70], [3, 6, 60], [5, 4, 75], [5, 4, 77.5], [5, 3, 80], [3, 3, 70], [4, 2, 85], [3, 2, 87.5], [2, 1, 92.5]],
  bench: [[5, 8, 65], [5, 8, 67.5], [5, 8, 70], [3, 8, 60], [5, 4, 75], [5, 4, 77.5], [5, 3, 80], [3, 3, 70], [4, 2, 85], [3, 2, 87.5], [2, 1, 92.5]],
  deadlift: [[4, 6, 65], [4, 6, 67.5], [4, 6, 70], [3, 5, 60], [4, 3, 77.5], [4, 3, 80], [4, 3, 82.5], [2, 3, 70], [3, 2, 85], [2, 2, 87.5], [1, 1, 92.5]]
};
const accessorySets = (week) => (week <= 4 ? 4 : week <= 8 ? 3 : 2);
const plWeek = (week) => {
  const [sq, sr, sp] = PL.squat[week - 1];
  const [bs, br, bp] = PL.bench[week - 1];
  const [ds, dr, dp] = PL.deadlift[week - 1];
  const a = accessorySets(week);
  return [
    { title: "Squat day", items: [
      ex("back_squat", sq, sr, { pct: sp }, 240), ex("paused_bench_press", Math.max(2, bs - 1), Math.max(2, br - 2), { pct: bp - 7.5 }, 180),
      ex("barbell_row", a, 8, { rpe: 7 }, 120), ex("lying_leg_curl", a, 10, { rpe: 8 }, 75)
    ] },
    { title: "Bench day", items: [
      ex("bench_press", bs, br, { pct: bp }, 210), ex("close_grip_bench_press", a, 6, { pct: Math.min(bp - 7.5, 80) }, 150),
      ex("pull_up", a, [6, 8], { rpe: 8 }, 120), ex("face_pull", a, 15, { rpe: 7 }, 60)
    ] },
    { title: "Deadlift day", items: [
      ex("deadlift", ds, dr, { pct: dp }, 240), ex("paused_back_squat", Math.max(2, sq - 2), Math.max(2, sr - 2), { pct: sp - 10 }, 180),
      ex("romanian_deadlift", a, 8, { rpe: 7 }, 120), ex("front_plank", 3, { seconds: 40 }, "bw", 60)
    ] },
    { title: "Bench variation day", items: [
      ex("spoto_press", Math.max(2, bs - 1), Math.max(2, br - 2), { pct: bp - 10 }, 180), ex("overhead_press", a, 6, { rpe: 7 }, 120),
      ex("chest_supported_row", a, 10, { rpe: 8 }, 90), ex("cable_triceps_pressdown", a, 12, { rpe: 8 }, 60)
    ] }
  ];
};
const plTaper = [
  { title: "Openers - squat and bench", items: [ex("back_squat", 2, 1, { pct: 90 }, 300), ex("bench_press", 2, 1, { pct: 90 }, 300), ex("barbell_row", 2, 8, { rpe: 6 }, 90)] },
  { title: "Openers - deadlift", items: [ex("deadlift", 1, 1, { pct: 90 }, 300), ex("bench_press", 3, 3, { pct: 70 }, 150)] }
];
const powerliftingMeetPrep = {
  key: "powerlifting_meet_prep",
  template_name: "Powerlifting meet prep",
  activity_id: "powerlifting",
  description: "Twelve weeks to a full-power meet: volume, then heavier triples, then doubles and singles, then a taper week with openers.",
  listing: { title: "Powerlifting meet prep (12 weeks)", summary: "Twelve weeks to a meet: build volume, then heavier triples, then doubles and singles, then a taper week with your openers. Squat, bench and deadlift each get a main day.", levels: ["amateur", "pro"], activity_ids: ["powerlifting"], days_per_week: 4, next: "intermediate_upper_lower" },
  blocks: [
    { name: "Accumulation", block_type: "volume", weeks: [1, 2, 3, 4].map(plWeek) },
    { name: "Intensification", block_type: "strength", weeks: [5, 6, 7, 8].map(plWeek) },
    { name: "Realisation", block_type: "peak", weeks: [9, 10, 11].map(plWeek) },
    { name: "Taper and meet", block_type: "deload", weeks: [plTaper] }
  ]
};

// ---------------------------------------------------------------------------
// 4. Team-sport strength and conditioning - amateur and pro, field and court
// sports. Explosive work first, while fresh; heavy compound lifting; the
// injury-reducing work these athletes need (Nordic curls, single-leg work).
const TEAM_SPORTS = ["rugby_union", "rugby_league", "rugby_sevens", "football_soccer", "field_hockey", "ice_hockey", "american_football", "netball", "basketball", "volleyball"];

const OFF_PCT = [72.5, 75, 77.5, 65, 75, 77.5, 80, 67.5];
const offSeasonWeek = (week) => {
  const pct = OFF_PCT[week - 1];
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Lower strength", items: [
      ex("box_jump", s(4), 3, "bw", 90), ex("back_squat", s(4), 5, { pct }, 180), ex("romanian_deadlift", s(3), 8, { pct: pct - 7.5 }, 150),
      ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90), ex("nordic_curl", s(3), 4, "bw", 90)
    ] },
    { title: "Upper strength", items: [
      ex("medicine_ball_chest_pass", s(4), 5, { kg: 4 }, 75), ex("bench_press", s(4), 5, { pct }, 180), ex("pull_up", s(4), 6, { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 10, { rpe: 8 }, 75), ex("side_plank", s(3), { seconds: 30 }, "bw", 45)
    ] },
    { title: "Power and full body", items: [
      ex("ten_metre_acceleration", s(6), { metres: 10 }, "bw", 90), ex("trap_bar_deadlift", s(4), 4, { pct: pct + 2.5 }, 180), ex("overhead_press", s(3), 5, { pct: pct - 2.5 }, 150),
      ex("walking_lunge", s(3), 8, { rpe: 8 }, 90), ex("pallof_press", s(3), 10, { rpe: 7 }, 60)
    ] }
  ];
};
const teamOffSeason = {
  key: "team_sport_off_season",
  template_name: "Team-sport off-season build",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week: jumps, throws and sprints first while fresh, then heavy squats, presses and pulls, plus Nordic curls and single-leg work to keep hamstrings and knees robust.",
  listing: { title: "Off-season strength build (8 weeks)", summary: "The off-season is when strength and power are built. Three days a week: jumps, throws and short sprints, then heavy lifting, plus hamstring and single-leg work for robustness.", levels: ["amateur", "pro"], activity_ids: TEAM_SPORTS, days_per_week: 3, next: "team_sport_in_season" },
  blocks: [{ name: "Off-season build", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(offSeasonWeek) }]
};

const IN_PCT = [80, 82.5, 85, 75];
const inSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("countermovement_jump", 3, 3, "bw", 90), ex("back_squat", s(3), 3, { pct }, 180), ex("bench_press", s(3), 3, { pct }, 180),
      ex("pull_up", s(3), 5, { rpe: 7 }, 120), ex("nordic_curl", 2, 4, "bw", 90)
    ] },
    { title: "Mid-week session", items: [
      ex("medicine_ball_rotational_throw", 3, 4, { kg: 4 }, 75), ex("trap_bar_deadlift", s(3), 3, { pct }, 180), ex("single_arm_dumbbell_press", s(3), 6, { rpe: 7 }, 90),
      ex("inverted_row", s(3), 8, "bw", 75), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const teamInSeason = {
  key: "team_sport_in_season",
  template_name: "Team-sport in-season maintenance",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week to keep the strength and power built in the off-season while staying fresh for matches. Every fourth week is lighter.",
  listing: { title: "In-season maintenance (12 weeks)", summary: "Keep your strength and power through the season: two short, heavy sessions a week, low volume so you stay fresh for matches. Your match week keeps heavy legs away from the day before a game.", levels: ["amateur", "pro"], activity_ids: TEAM_SPORTS, days_per_week: 2, next: "team_sport_off_season" },
  blocks: [{ name: "In season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => inSeasonWeek(i + 1)) }]
};

// ---------------------------------------------------------------------------
// 5. Endurance strength - amateur and pro. Heavy, low-rep lifting twice a week
// improves economy (less energy at the same pace or power) without adding
// bulk; plyometrics stiffen the lower leg. Sets stop short of failure and the
// volume stays low so it fits around the athlete's own training.
// Runners, cyclists and triathletes lift with a lower-body bias; swimmers,
// rowers and paddlers get more pulling and shoulder work.
const RUN_RIDE_SPORTS = ["athletics", "cycling", "triathlon"];
const SWIM_ROW_PADDLE_SPORTS = ["swimming", "rowing", "kayaking"];
const ENDURANCE_SPORTS = [...RUN_RIDE_SPORTS, ...SWIM_ROW_PADDLE_SPORTS];

// [sets, reps, %] per week for the main lifts: four weeks of technique and
// tissue preparation at 8s, then heavier 5s, then 4s; every fourth week lighter.
const ENDURANCE_MAIN = [[3, 8, 65], [3, 8, 67.5], [3, 8, 70], [2, 8, 60], [4, 5, 77.5], [4, 5, 80], [4, 5, 82.5], [3, 5, 70], [4, 4, 82.5], [4, 4, 85], [4, 4, 87.5], [3, 4, 75]];
const enduranceWeekShape = (week) => {
  const [sets, reps, pct] = ENDURANCE_MAIN[week - 1];
  const lighter = week % 4 === 0;
  return { sets, reps, pct, s: (n) => (lighter ? Math.max(2, n - 1) : n), plyoSets: week <= 4 ? 2 : 3 };
};
const runRideWeek = (week) => {
  const { sets, reps, pct, s, plyoSets } = enduranceWeekShape(week);
  return [
    { title: "Strength A - squat", items: [
      ex("pogo_jump", plyoSets, 10, "bw", 90), ex("back_squat", sets, reps, { pct }, 180), ex("single_leg_rdl", s(3), 6, { rpe: 7 }, 90),
      ex("single_leg_calf_raise", s(3), 8, { rpe: 8 }, 75), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Strength B - hinge", items: [
      ex("box_jump", plyoSets, 3, "bw", 90), ex("trap_bar_deadlift", sets, reps, { pct }, 180), ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90),
      ex("inverted_row", s(3), 8, "bw", 75), ex("wall_tibialis_raise", 2, 15, "bw", 45), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] }
  ];
};
const enduranceRunRide = {
  key: "endurance_run_ride_strength",
  template_name: "Run and ride strength",
  activity_id: "general_strength",
  description: "Twelve weeks, two short sessions a week, for distance runners, cyclists and triathletes: heavy squats and deadlifts at low reps to improve economy without adding bulk, plyometrics for a stiffer lower leg, and calf, shin and single-leg work for robustness.",
  listing: { title: "Run and ride strength (12 weeks)", summary: "For distance runners, cyclists and triathletes. Two short sessions a week: heavy, low-rep lifting that makes each stride or pedal stroke cheaper without adding bulk, plus jumps and calf, shin and single-leg work. Built to sit alongside your miles.", levels: ["amateur", "pro"], activity_ids: RUN_RIDE_SPORTS, days_per_week: 2, next: "endurance_in_season" },
  blocks: [
    { name: "Foundation", block_type: "general", weeks: [1, 2, 3, 4].map(runRideWeek) },
    { name: "Heavy strength", block_type: "strength", weeks: [5, 6, 7, 8].map(runRideWeek) },
    { name: "Heavy strength 2", block_type: "strength", weeks: [9, 10, 11, 12].map(runRideWeek) }
  ]
};

const swimRowPaddleWeek = (week) => {
  const { sets, reps, pct, s, plyoSets } = enduranceWeekShape(week);
  return [
    { title: "Strength A - legs and pull", items: [
      ex("squat_jump", plyoSets, 3, "bw", 90), ex("trap_bar_deadlift", sets, reps, { pct }, 180), ex("pull_up", s(4), [4, 6], { rpe: 8 }, 120),
      ex("landmine_press", s(3), 6, { rpe: 8 }, 90), ex("band_external_rotation", 2, 15, { rpe: 6 }, 45), ex("dead_bug", 2, 8, "bw", 45)
    ] },
    { title: "Strength B - squat and row", items: [
      ex("overhead_medicine_ball_slam", 3, 5, { kg: 4 }, 75), ex("back_squat", sets, reps, { pct }, 180), ex("seated_cable_row", s(3), 8, { rpe: 8 }, 90),
      ex("cable_woodchop", s(3), 8, { rpe: 7 }, 60), ex("side_lying_external_rotation", 2, 12, { rpe: 7 }, 45), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const enduranceSwimRowPaddle = {
  key: "endurance_swim_row_paddle_strength",
  template_name: "Swim, row and paddle strength",
  activity_id: "general_strength",
  description: "Twelve weeks, two short sessions a week, for swimmers, rowers and paddlers: heavy leg drive at low reps, strong pulling, and rotator-cuff and trunk work to keep shoulders healthy under high stroke volume.",
  listing: { title: "Swim, row and paddle strength (12 weeks)", summary: "For swimmers, rowers and paddlers. Two short sessions a week: heavy, low-rep leg drive, strong pulling, and shoulder and trunk work to keep you healthy through thousands of strokes. Built to sit alongside your water time.", levels: ["amateur", "pro"], activity_ids: SWIM_ROW_PADDLE_SPORTS, days_per_week: 2, next: "endurance_in_season" },
  blocks: [
    { name: "Foundation", block_type: "general", weeks: [1, 2, 3, 4].map(swimRowPaddleWeek) },
    { name: "Heavy strength", block_type: "strength", weeks: [5, 6, 7, 8].map(swimRowPaddleWeek) },
    { name: "Heavy strength 2", block_type: "strength", weeks: [9, 10, 11, 12].map(swimRowPaddleWeek) }
  ]
};

// One heavy session a week holds strength through a race season.
const ENDURANCE_IN_PCT = [80, 82.5, 85, 75];
const enduranceInSeasonWeek = (week) => {
  const lighter = week % 4 === 0;
  return [
    { title: "Maintenance session", items: [
      ex("box_jump", 3, 3, "bw", 90), ex("back_squat", lighter ? 2 : 3, 4, { pct: at(ENDURANCE_IN_PCT, week) }, 180), ex("single_leg_calf_raise", 2, 8, { rpe: 8 }, 75),
      ex("pull_up", lighter ? 2 : 3, 5, { rpe: 7 }, 120), ex("band_external_rotation", 2, 15, { rpe: 6 }, 45), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] }
  ];
};
const enduranceInSeason = {
  key: "endurance_in_season",
  template_name: "Endurance race-season maintenance",
  activity_id: "general_strength",
  description: "One short, heavy session a week through the racing season, enough to keep the strength built in the off-season. Every fourth week is lighter; skip the session in the five days before a key race.",
  listing: { title: "Endurance race-season maintenance (12 weeks)", summary: "For distance athletes. Keep your off-season strength through the racing season with one short, heavy session a week. Skip it in the five days before a key race.", levels: ["amateur", "pro"], activity_ids: ENDURANCE_SPORTS, days_per_week: 1 },
  blocks: [{ name: "Race season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => enduranceInSeasonWeek(i + 1)) }]
};

// ---------------------------------------------------------------------------
// 6. Combat sports - amateur and pro. Strength and power without the
// high-rep volume that adds size (these athletes compete at a weight). Neck
// and grip work every week, rotational throws, carries.
const COMBAT_SPORTS = ["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"];

const COMBAT_PCT = [72.5, 75, 77.5, 65, 77.5, 80, 82.5, 70];
const combatBuildWeek = (week) => {
  const pct = COMBAT_PCT[week - 1];
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Lower strength and neck", items: [
      ex("box_jump", s(4), 3, "bw", 90), ex("trap_bar_deadlift", s(4), 4, { pct }, 180), ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90),
      ex("nordic_curl", s(3), 4, "bw", 90), ex("neck_flexion_isometric", 3, { seconds: 20 }, { rpe: 6 }, 45), ex("neck_extension_isometric", 3, { seconds: 20 }, { rpe: 6 }, 45)
    ] },
    { title: "Upper strength and grip", items: [
      ex("medicine_ball_chest_pass", s(4), 5, { kg: 4 }, 75), ex("bench_press", s(4), 5, { pct }, 180), ex("pull_up", s(4), [5, 8], { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), ex("dumbbell_static_hold", 3, { seconds: 30 }, { rpe: 8 }, 60), ex("neck_lateral_flexion_isometric", 3, { seconds: 20 }, { rpe: 6 }, 45)
    ] },
    { title: "Power and trunk", items: [
      ex("medicine_ball_rotational_throw", s(4), 4, { kg: 4 }, 75), ex("power_clean", s(4), 3, { pct }, 150), ex("front_squat", s(3), 5, { pct: pct - 5 }, 150),
      ex("landmine_press", s(3), 6, { rpe: 8 }, 90), ex("farmers_carry", 3, { metres: 30 }, { rpe: 8 }, 75), ex("pallof_press", s(3), 10, { rpe: 7 }, 45)
    ] }
  ];
};
const combatBuild = {
  key: "combat_strength_power",
  template_name: "Combat-sport strength and power",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, between fight camps: heavy, low-rep lifting and explosive throws and jumps that build strength and power without adding size, plus neck, grip and trunk work every week.",
  listing: { title: "Combat strength and power (8 weeks)", summary: "For fighters between camps. Three days a week: heavy, low-rep lifting, jumps and throws for power without adding size, plus neck, grip and trunk work every week. Fits around your mat or bag work.", levels: ["amateur", "pro"], activity_ids: COMBAT_SPORTS, days_per_week: 3, next: "combat_fight_camp" },
  blocks: [{ name: "Between camps", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(combatBuildWeek) }]
};

// In camp the sparring load is high: two short sessions, heavy but few sets,
// then a taper - nothing heavier than 70% in the last fortnight, and only a
// light primer in fight week.
const CAMP_PCT = [80, 82.5, 85, 77.5, 80, 82.5];
const campSessions = (pct, sets) => [
  { title: "Camp session A", items: [
    ex("countermovement_jump", 3, 3, "bw", 90), ex("trap_bar_deadlift", sets, 3, { pct }, 180), ex("bench_press", sets, 3, { pct }, 180),
    ex("pull_up", sets, 5, { rpe: 7 }, 120), ex("neck_flexion_isometric", 2, { seconds: 20 }, { rpe: 6 }, 45), ex("neck_extension_isometric", 2, { seconds: 20 }, { rpe: 6 }, 45)
  ] },
  { title: "Camp session B", items: [
    ex("medicine_ball_rotational_throw", 3, 4, { kg: 4 }, 75), ex("bulgarian_split_squat", sets, 5, { rpe: 7 }, 90), ex("landmine_press", sets, 5, { rpe: 7 }, 90),
    ex("inverted_row", sets, 8, "bw", 75), ex("farmers_carry", 2, { metres: 30 }, { rpe: 7 }, 60), ex("neck_lateral_flexion_isometric", 2, { seconds: 20 }, { rpe: 6 }, 45)
  ] }
];
const fightWeekPrimer = [
  { title: "Fight-week primer", items: [
    ex("countermovement_jump", 3, 3, "bw", 90), ex("medicine_ball_chest_pass", 3, 3, { kg: 4 }, 75), ex("inverted_row", 2, 8, "bw", 60), ex("neck_extension_isometric", 2, { seconds: 15 }, { rpe: 5 }, 45)
  ] }
];
const fightCamp = {
  key: "combat_fight_camp",
  template_name: "Fight camp strength",
  activity_id: "general_strength",
  description: "Eight weeks into a fight: six weeks of two short, heavy sessions alongside sparring, a lighter week, then one light primer in fight week. Nothing heavy in the last fortnight. Making weight is for you and your coach; this programme doesn't cut.",
  listing: { title: "Fight camp strength (8 weeks)", summary: "For the eight weeks into a fight. Two short, heavy sessions a week alongside sparring, a lighter week, then a light primer in fight week - you arrive fresh, not sore. Start it eight weeks out.", levels: ["amateur", "pro"], activity_ids: COMBAT_SPORTS, days_per_week: 2, next: "combat_strength_power" },
  blocks: [
    { name: "Camp", block_type: "strength", weeks: CAMP_PCT.map((pct) => campSessions(pct, 3)) },
    { name: "Taper and fight week", block_type: "deload", weeks: [campSessions(70, 2), fightWeekPrimer] }
  ]
};

// ---------------------------------------------------------------------------
// 7. Tennis - amateur and pro. Rotational power, lateral strength and
// deceleration, and the shoulder, elbow and groin work that keeps players on
// court.
const TENNIS_OFF_PCT = [72.5, 75, 77.5, 65, 75, 77.5, 80, 67.5];
const tennisOffSeasonWeek = (week) => {
  const pct = TENNIS_OFF_PCT[week - 1];
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Lower and lateral", items: [
      ex("lateral_bound", s(4), 4, "bw", 90), ex("trap_bar_deadlift", s(4), 5, { pct }, 180), ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90),
      ex("lateral_lunge", s(3), 6, { rpe: 7 }, 75), ex("machine_hip_adduction", 2, 10, { rpe: 7 }, 60), ex("single_leg_calf_raise", 2, 10, { rpe: 8 }, 60)
    ] },
    { title: "Upper and shoulder", items: [
      ex("medicine_ball_rotational_throw", s(4), 4, { kg: 3 }, 75), ex("landmine_press", s(3), 6, { rpe: 8 }, 90), ex("chin_up", s(3), 6, { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), ex("side_lying_external_rotation", 3, 12, { rpe: 7 }, 45), ex("face_pull", 2, 15, { rpe: 7 }, 45),
      ex("dumbbell_wrist_extension", 2, 15, { rpe: 7 }, 45)
    ] },
    { title: "Speed and full body", items: [
      ex("five_ten_five_shuttle", s(5), { metres: 20 }, "bw", 90), ex("back_squat", s(4), 5, { pct }, 180), ex("single_leg_rdl", s(3), 6, { rpe: 8 }, 90),
      ex("cable_woodchop", s(3), 8, { rpe: 7 }, 60), ex("pallof_press", s(3), 10, { rpe: 7 }, 45)
    ] }
  ];
};
const tennisOffSeason = {
  key: "tennis_off_season",
  template_name: "Tennis off-season build",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, in the off-season or a long break between tournaments: rotational throws, lateral bounds and change of direction first, heavy lifting, then the shoulder, elbow and groin work tennis players need.",
  listing: { title: "Tennis off-season build (8 weeks)", summary: "Three days a week in the off-season or a long break between tournaments: rotational power, lateral speed and heavy lifting, plus shoulder, elbow and groin work to keep you on court.", levels: ["amateur", "pro"], activity_ids: ["tennis"], days_per_week: 3, next: "tennis_in_season" },
  blocks: [{ name: "Off-season build", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(tennisOffSeasonWeek) }]
};

const tennisInSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("lateral_bound", 3, 3, "bw", 90), ex("trap_bar_deadlift", s(3), 3, { pct }, 180), ex("landmine_press", s(3), 5, { rpe: 7 }, 90),
      ex("side_lying_external_rotation", 2, 12, { rpe: 7 }, 45), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] },
    { title: "Mid-week session", items: [
      ex("medicine_ball_rotational_throw", 3, 4, { kg: 3 }, 75), ex("bulgarian_split_squat", s(3), 5, { rpe: 7 }, 90), ex("single_arm_dumbbell_row", s(3), 8, { rpe: 7 }, 75),
      ex("machine_hip_adduction", 2, 10, { rpe: 7 }, 60), ex("dumbbell_wrist_extension", 2, 15, { rpe: 7 }, 45)
    ] }
  ];
};
const tennisInSeason = {
  key: "tennis_in_season",
  template_name: "Tennis tournament-season maintenance",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week during the tournament season to hold strength and power while staying fresh to play. Every fourth week is lighter; in a tournament week, do the early session only.",
  listing: { title: "Tennis tournament-season maintenance (12 weeks)", summary: "Hold your strength and power through the tournament season: two short, heavy sessions a week, low volume so you stay fresh to play. In a tournament week, do the early session only.", levels: ["amateur", "pro"], activity_ids: ["tennis"], days_per_week: 2, next: "tennis_off_season" },
  blocks: [{ name: "Tournament season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => tennisInSeasonWeek(i + 1)) }]
};

// ---------------------------------------------------------------------------
// 8. Cricket - amateur and pro. Rotational power for batting, bowling and
// throwing; a strong, stiff front leg and trunk for fast bowlers (who carry
// the sport's highest injury risk - lumbar stress, side strain, hamstrings);
// the throwing shoulder; and short acceleration between the wickets and in
// the field.
const CRICKET_OFF_PCT = [72.5, 75, 77.5, 65, 75, 77.5, 80, 67.5];
const cricketOffSeasonWeek = (week) => {
  const pct = CRICKET_OFF_PCT[week - 1];
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Lower strength and landing", items: [
      ex("broad_jump_to_stick", s(4), 3, "bw", 90), ex("trap_bar_deadlift", s(4), 5, { pct }, 180), ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90),
      ex("nordic_curl", s(3), 4, "bw", 90), ex("machine_hip_adduction", 2, 10, { rpe: 7 }, 60), ex("single_leg_calf_raise", 2, 10, { rpe: 8 }, 60)
    ] },
    { title: "Upper strength and rotation", items: [
      ex("medicine_ball_rotational_throw", s(4), 4, { kg: 4 }, 75), ex("landmine_press", s(3), 6, { rpe: 8 }, 90), ex("pull_up", s(3), [5, 8], { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), ex("side_lying_external_rotation", 3, 12, { rpe: 7 }, 45), ex("side_plank", s(3), { seconds: 30 }, "bw", 45)
    ] },
    { title: "Speed and full body", items: [
      ex("twenty_metre_acceleration", s(5), { metres: 20 }, "bw", 90), ex("back_squat", s(4), 5, { pct }, 180), ex("single_leg_rdl", s(3), 6, { rpe: 8 }, 90),
      ex("half_kneeling_pallof_press", s(3), 10, { rpe: 7 }, 45), ex("back_extension", 2, 10, "bw", 60), ex("bird_dog", 2, 8, "bw", 45)
    ] }
  ];
};
const cricketOffSeason = {
  key: "cricket_off_season",
  template_name: "Cricket off-season build",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, in the off-season: jumps, rotational throws and accelerations first, heavy lifting, then the hamstring, groin, shoulder and trunk work that keeps bowlers, batters and fielders on the park.",
  listing: { title: "Cricket off-season build (8 weeks)", summary: "Three days a week in the off-season: rotational power for batting, bowling and throwing, speed between the wickets, heavy lifting, and the trunk, hamstring and shoulder work that keeps fast bowlers on the park.", levels: ["amateur", "pro"], activity_ids: ["cricket"], days_per_week: 3, next: "cricket_in_season" },
  blocks: [{ name: "Off-season build", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(cricketOffSeasonWeek) }]
};

const cricketInSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("countermovement_jump", 3, 3, "bw", 90), ex("trap_bar_deadlift", s(3), 3, { pct }, 180), ex("landmine_press", s(3), 5, { rpe: 7 }, 90),
      ex("nordic_curl", 2, 4, "bw", 90), ex("side_lying_external_rotation", 2, 12, { rpe: 7 }, 45)
    ] },
    { title: "Mid-week session", items: [
      ex("medicine_ball_rotational_throw", 3, 4, { kg: 4 }, 75), ex("bulgarian_split_squat", s(3), 5, { rpe: 7 }, 90), ex("single_arm_dumbbell_row", s(3), 8, { rpe: 7 }, 75),
      ex("machine_hip_adduction", 2, 10, { rpe: 7 }, 60), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const cricketInSeason = {
  key: "cricket_in_season",
  template_name: "Cricket in-season maintenance",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week through the season to hold strength and power while staying fresh to play. Every fourth week is lighter; in a multi-day match week, do the early session only, and keep both away from a big bowling day.",
  listing: { title: "Cricket in-season maintenance (12 weeks)", summary: "Hold your strength and power through the season: two short, heavy sessions a week, low volume so you stay fresh. In a multi-day match week, do the early session only. Bowlers: not the day before or after a long spell.", levels: ["amateur", "pro"], activity_ids: ["cricket"], days_per_week: 2, next: "cricket_off_season" },
  blocks: [{ name: "In season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => cricketInSeasonWeek(i + 1)) }]
};

// ---------------------------------------------------------------------------
// 9. Athletics sprints, jumps and throws - amateur and pro. Force and rate of
// force development: heavy squats and Olympic-lift power, jumps and
// medicine ball throws, plus the hamstring, calf and hip flexor work
// sprinters need. Sprinting itself stays on the track with the coach.
// [sets, reps, %] per week: general strength (5s), max strength (3s), then
// power (2s), each block ending lighter.
const ATHLETICS_MAIN = [[4, 5, 72.5], [4, 5, 75], [4, 5, 77.5], [3, 5, 65], [4, 3, 80], [4, 3, 82.5], [5, 3, 85], [3, 3, 72.5], [4, 2, 85], [4, 2, 87.5], [3, 2, 90], [3, 2, 75]];
const ATHLETICS_CLEAN = [70, 72.5, 75, 65, 77.5, 80, 82.5, 70, 82.5, 85, 87.5, 72.5];
const athleticsPowerWeek = (week) => {
  const [sets, reps, pct] = ATHLETICS_MAIN[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const cleanReps = week <= 8 ? 3 : 2;
  return [
    { title: "Lower strength", items: [
      ex("box_jump", s(4), 3, "bw", 90), ex("back_squat", sets, reps, { pct }, 210), ex("romanian_deadlift", s(3), 6, { rpe: 8 }, 120),
      ex("nordic_curl", s(3), 4, "bw", 90), ex("single_leg_calf_raise", s(3), 8, { rpe: 8 }, 60)
    ] },
    { title: "Upper strength and throws", items: [
      ex("backward_overhead_medicine_ball_throw", s(4), 4, { kg: 4 }, 75), ex("bench_press", sets, reps, { pct }, 180), ex("pull_up", s(3), [5, 8], { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), ex("medicine_ball_rotational_throw", 3, 4, { kg: 4 }, 75), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Power", items: [
      ex("repeated_broad_jump", s(4), 3, "bw", 120), ex("power_clean", s(4), cleanReps, { pct: ATHLETICS_CLEAN[week - 1] }, 180), ex("bulgarian_split_squat", s(3), 5, { rpe: 8 }, 90),
      ex("cable_hip_flexion", 2, 8, { rpe: 7 }, 60), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] }
  ];
};
const athleticsPowerBuild = {
  key: "athletics_power_build",
  template_name: "Sprint, jump and throw power",
  activity_id: "general_strength",
  description: "Twelve weeks, three days a week, in the general preparation phase for sprinters, jumpers and throwers: general strength (5s), max strength (3s), then power (2s), with jumps, throws and power cleans every week and hamstring, calf and hip flexor work for sprinters. Track sessions stay with your coach.",
  listing: { title: "Sprint, jump and throw power (12 weeks)", summary: "For sprinters, jumpers and throwers in the off-season. Three days a week: heavy squats and power cleans moving from 5s to 3s to 2s, jumps and medicine ball throws every session, plus hamstring, calf and hip flexor work. Sits alongside your track sessions.", levels: ["amateur", "pro"], activity_ids: ["athletics"], days_per_week: 3, next: "athletics_competition_season" },
  blocks: [
    { name: "General strength", block_type: "volume", weeks: [1, 2, 3, 4].map(athleticsPowerWeek) },
    { name: "Max strength", block_type: "strength", weeks: [5, 6, 7, 8].map(athleticsPowerWeek) },
    { name: "Power", block_type: "peak", weeks: [9, 10, 11, 12].map(athleticsPowerWeek) }
  ]
};

const athleticsSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("box_jump", 3, 3, "bw", 90), ex("back_squat", s(3), 3, { pct }, 210), ex("power_clean", s(3), 2, { pct: pct - 5 }, 180),
      ex("nordic_curl", 2, 4, "bw", 90), ex("single_leg_calf_raise", 2, 8, { rpe: 8 }, 60)
    ] },
    { title: "Mid-week session", items: [
      ex("backward_overhead_medicine_ball_throw", 3, 3, { kg: 4 }, 75), ex("bench_press", s(3), 3, { pct }, 180), ex("pull_up", s(3), 5, { rpe: 7 }, 120),
      ex("cable_hip_flexion", 2, 8, { rpe: 7 }, 60), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const athleticsSeason = {
  key: "athletics_competition_season",
  template_name: "Sprint, jump and throw competition season",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week through the competition season to hold strength and power while staying fast. Every fourth week is lighter; in a competition week, do the early session only, and never in the 48 hours before you compete.",
  listing: { title: "Sprint, jump and throw competition season (12 weeks)", summary: "Hold your strength and power through the competition season: two short, heavy sessions a week, low volume so you stay fast. In a competition week, do the early session only, and never in the 48 hours before you compete.", levels: ["amateur", "pro"], activity_ids: ["athletics"], days_per_week: 2, next: "athletics_power_build" },
  blocks: [{ name: "Competition season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => athleticsSeasonWeek(i + 1)) }]
};

// ---------------------------------------------------------------------------
// 10. Strongman - amateur and pro, 4 days a week, 12 weeks. Gym days build
// the base lifts (log, deadlift, squat); a separate event day trains the
// implements at a hard but sub-maximal effort - never a max event every week.
// Grip and biceps load (stones, axle, carries) is kept on one day.
const STRONGMAN_MAIN = [[4, 5, 70], [4, 5, 72.5], [4, 5, 75], [3, 5, 65], [5, 3, 80], [5, 3, 82.5], [5, 3, 85], [3, 3, 72.5], [4, 2, 87.5], [3, 2, 90], [3, 1, 92.5], [2, 2, 75]];
const STRONGMAN_EVENT_RPE = [7, 7, 8, 6, 8, 8, 9, 6, 8, 9, 9, 6];
const strongmanWeek = (week) => {
  const [sets, reps, pct] = STRONGMAN_MAIN[week - 1];
  const lighter = week % 4 === 0 || week === 12;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const rpe = STRONGMAN_EVENT_RPE[week - 1];
  const hold = "Choose a weight you can take the full distance at this effort; log it.";
  return [
    { title: "Overhead day", items: [
      ex("strongman_log_press", sets, reps, { pct }, 210, "Clean the log each rep unless your contest allows a single clean."),
      ex("axle_bar_press", s(3), 5, { rpe: 8 }, 150), ex("single_arm_dumbbell_row", s(3), 10, { rpe: 8 }, 75),
      ex("face_pull", 3, 15, { rpe: 7 }, 45), ex("cable_triceps_pressdown", s(3), 12, { rpe: 8 }, 60)
    ] },
    { title: "Deadlift day", items: [
      ex("deadlift", sets, reps, { pct }, 240), ex("romanian_deadlift", s(3), 8, { rpe: 7 }, 120),
      ex("barbell_row", s(4), 8, { rpe: 8 }, 90), ex("front_plank", 3, { seconds: 45 }, "bw", 60)
    ] },
    { title: "Event day", items: [
      ex("yoke_walk", s(4), { metres: 20 }, { rpe }, 150, hold), ex("farmers_carry", s(4), { metres: 30 }, { rpe }, 120, hold),
      ex("sandbag_carry", s(3), { metres: 30 }, { rpe: Math.min(rpe, 8) }, 120, hold), ex("atlas_stone_carry", s(3), { metres: 15 }, { rpe: Math.min(rpe, 8) }, 120, hold),
      ex("tire_flip", s(3), 4, { rpe: Math.min(rpe, 8) }, 120)
    ] },
    { title: "Squat day", items: [
      ex("back_squat", sets, reps, { pct: pct - 2.5 }, 210), ex("sandbag_lunge", s(3), 10, { rpe: 7 }, 90),
      ex("pull_up", s(4), [5, 8], { rpe: 8 }, 120), ex("side_plank", 3, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const strongmanBuild = {
  key: "strongman_strength_events",
  template_name: "Strongman strength and events",
  activity_id: "strongman",
  description: "Twelve weeks, four days a week: log, deadlift and squat waves on three gym days (5s, then 3s, then doubles and singles) and a separate event day on the yoke, farmer's, sandbag, stones and tyre at a hard but not maximal effort. Every fourth week is lighter, and the last week eases off before a contest.",
  listing: { title: "Strongman strength and events (12 weeks)", summary: "Three gym days building your log, deadlift and squat from 5s to singles, and one event day on the yoke, farmer's, sandbag, stones and tyre - hard, never a max every week. Lighter every fourth week, and the last week eases off for a contest.", levels: ["amateur", "pro"], activity_ids: ["strongman"], days_per_week: 4, next: "intermediate_upper_lower" },
  blocks: [
    { name: "Base", block_type: "volume", weeks: [1, 2, 3, 4].map(strongmanWeek) },
    { name: "Build", block_type: "strength", weeks: [5, 6, 7, 8].map(strongmanWeek) },
    { name: "Peak", block_type: "peak", weeks: [9, 10, 11].map(strongmanWeek) },
    { name: "Contest week", block_type: "deload", weeks: [strongmanWeek(12)] }
  ]
};

// ---------------------------------------------------------------------------
// 11. Street lifting - amateur and pro, 3 days a week, 12 weeks. The
// competition lifts (weighted pull-up and dip) are bodyweight lifts with
// added load, so they're set by effort: the athlete adds weight to reach the
// RPE and logs the added weight. Waves from 5s to singles with deloads, a
// taper week, and rotator cuff and elbow care every week (dips and heavy
// pulls are hard on the tendons). The squat is in for federations that
// include it.
const STREET_MAIN = [[5, 5, 7], [5, 5, 8], [5, 4, 8], [3, 5, 6], [5, 3, 8], [5, 3, 9], [4, 3, 9], [3, 3, 6], [4, 2, 8], [3, 2, 9], [3, 1, 9], [2, 1, 7]];
const STREET_SQUAT = [72.5, 75, 77.5, 65, 80, 82.5, 85, 72.5, 87.5, 90, 92.5, 75];
const streetWeek = (week) => {
  const [sets, reps, rpe] = STREET_MAIN[week - 1];
  const lighter = week % 4 === 0 || week === 12;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const added = "Add weight (belt or vest) to reach this effort, to your federation's standard; log the added weight.";
  return [
    { title: "Heavy pull and dip", items: [
      ex("pull_up", sets, reps, { rpe }, 210, added), ex("dip", sets, reps, { rpe }, 210, added),
      ex("band_external_rotation", 2, 15, { rpe: 6 }, 45), ex("face_pull", s(3), 15, { rpe: 7 }, 45)
    ] },
    { title: "Squat and volume", items: [
      ex("back_squat", s(4), reps, { pct: STREET_SQUAT[week - 1] }, 210, "If your federation doesn't include the squat, keep it as your leg strength."),
      ex("muscle_up", s(4), 2, "bw", 120, "Strict and fresh - stop the set when a rep loses its shape."),
      ex("chin_up", s(3), 8, { rpe: 7 }, 90), ex("dip", s(3), 8, { rpe: 7 }, 90, "Bodyweight or light: practice your depth.")
    ] },
    { title: "Second heavy day", items: [
      ex("pull_up", s(3), reps + 1, { rpe: Math.max(6, rpe - 1) }, 180, added), ex("dip", s(3), reps + 1, { rpe: Math.max(6, rpe - 1) }, 180, added),
      ex("single_arm_dumbbell_row", s(3), 10, { rpe: 8 }, 75), ex("cable_triceps_pressdown", s(3), 15, { rpe: 7 }, 60),
      ex("side_lying_external_rotation", 2, 12, { rpe: 7 }, 45)
    ] }
  ];
};
const streetLifting = {
  key: "street_lifting_meet_prep",
  template_name: "Street lifting: weighted pull-up and dip",
  activity_id: "street_lifting",
  description: "Twelve weeks, three days a week, to a street lifting meet: weighted pull-ups and dips from 5s to singles by effort (add weight to reach the RPE, log the added weight), a second lighter heavy day, squat for federations that include it, muscle-up practice, and rotator cuff and elbow care every week. Every fourth week is lighter and the last week is a taper.",
  listing: { title: "Street lifting meet prep (12 weeks)", summary: "Weighted pull-ups and dips from 5s to singles - add weight to reach the effort and log it - plus squat, muscle-up practice and shoulder and elbow care every week. Three days a week; lighter every fourth week, then a taper.", levels: ["amateur", "pro"], activity_ids: ["street_lifting"], days_per_week: 3, next: "intermediate_upper_lower" },
  blocks: [
    { name: "Accumulation", block_type: "volume", weeks: [1, 2, 3, 4].map(streetWeek) },
    { name: "Intensification", block_type: "strength", weeks: [5, 6, 7, 8].map(streetWeek) },
    { name: "Realisation", block_type: "peak", weeks: [9, 10, 11].map(streetWeek) },
    { name: "Taper and meet", block_type: "deload", weeks: [streetWeek(12)] }
  ]
};

// ---------------------------------------------------------------------------
// 12. HYROX - amateur and pro, 3 days a week, 12 weeks. The race is 8 x 1 km
// runs, each followed by a station: SkiErg, sled push, sled pull, burpee
// broad jumps, row, farmer's carry, sandbag lunges, wall balls. One strength
// day, one compromised-running day (runs straight after station work,
// building to a race simulation) and one station strength-endurance day.
// Station weights follow the athlete's division - they're never set here.
// The athlete's other running (easy and threshold runs) stays their own.
const race = "Race weight for your division (Open or Pro, men's or women's).";
// The eight stations in race order, as four pairs.
const station = {
  ski: (sets) => ex("ski_erg", sets, { metres: 1000 }, { rpe: 8 }, 0),
  push: (sets) => ex("sled_push", sets, { metres: 50 }, { rpe: 8 }, 0, race),
  pull: (sets) => ex("backward_sled_drag", sets, { metres: 50 }, { rpe: 8 }, 0, `Stands in for the sled pull. ${race}`),
  bbj: (sets) => ex("burpee_broad_jump", sets, { metres: 80 }, "bw", 0),
  row: (sets) => ex("rowing_ergometer", sets, { metres: 1000 }, { rpe: 8 }, 0),
  farmers: (sets) => ex("farmers_carry", sets, { metres: 200 }, { rpe: 8 }, 0, race),
  lunge: (sets) => ex("sandbag_lunge", sets, { metres: 100 }, { rpe: 8 }, 0, race),
  wallball: (sets) => ex("wall_ball", sets, 100, { rpe: 8 }, 0, race)
};
const PAIRS = [["ski", "push"], ["pull", "bbj"], ["row", "farmers"], ["lunge", "wallball"]];
// Compromised running: rounds of a 1 km run straight into a pair of stations.
const compromised = (rounds, pair) => group("for_time", { cap: rounds * 11 * 60 }, [
  ex("treadmill_run", rounds, { metres: 1000 }, { rpe: 7 }, 0, "1 km at race-pace effort to start each round; outdoors is fine."),
  station[PAIRS[pair][0]](rounds), station[PAIRS[pair][1]](rounds)
]);
// The race simulation: all eight stations in order, a 1 km run before each pair.
const raceSimulation = () => group("for_time", { cap: 75 * 60 }, [
  ex("treadmill_run", 4, { metres: 1000 }, { rpe: 7 }, 0, "4 x 1 km: one before each pair of stations, in race order."),
  ...["ski", "push", "pull", "bbj", "row", "farmers", "lunge", "wallball"].map((name) => station[name](1))
]);
const HYROX_SQUAT = [72.5, 75, 77.5, 65, 77.5, 80, 82.5, 70, 80, 82.5, 75, 65];
const HYROX_ROUNDS = [2, 2, 3, 2, 3, 3, 4, 3, 4, 0, 3, 2];
const hyroxWeek = (week) => {
  const lighter = week % 4 === 0 || week === 12;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const simulation = week === 10;
  return [
    { title: "Strength", items: [
      ex("back_squat", s(4), 5, { pct: HYROX_SQUAT[week - 1] }, 180), ex("romanian_deadlift", s(3), 8, { rpe: 7 }, 120),
      ex("sled_push", s(4), { metres: 25 }, { rpe: 8 }, 120, "Heavier than race weight: drive low and steady."),
      ex("pull_up", s(3), 8, { rpe: 7 }, 90), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: simulation ? "Race simulation: all 8 stations" : "Compromised running", items: simulation ? raceSimulation() : compromised(HYROX_ROUNDS[week - 1], (week - 1) % 4) },
    { title: "Stations: strength-endurance", items: [
      ...group("amrap", { cap: (lighter ? 10 : 14) * 60 }, [
        ex("wall_ball", 1, 20, { rpe: 8 }, 0, race), ex("sandbag_lunge", 1, 20, { rpe: 8 }, 0, race),
        ex("farmers_carry", 1, { metres: 50 }, { rpe: 8 }, 0, race), ex("rowing_ergometer", 1, { metres: 250 }, { rpe: 8 }, 0)
      ]),
      ex("ski_erg", s(4), { metres: 500 }, { rpe: 8 }, 90, "Hard repeats with 90 s rest.")
    ] }
  ];
};
const hyroxBuild = {
  key: "hyrox_race_build",
  template_name: "HYROX race build",
  activity_id: "hyrox",
  description: "Twelve weeks, three days a week, to a HYROX race: a strength day, a compromised-running day (rounds of a 1 km run straight into a pair of stations, through all eight in race order, and an all-station race simulation in week 10) and a station strength-endurance day. Station weights follow your division. Your own easy and threshold runs stay yours. Every fourth week is lighter and the last week is a taper.",
  listing: { title: "HYROX race build (12 weeks)", summary: "A strength day, a compromised-running day - rounds of a 1 km run straight into the stations, and an all-station race simulation in week 10 - and a station strength-endurance day. Station weights follow your division; keep your own easy runs. Lighter every fourth week, then a taper.", levels: ["amateur", "pro"], activity_ids: ["hyrox"], days_per_week: 3, next: "intermediate_upper_lower" },
  blocks: [
    { name: "Base", block_type: "general", weeks: [1, 2, 3, 4].map(hyroxWeek) },
    { name: "Build", block_type: "volume", weeks: [5, 6, 7, 8].map(hyroxWeek) },
    { name: "Race specific", block_type: "peak", weeks: [9, 10, 11].map(hyroxWeek) },
    { name: "Taper and race", block_type: "deload", weeks: [hyroxWeek(12)] }
  ]
};

// ---------------------------------------------------------------------------
// 13. CrossFit - amateur and pro, 4 days a week, 8 weeks. Strength or skill
// first while fresh (squat, Olympic lifts, strict gymnastics), then one
// conditioning piece in a different time domain each day: a short For Time,
// an AMRAP, an EMOM and a longer chipper. Strict before kipping; Olympic
// lifts in low reps, never high reps under fatigue.
const CF_PCT = [72.5, 75, 77.5, 65, 77.5, 80, 82.5, 70];
const crossfitWeek = (week) => {
  const pct = CF_PCT[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const capScale = lighter ? 0.75 : 1;
  return [
    { title: "Squat and a short For Time", items: [
      ex("back_squat", s(5), 5, { pct }, 180),
      ...group("for_time", { cap: Math.round(8 * capScale) * 60 }, [
        ex("thruster", 3, 12, { rpe: 7 }, 0, "Rx or scaled - log which."), ex("pull_up", 3, 12, "bw", 0, "Kip only once you have 10 strict.")
      ])
    ] },
    { title: "Clean and jerk, then an AMRAP", items: [
      ex("power_clean", s(5), 2, { pct }, 120), ex("push_jerk", s(5), 2, { pct }, 120),
      ...group("amrap", { cap: Math.round(12 * capScale) * 60 }, [
        ex("kettlebell_swing", 1, 15, { rpe: 7 }, 0), ex("box_jump", 1, 10, "bw", 0, "Step down."), ex("burpee", 1, 10, "bw", 0)
      ])
    ] },
    { title: "Strict gymnastics, then an EMOM", items: [
      ex("pull_up", s(5), 5, { rpe: 8 }, 120, "Strict. Add weight once 5 are easy."),
      ex("handstand_push_up", s(4), 5, "bw", 120, "Strict; scale to a pike or box handstand push-up."),
      ...group("emom", { round: 60, rounds: lighter ? 8 : 12 }, [
        ex("double_under", 1, 40, "bw", 0, "Scale to 80 single-unders."), ex("toes_to_bar", 1, 10, "bw", 0, "Scale to knee raises.")
      ])
    ] },
    { title: "Snatch, then a chipper", items: [
      ex("snatch", s(5), 2, { pct: pct - 5 }, 150, "Technique first: every rep the same."),
      ...group("for_time", { cap: Math.round(20 * capScale) * 60 }, [
        ex("rowing_ergometer", 1, { metres: 1000 }, { rpe: 8 }, 0), ex("wall_ball", 1, 40, { rpe: 7 }, 0),
        ex("toes_to_bar", 1, 30, "bw", 0), ex("kettlebell_swing", 1, 30, { rpe: 7 }, 0), ex("bike_ergometer", 1, { metres: 2000 }, { rpe: 8 }, 0)
      ])
    ] }
  ];
};
const crossfitBuild = {
  key: "crossfit_strength_conditioning",
  template_name: "CrossFit strength and conditioning",
  activity_id: "crossfit",
  description: "Eight weeks, four days a week: strength or skill first while fresh (squat, power clean and push jerk, snatch, strict pull-ups and handstand push-ups), then one conditioning piece a day in a different time domain - a short For Time, an AMRAP, an EMOM and a longer chipper. Strict before kipping, Olympic lifts in low reps. Every fourth week is lighter.",
  listing: { title: "CrossFit strength and conditioning (8 weeks)", summary: "Four days a week: strength or skill first - squat, Olympic lifts, strict gymnastics - then one conditioning piece in a different time domain each day: a short For Time, an AMRAP, an EMOM and a chipper. Rx or scaled, logged. Lighter every fourth week.", levels: ["amateur", "pro"], activity_ids: ["crossfit"], days_per_week: 4 },
  blocks: [
    { name: "Wave 1", block_type: "general", weeks: [1, 2, 3, 4].map(crossfitWeek) },
    { name: "Wave 2", block_type: "general", weeks: [5, 6, 7, 8].map(crossfitWeek) }
  ]
};

// ---------------------------------------------------------------------------
// 14. Olympic weightlifting - amateur and pro, 4 days a week, 12 weeks. The
// classic lifts first in every session while fresh, in low reps (never high
// reps under fatigue): triples, then doubles, then singles, then a taper with
// openers. Percentages are of the athlete's own snatch and clean & jerk.
// Pulls and power/hang variants are set by effort, with the usual % of the
// lift in the note (the app takes a % only from an exercise's own max).
// Squats build strength under the lifts.
const OWL = [
  // [snatch/C&J sets, reps, %, squat sets, squat reps, squat %]
  [5, 3, 70, 5, 5, 70], [5, 3, 72.5, 5, 5, 72.5], [5, 3, 75, 5, 5, 75], [4, 2, 65, 3, 5, 65],
  [5, 2, 77.5, 5, 3, 80], [5, 2, 80, 5, 3, 82.5], [5, 2, 82.5, 5, 3, 85], [4, 2, 70, 3, 3, 72.5],
  [5, 1, 85, 4, 2, 87.5], [5, 1, 87.5, 4, 2, 90], [4, 1, 90, 3, 2, 85]
];
const owlWeek = (week) => {
  const [ls, lr, lp, ss, sr, sp] = OWL[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const pullNote = (lift) => `About 95-105% of your best ${lift}: fast, same positions as the lift.`;
  return [
    { title: "Snatch and back squat", items: [
      ex("snatch", ls, lr, { pct: lp }, 150, "Every rep the same - stop if the technique breaks."),
      ex("overhead_squat", s(3), 3, { rpe: 7 }, 120),
      ex("back_squat", ss, sr, { pct: sp }, 180),
      ex("snatch_pull", s(4), 3, { rpe: 8 }, 120, pullNote("snatch"))
    ] },
    { title: "Clean and jerk and front squat", items: [
      ex("clean_and_jerk", ls, lr, { pct: lp }, 180, "One clean and one jerk per rep; log which part missed if one does."),
      ex("split_jerk", s(3), 2, { rpe: 7 }, 120, "From the rack: a fast, straight dip and drive."),
      ex("front_squat", ss, sr, { pct: sp - 5 }, 180),
      ex("clean_pull", s(4), 3, { rpe: 8 }, 120, pullNote("clean"))
    ] },
    { title: "Power and hang variants", items: [
      ex("power_snatch", s(4), 2, { rpe: 7 }, 120, "About 70-80% of your snatch."),
      ex("hang_power_clean", s(4), 2, { rpe: 7 }, 120, "About 70-80% of your clean."),
      ex("romanian_deadlift", s(3), 6, { rpe: 7 }, 120), ex("pull_up", s(3), 6, { rpe: 8 }, 90),
      ex("front_plank", 3, { seconds: 40 }, "bw", 60)
    ] },
    { title: "Heavy snatch and clean and jerk", items: [
      ex("hang_snatch", s(3), 2, { rpe: 7 }, 120, "A light primer: the positions above the knee."),
      ex("snatch", s(ls - 1), lr, { pct: lp + 2.5 }, 150), ex("clean_and_jerk", s(ls - 1), lr, { pct: lp + 2.5 }, 180),
      ex("back_squat", s(3), sr, { pct: sp - 10 }, 150)
    ] }
  ];
};
// Competition week: openers practised, volume down, nothing heavier than 90%.
const owlTaper = [
  { title: "Openers", items: [
    ex("snatch", 3, 1, { pct: 85 }, 150, "Your opener: a weight you'd make on a bad day."),
    ex("clean_and_jerk", 3, 1, { pct: 85 }, 180, "Your opener: a weight you'd make on a bad day."),
    ex("front_squat", 2, 2, { pct: 75 }, 150)
  ] },
  { title: "Primer", items: [
    ex("power_snatch", 3, 1, { rpe: 6 }, 120), ex("hang_power_clean", 3, 1, { rpe: 6 }, 120), ex("split_jerk", 2, 1, { rpe: 6 }, 120)
  ] }
];
const olympicWeightlifting = {
  key: "olympic_weightlifting_meet_prep",
  template_name: "Olympic weightlifting meet prep",
  activity_id: "olympic_weightlifting",
  description: "Twelve weeks, four days a week, to a weightlifting meet: the snatch and clean & jerk first in every session, in triples, then doubles, then singles, at percentages of your own best lifts; pulls, power and hang variants; back and front squats building strength underneath; then a taper week with openers. Every fourth week is lighter.",
  listing: { title: "Olympic weightlifting meet prep (12 weeks)", summary: "The snatch and clean & jerk first every session, from triples to doubles to singles at percentages of your own best lifts, with pulls, power and hang variants and squats underneath - then a taper week practising your openers. Four days a week; lighter every fourth week.", levels: ["amateur", "pro"], activity_ids: ["olympic_weightlifting"], days_per_week: 4, next: "intermediate_upper_lower" },
  blocks: [
    { name: "Accumulation", block_type: "volume", weeks: [1, 2, 3, 4].map(owlWeek) },
    { name: "Intensification", block_type: "strength", weeks: [5, 6, 7, 8].map(owlWeek) },
    { name: "Realisation", block_type: "peak", weeks: [9, 10, 11].map(owlWeek) },
    { name: "Taper and meet", block_type: "deload", weeks: [owlTaper] }
  ]
};

export const PROGRAMMES = [
  beginnerFullBody, intermediateUpperLower, powerliftingMeetPrep, teamOffSeason, teamInSeason,
  enduranceRunRide, enduranceSwimRowPaddle, enduranceInSeason, combatBuild, fightCamp, tennisOffSeason, tennisInSeason,
  cricketOffSeason, cricketInSeason, athleticsPowerBuild, athleticsSeason,
  strongmanBuild, streetLifting, hyroxBuild, crossfitBuild, olympicWeightlifting
];
