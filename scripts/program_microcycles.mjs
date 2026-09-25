// DEV NOTE: Repository automation data. The amateur training week (microcycle) for every
// sport, consumed by scripts/generate_program_level_variants.mjs, which derives the
// beginner and pro weeks from it. Days are in priority order: a two-session week
// (in-season, taper, transition) trains the first two; one session a week trains the
// sport's full-body base session instead.
//
// Item format: "<exercise_id> <sets>x<reps|Nm|Ns> @<N%|rpeN|bw> r<rest seconds> [g=<id>:<type>:<cap seconds>]"
//   e.g. "back_squat 5x3 @80% r180", "yoke_walk 4x20m @rpe8 r180", "pull_up 1x5 @bw r0 g=metcon:amrap:720"

// Collision sports: lower-body power, upper-body strength, full-body power.
// Neck work twice a week; hamstring (Nordic) and adductor resilience.
const COLLISION = (neck, carry) => [
  ["a", "lower_body_power", [
    "countermovement_jump 4x3 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90",
    "nordic_curl 3x4 @bw r90", neck, "pallof_press 3x10 @rpe7 r60"]],
  ["b", "upper_body_strength", [
    "bench_press 4x5 @78% r150", "chin_up 4x6 @rpe8 r120", "landmine_press 3x6 @rpe8 r90",
    "chest_supported_row 3x8 @rpe8 r90", neck, carry]],
  ["c", "full_body_power", [
    "broad_jump_to_stick 4x3 @bw r90", "front_squat 4x4 @75% r150", "medicine_ball_chest_pass 3x5 @bw r60",
    "romanian_deadlift 3x6 @rpe7 r120", "single_arm_dumbbell_row 3x8 @rpe8 r90", "side_plank 3x30s @rpe7 r60"]]
];

