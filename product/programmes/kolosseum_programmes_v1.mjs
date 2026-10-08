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
//   (A "superset" group - the pro versions' contrast pairs - needs no timing.)
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
const UL = { bench: wave(72.5), squat: wave(72.5), row: wave(70), ohp: wave(70), rdl: wave(65), deadlift: wave(72.5), front: wave(62.5) };
// Weeks 3 and 7 end each main lift with a rep-out: the reps it gives update
// the athlete's estimated max, so the next wave starts from where they are.
const REP_OUT = "Last set: as many good reps as you can, stopping one short of failure - log them; they update your max.";
const intermediateWeek = (week) => {
  const p = (k) => ({ pct: UL[k][week - 1] });
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  const out = week % 4 === 3 ? REP_OUT : undefined;
  return [
    { title: "Upper 1 - strength", items: [
      ex("bench_press", s(4), 5, p("bench"), 180, out), ex("barbell_row", s(4), 6, p("row"), 150), ex("overhead_press", s(3), 6, p("ohp"), 150),
      ex("pull_up", s(3), [6, 8], { rpe: 8 }, 120), ex("cable_triceps_pressdown", s(3), 12, { rpe: 8 }, 75)
    ] },
    { title: "Lower 1 - strength", items: [
      ex("back_squat", s(4), 5, p("squat"), 180, out), ex("romanian_deadlift", s(3), 8, p("rdl"), 150), ex("bulgarian_split_squat", s(3), 8, { rpe: 8 }, 90),
      ex("lying_leg_curl", s(3), 10, { rpe: 8 }, 75), ex("side_plank", s(3), { seconds: 30 }, "bw", 60)
    ] },
    { title: "Upper 2 - volume", items: [
      ex("incline_dumbbell_press", s(4), 10, { rpe: 8 }, 120), ex("seated_cable_row", s(4), 10, { rpe: 8 }, 90), ex("dumbbell_overhead_press", s(3), 10, { rpe: 8 }, 90),
      ex("dumbbell_lateral_raise", s(3), 15, { rpe: 8 }, 60), ex("face_pull", s(3), 15, { rpe: 7 }, 60)
    ] },
    { title: "Lower 2 - volume", items: [
      ex("deadlift", s(3), 5, p("deadlift"), 180, out), ex("front_squat", s(3), 8, p("front"), 150), ex("walking_lunge", s(3), 10, { rpe: 8 }, 90),
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
  // Accumulation at RPE 5.5-7, intensification triples at RPE 7-8.5,
  // realisation doubles and a single at RPE 8-8.5 (on the RPE chart).
  squat: [[5, 5, 72.5], [5, 5, 75], [5, 5, 77.5], [3, 5, 65], [5, 3, 82.5], [5, 3, 85], [5, 3, 87.5], [3, 3, 72.5], [4, 2, 87.5], [3, 2, 90], [2, 1, 92.5]],
  bench: [[5, 6, 72.5], [5, 6, 75], [5, 6, 77.5], [3, 6, 65], [5, 3, 82.5], [5, 3, 85], [5, 3, 87.5], [3, 3, 72.5], [4, 2, 87.5], [3, 2, 90], [2, 1, 92.5]],
  deadlift: [[4, 5, 72.5], [4, 5, 75], [4, 5, 77.5], [3, 5, 65], [4, 3, 82.5], [4, 3, 85], [4, 3, 87.5], [2, 3, 72.5], [3, 2, 87.5], [2, 2, 90], [1, 1, 92.5]]
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
      ex("deadlift", ds, dr, { pct: dp }, 240), ex("paused_back_squat", sq <= 3 ? 2 : 4, Math.min(sr, 4), { pct: sp - 12.5 }, 180),
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
// 4. Team sports - amateur and pro. Four families with different demands, so
// four programmes, each with its own in-season maintenance:
// - collision forwards and linemen (rugby forwards, American football linemen):
//   mass, upper-body pushing and neck strength for the scrum, maul and line;
// - collision backs and skill players: speed first, still neck strength - every
//   collision athlete is tackled and hits the ground;
// - field and ice sports (football, field hockey, ice hockey): acceleration,
//   change of direction, and the hamstring (Nordic curl) and groin (Copenhagen
//   plank) work that prevents those sports' most common time-loss injuries;
// - court sports (netball, basketball, volleyball): landing, deceleration and
//   patellar-tendon care, with jump volume kept low because practice is full of
//   jumps.
// Explosive work comes first in a session, while fresh.
const COLLISION_SPORTS = ["rugby_union", "rugby_league", "rugby_sevens", "american_football"];
const FIELD_ICE_SPORTS = ["football_soccer", "field_hockey", "ice_hockey"];
const COURT_SPORTS = ["netball", "basketball", "volleyball"];

// Collision off-season, 12 weeks: hypertrophy (8s), max strength (5s), then
// strength and power (3s), each block ending with a lighter week.
const COLLISION_MAIN = [[4, 8, 67.5], [4, 8, 70], [4, 8, 72.5], [3, 8, 60], [5, 5, 77.5], [5, 5, 80], [5, 5, 82.5], [3, 5, 70], [4, 3, 82.5], [4, 3, 85], [4, 3, 87.5], [3, 3, 75]];
const collisionShape = (week) => {
  const [sets, reps, pct] = COLLISION_MAIN[week - 1];
  const lighter = week % 4 === 0;
  return { sets, reps, pct, s: (n) => (lighter ? Math.max(2, n - 1) : n), accessoryReps: week <= 4 ? 10 : week <= 8 ? 8 : 6 };
};
const neck = (id, sets) => ex(id, sets, { seconds: 20 }, { rpe: 6 }, 45, "Push into your hand or a band and hold - build the effort slowly.");
const collisionForwardsWeek = (week) => {
  const { sets, reps, pct, s, accessoryReps } = collisionShape(week);
  return [
    { title: "Lower A - squat", items: [
      ex("box_jump", s(4), 3, "bw", 90), ex("back_squat", sets, reps, { pct }, 210), ex("romanian_deadlift", s(3), accessoryReps, { rpe: 8 }, 150),
      ex("bulgarian_split_squat", s(3), accessoryReps, { rpe: 8 }, 90), ex("nordic_curl", s(3), 4, "bw", 90),
      neck("neck_flexion_isometric", 3), neck("neck_extension_isometric", 3)
    ] },
    { title: "Upper A - press", items: [
      ex("medicine_ball_chest_pass", s(4), 5, { kg: 5 }, 75), ex("bench_press", sets, reps, { pct }, 180), ex("pull_up", s(4), [5, 8], { rpe: 8 }, 120, "Add weight once 8 are easy."),
      ex("barbell_row", s(3), accessoryReps, { rpe: 8 }, 90), ex("dumbbell_overhead_press", s(3), accessoryReps, { rpe: 8 }, 90), neck("neck_lateral_flexion_isometric", 3)
    ] },
    { title: "Lower B - hinge and push", items: [
      ex("broad_jump_to_stick", s(4), 3, "bw", 90), ex("trap_bar_deadlift", sets, reps, { pct }, 210), ex("front_squat", s(3), 6, { rpe: 7 }, 150),
      ex("sled_push", s(4), { metres: 20 }, { rpe: 8 }, 120, "Heavy: drive low, like hitting a ruck or the line."), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45),
      neck("neck_flexion_isometric", 2), neck("neck_extension_isometric", 2)
    ] },
    { title: "Upper B - volume and carries", items: [
      ex("incline_bench_press", s(4), accessoryReps, { rpe: 8 }, 120), ex("chin_up", s(3), accessoryReps, { rpe: 8 }, 90), ex("landmine_press", s(3), 6, { rpe: 8 }, 90),
      ex("chest_supported_row", s(3), accessoryReps + 2, { rpe: 8 }, 75), ex("farmers_carry", 3, { metres: 30 }, { rpe: 8 }, 75), ex("face_pull", 3, 15, { rpe: 7 }, 45)
    ] }
  ];
};
const collisionForwardsOffSeason = {
  key: "collision_forwards_off_season",
  template_name: "Collision off-season: forwards and linemen",
  activity_id: "general_strength",
  description: "Twelve weeks, four days a week, for rugby forwards and American football linemen: a hypertrophy block (8s) to add muscle, a max-strength block (5s), then strength and power (3s), each ending lighter. Jumps and throws first while fresh, heavy squats, deadlifts and presses, sled pushes, and neck strength three times a week for the scrum, maul and line.",
  listing: { title: "Collision off-season: forwards and linemen (12 weeks)", summary: "Rugby forwards and American football linemen. Four days a week: build muscle, then max strength, then strength and power - with sled pushes, carries and neck strength three times a week for the contact your position takes.", levels: ["amateur", "pro"], activity_ids: COLLISION_SPORTS, days_per_week: 4, next: "collision_in_season" },
  blocks: [
    { name: "Hypertrophy", block_type: "volume", weeks: [1, 2, 3, 4].map(collisionForwardsWeek) },
    { name: "Max strength", block_type: "strength", weeks: [5, 6, 7, 8].map(collisionForwardsWeek) },
    { name: "Strength and power", block_type: "peak", weeks: [9, 10, 11, 12].map(collisionForwardsWeek) }
  ]
};

const collisionBacksWeek = (week) => {
  const { sets, reps, pct, s } = collisionShape(week);
  return [
    { title: "Acceleration and squat", items: [
      ex("twenty_metre_acceleration", s(5), { metres: 20 }, "bw", 120, "Full recovery: every rep at top speed."), ex("back_squat", sets, reps, { pct }, 210),
      ex("single_leg_rdl", s(3), 6, { rpe: 8 }, 90), ex("nordic_curl", s(3), 4, "bw", 90), neck("neck_flexion_isometric", 3), neck("neck_extension_isometric", 3)
    ] },
    { title: "Upper strength", items: [
      ex("medicine_ball_chest_pass", s(4), 5, { kg: 4 }, 75), ex("bench_press", sets, reps, { pct }, 180), ex("pull_up", s(4), [5, 8], { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), neck("neck_lateral_flexion_isometric", 3), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Top speed and power", items: [
      ex("flying_twenty_sprint", s(4), { metres: 20 }, "bw", 180, "Build up over 20-30 m, then 20 m flat out. Full recovery."), ex("trap_bar_deadlift", sets, Math.min(reps, 5), { pct }, 180),
      ex("lateral_bound", s(3), 4, "bw", 90), ex("walking_lunge", s(3), 8, { rpe: 8 }, 90), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45),
      ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] }
  ];
};
const collisionBacksOffSeason = {
  key: "collision_backs_off_season",
  template_name: "Collision off-season: backs and skill players",
  activity_id: "general_strength",
  description: "Twelve weeks, three days a week, for rugby backs and American football skill players: acceleration and top-speed sprints first, then heavy lifting through 8s, 5s and 3s, Nordic curls for the hamstrings, Copenhagen planks for the groin, and neck strength twice a week - every collision athlete is tackled.",
  listing: { title: "Collision off-season: backs and skill players (12 weeks)", summary: "Rugby backs and American football skill players. Three days a week: acceleration and top-speed sprints first, heavy lifting from 8s to 3s, and hamstring, groin and neck work - fast, and robust in contact.", levels: ["amateur", "pro"], activity_ids: COLLISION_SPORTS, days_per_week: 3, next: "collision_in_season" },
  blocks: [
    { name: "Hypertrophy", block_type: "volume", weeks: [1, 2, 3, 4].map(collisionBacksWeek) },
    { name: "Max strength", block_type: "strength", weeks: [5, 6, 7, 8].map(collisionBacksWeek) },
    { name: "Strength and power", block_type: "peak", weeks: [9, 10, 11, 12].map(collisionBacksWeek) }
  ]
};

const IN_PCT = [80, 82.5, 85, 75];
const collisionInSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("countermovement_jump", 3, 3, "bw", 90), ex("back_squat", s(3), 3, { pct }, 180), ex("bench_press", s(3), 3, { pct }, 180),
      ex("pull_up", s(3), 5, { rpe: 7 }, 120), ex("nordic_curl", 2, 4, "bw", 90), neck("neck_flexion_isometric", 2), neck("neck_extension_isometric", 2)
    ] },
    { title: "Mid-week session", items: [
      ex("medicine_ball_rotational_throw", 3, 4, { kg: 4 }, 75), ex("trap_bar_deadlift", s(3), 3, { pct }, 180), ex("single_arm_dumbbell_press", s(3), 6, { rpe: 7 }, 90),
      ex("inverted_row", s(3), 8, "bw", 75), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45), neck("neck_lateral_flexion_isometric", 2)
    ] }
  ];
};
const collisionInSeason = {
  key: "collision_in_season",
  template_name: "Collision in-season maintenance",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week through the season for rugby and American football: hold strength and power while staying fresh for matches, with neck, hamstring and groin work every week. Every fourth week is lighter.",
  listing: { title: "Collision in-season maintenance (12 weeks)", summary: "Rugby and American football. Two short, heavy sessions a week to keep your strength and power through the season, with neck, hamstring and groin work every week. Your match week keeps heavy legs away from the day before a game.", levels: ["amateur", "pro"], activity_ids: COLLISION_SPORTS, days_per_week: 2 },
  blocks: [{ name: "In season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => collisionInSeasonWeek(i + 1)) }]
};

// Field and ice, and court, off-season: 8 weeks - base strength (6s) then
// strength and power (4s), each block ending lighter.
const FIELD_MAIN = [[3, 6, 70], [3, 6, 72.5], [4, 6, 75], [2, 6, 65], [4, 4, 80], [4, 4, 82.5], [4, 4, 85], [3, 4, 72.5]];
const fieldShape = (week) => {
  const [sets, reps, pct] = FIELD_MAIN[week - 1];
  const lighter = week % 4 === 0;
  return { sets, reps, pct, s: (n) => (lighter ? Math.max(2, n - 1) : n) };
};
const fieldIceWeek = (week) => {
  const { sets, reps, pct, s } = fieldShape(week);
  return [
    { title: "Acceleration and squat", items: [
      ex("ten_metre_acceleration", s(6), { metres: 10 }, "bw", 90, "Every rep at top speed - full recovery."), ex("back_squat", sets, reps, { pct }, 180),
      ex("romanian_deadlift", s(3), 8, { rpe: 7 }, 120), ex("nordic_curl", s(3), 4, "bw", 90), ex("copenhagen_plank", s(3), { seconds: 20 }, "bw", 45, "Short lever (top leg on the bench at the knee) until 30 s is easy.")
    ] },
    { title: "Upper and trunk", items: [
      ex("medicine_ball_rotational_throw", s(4), 4, { kg: 4 }, 75), ex("pull_up", s(3), [5, 8], { rpe: 8 }, 120), ex("dumbbell_bench_press", s(3), 8, { rpe: 8 }, 90),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), ex("side_plank", 2, { seconds: 30 }, "bw", 45), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] },
    { title: "Change of direction and single leg", items: [
      ex("lateral_bound", s(4), 4, "bw", 90, "Stick each landing: skating and cutting start here."), ex("trap_bar_deadlift", sets, reps, { pct }, 180),
      ex("ten_metre_deceleration", s(3), { metres: 10 }, "bw", 90), ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90), ex("lateral_lunge", s(3), 6, { rpe: 7 }, 75),
      ex("machine_hip_adduction", 2, 12, { rpe: 7 }, 60), ex("single_leg_calf_raise", 2, 10, { rpe: 8 }, 60)
    ] }
  ];
};
const fieldIceOffSeason = {
  key: "field_ice_off_season",
  template_name: "Field and ice off-season build",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, for football, field hockey and ice hockey: acceleration, deceleration and lateral bounds first, base strength then strength and power, and the hamstring (Nordic curl) and groin (Copenhagen plank, adduction) work that prevents these sports' most common injuries.",
  listing: { title: "Field and ice off-season build (8 weeks)", summary: "Football, field hockey and ice hockey. Three days a week: acceleration, cutting and lateral power, heavy squats and deadlifts, and Nordic curls and Copenhagen planks every week - the hamstring and groin work that keeps players available.", levels: ["amateur", "pro"], activity_ids: FIELD_ICE_SPORTS, days_per_week: 3, next: "field_ice_in_season" },
  blocks: [
    { name: "Base strength", block_type: "volume", weeks: [1, 2, 3, 4].map(fieldIceWeek) },
    { name: "Strength and power", block_type: "strength", weeks: [5, 6, 7, 8].map(fieldIceWeek) }
  ]
};
const fieldIceInSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("countermovement_jump", 3, 3, "bw", 90), ex("back_squat", s(3), 3, { pct }, 180), ex("pull_up", s(3), 5, { rpe: 7 }, 120),
      ex("nordic_curl", 2, 4, "bw", 90), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45)
    ] },
    { title: "Mid-week session", items: [
      ex("medicine_ball_rotational_throw", 3, 4, { kg: 4 }, 75), ex("trap_bar_deadlift", s(3), 3, { pct }, 180), ex("bulgarian_split_squat", s(3), 5, { rpe: 7 }, 90),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 7 }, 75), ex("machine_hip_adduction", 2, 10, { rpe: 7 }, 60), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const fieldIceInSeason = {
  key: "field_ice_in_season",
  template_name: "Field and ice in-season maintenance",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week through the season for football, field hockey and ice hockey: hold strength and power while staying fresh, with Nordic curls and Copenhagen planks every week. Every fourth week is lighter.",
  listing: { title: "Field and ice in-season maintenance (12 weeks)", summary: "Football, field hockey and ice hockey. Two short, heavy sessions a week through the season, with Nordic curls and Copenhagen planks every week. Your match week keeps heavy legs away from the day before a game.", levels: ["amateur", "pro"], activity_ids: FIELD_ICE_SPORTS, days_per_week: 2, next: "field_ice_off_season" },
  blocks: [{ name: "In season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => fieldIceInSeasonWeek(i + 1)) }]
};

const tendonHold = (sets) => ex("split_squat", sets, { seconds: 30 }, { rpe: 7 }, 60, "Hold the bottom of a split squat, front shin upright: a steady hold that settles a sore patellar tendon.");
const courtWeek = (week) => {
  const { sets, reps, pct, s } = fieldShape(week);
  return [
    { title: "Jump, land and squat", items: [
      ex("countermovement_jump", s(4), 3, "bw", 90, "Few, maximal jumps - practice supplies the volume."), ex("back_squat", sets, reps, { pct }, 180),
      ex("drop_to_stick", s(3), 4, "bw", 75, "Land soft and quiet, knees over toes, and hold for two seconds."), tendonHold(s(3)),
      ex("nordic_curl", s(3), 4, "bw", 90), ex("single_leg_calf_raise", s(3), 10, { rpe: 8 }, 60)
    ] },
    { title: "Upper and shoulder", items: [
      ex("medicine_ball_chest_pass", s(4), 5, { kg: 4 }, 75), ex("landmine_press", s(3), 6, { rpe: 8 }, 90), ex("pull_up", s(3), [5, 8], { rpe: 8 }, 120),
      ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75), ex("band_external_rotation", 3, 15, { rpe: 6 }, 45, "Volleyball: the hitting shoulder needs this every week."), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] },
    { title: "Deceleration and single leg", items: [
      ex("lateral_bound", s(3), 4, "bw", 90), ex("trap_bar_deadlift", sets, reps, { pct }, 180), ex("lateral_deceleration", s(3), 4, "bw", 75),
      ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45), ex("wall_tibialis_raise", 2, 15, "bw", 45),
      ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const courtOffSeason = {
  key: "court_off_season",
  template_name: "Court-sport off-season build",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, for netball, basketball and volleyball: a few maximal jumps (practice supplies the jump volume), landing and deceleration drills, base strength then strength and power, patellar-tendon holds, calves and shins, and shoulder care for hitters and shooters.",
  listing: { title: "Court-sport off-season build (8 weeks)", summary: "Netball, basketball and volleyball. Three days a week: a few maximal jumps, landing and deceleration drills, heavy squats and deadlifts, and the knee, calf, groin and shoulder work that keeps court players jumping all season.", levels: ["amateur", "pro"], activity_ids: COURT_SPORTS, days_per_week: 3, next: "court_in_season" },
  blocks: [
    { name: "Base strength", block_type: "volume", weeks: [1, 2, 3, 4].map(courtWeek) },
    { name: "Strength and power", block_type: "strength", weeks: [5, 6, 7, 8].map(courtWeek) }
  ]
};
const courtInSeasonWeek = (week) => {
  const pct = at(IN_PCT, week);
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  return [
    { title: "Early-week session", items: [
      ex("back_squat", s(3), 3, { pct }, 180), tendonHold(3), ex("pull_up", s(3), 5, { rpe: 7 }, 120),
      ex("nordic_curl", 2, 4, "bw", 90), ex("single_leg_calf_raise", 2, 10, { rpe: 8 }, 60)
    ] },
    { title: "Mid-week session", items: [
      ex("medicine_ball_chest_pass", 3, 4, { kg: 4 }, 75), ex("trap_bar_deadlift", s(3), 3, { pct }, 180), ex("landmine_press", s(3), 5, { rpe: 7 }, 90),
      ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45), ex("band_external_rotation", 2, 15, { rpe: 6 }, 45), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const courtInSeason = {
  key: "court_in_season",
  template_name: "Court-sport in-season maintenance",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week through the season for netball, basketball and volleyball: no extra jumping (games and practice supply it), heavy low-rep lifting, patellar-tendon holds, and groin and shoulder care. Every fourth week is lighter.",
  listing: { title: "Court-sport in-season maintenance (12 weeks)", summary: "Netball, basketball and volleyball. Two short, heavy sessions a week, no extra jumping - games supply it - with patellar-tendon holds and groin and shoulder care. Your match week keeps heavy legs away from the day before a game.", levels: ["amateur", "pro"], activity_ids: COURT_SPORTS, days_per_week: 2, next: "court_off_season" },
  blocks: [{ name: "In season", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => courtInSeasonWeek(i + 1)) }]
};

// ---------------------------------------------------------------------------
// 5. Endurance strength - amateur and pro. Heavy, low-rep lifting twice a week
// improves economy (less energy at the same pace or power) without adding
// bulk; plyometrics stiffen the lower leg. Sets stop short of failure and the
// volume stays low so it fits around the athlete's own training.
// Runners, cyclists and triathletes lift with a lower-body bias; swimmers,
// rowers and paddlers get more pulling and shoulder work.
const RUN_RIDE_SPORTS = ["athletics", "cycling"];
const SWIM_ROW_PADDLE_SPORTS = ["swimming", "rowing", "kayaking"];
const ENDURANCE_SPORTS = [...RUN_RIDE_SPORTS, "triathlon", ...SWIM_ROW_PADDLE_SPORTS];

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
  description: "Twelve weeks, two short sessions a week, for distance runners and cyclists: heavy squats and deadlifts at low reps to improve economy without adding bulk, plyometrics for a stiffer lower leg, and calf, shin and single-leg work for robustness.",
  listing: { title: "Run and ride strength (12 weeks)", summary: "For distance runners and cyclists. Two short sessions a week: heavy, low-rep lifting that makes each stride or pedal stroke cheaper without adding bulk, plus jumps and calf, shin and single-leg work. Built to sit alongside your miles.", levels: ["amateur", "pro"], activity_ids: RUN_RIDE_SPORTS, days_per_week: 2, next: "endurance_in_season" },
  blocks: [
    { name: "Foundation", block_type: "general", weeks: [1, 2, 3, 4].map(runRideWeek) },
    { name: "Heavy strength", block_type: "strength", weeks: [5, 6, 7, 8].map(runRideWeek) },
    { name: "Heavy strength 2", block_type: "strength", weeks: [9, 10, 11, 12].map(runRideWeek) }
  ]
};

// Triathletes: the run-and-ride lower body plus the swimmer's pulling and
// rotator-cuff work - three sports, one short programme.
const triathlonWeek = (week) => {
  const { sets, reps, pct, s, plyoSets } = enduranceWeekShape(week);
  return [
    { title: "Strength A - squat and pull", items: [
      ex("pogo_jump", plyoSets, 10, "bw", 90), ex("back_squat", sets, reps, { pct }, 180), ex("pull_up", s(3), [4, 6], { rpe: 8 }, 120),
      ex("single_leg_calf_raise", s(3), 8, { rpe: 8 }, 75), ex("band_external_rotation", 2, 15, { rpe: 6 }, 45), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Strength B - hinge and row", items: [
      ex("box_jump", plyoSets, 3, "bw", 90), ex("trap_bar_deadlift", sets, reps, { pct }, 180), ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90),
      ex("seated_cable_row", s(3), 8, { rpe: 8 }, 75), ex("side_lying_external_rotation", 2, 12, { rpe: 7 }, 45), ex("wall_tibialis_raise", 2, 15, "bw", 45)
    ] }
  ];
};
const triathlonStrength = {
  key: "triathlon_strength",
  template_name: "Triathlon strength",
  activity_id: "general_strength",
  description: "Twelve weeks, two short sessions a week, for triathletes: heavy, low-rep squats and deadlifts for run and bike economy, plyometrics for a stiffer lower leg, pull-ups and rows for the swim, and rotator-cuff, calf and shin work for robustness across three sports.",
  listing: { title: "Triathlon strength (12 weeks)", summary: "For triathletes. Two short sessions a week: heavy, low-rep leg strength for the bike and run, pulling for the swim, jumps, and the shoulder, calf and shin work that keeps you training across three sports.", levels: ["amateur", "pro"], activity_ids: ["triathlon"], days_per_week: 2, next: "endurance_in_season" },
  blocks: [
    { name: "Foundation", block_type: "general", weeks: [1, 2, 3, 4].map(triathlonWeek) },
    { name: "Heavy strength", block_type: "strength", weeks: [5, 6, 7, 8].map(triathlonWeek) },
    { name: "Heavy strength 2", block_type: "strength", weeks: [9, 10, 11, 12].map(triathlonWeek) }
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
  template_name: "Cricket off-season build: batters and spinners",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, in the off-season: jumps, rotational throws and accelerations first, heavy lifting, then the hamstring, groin, shoulder and trunk work that keeps bowlers, batters and fielders on the park.",
  listing: { title: "Cricket off-season: batters and spinners (8 weeks)", summary: "Batters, spinners and keepers. Three days a week in the off-season: rotational power for batting, bowling and throwing, speed between the wickets, heavy lifting, and the trunk, hamstring and shoulder work that keeps fast bowlers on the park.", levels: ["amateur", "pro"], activity_ids: ["cricket"], days_per_week: 3, next: "cricket_in_season" },
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
  template_name: "Sprint and jump power",
  activity_id: "general_strength",
  description: "Twelve weeks, three days a week, in the general preparation phase for sprinters and jumpers: general strength (5s), max strength (3s), then power (2s), with jumps, throws and power cleans every week and hamstring, calf and hip flexor work for sprinters. Track sessions stay with your coach.",
  listing: { title: "Sprint and jump power (12 weeks)", summary: "For sprinters and jumpers in the off-season. Three days a week: heavy squats and power cleans moving from 5s to 3s to 2s, jumps and medicine ball throws every session, plus hamstring, calf and hip flexor work. Sits alongside your track sessions.", levels: ["amateur", "pro"], activity_ids: ["athletics"], days_per_week: 3, next: "athletics_competition_season" },
  blocks: [
    { name: "General strength", block_type: "volume", weeks: [1, 2, 3, 4].map(athleticsPowerWeek) },
    { name: "Max strength", block_type: "strength", weeks: [5, 6, 7, 8].map(athleticsPowerWeek) },
    { name: "Power", block_type: "peak", weeks: [9, 10, 11, 12].map(athleticsPowerWeek) }
  ]
};

// Throwers (shot, discus, hammer, javelin): more strength and more of it -
// four days, heavier and closer to max than sprinters, with heavy
// medicine-ball throws in every session and Olympic lifts for power.
const THROWS_MAIN = [[5, 5, 72.5], [5, 5, 75], [5, 5, 77.5], [3, 5, 65], [5, 3, 82.5], [5, 3, 85], [5, 3, 87.5], [3, 3, 75], [5, 2, 87.5], [4, 2, 90], [4, 1, 92.5], [3, 2, 80]];
const throwsWeek = (week) => {
  const [sets, reps, pct] = THROWS_MAIN[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const cleanPct = Math.min(pct, 85);
  return [
    { title: "Squat and back throw", items: [
      ex("backward_overhead_medicine_ball_throw", s(5), 3, { kg: 6 }, 90, "Heavy ball, full extension: the drive out of the back of the circle."), ex("back_squat", sets, reps, { pct }, 240),
      ex("romanian_deadlift", s(3), 6, { rpe: 8 }, 150), ex("single_leg_calf_raise", 2, 8, { rpe: 8 }, 60), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Bench and rotation", items: [
      ex("medicine_ball_rotational_throw", s(5), 4, { kg: 6 }, 90, "Hips lead, arm last - throw through the wall."), ex("bench_press", sets, reps, { pct }, 210),
      ex("incline_bench_press", s(3), 6, { rpe: 8 }, 150), ex("pull_up", s(3), [5, 8], { rpe: 8 }, 120), ex("cable_woodchop", s(3), 8, { rpe: 8 }, 60),
      ex("band_external_rotation", 2, 15, { rpe: 6 }, 45, "Javelin: never skip this.")
    ] },
    { title: "Clean and front squat", items: [
      ex("medicine_ball_scoop_toss", s(4), 3, { kg: 6 }, 90), ex("power_clean", s(5), Math.min(reps, 3), { pct: cleanPct }, 180),
      ex("front_squat", s(4), Math.min(reps, 5), { pct: pct - 10 }, 180), ex("back_extension", s(3), 10, "bw", 60), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45)
    ] },
    { title: "Overhead and upper volume", items: [
      ex("overhead_press", s(4), Math.min(reps, 5), { pct: pct - 10 }, 180), ex("single_arm_dumbbell_row", s(3), 8, { rpe: 8 }, 75),
      ex("dumbbell_bench_press", s(3), 8, { rpe: 8 }, 90), ex("barbell_wrist_curl", 2, 12, { rpe: 7 }, 45), ex("pallof_press", 2, 10, { rpe: 7 }, 45)
    ] }
  ];
};
const athleticsThrows = {
  key: "athletics_throws_build",
  template_name: "Throws strength and power",
  activity_id: "general_strength",
  description: "Twelve weeks, four days a week, in the general preparation phase for shot, discus, hammer and javelin throwers: heavy squats, benches, cleans and presses moving from 5s to 3s to doubles and singles, heavy medicine-ball throws in every session, and trunk, rotator-cuff and groin work. Technical throwing stays with your coach.",
  listing: { title: "Throws strength and power (12 weeks)", summary: "For shot, discus, hammer and javelin throwers in the off-season. Four days a week: heavy squats, benches, cleans and presses from 5s to singles, heavy medicine-ball throws every session, and trunk and shoulder work. Sits alongside your throwing.", levels: ["amateur", "pro"], activity_ids: ["athletics"], days_per_week: 4, next: "athletics_competition_season" },
  blocks: [
    { name: "General strength", block_type: "volume", weeks: [1, 2, 3, 4].map(throwsWeek) },
    { name: "Max strength", block_type: "strength", weeks: [5, 6, 7, 8].map(throwsWeek) },
    { name: "Power", block_type: "peak", weeks: [9, 10, 11, 12].map(throwsWeek) }
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
  template_name: "Athletics competition season",
  activity_id: "general_strength",
  description: "Two short, heavy sessions a week through the competition season to hold strength and power while staying fast. Every fourth week is lighter; in a competition week, do the early session only, and never in the 48 hours before you compete.",
  listing: { title: "Athletics competition season (12 weeks)", summary: "Sprinters, jumpers and throwers. Hold your strength and power through the competition season: two short, heavy sessions a week, low volume so you stay fast. In a competition week, do the early session only, and never in the 48 hours before you compete.", levels: ["amateur", "pro"], activity_ids: ["athletics"], days_per_week: 2, next: "athletics_power_build" },
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
  const hold = "Choose a weight you can take the full distance at this effort; log it. Swap in your contest's implement and distance once it's announced.";
  const er = (cap) => ({ rpe: Math.min(rpe, cap) });
  // The overhead and deadlift variations, and the event day, rotate through
  // the implements contests use, a different set each week of a four-week
  // block - the fourth a timed medley, as contests run them.
  const overhead = [
    ex("axle_bar_press", s(3), 5, { rpe: 8 }, 150, "Clean the axle every rep: the contest version."),
    ex("circus_dumbbell_press", s(3), 4, { rpe: 8 }, 150, "Each arm. Clean it to the shoulder; the other hand may help if your contest allows."),
    ex("viking_press", s(3), 6, { rpe: 8 }, 120, "Viking press: press for reps, the way contests score it."),
    ex("axle_bar_press", s(3), 5, { rpe: 8 }, 150, "Clean the axle every rep: the contest version.")
  ][(week - 1) % 4];
  const pullVariation = week % 2 === 1
    ? ex("axle_deadlift", s(3), 3, { rpe: 7 }, 180, "Double overhand: the axle is a grip test as much as a pull.")
    : ex("frame_deadlift", s(3), 3, { rpe: 7 }, 180, "The frame (car) deadlift: hands at your sides, a shorter, heavier pull.");
  const EVENT_DAYS = [
    [ex("yoke_walk", s(4), { metres: 20 }, { rpe }, 150, hold), ex("strongman_farmers_walk", s(4), { metres: 30 }, { rpe }, 120, hold),
      ex("atlas_stone_load", s(4), 3, er(8), 150, "Lap, re-grip, extend. Work up to the effort; your contest's stone series replaces this once announced."), ex("tire_flip", s(3), 4, er(8), 120)],
    [ex("frame_carry", s(4), { metres: 20 }, { rpe }, 150, hold), ex("keg_carry", s(3), { metres: 30 }, er(8), 120, hold),
      ex("atlas_stone_over_bar", s(4), 3, er(8), 150, "Lap, re-grip, extend over the bar. Your contest's stone series replaces this once announced."), ex("sandbag_to_shoulder", s(3), 4, er(8), 120, "Alternate shoulders. Swap in your contest's bag once announced.")],
    [ex("husafell_stone_carry", s(3), { metres: 20 }, er(8), 150, hold), ex("duck_walk", s(3), { metres: 20 }, er(8), 120, hold),
      ex("keg_load", s(3), 4, er(8), 150, "A loading run's keg: lap it, drive the hips. Swap in your contest's event once announced."), ex("vehicle_pull", s(3), { metres: 20 }, er(8), 180, "Harness or rope. Swap in your contest's vehicle and distance once announced.")],
    group("for_time", { cap: (lighter ? 2 : 3) * 6 * 60 }, [
      ex("yoke_walk", lighter ? 2 : 3, { metres: 20 }, er(8), 0, "Medley: one run of each implement, in order, against the clock - then full rest (3-4 min) and go again. Swap in your contest's medley once announced."),
      ex("sandbag_carry", lighter ? 2 : 3, { metres: 20 }, er(8), 0, "Medley: straight from the yoke, as in a contest medley."),
      ex("strongman_farmers_walk", lighter ? 2 : 3, { metres: 20 }, er(8), 0, "Medley: straight from the sandbag, as in a contest medley."),
      ex("atlas_stone_load", lighter ? 2 : 3, 2, er(8), 0, "Medley: finish on the stones, as in a contest medley.")
    ])
  ];
  const CONTEST_WEEK_EVENTS = [
    ex("yoke_walk", 2, { metres: 15 }, { rpe: 6 }, 150, "Contest week: a light run to rehearse your pick and first steps. Your contest's yoke weight comes on the day."),
    ex("strongman_farmers_walk", 2, { metres: 15 }, { rpe: 6 }, 120, "Light: grip and set-up only - nothing hard this close to your contest."),
    ex("atlas_stone_load", 2, 1, { rpe: 6 }, 150, "A light stone or two: rehearse the lap and the finish for your contest, then stop.")
  ];
  return [
    { title: "Overhead day", items: [
      ex("strongman_log_press", sets, reps, { pct }, 210, "Clean the log each rep unless your contest allows a single clean."),
      overhead, ex("single_arm_dumbbell_row", s(3), 10, { rpe: 8 }, 75),
      ex("face_pull", 3, 15, { rpe: 7 }, 45), ex("cable_triceps_pressdown", s(3), 12, { rpe: 8 }, 60)
    ] },
    { title: "Deadlift day", items: [
      ex("deadlift", sets, reps, { pct }, 240), pullVariation, ex("romanian_deadlift", s(3), 8, { rpe: 7 }, 120),
      ex("barbell_row", s(4), 8, { rpe: 8 }, 90), ex("front_plank", 3, { seconds: 45 }, "bw", 60)
    ] },
    // The medley is the most contest-like event, so it falls in a loading week
    // (week 3 of each block), not the lighter week; contest week rehearses
    // light openers instead.
    { title: "Event day", items: week === 12 ? CONTEST_WEEK_EVENTS : EVENT_DAYS[[0, 1, 3, 2][(week - 1) % 4]] },
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
  description: "Twelve weeks, four days a week: log, deadlift and squat waves on three gym days (5s, then 3s, then doubles and singles) and a separate event day on the yoke, farmer's, sandbag, stone loading (to a platform and over a bar on alternate weeks) and tyre at a hard but not maximal effort - swap in your contest's events once they're announced. Axle deadlifts for grip and the contest deadlift. Every fourth week is lighter, and the last week eases off before a contest.",
  listing: { title: "Strongman strength and events (12 weeks)", summary: "Three gym days building your log, deadlift and squat from 5s to singles, and one event day on the yoke, farmer's, sandbag, stone loading and tyre - hard, never a max every week; swap in your contest's events. Lighter every fourth week, and the last week eases off for a contest.", levels: ["amateur", "pro"], activity_ids: ["strongman"], days_per_week: 4, next: "intermediate_upper_lower" },
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
  pull: (sets) => ex("sled_rope_pull", sets, { metres: 50 }, { rpe: 8 }, 0, `Hand over hand, standing in the box. ${race}`),
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
// Running is half the race. Threshold: [repeats, minutes] at a comfortably
// hard effort, 2 min easy between; easy aerobic run in km.
const HYROX_THRESHOLD = [[3, 8], [3, 9], [4, 8], [2, 8], [4, 9], [4, 10], [3, 12], [3, 8], [2, 15], [2, 10], [3, 10], [2, 6]];
const HYROX_EASY = [6, 7, 8, 5, 8, 9, 10, 6, 10, 7, 8, 5];
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
    ] },
    { title: "Threshold run", items: [
      ex("tempo_run", HYROX_THRESHOLD[week - 1][0], { seconds: HYROX_THRESHOLD[week - 1][1] * 60 }, { rpe: 7 }, 120, "Comfortably hard: a pace you could hold for about an hour. 2 min easy jog between."),
      ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Easy run", items: [
      ex("easy_run", 1, { metres: HYROX_EASY[week - 1] * 1000 }, { rpe: 5 }, 0, "Conversational pace the whole way - this builds the engine the race runs on.")
    ] }
  ];
};
const hyroxBuild = {
  key: "hyrox_race_build",
  template_name: "HYROX race build",
  activity_id: "hyrox",
  description: "Twelve weeks, five days a week, to a HYROX race: a strength day, a compromised-running day (rounds of a 1 km run straight into a pair of stations, through all eight in race order, and an all-station race simulation in week 10), a station strength-endurance day, a threshold run and an easy aerobic run - running is half the race. Station weights follow your division. Every fourth week is lighter and the last week is a taper.",
  listing: { title: "HYROX race build (12 weeks)", summary: "Five days a week: strength, compromised running - 1 km runs straight into the stations, with a full race simulation in week 10 - station strength-endurance, a threshold run and an easy run. Station weights follow your division. Lighter every fourth week, then a taper.", levels: ["amateur", "pro"], activity_ids: ["hyrox"], days_per_week: 5, next: "intermediate_upper_lower" },
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
const rx = "Rx or scaled - log which.";
// Each pool: four workouts in one time domain, rotated week to week.
const CF_SHORT = [
  () => [ex("thruster", 3, 12, { rpe: 7 }, 0, rx), ex("pull_up", 3, 12, "bw", 0, "Kip only once you have 10 strict.")],
  () => [ex("wall_ball", 3, 15, { rpe: 7 }, 0, rx), ex("toes_to_bar", 3, 12, "bw", 0, "Scale to knee raises.")],
  () => [ex("rowing_ergometer", 3, { metres: 500 }, { rpe: 8 }, 0), ex("burpee", 3, 12, "bw", 0)],
  () => [ex("deadlift", 3, 10, { rpe: 7 }, 0, rx), ex("box_jump", 3, 12, "bw", 0, "Step down.")]
];
const CF_AMRAP = [
  () => [ex("kettlebell_swing", 1, 15, { rpe: 7 }, 0), ex("box_jump", 1, 10, "bw", 0, "Step down."), ex("burpee", 1, 10, "bw", 0)],
  () => [ex("wall_ball", 1, 15, { rpe: 7 }, 0, rx), ex("pull_up", 1, 10, "bw", 0), ex("rowing_ergometer", 1, { metres: 250 }, { rpe: 8 }, 0)],
  () => [ex("double_under", 1, 50, "bw", 0, "Scale to 100 single-unders."), ex("kettlebell_swing", 1, 20, { rpe: 7 }, 0), ex("push_up", 1, 15, "bw", 0)],
  () => [ex("bike_ergometer", 1, { metres: 500 }, { rpe: 8 }, 0), ex("air_squat", 1, 20, "bw", 0), ex("toes_to_bar", 1, 10, "bw", 0, "Scale to knee raises.")]
];
const CF_EMOM = [
  () => [ex("double_under", 1, 40, "bw", 0, "Scale to 80 single-unders."), ex("toes_to_bar", 1, 10, "bw", 0, "Scale to knee raises.")],
  () => [ex("rowing_ergometer", 1, { metres: 200 }, { rpe: 8 }, 0), ex("burpee", 1, 8, "bw", 0)],
  () => [ex("kettlebell_swing", 1, 15, { rpe: 7 }, 0), ex("air_squat", 1, 15, "bw", 0)],
  () => [ex("wall_ball", 1, 12, { rpe: 7 }, 0, rx), ex("double_under", 1, 30, "bw", 0, "Scale to 60 single-unders.")]
];
const CF_CHIPPER = [
  () => [ex("rowing_ergometer", 1, { metres: 1000 }, { rpe: 8 }, 0), ex("wall_ball", 1, 40, { rpe: 7 }, 0), ex("toes_to_bar", 1, 30, "bw", 0), ex("kettlebell_swing", 1, 30, { rpe: 7 }, 0), ex("bike_ergometer", 1, { metres: 2000 }, { rpe: 8 }, 0)],
  () => [ex("ski_erg", 1, { metres: 1000 }, { rpe: 8 }, 0), ex("thruster", 1, 30, { rpe: 7 }, 0, rx), ex("box_jump", 1, 30, "bw", 0, "Step down."), ex("pull_up", 1, 30, "bw", 0), ex("rowing_ergometer", 1, { metres: 1000 }, { rpe: 8 }, 0)],
  () => [ex("bike_ergometer", 1, { metres: 2000 }, { rpe: 8 }, 0), ex("burpee", 1, 40, "bw", 0), ex("deadlift", 1, 30, { rpe: 7 }, 0, rx), ex("double_under", 1, 100, "bw", 0, "Scale to 200 single-unders."), ex("rowing_ergometer", 1, { metres: 1000 }, { rpe: 8 }, 0)],
  () => [ex("treadmill_run", 1, { metres: 800 }, { rpe: 8 }, 0, "Outdoors is fine."), ex("wall_ball", 1, 50, { rpe: 7 }, 0, rx), ex("toes_to_bar", 1, 40, "bw", 0), ex("kettlebell_swing", 1, 40, { rpe: 7 }, 0), ex("bike_ergometer", 1, { metres: 1500 }, { rpe: 8 }, 0)]
];
const crossfitWeek = (week) => {
  const pct = CF_PCT[week - 1];
  const lighter = week % 4 === 0;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const capScale = lighter ? 0.75 : 1;
  const v = (week - 1) % 4;
  // Week 8 repeats week 1's short workout: the benchmark retest.
  const benchmark = week === 1 || week === 8;
  const short = CF_SHORT[benchmark ? 0 : v]().map((item, i) => (benchmark && i === 0 ? { ...item, note: `Benchmark: ${week === 1 ? "log your time - you'll repeat this in week 8" : "your week 1 workout again - beat your time"}. ${rx}` } : item));
  return [
    { title: benchmark ? "Squat and the benchmark" : "Squat and a short For Time", items: [
      ex("back_squat", s(5), 5, { pct }, 180),
      ...group("for_time", { cap: Math.round(8 * capScale) * 60 }, short)
    ] },
    { title: "Clean and jerk, then an AMRAP", items: [
      ex("power_clean", s(5), 2, { pct }, 120), ex("push_jerk", s(5), 2, { pct }, 120),
      ...group("amrap", { cap: Math.round(12 * capScale) * 60 }, CF_AMRAP[v]())
    ] },
    { title: "Strict gymnastics, then an EMOM", items: [
      ex("pull_up", s(5), 5, { rpe: 8 }, 120, "Strict. Add weight once 5 are easy."),
      ex("handstand_push_up", s(4), 5, "bw", 120, "Strict; scale to a pike or box handstand push-up."),
      ...group("emom", { round: 60, rounds: lighter ? 8 : 12 }, CF_EMOM[v]().filter((item) => item.id !== "pull_up"))
    ] },
    { title: "Snatch, then a chipper", items: [
      ex("snatch", s(5), 2, { pct: pct - 5 }, 150, "Technique first: every rep the same."),
      ...group("for_time", { cap: Math.round(20 * capScale) * 60 }, CF_CHIPPER[v]().filter((item) => item.id !== "snatch"))
    ] }
  ];
};
const crossfitBuild = {
  key: "crossfit_strength_conditioning",
  template_name: "CrossFit strength and conditioning",
  activity_id: "crossfit",
  description: "Eight weeks, four days a week: strength or skill first while fresh (squat, power clean and push jerk, snatch, strict pull-ups and handstand push-ups), then one conditioning piece a day in a different time domain - a short For Time, an AMRAP, an EMOM and a longer chipper - with four different workouts in each rotating week to week, and week 1's short workout retested as a benchmark in week 8. Strict before kipping, Olympic lifts in low reps. Every fourth week is lighter.",
  listing: { title: "CrossFit strength and conditioning (8 weeks)", summary: "Four days a week: strength or skill first - squat, Olympic lifts, strict gymnastics - then one conditioning piece in a different time domain each day - different workouts every week, with a benchmark in week 1 retested in week 8. Rx or scaled, logged. Lighter every fourth week.", levels: ["amateur", "pro"], activity_ids: ["crossfit"], days_per_week: 4 },
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

// ---------------------------------------------------------------------------
// 15. Pro versions of the sport builds - pro only. A full-time athlete has
// the recovery for more work and the training age for advanced methods:
// - contrast pairs: each heavy lift is followed straight away by the jump,
//   throw or sprint that led its session (a superset), using the
//   potentiation the heavy set leaves - full rest after the pair;
// - one more working set on the main lifts (at most 6);
// everything else - loads, lighter weeks, the robustness work - as the
// amateur build. Built from the amateur build, so the two never drift apart.
const isExplosive = (item) => item.load === "bw" || (item.load && "kg" in item.load);
const isMainLift = (item) => item.load && item.load !== "bw" && "pct" in item.load;
let contrastCount = 0;
const proSession = (session) => {
  const [first, second, ...rest] = session.items;
  const items = session.items.map((item) => (isMainLift(item) ? { ...item, sets: Math.min(6, item.sets + 1) } : item));
  if (!(first && second && isExplosive(first) && isMainLift(second))) return { ...session, items };
  contrastCount += 1;
  const id = `contrast_${contrastCount}`;
  const heavy = { ...items[1], group: { id, type: "superset", cap: 0, round: 0, rounds: 0 } };
  const fast = { ...first, sets: heavy.sets, group: heavy.group, note: "Contrast: straight after each heavy set, while you're primed - full rest after the pair." };
  return { ...session, items: [heavy, fast, ...items.slice(2)] };
};
const proVersion = (amateur, title) => ({
  ...amateur,
  key: `${amateur.key}_pro`,
  template_name: `${amateur.template_name} (pro)`,
  description: `${amateur.description} Pro version: each heavy lift is paired with a jump, throw or sprint straight after it (contrast), and the main lifts carry an extra set.`,
  listing: {
    ...amateur.listing,
    title,
    summary: "For full-time athletes. The same build with contrast pairs - each heavy lift straight into a jump, throw or sprint - and an extra set on the main lifts.",
    levels: ["pro"]
  },
  blocks: amateur.blocks.map((block) => ({ ...block, weeks: block.weeks.map((week) => week.map(proSession)) }))
});
const PRO_VERSIONS = [
  proVersion(collisionForwardsOffSeason, "Collision off-season: forwards and linemen - pro (12 weeks)"),
  proVersion(collisionBacksOffSeason, "Collision off-season: backs and skill players - pro (12 weeks)"),
  proVersion(fieldIceOffSeason, "Field and ice off-season build - pro (8 weeks)"),
  proVersion(courtOffSeason, "Court-sport off-season build - pro (8 weeks)"),
  proVersion(tennisOffSeason, "Tennis off-season build - pro (8 weeks)"),
  proVersion(cricketOffSeason, "Cricket off-season build - pro (8 weeks)"),
  proVersion(combatBuild, "Combat strength and power - pro (8 weeks)"),
  proVersion(athleticsPowerBuild, "Sprint and jump power - pro (12 weeks)"),
  proVersion(enduranceRunRide, "Run and ride strength - pro (12 weeks)"),
  proVersion(triathlonStrength, "Triathlon strength - pro (12 weeks)"),
  proVersion(enduranceSwimRowPaddle, "Swim, row and paddle strength - pro (12 weeks)")
];

// ---------------------------------------------------------------------------
// 16. Sport-specific beginner programmes - beginner only. Where the sport's
// own skills are lifts (weightlifting, street lifting), stations (HYROX) or
// movements to learn (CrossFit), or where contact makes neck and hamstring
// work non-negotiable from day one (collision and combat sports), a beginner
// starts on their sport's own foundation rather than a generic one. Loads
// build from what they lift (the beginner default); efforts stay at RPE 6-7.
const BEGINNER_LIGHTER = (week) => week % 4 === 0;
const beginnerS = (week) => (n) => (BEGINNER_LIGHTER(week) ? Math.max(2, n - 1) : n);

const contactBeginnerDay = (day, week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  return day === "A"
    ? { title: "Day A", items: [
        ex("back_squat", 3, 5, { pct }, 180), ex("bench_press", 3, 5, { pct }, 180), ex("barbell_row", 3, 8, { pct: pct - 5 }, 120),
        ex("nordic_curl", s(2), 3, "bw", 90, "Lower as slowly as you can; catch yourself with your hands."),
        ex("neck_flexion_isometric", 2, { seconds: 15 }, { rpe: 5 }, 45, "Gentle: push into your hand and hold - build the effort over the weeks."),
        ex("neck_extension_isometric", 2, { seconds: 15 }, { rpe: 5 }, 45)
      ] }
    : { title: "Day B", items: [
        ex("back_squat", 3, 5, { pct }, 180), ex("overhead_press", 3, 5, { pct }, 180), ex("deadlift", 1, 5, { pct }, 180),
        ex("lat_pulldown", 3, 10, { rpe: 7 }, 90), ex("neck_lateral_flexion_isometric", 2, { seconds: 15 }, { rpe: 5 }, 45),
        ex("farmers_carry", 2, { metres: 30 }, { rpe: 7 }, 60, "Grip and trunk: tall, slow and steady.")
      ] };
};
const contactBeginner = {
  key: "beginner_contact_foundation",
  template_name: "Contact-sport foundation (beginner)",
  activity_id: "general_strength",
  description: "Twelve weeks, three full-body days a week, for beginners in rugby, American football and combat sports: the main lifts, adding a little weight whenever every rep is made, plus the neck strength and Nordic curls every contact athlete needs from the first week - gentle holds that build over the weeks.",
  listing: { title: "Contact-sport foundation (beginner, 12 weeks)", summary: "New to lifting in a contact sport? Three full-body days a week on the main lifts, adding weight as you make your reps, with neck strength and Nordic curls from week one - for rugby, American football and fighters.", levels: ["beginner"], activity_ids: [...COLLISION_SPORTS, ...COMBAT_SPORTS], days_per_week: 3, next: "intermediate_upper_lower" },
  blocks: [{ name: "Foundation", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    return (week % 2 === 1 ? ["A", "B", "A"] : ["B", "A", "B"]).map((day) => contactBeginnerDay(day, week));
  }) }]
};

// Weightlifting beginners learn the lifts: light, technically perfect
// triples and doubles at RPE 6-7 every session, pulls and squats for
// strength. Nothing heavy until the positions are automatic.
const owlBeginnerWeek = (week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  const rpe = week <= 4 ? 6 : 7;
  const tech = "Light and perfect: stop the set if a rep changes shape. Video your sets for your coach.";
  return [
    { title: "Snatch and back squat", items: [
      ex("snatch", s(5), 3, { rpe }, 120, tech), ex("overhead_squat", s(3), 3, { rpe: 6 }, 90, "With an empty bar or light: depth and a locked bar overhead."),
      ex("back_squat", 3, 5, { pct }, 180), ex("snatch_pull", s(3), 3, { rpe: 7 }, 120)
    ] },
    { title: "Clean and jerk and front squat", items: [
      ex("clean_and_jerk", s(5), 2, { rpe }, 150, tech), ex("split_jerk", s(3), 3, { rpe: 6 }, 90, "From the rack: find your split."),
      ex("front_squat", 3, 5, { pct: pct - 5 }, 180), ex("clean_pull", s(3), 3, { rpe: 7 }, 120)
    ] },
    { title: "Power and hang", items: [
      ex("power_snatch", s(4), 3, { rpe }, 120), ex("hang_power_clean", s(4), 3, { rpe }, 120), ex("romanian_deadlift", 3, 6, { rpe: 7 }, 120),
      ex("pull_up", 3, [5, 8], { rpe: 7 }, 90), ex("front_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const owlBeginner = {
  key: "beginner_weightlifting_foundation",
  template_name: "Weightlifting foundation (beginner)",
  activity_id: "olympic_weightlifting",
  description: "Twelve weeks, three days a week, for new weightlifters: the snatch and clean & jerk every week, light and technically perfect (triples and doubles at RPE 6-7), power and hang variants, pulls, and back and front squats building strength underneath. Video your sets: technique is the whole point of this block.",
  listing: { title: "Weightlifting foundation (beginner, 12 weeks)", summary: "New to weightlifting? Three days a week learning the snatch and clean & jerk - light, perfect triples and doubles - with pulls and squats building strength underneath. Nothing heavy until the positions are automatic.", levels: ["beginner"], activity_ids: ["olympic_weightlifting"], days_per_week: 3, next: "olympic_weightlifting_meet_prep" },
  blocks: [
    { name: "Positions", block_type: "general", weeks: [1, 2, 3, 4].map(owlBeginnerWeek) },
    { name: "Speed", block_type: "general", weeks: [5, 6, 7, 8].map(owlBeginnerWeek) },
    { name: "Confidence", block_type: "general", weeks: [9, 10, 11, 12].map(owlBeginnerWeek) }
  ]
};

// Street lifting beginners build bodyweight pull-up and dip volume first,
// then start adding weight in the last block.
const streetBeginnerWeek = (week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  const loaded = week >= 9;
  return [
    { title: "Pull and dip", items: [
      ex("pull_up", s(4), loaded ? 5 : [3, 8], { rpe: 7 }, 150, loaded ? "Add a little weight (2.5-5 kg) once 4 x 8 at bodyweight is easy; log it." : "Bodyweight, full range: dead hang to chin over the bar. Use a band if you can't do 3."),
      ex("dip", s(4), loaded ? 5 : [3, 10], { rpe: 7 }, 150, loaded ? "Add a little weight once 4 x 10 is easy; log it." : "Bodyweight, shoulders below elbows at the bottom."),
      ex("back_squat", 3, 5, { pct }, 180), ex("band_external_rotation", 2, 15, { rpe: 6 }, 45)
    ] },
    { title: "Volume", items: [
      ex("chin_up", s(3), [5, 10], { rpe: 7 }, 90), ex("push_up", s(3), [8, 15], { rpe: 7 }, 75), ex("inverted_row", s(3), 10, "bw", 75),
      ex("cable_triceps_pressdown", 2, 12, { rpe: 7 }, 60), ex("dead_bug", 2, 8, "bw", 45)
    ] },
    { title: "Pull, dip and legs", items: [
      ex("pull_up", s(3), [3, 8], { rpe: 7 }, 120), ex("dip", s(3), [3, 10], { rpe: 7 }, 120), ex("romanian_deadlift", 3, 8, { rpe: 7 }, 120),
      ex("face_pull", 3, 15, { rpe: 7 }, 45), ex("side_lying_external_rotation", 2, 12, { rpe: 6 }, 45)
    ] }
  ];
};
const streetBeginner = {
  key: "beginner_street_lifting_foundation",
  template_name: "Street lifting foundation (beginner)",
  activity_id: "street_lifting",
  description: "Twelve weeks, three days a week, for new street lifters: strict bodyweight pull-ups and dips built up in volume for eight weeks, then the first weighted sets; chin-ups, push-ups and rows for volume; squat; and rotator cuff and elbow care every week, because tendons adapt slower than muscle.",
  listing: { title: "Street lifting foundation (beginner, 12 weeks)", summary: "New to street lifting? Three days a week: strict bodyweight pull-ups and dips built up for eight weeks, then your first weighted sets - with squats and the shoulder and elbow care your tendons need.", levels: ["beginner"], activity_ids: ["street_lifting"], days_per_week: 3, next: "street_lifting_meet_prep" },
  blocks: [
    { name: "Bodyweight volume", block_type: "volume", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(streetBeginnerWeek) },
    { name: "First weighted sets", block_type: "strength", weeks: [9, 10, 11, 12].map(streetBeginnerWeek) }
  ]
};

// CrossFit on-ramp: the fundamental movements before intensity. Short,
// scaled conditioning pieces; strict gymnastics; barbell basics.
const cfBeginnerWeek = (week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  const cap = (BEGINNER_LIGHTER(week) ? 6 : 8) * 60;
  return [
    { title: "Squat and a short AMRAP", items: [
      ex("back_squat", 3, 5, { pct }, 180),
      ...group("amrap", { cap }, [ex("air_squat", 1, 10, "bw", 0), ex("push_up", 1, 8, "bw", 0, "From the knees or a box if needed."), ex("rowing_ergometer", 1, { metres: 200 }, { rpe: 7 }, 0)])
    ] },
    { title: "Deadlift, press and an EMOM", items: [
      ex("deadlift", 1, 5, { pct }, 180), ex("overhead_press", 3, 5, { pct }, 150),
      ...group("emom", { round: 60, rounds: BEGINNER_LIGHTER(week) ? 6 : 8 }, [ex("kettlebell_swing", 1, 10, { rpe: 6 }, 0, "Hips drive the bell: chest height, not overhead."), ex("box_jump", 1, 5, "bw", 0, "Low box, step down.")])
    ] },
    { title: "Gymnastics basics and a short For Time", items: [
      ex("band_assisted_pull_up", s(4), 5, "bw", 90, "Strict. Lighter band as you get stronger."), ex("pike_push_up", s(3), 6, "bw", 90),
      ...group("for_time", { cap }, [ex("wall_ball", 2, 10, { rpe: 6 }, 0, "Light ball: full squat, hit the target."), ex("burpee", 2, 6, "bw", 0)])
    ] }
  ];
};
const cfBeginner = {
  key: "beginner_crossfit_on_ramp",
  template_name: "CrossFit on-ramp (beginner)",
  activity_id: "crossfit",
  description: "Twelve weeks, three days a week, for new CrossFitters: the barbell basics (squat, deadlift, press) adding weight as every rep is made, strict gymnastics with a band, and one short, scaled conditioning piece a day - mechanics, then consistency, then intensity.",
  listing: { title: "CrossFit on-ramp (beginner, 12 weeks)", summary: "New to CrossFit? Three days a week: squat, deadlift and press, strict pull-ups and push-ups, and one short, scaled workout a day. Mechanics first, then consistency, then intensity.", levels: ["beginner"], activity_ids: ["crossfit"], days_per_week: 3, next: "crossfit_strength_conditioning" },
  blocks: [{ name: "On-ramp", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => cfBeginnerWeek(i + 1)) }]
};

// HYROX first race: running base, full-body strength, and every station at
// light weights learned before it's raced.
const HYROX_BEGINNER_EASY = [3, 3, 4, 3, 4, 5, 5, 4, 5, 6, 6, 4];
// A station at a learning dose: half the race distance (50 wall balls),
// light, with rest.
const lightStation = (name, sets) => {
  const item = station[name](sets);
  const reps = typeof item.reps === "object" && "metres" in item.reps ? { metres: Math.max(25, item.reps.metres / 2) } : Math.min(Number(item.reps), 50);
  return { ...item, reps, load: item.load === "bw" ? "bw" : { rpe: 6 }, rest: 120, note: "Learn the movement at a light weight; race weight comes later." };
};
const hyroxBeginnerWeek = (week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  const pair = PAIRS[(week - 1) % 4];
  return [
    { title: "Full-body strength", items: [
      ex("back_squat", 3, 5, { pct }, 180), ex("romanian_deadlift", 3, 8, { rpe: 7 }, 120), ex("push_up", 3, [8, 12], "bw", 75),
      ex("seated_cable_row", 3, 10, { rpe: 7 }, 75), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] },
    { title: "Learn the stations", items: [
      lightStation(pair[0], s(3)), lightStation(pair[1], s(3)),
      ...(pair.includes("wallball") ? [] : [ex("wall_ball", s(3), 15, { rpe: 6 }, 90, "Light ball, steady rhythm.")])
    ] },
    { title: "Easy run", items: [
      ex("easy_run", 1, { metres: HYROX_BEGINNER_EASY[week - 1] * 1000 }, { rpe: 5 }, 0, "Conversational pace. Walk breaks are fine.")
    ] }
  ];
};
const hyroxBeginner = {
  key: "beginner_hyrox_first_race",
  template_name: "HYROX first race (beginner)",
  activity_id: "hyrox",
  description: "Twelve weeks, three days a week, to a first HYROX: a full-body strength day, a day learning two of the eight stations at light weights (all eight in race order every four weeks), and an easy run building from 3 to 6 km. Finish the race strong, then move on to the race build.",
  listing: { title: "HYROX first race (beginner, 12 weeks)", summary: "Your first HYROX? Three days a week: full-body strength, learning the eight stations at light weights, and an easy run building to 6 km. Get to the start line ready to finish strong.", levels: ["beginner"], activity_ids: ["hyrox"], days_per_week: 3, next: "hyrox_race_build" },
  blocks: [{ name: "First race", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => hyroxBeginnerWeek(i + 1)) }]
};

// Field, court and racket beginners: the main lifts plus the injury
// prevention their sports need from the first week - Nordic curls, Copenhagen
// planks (short lever) and landing practice.
const fieldBeginnerDay = (day, week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  return day === "A"
    ? { title: "Day A", items: [
        ex("back_squat", 3, 5, { pct }, 180), ex("bench_press", 3, 5, { pct }, 180), ex("barbell_row", 3, 8, { pct: pct - 5 }, 120),
        ex("nordic_curl", s(2), 3, "bw", 90, "Lower as slowly as you can; catch yourself with your hands."),
        ex("copenhagen_plank", 2, { seconds: 15 }, "bw", 45, "Short lever: top leg on the bench at the knee.")
      ] }
    : { title: "Day B", items: [
        ex("drop_to_stick", 3, 4, "bw", 60, "Land soft and quiet, knees over toes, hold for two seconds."), ex("back_squat", 3, 5, { pct }, 180),
        ex("overhead_press", 3, 5, { pct }, 180), ex("deadlift", 1, 5, { pct }, 180), ex("lat_pulldown", 3, 10, { rpe: 7 }, 90),
        ex("single_leg_calf_raise", 2, 10, { rpe: 7 }, 60)
      ] };
};
const fieldBeginner = {
  key: "beginner_field_court_foundation",
  template_name: "Field, court and racket foundation (beginner)",
  activity_id: "general_strength",
  description: "Twelve weeks, three full-body days a week, for beginners in football, field hockey, ice hockey, netball, basketball, volleyball, cricket and tennis: the main lifts, adding a little weight whenever every rep is made, plus Nordic curls, Copenhagen planks and landing practice from the first week - the hamstring, groin and knee work these sports need.",
  listing: { title: "Field, court and racket foundation (beginner, 12 weeks)", summary: "New to lifting in a field, court or racket sport? Three full-body days a week on the main lifts, adding weight as you make your reps, with Nordic curls, Copenhagen planks and landing practice from week one.", levels: ["beginner"], activity_ids: [...FIELD_ICE_SPORTS, ...COURT_SPORTS, "cricket", "tennis"], days_per_week: 3, next: "intermediate_upper_lower" },
  blocks: [{ name: "Foundation", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    return (week % 2 === 1 ? ["A", "B", "A"] : ["B", "A", "B"]).map((day) => fieldBeginnerDay(day, week));
  }) }]
};

// Cricket fast bowlers: the sport's highest injury load - lumbar stress
// injury, side strain, hamstring, the front-foot landing at several times
// bodyweight. Heavy single-leg and posterior-chain strength, landing and
// eccentric work, side-trunk and anti-rotation strength, the bowling
// shoulder; no loaded spinal flexion with rotation. Batters and spinners keep
// the cricket off-season build.
const fastBowlerWeek = (week) => {
  const pct = CRICKET_OFF_PCT[week - 1];
  const deload = week % 4 === 0;
  const s = (n) => (deload ? Math.max(2, n - 1) : n);
  return [
    { title: "Lower strength and front-foot landing", items: [
      ex("broad_jump_to_stick", s(4), 3, "bw", 90), ex("trap_bar_deadlift", s(4), 5, { pct }, 180),
      ex("drop_to_stick", s(3), 4, "bw", 75, "Front-foot contact: land on one leg, brace, hold - the delivery stride."),
      ex("bulgarian_split_squat", s(3), 6, { rpe: 8 }, 90), ex("nordic_curl", s(3), 4, "bw", 90), ex("copenhagen_plank", 2, { seconds: 20 }, "bw", 45)
    ] },
    { title: "Trunk and bowling shoulder", items: [
      ex("medicine_ball_rotational_throw", s(4), 4, { kg: 4 }, 75, "Hips lead; stop if your back complains."), ex("landmine_press", s(3), 6, { rpe: 8 }, 90),
      ex("pull_up", s(3), [5, 8], { rpe: 8 }, 120), ex("side_plank", s(3), { seconds: 40 }, "bw", 45, "Side strain prevention: both sides, front-arm side last."),
      ex("half_kneeling_pallof_press", s(3), 10, { rpe: 7 }, 45), ex("side_lying_external_rotation", 3, 12, { rpe: 7 }, 45)
    ] },
    { title: "Speed and posterior chain", items: [
      ex("twenty_metre_acceleration", s(5), { metres: 20 }, "bw", 90), ex("back_squat", s(4), 5, { pct }, 180),
      ex("single_leg_rdl", s(3), 6, { rpe: 8 }, 90), ex("weighted_back_extension", 2, 10, { rpe: 7 }, 60, "Neutral spine through the whole range - no hyperextension."),
      ex("single_leg_calf_raise", s(3), 10, { rpe: 8 }, 60), ex("bird_dog", 2, 8, "bw", 45)
    ] }
  ];
};
const cricketFastBowler = {
  key: "cricket_fast_bowler_off_season",
  template_name: "Cricket off-season: fast bowlers",
  activity_id: "general_strength",
  description: "Eight weeks, three days a week, for fast bowlers in the off-season: heavy single-leg and posterior-chain strength, front-foot landing and Nordic curls for the delivery stride and the hamstrings, side planks and anti-rotation for side strain, rotator-cuff work for the bowling shoulder - and no loaded spinal flexion with rotation, the lumbar stress pattern. Bowling workload stays with your coach.",
  listing: { title: "Cricket off-season: fast bowlers (8 weeks)", summary: "Fast bowlers. Three days a week: heavy single-leg and posterior-chain strength, front-foot landing, Nordic curls, side-strain and anti-rotation trunk work, and the bowling shoulder - built around the injuries fast bowlers lose most time to.", levels: ["amateur", "pro"], activity_ids: ["cricket"], days_per_week: 3, next: "cricket_in_season" },
  blocks: [{ name: "Off-season build", block_type: "strength", weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(fastBowlerWeek) }]
};

// ---------------------------------------------------------------------------
// 17. Pro versions of the strength and hybrid preps - pro only. Full-time
// lifters and racers differ from amateurs in frequency and in how close to
// their max they train, not in one more set: each pro prep adds a day built
// around that - heavy singles for lifters, a second event day for strongmen,
// race-pace intervals for HYROX, gymnastics and engine volume for CrossFit -
// and the lifting preps peak at 95%. Taper weeks are unchanged.
const proPrep = (amateur, title, summary, extraDay, peakTo95 = false) => {
  let week = 0;
  return {
    ...amateur,
    key: `${amateur.key}_pro`,
    template_name: `${amateur.template_name} (pro)`,
    description: `${amateur.description} Pro version: ${summary}`,
    listing: { ...amateur.listing, title, summary: `For full-time athletes. ${summary}`, levels: ["pro"], days_per_week: amateur.listing.days_per_week + 1 },
    blocks: amateur.blocks.map((block) => ({
      ...block,
      weeks: block.weeks.map((sessions) => {
        week += 1;
        if (block.block_type === "deload") return sessions;
        const peak = (session) => (peakTo95 && block.block_type === "peak" && week === amateur.blocks.filter((b) => b.block_type !== "deload").reduce((n, b) => n + b.weeks.length, 0)
          ? { ...session, items: session.items.map((i) => (i.load !== "bw" && i.load && "pct" in i.load && i.load.pct === 92.5 ? { ...i, load: { pct: 95 } } : i)) }
          : session);
        return [...sessions.map(peak), extraDay(week, block.block_type)];
      })
    }))
  };
};

// Heavy-single day: work up to a top single at the week's effort, then
// back-off sets on a variation (the builder holds each exercise once a
// session). Rotates squat, bench, deadlift.
const PL_SINGLE = [["back_squat", "paused_back_squat"], ["bench_press", "paused_bench_press"], ["deadlift", "paused_deadlift"]];
const plSingleDay = (week, blockType) => {
  const [lift, backOff] = PL_SINGLE[(week - 1) % 3];
  const rpe = blockType === "volume" ? 7 : blockType === "strength" ? 8 : 9;
  return { title: "Heavy single", items: [
    ex(lift, 1, 1, { rpe }, 300, `Work up to one single at RPE ${rpe} - your read on where your max is today; log it.`),
    ex(backOff, 3, 3, { rpe: rpe - 1 }, 180, "Back-off sets: same groove, slower and stricter."),
    ex("chest_supported_row", 3, 10, { rpe: 8 }, 90), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
  ] };
};
// Peak weeks 9-11: 90, 92.5, then 95%.
const OWL_PEAK_SINGLE = [90, 92.5, 95];
const owlSingleDay = (week, blockType) => {
  const pct = blockType === "peak" ? OWL_PEAK_SINGLE[Math.min(2, Math.max(0, week - 9))] : null;
  const load = pct ? { pct } : { rpe: blockType === "volume" ? 7 : 8 };
  const note = pct ? "Your heavy single for the week: make it, then stop." : "Work up to a crisp single at this effort; log it - it tells your coach where your max is.";
  return { title: "Heavy singles", items: [
    ex("snatch", 1, 1, load, 180, note), ex("clean_and_jerk", 1, 1, load, 210, note),
    ex("front_squat", 3, 2, { rpe: 8 }, 180), ex("snatch_pull", 3, 2, { rpe: 8 }, 120)
  ] };
};
const strongmanEventTwo = (week) => {
  const stone = week % 2 === 1 ? "atlas_stone_over_bar" : "atlas_stone_load";
  return { title: "Event day 2 - medley", items: [
    ex(stone, 4, 3, { rpe: 8 }, 150, "The other stone event from day 3: swap in your contest's series once announced."),
    ex(week % 2 === 1 ? "circus_dumbbell_press" : "axle_bar_press", 4, week % 2 === 1 ? 3 : 5, { rpe: 8 }, 150, "The other overhead event from day 1."),
    ex(week % 2 === 1 ? "vehicle_pull" : "conans_wheel_carry", 4, { metres: 20 }, { rpe: 8 }, 150, "Swap in your contest's event once announced."),
    ex("tire_flip", 3, 5, { rpe: 8 }, 120), ex("hercules_hold", 3, { seconds: 30 }, { rpe: 8 }, 90, "Hold for time; work up to a contest-length hold.")
  ] };
};
const streetSingleDay = (week, blockType) => {
  const rpe = blockType === "volume" ? 7 : blockType === "strength" ? 8 : 9;
  const added = "Add weight (belt or vest) to reach this effort, to your federation's standard; log the added weight.";
  return { title: "Heavy singles", items: [
    ex("pull_up", 3, 1, { rpe }, 240, added), ex("dip", 3, 1, { rpe }, 240, added),
    ex("muscle_up", 3, 3, "bw", 120, "Strict and fresh."), ex("band_external_rotation", 2, 15, { rpe: 6 }, 45)
  ] };
};
const hyroxIntervals = (week, blockType) => ({ title: "Race-pace intervals", items: [
  ex("treadmill_run", blockType === "general" ? 4 : 5, { metres: 1000 }, { rpe: 8 }, 90, "Your target race pace for each 1 km, 90 s rest."),
  ex("sled_push", 4, { metres: 25 }, { rpe: 8 }, 120, "Heavier than race weight."), ex("sled_rope_pull", 4, { metres: 25 }, { rpe: 8 }, 120, "Heavier than race weight, hand over hand."),
  ex("ski_erg", 3, { metres: 500 }, { rpe: 8 }, 90)
] });
const crossfitEngine = (week) => ({ title: "Gymnastics volume and long engine", items: [
  ex("muscle_up", 4, 3, "bw", 120, "Bar or rings; strict before kipping."), ex("rope_climb", 3, 1, "bw", 90),
  ...group("amrap", { cap: (week % 4 === 0 ? 15 : 20) * 60 }, [
    ex("rowing_ergometer", 1, { metres: 500 }, { rpe: 7 }, 0), ex("toes_to_bar", 1, 15, "bw", 0), ex("double_under", 1, 50, "bw", 0), ex("thruster", 1, 10, { rpe: 6 }, 0, "Light: sustainable for 20 minutes.")
  ])
] });

const STRENGTH_PRO_VERSIONS = [
  proPrep(powerliftingMeetPrep, "Powerlifting meet prep - pro (12 weeks)", "a fifth day for a heavy single (RPE 7 to 9) with back-off sets, rotating squat, bench and deadlift, and the last peak week at 95%.", plSingleDay, true),
  proPrep(olympicWeightlifting, "Olympic weightlifting meet prep - pro (12 weeks)", "a fifth day of heavy singles in the snatch and clean & jerk - by effort in the build, then 90, 92.5 and 95% in the peak.", owlSingleDay),
  proPrep(strongmanBuild, "Strongman strength and events - pro (12 weeks)", "a second event day - the other stone event, axle clean and press, a vehicle-pull stand-in and tyre - for the event volume a full-time strongman handles.", strongmanEventTwo),
  proPrep(streetLifting, "Street lifting meet prep - pro (12 weeks)", "a fourth day of heavy singles on the weighted pull-up and dip (RPE 7 to 9) with muscle-up practice.", streetSingleDay),
  proPrep(hyroxBuild, "HYROX race build - pro (12 weeks)", "a sixth day of race-pace 1 km intervals and heavy sled push and pull.", hyroxIntervals),
  proPrep(crossfitBuild, "CrossFit strength and conditioning - pro (8 weeks)", "a fifth day of gymnastics volume (muscle-ups, rope climbs) and a long aerobic piece.", crossfitEngine)
];


// ---------------------------------------------------------------------------
// 18. Grip sport - beginner, amateur and pro. Grip contests score attempts on
// grippers, pinch implements, thick and rolling handles and levers, so the
// work is attempt-style - low reps, full rest - on three days (crush and thick
// bar; pinch and support; wrist and lever), waving up to singles, then a
// taper. Tendons adapt slower than muscle: volume stays moderate, efforts are
// capped below a max every week, and every day has a lighter week.
const GRIP_RPE = [7, 7, 8, 6, 8, 8, 9, 6, 8, 9, 9, 6];
const GRIP_REPS = [5, 5, 5, 5, 3, 3, 3, 3, 2, 2, 1, 2];
const attempt = "Attempt-style: full rest, every rep a clean attempt to your contest's standard - stop when one isn't.";
const gripWeek = (week) => {
  const rpe = GRIP_RPE[week - 1];
  const reps = GRIP_REPS[week - 1];
  const lighter = week % 4 === 0 || week === 12;
  const s = (n) => (lighter ? Math.max(2, n - 1) : n);
  const pinchSupport = week % 2 === 1 ? "inch_dumbbell_deadlift" : "vertical_bar_lift";
  return [
    { title: "Crush and thick bar", items: [
      ex("gripper_close", s(5), reps, { rpe }, 120, `${attempt} Set the gripper the same way every time.`),
      ex("axle_deadlift", s(4), Math.max(2, reps), { rpe: Math.min(rpe, 8) }, 180, "Double overhand, no straps."),
      ex("thick_handle_deadlift", s(3), 1, { rpe: Math.min(rpe, 8) }, 150, "Lift and hold 5 s: the holding half of a thick-bar event."),
      ex("hammer_curl", 3, 10, { rpe: 7 }, 60), ex("dead_bug", 2, 8, "bw", 45)
    ] },
    { title: "Pinch and support", items: [
      ex("pinch_block_hold", s(5), reps, { rpe }, 150, attempt), ex("blob_lift", s(4), reps, { rpe }, 150, attempt),
      ex(pinchSupport, s(3), Math.max(2, reps), { rpe: Math.min(rpe, 8) }, 150, attempt),
      ex("towel_hang", 3, { seconds: 30 }, { rpe: 7 }, 90), ex("face_pull", 3, 15, { rpe: 7 }, 45)
    ] },
    { title: "Wrist and lever", items: [
      ex("rolling_handle_lift", s(5), reps, { rpe }, 150, attempt), ex("levering", s(4), Math.max(3, reps), { rpe: Math.min(rpe, 8) }, 120, "Slow up, slower down: wrists and elbows take this load."),
      ex("hub_lift", s(3), reps, { rpe: Math.min(rpe, 8) }, 120, attempt), ex("wrist_roller_roll", 2, 3, { rpe: 7 }, 90),
      ex("pull_up", 3, [5, 8], { rpe: 7 }, 120), ex("side_plank", 2, { seconds: 30 }, "bw", 45)
    ] }
  ];
};
const gripTaper = [
  { title: "Openers - crush and pinch", items: [
    ex("gripper_close", 3, 1, { rpe: 7 }, 180, "Your opener: a close you'd make on a bad day."), ex("pinch_block_hold", 3, 1, { rpe: 7 }, 180, "Your opener."),
    ex("hammer_curl", 2, 10, { rpe: 6 }, 60)
  ] },
  { title: "Openers - wrist and thick bar", items: [
    ex("rolling_handle_lift", 3, 1, { rpe: 7 }, 180, "Your opener."), ex("axle_deadlift", 2, 1, { rpe: 7 }, 180), ex("dead_bug", 2, 8, "bw", 45)
  ] }
];
const gripMeetPrep = {
  key: "grip_sport_meet_prep",
  template_name: "Grip sport meet prep",
  activity_id: "grip_sport",
  description: "Twelve weeks, three days a week, to a grip contest: crush and thick bar, pinch and support, and wrist and lever days, every lift attempt-style at full rest, waving from 5s to 3s to doubles and singles, then a taper week with openers. Efforts never hit a max in training, and every fourth week is lighter - grip tendons adapt slower than muscle.",
  listing: { title: "Grip sport meet prep (12 weeks)", summary: "Three days a week to a grip contest: crush and thick bar, pinch and support, wrist and lever - attempt-style, from 5s to singles, then a taper with openers. Lighter every fourth week to look after your tendons.", levels: ["amateur", "pro"], activity_ids: ["grip_sport"], days_per_week: 3, next: "intermediate_upper_lower" },
  blocks: [
    { name: "Base", block_type: "volume", weeks: [1, 2, 3, 4].map(gripWeek) },
    { name: "Build", block_type: "strength", weeks: [5, 6, 7, 8].map(gripWeek) },
    { name: "Peak", block_type: "peak", weeks: [9, 10, 11].map(gripWeek) },
    { name: "Taper and contest", block_type: "deload", weeks: [gripTaper] }
  ]
};
const gripHeavyAttempts = (week, blockType) => {
  const rpe = blockType === "volume" ? 7 : blockType === "strength" ? 8 : 9;
  return { title: "Heavy attempts", items: [
    ex("gripper_close", 3, 1, { rpe }, 240, `Work up to a heavy close at RPE ${rpe}; log it.`), ex("pinch_block_hold", 3, 1, { rpe }, 240, "Heavy single attempts; log the weight."),
    ex("rolling_handle_lift", 3, 1, { rpe }, 240, "Heavy single attempts; log the weight."), ex("block_weight_pinch", 3, 1, { rpe: Math.min(rpe, 8) }, 180, attempt)
  ] };
};
const gripBeginnerWeek = (week) => {
  const pct = BEGINNER_PCT[week - 1];
  const s = beginnerS(week);
  return [
    { title: "Pull and crush", items: [
      ex("trap_bar_deadlift", 3, 5, { pct }, 180, "No straps: let your grip work."), ex("dumbbell_crush_grip_hold", s(3), { seconds: 20 }, { rpe: 6 }, 60),
      ex("gripper_close", s(3), 8, { rpe: 6 }, 90, "A light gripper you can close for 8: learn the set."), ex("hammer_curl", 2, 10, { rpe: 7 }, 60)
    ] },
    { title: "Press and pinch", items: [
      ex("overhead_press", 3, 5, { pct }, 150), ex("plate_pinch", s(3), 3, { rpe: 6 }, 90, "Two light plates, smooth sides out: lift and hold 5 s."),
      ex("dumbbell_static_hold", s(3), { seconds: 20 }, { rpe: 6 }, 60), ex("face_pull", 2, 15, { rpe: 7 }, 45)
    ] },
    { title: "Pull-up and wrist", items: [
      ex("band_assisted_pull_up", s(3), 6, "bw", 90), ex("dumbbell_wrist_curl", 2, 15, { rpe: 6 }, 45), ex("dumbbell_wrist_extension", 2, 15, { rpe: 6 }, 45),
      ex("wrist_roller_roll", 2, 2, { rpe: 6 }, 90), ex("dead_bug", 2, 8, "bw", 45)
    ] }
  ];
};
const gripBeginner = {
  key: "beginner_grip_sport_foundation",
  template_name: "Grip sport foundation (beginner)",
  activity_id: "grip_sport",
  description: "Twelve weeks, three days a week, for new grip athletes: deadlifts without straps, presses and pull-ups, adding weight whenever every rep is made, and light crush, pinch, support and wrist work at RPE 6 - building the tendons before any heavy attempts.",
  listing: { title: "Grip sport foundation (beginner, 12 weeks)", summary: "New to grip sport? Three days a week: strap-free deadlifts, presses and pull-ups, plus light gripper, pinch, hold and wrist work to build your tendons before heavy attempts.", levels: ["beginner"], activity_ids: ["grip_sport"], days_per_week: 3, next: "grip_sport_meet_prep" },
  blocks: [{ name: "Foundation", block_type: "general", weeks: Array.from({ length: 12 }, (_, i) => gripBeginnerWeek(i + 1)) }]
};
// The pro heavy-attempts day replaces volume rather than adding to it: every
// attempt item on the three main days loses a set, so the week's hand and
// forearm load stays where finger and elbow tendons can take it.
const gripProBase = proPrep(gripMeetPrep, "Grip sport meet prep - pro (12 weeks)", "a fourth day of heavy single attempts on the gripper, pinch block, rolling handle and block weight (RPE 7 to 9), with a set less on the attempt work of the other three days so the weekly load on the hands doesn't simply stack.", gripHeavyAttempts);
const gripPro = { ...gripProBase, blocks: gripProBase.blocks.map((block) => block.block_type === "deload" ? block : ({
  ...block,
  weeks: block.weeks.map((week) => week.map((session) => session.title === "Heavy attempts" ? session : ({
    ...session,
    items: session.items.map((item) => (/Attempt-style|Set the gripper/u.test(item.note ?? "") ? { ...item, sets: Math.max(2, item.sets - 1) } : item))
  })))
})) };
const GRIP_PROGRAMMES = [gripBeginner, gripMeetPrep, gripPro];

export const PROGRAMMES = [
  beginnerFullBody, intermediateUpperLower, powerliftingMeetPrep,
  collisionForwardsOffSeason, collisionBacksOffSeason, collisionInSeason, fieldIceOffSeason, fieldIceInSeason, courtOffSeason, courtInSeason,
  enduranceRunRide, triathlonStrength, enduranceSwimRowPaddle, enduranceInSeason, combatBuild, fightCamp, tennisOffSeason, tennisInSeason,
  cricketOffSeason, cricketFastBowler, cricketInSeason, athleticsPowerBuild, athleticsThrows, athleticsSeason,
  strongmanBuild, streetLifting, hyroxBuild, crossfitBuild, olympicWeightlifting,
  ...PRO_VERSIONS,
  contactBeginner, fieldBeginner, owlBeginner, streetBeginner, cfBeginner, hyroxBeginner,
  ...STRENGTH_PRO_VERSIONS,
  ...GRIP_PROGRAMMES
];
