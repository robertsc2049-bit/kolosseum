// Kolosseum programmes v1 - drafts for coach review.
// The reasoning behind each programme is in
// docs/programmes/KOLOSSEUM_PROGRAMMES_V1.md. scripts/seed_kolosseum_programmes.mjs
// turns these into programmes in the builder (as drafts, by default).
//
// Notation, per exercise:
//   ex(exercise_id, sets, reps, load, rest_seconds?)
//   reps: 5 | [8, 12] (a range) | { seconds: 30 } | { metres: 10 }
//   load: { pct: 70 } (% of 1RM) | { rpe: 8 } | "bw" (bodyweight) | { kg: 4 } (fixed weight)
// Main lifts use % of 1RM: the athlete's own setting turns it into weights
// built from what they lift (the beginner default), % of their max, or RPE.

export const ex = (id, sets, reps, load, rest) => ({ id, sets, reps, load, rest });

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
  listing: { title: "Beginner full-body", summary: "New to lifting? Three full-body sessions a week on the main lifts, adding a little weight every time you make all your reps. Works alongside any sport.", levels: ["beginner"], activity_ids: [], days_per_week: 3 },
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
  listing: { title: "Powerlifting meet prep (12 weeks)", summary: "Twelve weeks to a meet: build volume, then heavier triples, then doubles and singles, then a taper week with your openers. Squat, bench and deadlift each get a main day.", levels: ["amateur", "pro"], activity_ids: ["powerlifting"], days_per_week: 4 },
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
  listing: { title: "Off-season strength build (8 weeks)", summary: "The off-season is when strength and power are built. Three days a week: jumps, throws and short sprints, then heavy lifting, plus hamstring and single-leg work for robustness.", levels: ["amateur", "pro"], activity_ids: TEAM_SPORTS, days_per_week: 3 },
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
  listing: { title: "In-season maintenance (12 weeks)", summary: "Keep your strength and power through the season: two short, heavy sessions a week, low volume so you stay fresh for matches. Your match week keeps heavy legs away from the day before a game.", levels: ["amateur", "pro"], activity_ids: TEAM_SPORTS, days_per_week: 2 },
  blocks: [{ name: "In season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => inSeasonWeek(i + 1)) }]
};

export const PROGRAMMES = [beginnerFullBody, intermediateUpperLower, powerliftingMeetPrep, teamOffSeason, teamInSeason];