// Field and court sports: lower-body power, upper-body strength with shoulder care,
// unilateral resilience (deceleration, single leg, adductors, calves).
const FIELD = (power, decel, extraUpper) => [
  ["a", "lower_body_power", [
    power, "trap_bar_deadlift 4x4 @78% r180", "bulgarian_split_squat 3x6 @rpe8 r90",
    "nordic_curl 3x4 @bw r90", "single_leg_calf_raise 3x12 @rpe8 r60", "pallof_press 3x10 @rpe7 r60"]],
  ["b", "upper_body_strength", [
    "dumbbell_bench_press 4x6 @rpe8 r120", "chin_up 4x6 @rpe8 r120", "single_arm_dumbbell_row 3x8 @rpe8 r90",
    "half_kneeling_dumbbell_angled_press 3x8 @rpe7 r90", extraUpper, "dead_bug 3x8 @rpe7 r60"]],
  ["c", "unilateral_resilience", [
    decel, "split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90",
    "lateral_lunge 3x8 @rpe7 r90", "cable_hip_adduction 3x10 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]]
];

// Endurance sports: two minimum-effective-dose strength sessions; a third day
// repeats the first. Low volume, heavy enough to matter, no hypertrophy chasing.
const ENDURANCE = (a, b) => [["a", "strength", a], ["b", "strength_endurance_resilience", b]];

// Combat sports: lower-body power, pulling and grip, full-body power and bracing.
const COMBAT = (power, rotational) => [
  ["a", "lower_body_power", [
    power, "trap_bar_deadlift 4x4 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90",
    "self_resisted_neck_isometric 3x4 @rpe6 r60", "nordic_curl 3x4 @bw r90", "pallof_press 3x10 @rpe7 r60"]],
  ["b", "pulling_and_grip", [
    "chin_up 4x5 @rpe8 r120", "pendlay_row 4x5 @75% r120", "landmine_press 3x6 @rpe8 r90",
    "self_resisted_neck_isometric 3x4 @rpe6 r60", "trap_bar_static_hold 3x20s @rpe8 r90", "face_pull 3x12 @rpe7 r60"]],
  ["c", "full_body_power", [
    rotational, "front_squat 4x4 @72% r150", "medicine_ball_chest_pass 3x5 @bw r60",
    "single_leg_rdl 3x6 @rpe7 r90", "front_rack_carry 3x30m @rpe8 r90", "side_plank 3x30s @rpe7 r60"]]
];

export const MICROCYCLES = {
  // --- Strength sports (hand-tuned; levels derived with strength rules) ---
  powerlifting: [
    ["squat", "squat_day", ["back_squat 5x3 @80% r210", "paused_bench_press 4x4 @72% r150", "paused_back_squat 3x3 @68% r150", "barbell_row 3x8 @rpe8 r90", "cable_crunch 3x12 @rpe8 r60"]],
    ["bench", "bench_day", ["paused_bench_press 5x3 @80% r180", "close_grip_bench_press 3x6 @72% r120", "romanian_deadlift 3x6 @rpe7 r120", "chest_supported_row 4x8 @rpe8 r90", "cable_triceps_pressdown 3x12 @rpe8 r60", "face_pull 3x15 @rpe7 r60"]],
    ["deadlift", "deadlift_day", ["deadlift 4x3 @82% r240", "spoto_press 4x5 @70% r150", "front_squat 3x5 @65% r150", "pull_up 3x6 @rpe8 r120", "back_extension 3x12 @rpe7 r60"]]
  ],
  olympic_weightlifting: [
    ["snatch", "snatch_day", ["snatch 6x2 @75% r150", "snatch_grip_deadlift 4x3 @90% r150", "front_squat 4x3 @75% r180", "back_extension 3x10 @rpe7 r60"]],
    ["clean_jerk", "clean_and_jerk_day", ["power_clean 5x2 @78% r150", "push_jerk 5x2 @75% r150", "back_squat 4x4 @75% r180", "pull_up 3x6 @rpe7 r90"]],
    ["strength", "strength_day", ["back_squat 5x3 @80% r180", "snatch_grip_deadlift 3x3 @85% r150", "overhead_press 4x5 @70% r120", "pendlay_row 3x6 @rpe7 r90", "dead_bug 3x8 @rpe7 r60"]]
  ],
  strongman: [
    ["static", "static_strength", ["deadlift 5x3 @80% r210", "strongman_log_press 5x3 @78% r180", "zercher_squat 3x5 @70% r150", "barbell_row 3x8 @rpe8 r90"]],
    ["events", "event_day", ["yoke_walk 5x20m @rpe8 r180", "farmers_carry 4x30m @rpe8 r150", "sandbag_carry 3x30m @rpe8 r150", "axle_bar_press 4x5 @rpe8 r150", "back_extension 3x12 @rpe7 r60"]],
    ["volume", "volume_strength", ["front_squat 4x5 @72% r150", "romanian_deadlift 4x6 @rpe8 r120", "overhead_press 4x6 @70% r120", "chin_up 3x8 @rpe8 r90", "farmers_carry 3x30m @rpe7 r120"]]
  ],
  street_lifting: [
    ["pull", "pull_up_day", ["pull_up 6x2 @rpe8 r210", "barbell_row 4x6 @rpe8 r120", "front_squat 3x5 @70% r150", "dumbbell_curl 3x10 @rpe8 r60", "face_pull 3x15 @rpe7 r60"]],
    ["dip", "dip_day", ["dip 6x2 @rpe8 r210", "close_grip_bench_press 4x5 @75% r150", "romanian_deadlift 3x6 @rpe7 r120", "overhead_cable_triceps_extension 3x12 @rpe8 r60", "dead_bug 3x8 @rpe7 r60"]],
    ["squat", "squat_and_volume", ["back_squat 5x3 @80% r180", "pull_up 4x5 @rpe7 r150", "dip 4x5 @rpe7 r150", "single_arm_dumbbell_row 3x10 @rpe8 r90"]]
  ],
  general_strength: [
    ["lower", "lower_body", ["goblet_squat 4x8 @rpe7 r120", "romanian_deadlift 3x8 @rpe7 r120", "reverse_lunge 3x8 @rpe7 r90", "glute_bridge 3x12 @rpe7 r60", "dead_bug 3x8 @rpe6 r60"]],
    ["upper", "upper_body", ["dumbbell_bench_press 3x8 @rpe7 r120", "single_arm_dumbbell_row 3x10 @rpe7 r90", "dumbbell_overhead_press 3x8 @rpe7 r90", "lat_pulldown 3x10 @rpe7 r90", "face_pull 3x12 @rpe7 r60"]],
    ["full", "full_body", ["trap_bar_deadlift 3x5 @rpe7 r150", "push_up 3x10 @rpe7 r90", "split_squat 3x8 @rpe7 r90", "seated_cable_row 3x10 @rpe7 r90", "farmers_carry 3x30m @rpe7 r90", "side_plank 3x30s @rpe6 r60"]]
  ],

  // --- Hybrid ---
  hyrox: [
    ["strength", "strength_and_sleds", ["trap_bar_deadlift 4x5 @rpe8 r150", "sled_push 4x25m @rpe8 r120", "walking_lunge 3x12 @rpe8 r90", "single_arm_dumbbell_row 3x10 @rpe7 r90", "front_plank 3x45s @rpe7 r60"]],
    ["stations", "station_strength_endurance", ["wall_ball 4x20 @rpe8 r90", "sled_drag 4x25m @rpe8 r120", "sandbag_lunge 3x20 @rpe8 r90", "burpee_broad_jump 3x10 @rpe8 r90", "farmers_carry 3x50m @rpe8 r90"]],
    ["compromised", "compromised_running", ["tempo_run 4x1000m @rpe7 r60", "wall_ball 4x15 @rpe8 r60", "rowing_ergometer 3x500m @rpe8 r90", "ski_erg 3x500m @rpe8 r90"]]
  ],
  crossfit: [
    ["strength_metcon", "strength_and_metcon", ["power_clean 5x3 @75% r150", "pull_up 1x5 @bw r0 g=metcon:amrap:720", "burpee 1x10 @bw r0 g=metcon:amrap:720", "air_squat 1x15 @bw r0 g=metcon:amrap:720", "toes_to_bar 3x10 @rpe7 r60", "double_under 3x50 @rpe7 r60"]],
    ["lifting", "olympic_lifting_and_gymnastics", ["snatch 5x2 @72% r150", "front_squat 4x4 @75% r150", "handstand_push_up 4x5 @rpe8 r120", "chest_supported_row 3x10 @rpe7 r90", "front_plank 3x45s @rpe7 r60"]],
    ["engine", "engine_and_strength", ["back_squat 5x5 @75% r180", "rowing_ergometer 1x500m @bw r0 g=chipper:for_time:900", "thruster 1x15 @bw r0 g=chipper:for_time:900", "pull_up 1x15 @bw r0 g=chipper:for_time:900", "kettlebell_swing 3x15 @rpe7 r60"]]
  ],

  // --- Collision sports ---
  rugby_union: COLLISION("self_resisted_neck_isometric 3x4 @rpe6 r60", "front_rack_carry 3x30m @rpe8 r90"),
  rugby_league: COLLISION("self_resisted_neck_isometric 3x4 @rpe6 r60", "front_rack_carry 3x30m @rpe8 r90"),
  american_football: COLLISION("self_resisted_neck_isometric 3x4 @rpe6 r60", "farmers_carry 3x30m @rpe8 r90"),
  ice_hockey: [
    ["a", "lower_body_power", ["lateral_bound 4x4 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90", "cable_hip_adduction 3x10 @rpe7 r60", "self_resisted_neck_isometric 3x4 @rpe6 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "upper_body_strength", ["bench_press 4x5 @78% r150", "chin_up 4x6 @rpe8 r120", "chest_supported_row 3x8 @rpe8 r90", "landmine_press 3x6 @rpe8 r90", "self_resisted_neck_isometric 3x4 @rpe6 r60", "lateral_sled_drag 3x20m @rpe7 r90"]],
    ["c", "full_body_power", ["broad_jump_to_stick 4x3 @bw r90", "front_squat 4x4 @75% r150", "lateral_lunge 3x8 @rpe7 r90", "nordic_curl 3x4 @bw r90", "single_arm_dumbbell_row 3x8 @rpe8 r90", "side_plank 3x30s @rpe7 r60"]]
  ],
  rugby_sevens: [
    ["a", "speed_and_lower_power", ["ten_metre_acceleration 6x10m @bw r120", "flying_twenty_sprint 4x20m @bw r180", "trap_bar_deadlift 3x3 @80% r180", "split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", "self_resisted_neck_isometric 3x4 @rpe6 r60"]],
    ["b", "upper_body_strength", ["bench_press 4x5 @75% r150", "chin_up 4x6 @rpe8 r120", "chest_supported_row 3x8 @rpe8 r90", "landmine_press 3x6 @rpe7 r90", "self_resisted_neck_isometric 3x4 @rpe6 r60", "front_rack_carry 3x30m @rpe7 r90"]],
    ["c", "unilateral_resilience", ["sprint_to_stick 4x3 @bw r90", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90", "cable_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]]
  ],

  // --- Field and court sports ---
  football_soccer: FIELD("countermovement_jump 3x5 @bw r90", "ten_metre_deceleration 4x3 @bw r90", "face_pull 3x12 @rpe7 r60"),
  field_hockey: FIELD("ten_metre_acceleration 5x10m @bw r120", "lateral_deceleration 4x3 @bw r90", "face_pull 3x12 @rpe7 r60"),
  netball: FIELD("vertical_jump_to_stick 4x3 @bw r90", "drop_to_stick 4x3 @bw r90", "cable_external_rotation 3x12 @rpe7 r60"),
  basketball: FIELD("countermovement_jump 4x3 @bw r90", "drop_to_stick 3x3 @bw r90", "face_pull 3x12 @rpe7 r60"),
  volleyball: FIELD("countermovement_jump 4x3 @bw r90", "drop_to_stick 3x3 @bw r90", "cable_external_rotation 3x12 @rpe7 r60"),
  cricket: FIELD("medicine_ball_rotational_throw 4x4 @bw r90", "ten_metre_deceleration 3x3 @bw r90", "cable_external_rotation 3x12 @rpe7 r60"),
  tennis: FIELD("medicine_ball_rotational_throw 4x4 @bw r90", "lateral_deceleration 4x3 @bw r90", "cable_external_rotation 3x12 @rpe7 r60"),

  // --- Endurance sports ---
  athletics: ENDURANCE(
    ["falling_start_sprint 5x20m @bw r150", "trap_bar_deadlift 4x3 @80% r180", "bulgarian_split_squat 3x5 @rpe8 r90", "nordic_curl 3x4 @bw r90", "single_leg_calf_raise 3x10 @rpe8 r60"],
    ["pogo_jump 3x10 @bw r60", "front_squat 3x4 @75% r150", "single_leg_rdl 3x6 @rpe7 r90", "barbell_hip_thrust 3x6 @rpe8 r90", "side_plank 3x30s @rpe7 r60"]),
  swimming: ENDURANCE(
    ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 3x4 @78% r180", "chin_up 3x6 @rpe8 r120", "split_squat 3x6 @rpe7 r90", "cable_external_rotation 3x12 @rpe7 r60"],
    ["pull_up 3x5 @rpe8 r120", "dumbbell_bench_press 3x6 @rpe7 r120", "single_leg_rdl 3x6 @rpe7 r90", "face_pull 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]),
  cycling: ENDURANCE(
    ["squat_jump 3x4 @bw r90", "trap_bar_deadlift 4x4 @78% r180", "bulgarian_split_squat 3x6 @rpe8 r90", "pallof_press 3x10 @rpe7 r60"],
    ["back_squat 3x5 @75% r180", "single_leg_rdl 3x6 @rpe7 r90", "box_step_up 3x8 @rpe7 r90", "single_leg_calf_raise 3x12 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]),
  rowing: ENDURANCE(
    ["backward_overhead_medicine_ball_throw 4x3 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "chest_supported_row 3x8 @rpe8 r90", "split_squat 3x6 @rpe7 r90", "pallof_press 3x10 @rpe7 r60"],
    ["front_squat 3x5 @72% r150", "romanian_deadlift 3x6 @rpe7 r120", "pull_up 3x6 @rpe8 r120", "back_extension 3x10 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]),
  kayaking: ENDURANCE(
    ["rotational_medicine_ball_throw 4x4 @bw r90", "chin_up 4x5 @rpe8 r120", "pendlay_row 4x5 @75% r120", "trap_bar_deadlift 3x5 @75% r150", "half_kneeling_pallof_press 3x10 @rpe7 r60"],
    ["pull_up 3x6 @rpe8 r120", "dumbbell_bench_press 3x6 @rpe7 r120", "single_arm_dumbbell_row 3x8 @rpe8 r90", "cable_external_rotation 3x12 @rpe7 r60", "cable_woodchop 3x10 @rpe7 r60"]),
  triathlon: ENDURANCE(
    ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 3x4 @78% r180", "bulgarian_split_squat 3x6 @rpe7 r90", "single_leg_calf_raise 3x12 @rpe7 r60", "face_pull 3x12 @rpe7 r60"],
    ["chin_up 3x5 @rpe8 r120", "split_squat 3x6 @rpe7 r90", "single_leg_rdl 3x6 @rpe7 r90", "cable_external_rotation 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]),

  // --- Combat sports ---
  boxing: COMBAT("lateral_bound 3x4 @bw r90", "rotational_medicine_ball_throw 4x4 @bw r90"),
  muay_thai: COMBAT("countermovement_jump 3x3 @bw r90", "rotational_medicine_ball_throw 4x4 @bw r90"),
  mma: COMBAT("broad_jump_to_stick 4x3 @bw r90", "rotational_medicine_ball_throw 3x4 @bw r60"),
  wrestling: COMBAT("broad_jump_to_stick 4x3 @bw r90", "medicine_ball_scoop_toss 4x4 @bw r90"),
  judo: COMBAT("broad_jump_to_stick 4x3 @bw r90", "rotational_medicine_ball_throw 4x4 @bw r90"),
  brazilian_jiu_jitsu: COMBAT("countermovement_jump 3x3 @bw r90", "medicine_ball_scoop_toss 4x4 @bw r90")
};

// Powerlifting competition events (hand-tuned weeks).
export const EVENT_MICROCYCLES = {
  powerlifting: {
    bench_only: [
      ["heavy", "heavy_bench", ["paused_bench_press 5x3 @80% r180", "pin_press 3x3 @rpe8 r150", "barbell_row 4x8 @rpe8 r90", "overhead_cable_triceps_extension 3x12 @rpe8 r60", "face_pull 3x15 @rpe7 r60"]],
      ["volume", "volume_bench", ["spoto_press 5x5 @70% r150", "close_grip_bench_press 4x6 @70% r120", "chest_supported_row 4x10 @rpe8 r90", "dumbbell_lateral_raise 3x15 @rpe8 r60", "cable_triceps_pressdown 3x12 @rpe8 r60"]],
      ["support", "legs_and_upper_back", ["paused_bench_press 4x4 @72% r150", "back_squat 3x5 @rpe6 r150", "romanian_deadlift 3x8 @rpe6 r120", "pull_up 3x8 @rpe8 r90", "dumbbell_curl 3x12 @rpe8 r60"]]
    ],
    deadlift_only: [
      ["heavy", "heavy_pull", ["deadlift 4x3 @82% r240", "paused_deadlift 3x3 @70% r180", "barbell_row 4x8 @rpe8 r90", "barbell_static_hold 3x20s @rpe8 r90", "back_extension 3x12 @rpe7 r60"]],
      ["variation", "pull_variation_and_squat", ["deficit_deadlift 4x4 @70% r180", "back_squat 4x5 @72% r150", "pull_up 3x8 @rpe8 r90", "reverse_hyper 3x12 @rpe7 r60"]],
      ["support", "posterior_chain_and_upper", ["romanian_deadlift 4x6 @rpe8 r120", "bench_press 3x6 @rpe7 r120", "chest_supported_row 3x10 @rpe8 r90", "farmers_carry 3x30m @rpe8 r90", "cable_crunch 3x12 @rpe8 r60"]]
    ],
    push_pull: [
      ["bench_heavy", "heavy_bench", ["paused_bench_press 5x3 @80% r180", "paused_deadlift 3x3 @68% r180", "close_grip_bench_press 3x6 @70% r120", "barbell_row 4x8 @rpe8 r90", "cable_triceps_pressdown 3x12 @rpe8 r60"]],
      ["deadlift_heavy", "heavy_deadlift", ["deadlift 4x3 @82% r240", "spoto_press 4x5 @70% r150", "back_squat 3x5 @68% r150", "pull_up 3x8 @rpe8 r90", "back_extension 3x12 @rpe7 r60"]],
      ["volume", "volume_and_support", ["bench_press 4x6 @72% r150", "romanian_deadlift 3x8 @rpe7 r120", "chest_supported_row 4x10 @rpe8 r90", "face_pull 3x15 @rpe7 r60"]]
    ],
    squat_only: [
      ["heavy", "heavy_squat", ["back_squat 5x3 @80% r210", "paused_back_squat 3x3 @68% r180", "barbell_row 3x8 @rpe8 r90", "cable_crunch 3x12 @rpe8 r60"]],
      ["variation", "squat_variation_and_hinge", ["pin_squat 4x4 @70% r180", "romanian_deadlift 4x6 @rpe7 r120", "bench_press 3x6 @rpe7 r120", "back_extension 3x12 @rpe7 r60"]],
      ["volume", "volume_squat", ["back_squat 4x6 @70% r180", "bulgarian_split_squat 3x8 @rpe8 r90", "pull_up 3x8 @rpe8 r90", "front_plank 3x45s @rpe7 r60"]]
    ]
  }
};
