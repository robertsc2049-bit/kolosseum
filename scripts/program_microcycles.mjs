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

// Endurance sports: two minimum-effective-dose strength sessions; a third day
// repeats the first. Low volume, heavy enough to matter, no hypertrophy chasing.
const ENDURANCE = (a, b) => [["a", "strength", a], ["b", "strength_endurance_resilience", b]];

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
  // Union: the breakdown, scrum and lineout - neck in every plane and overhead
  // strength. League keeps the shared collision week.
  rugby_union: [
    ["a", "lower_body_power", ["countermovement_jump 4x3 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", "neck_flexion_isometric 3x4 @rpe6 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "upper_body_strength", ["bench_press 4x5 @78% r150", "chin_up 4x6 @rpe8 r120", "overhead_press 3x6 @rpe8 r120", "chest_supported_row 3x8 @rpe8 r90", "neck_extension_isometric 3x4 @rpe6 r60", "front_rack_carry 3x30m @rpe8 r90"]],
    ["c", "full_body_power", ["broad_jump_to_stick 4x3 @bw r90", "front_squat 4x4 @75% r150", "medicine_ball_chest_pass 3x5 @bw r60", "romanian_deadlift 3x6 @rpe7 r120", "neck_lateral_flexion_isometric 3x4 @rpe6 r60", "side_plank 3x30s @rpe7 r60"]]
  ],
  rugby_league: COLLISION("self_resisted_neck_isometric 3x4 @rpe6 r60", "front_rack_carry 3x30m @rpe8 r90"),
  // American football: short bursts off the line, traditional max strength and
  // power, hamstrings, the neck, change of direction - not rugby's continuous play.
  american_football: [
    ["a", "speed_and_lower_body_power", ["ten_metre_acceleration 5x10m @bw r120", "countermovement_jump 3x3 @bw r90", "back_squat 4x4 @80% r180", "romanian_deadlift 3x6 @rpe7 r120", "nordic_curl 3x4 @bw r90", "self_resisted_neck_isometric 3x4 @rpe6 r60"]],
    ["b", "upper_body_strength_and_power", ["bench_press 5x4 @80% r150", "medicine_ball_chest_pass 3x5 @bw r60", "pull_up 4x5 @rpe8 r120", "dumbbell_overhead_press 3x6 @rpe8 r90", "single_arm_dumbbell_row 3x8 @rpe8 r90", "neck_extension_isometric 3x4 @rpe6 r60"]],
    ["c", "change_of_direction_and_hips", ["lateral_deceleration 4x3 @bw r90", "barbell_hip_thrust 3x6 @rpe8 r90", "bulgarian_split_squat 3x6 @rpe8 r90", "cable_hip_adduction 3x10 @rpe7 r60", "sled_push 3x15m @rpe8 r120", "self_resisted_neck_isometric 3x4 @rpe6 r60"]]
  ],
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
  football_soccer: [
    ["a", "speed_and_lower_body_power", ["ten_metre_acceleration 5x10m @bw r120", "flying_twenty_sprint 3x20m @bw r180", "trap_bar_deadlift 3x4 @78% r180", "nordic_curl 3x4 @bw r90", "cable_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60"]],
    ["b", "upper_body_and_trunk", ["chin_up 3x6 @rpe8 r120", "dumbbell_bench_press 3x8 @rpe7 r90", "single_arm_dumbbell_row 3x8 @rpe8 r90", "pallof_press 3x10 @rpe7 r60", "dead_bug 3x8 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]],
    ["c", "kicking_and_change_of_direction", ["countermovement_jump 3x5 @bw r90", "ten_metre_deceleration 4x3 @bw r90", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90", "cable_hip_flexion 3x10 @rpe7 r60", "lateral_lunge 3x8 @rpe7 r90"]]
  ],
  field_hockey: [
    ["a", "speed_and_lower_body_power", ["ten_metre_acceleration 5x10m @bw r120", "trap_bar_deadlift 4x4 @78% r180", "forward_lunge 3x8 @rpe7 r90", "nordic_curl 3x4 @bw r90", "cable_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60"]],
    ["b", "upper_body_and_stick_handling", ["medicine_ball_rotational_throw 4x4 @bw r90", "single_arm_dumbbell_row 3x8 @rpe8 r90", "half_kneeling_dumbbell_angled_press 3x8 @rpe7 r90", "dumbbell_wrist_extension 3x12 @rpe7 r60", "dumbbell_wrist_curl 3x12 @rpe7 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["c", "low_posture_endurance", ["lateral_deceleration 4x3 @bw r90", "goblet_squat 3x10 @rpe7 r90", "romanian_deadlift 3x8 @rpe7 r120", "back_extension 3x12 @rpe7 r60", "lateral_lunge 3x8 @rpe7 r90", "side_plank 3x30s @rpe7 r60"]]
  ],
  netball: [
    ["a", "lower_body_landing_and_jump", ["drop_to_stick 4x3 @bw r90", "vertical_jump_to_stick 4x3 @bw r90", "trap_bar_deadlift 3x4 @75% r180", "nordic_curl 3x4 @bw r90", "single_leg_calf_raise 3x12 @rpe8 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "upper_body_and_passing", ["medicine_ball_chest_pass 4x5 @bw r60", "dumbbell_bench_press 3x8 @rpe7 r90", "chin_up 3x6 @rpe8 r120", "single_arm_dumbbell_row 3x8 @rpe8 r90", "cable_external_rotation 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]],
    ["c", "deceleration_and_single_leg", ["lateral_deceleration 4x3 @bw r90", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90", "lateral_lunge 3x8 @rpe7 r90", "cable_hip_abduction 3x12 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]]
  ],
  basketball: [
    ["a", "lower_body_vertical_power", ["countermovement_jump 4x3 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "split_squat 3x6 @rpe8 r90", "barbell_hip_thrust 3x6 @rpe8 r90", "single_leg_calf_raise 3x12 @rpe8 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "contact_upper_body_strength", ["dumbbell_bench_press 4x6 @rpe8 r120", "chin_up 4x6 @rpe8 r120", "landmine_press 3x6 @rpe8 r90", "chest_supported_row 3x8 @rpe8 r90", "face_pull 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]],
    ["c", "landing_and_change_of_direction", ["drop_to_stick 3x3 @bw r90", "lateral_deceleration 4x3 @bw r90", "single_leg_rdl 3x6 @rpe7 r90", "lateral_lunge 3x8 @rpe7 r90", "cable_hip_abduction 3x12 @rpe7 r60", "seated_calf_raise 3x12 @rpe8 r60"]]
  ],
  volleyball: [
    ["a", "lower_body_jump_power", ["countermovement_jump 4x3 @bw r90", "front_squat 3x4 @72% r150", "romanian_deadlift 3x6 @rpe7 r120", "split_squat 3x6 @rpe8 r90", "single_leg_calf_raise 3x12 @rpe8 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "upper_body_and_spiking_shoulder", ["overhead_medicine_ball_slam 3x5 @bw r60", "half_kneeling_dumbbell_angled_press 3x8 @rpe7 r90", "chin_up 3x6 @rpe8 r120", "cable_external_rotation 3x12 @rpe7 r60", "face_pull 3x15 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]],
    ["c", "landing_and_single_leg", ["drop_to_stick 3x3 @bw r90", "box_step_up 3x8 @rpe7 r90", "single_leg_rdl 3x6 @rpe7 r90", "cable_hip_adduction 3x10 @rpe7 r60", "seated_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]]
  ],
  cricket: [
    ["a", "acceleration_and_lower_strength", ["ten_metre_acceleration 5x10m @bw r120", "trap_bar_deadlift 4x4 @78% r180", "split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", "single_leg_calf_raise 3x12 @rpe8 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "upper_body_rotation_and_throwing_shoulder", ["medicine_ball_rotational_throw 4x4 @bw r90", "landmine_press 3x6 @rpe8 r90", "single_arm_dumbbell_row 3x8 @rpe8 r90", "cable_external_rotation 3x12 @rpe7 r60", "barbell_reverse_wrist_curl 3x12 @rpe7 r60", "face_pull 3x12 @rpe7 r60"]],
    ["c", "squat_endurance_and_trunk", ["ten_metre_deceleration 3x3 @bw r90", "goblet_squat 3x10 @rpe7 r90", "single_leg_rdl 3x6 @rpe7 r90", "lateral_lunge 3x8 @rpe7 r90", "cable_woodchop 3x8 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]]
  ],
  tennis: [
    ["a", "lower_body_lateral_power", ["lateral_bound 3x4 @bw r90", "lateral_deceleration 4x3 @bw r90", "trap_bar_deadlift 3x4 @75% r180", "lateral_lunge 3x8 @rpe7 r90", "cable_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60"]],
    ["b", "upper_body_shoulder_and_forearm", ["medicine_ball_rotational_throw 4x4 @bw r90", "single_arm_dumbbell_row 3x8 @rpe8 r90", "half_kneeling_dumbbell_angled_press 3x8 @rpe7 r90", "cable_external_rotation 3x12 @rpe7 r60", "dumbbell_wrist_extension 3x12 @rpe7 r60", "face_pull 3x15 @rpe7 r60"]],
    ["c", "single_leg_and_trunk", ["countermovement_jump 3x3 @bw r90", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90", "cable_woodchop 3x8 @rpe7 r60", "pallof_press 3x10 @rpe7 r60", "side_plank 3x30s @rpe7 r60"]]
  ],

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
  // Triathlon: the run and the bike carry most of the load - calves and
  // Achilles, single-leg and hip stability, step-ups - with pulling for the swim.
  triathlon: ENDURANCE(
    ["pogo_jump 2x10 @bw r60", "trap_bar_deadlift 3x4 @78% r180", "bulgarian_split_squat 3x6 @rpe7 r90", "single_leg_calf_raise 3x12 @rpe8 r60", "pallof_press 3x10 @rpe7 r60"],
    ["box_step_up 3x8 @rpe7 r90", "single_leg_rdl 3x6 @rpe7 r90", "seated_calf_raise 3x12 @rpe8 r60", "cable_hip_abduction 3x12 @rpe7 r60", "pull_up 3x5 @rpe8 r120"]),

  // --- Combat sports ---
  boxing: [
    ["a", "lower_body_power_and_footwork", ["lateral_bound 3x4 @bw r90", "trap_bar_deadlift 4x4 @78% r180", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_calf_raise 3x12 @rpe8 r60", "self_resisted_neck_isometric 3x4 @rpe6 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "punching_power_and_shoulders", ["medicine_ball_chest_pass 4x5 @bw r60", "landmine_press 4x5 @rpe8 r90", "chin_up 3x6 @rpe8 r120", "single_arm_dumbbell_row 3x8 @rpe8 r90", "cable_external_rotation 3x12 @rpe7 r60", "face_pull 3x15 @rpe7 r60"]],
    ["c", "rotational_power", ["rotational_medicine_ball_throw 4x4 @bw r90", "front_squat 3x4 @72% r150", "single_leg_rdl 3x6 @rpe7 r90", "cable_woodchop 3x8 @rpe7 r60", "self_resisted_neck_isometric 3x4 @rpe6 r60", "side_plank 3x30s @rpe7 r60"]]
  ],
  muay_thai: [
    ["a", "kicking_power", ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 4x4 @78% r180", "single_leg_rdl 3x6 @rpe7 r90", "cable_hip_flexion 3x10 @rpe7 r60", "cable_hip_adduction 3x10 @rpe7 r60", "band_tibialis_raise 3x15 @rpe7 r60"]],
    ["b", "clinch_and_upper_body", ["chin_up 4x5 @rpe8 r120", "pendlay_row 3x6 @75% r120", "landmine_press 3x6 @rpe8 r90", "self_resisted_neck_isometric 4x4 @rpe7 r60", "farmers_carry 3x30m @rpe8 r90", "face_pull 3x12 @rpe7 r60"]],
    ["c", "rotational_power_and_balance", ["rotational_medicine_ball_throw 4x4 @bw r90", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_calf_raise 3x12 @rpe8 r60", "medicine_ball_chest_pass 3x5 @bw r60", "self_resisted_neck_isometric 3x4 @rpe6 r60", "side_plank 3x30s @rpe7 r60"]]
  ],
  mma: [
    ["a", "lower_body_power", ["broad_jump_to_stick 4x3 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", "self_resisted_neck_isometric 3x4 @rpe6 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "pulling_grip_and_striking", ["medicine_ball_chest_pass 3x5 @bw r60", "chin_up 4x5 @rpe8 r120", "landmine_press 3x6 @rpe8 r90", "pendlay_row 3x6 @75% r120", "trap_bar_static_hold 3x20s @rpe8 r90", "cable_external_rotation 3x12 @rpe7 r60"]],
    ["c", "full_body_power", ["rotational_medicine_ball_throw 3x4 @bw r60", "front_squat 4x4 @72% r150", "barbell_hip_thrust 3x6 @rpe8 r90", "front_rack_carry 3x30m @rpe8 r90", "sled_push 3x15m @rpe8 r120", "self_resisted_neck_isometric 3x4 @rpe6 r60"]]
  ],
  wrestling: [
    ["a", "hip_power_and_level_change", ["broad_jump_to_stick 4x3 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "split_squat 3x6 @rpe8 r90", "barbell_hip_thrust 3x6 @rpe8 r90", "neck_extension_isometric 3x4 @rpe7 r60", "neck_flexion_isometric 3x4 @rpe7 r60"]],
    ["b", "pulling_and_grip", ["pull_up 4x5 @rpe8 r120", "pendlay_row 4x5 @75% r120", "inverted_row 3x8 @rpe8 r90", "barbell_static_hold 3x20s @rpe8 r90", "dumbbell_crush_grip_hold 3x20s @rpe8 r60", "neck_lateral_flexion_isometric 3x4 @rpe7 r60"]],
    ["c", "bracing_and_carries", ["medicine_ball_scoop_toss 4x4 @bw r90", "zercher_squat 4x4 @rpe8 r150", "romanian_deadlift 3x6 @rpe7 r120", "front_rack_carry 3x30m @rpe8 r90", "sled_push 3x15m @rpe8 r120", "front_plank 3x30s @rpe7 r60"]]
  ],
  judo: [
    ["a", "throwing_power", ["rotational_medicine_ball_throw 4x4 @bw r90", "trap_bar_deadlift 4x4 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90", "cable_woodchop 3x8 @rpe7 r60", "self_resisted_neck_isometric 3x4 @rpe6 r60", "side_plank 3x30s @rpe7 r60"]],
    ["b", "gripping_and_pulling", ["chin_up 4x5 @rpe8 r120", "single_arm_dumbbell_row 4x8 @rpe8 r90", "pendlay_row 3x6 @75% r120", "dumbbell_static_hold 3x30s @rpe8 r90", "barbell_reverse_wrist_curl 3x12 @rpe7 r60", "self_resisted_neck_isometric 3x4 @rpe6 r60"]],
    ["c", "lower_body_and_bracing", ["broad_jump_to_stick 3x3 @bw r90", "front_squat 4x4 @72% r150", "single_leg_rdl 3x6 @rpe7 r90", "cable_hip_adduction 3x10 @rpe7 r60", "farmers_carry 3x30m @rpe8 r90", "pallof_press 3x10 @rpe7 r60"]]
  ],
  brazilian_jiu_jitsu: [
    ["a", "posterior_chain_and_hips", ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 4x4 @78% r180", "barbell_hip_thrust 3x8 @rpe8 r90", "cable_hip_adduction 3x12 @rpe7 r60", "nordic_curl 3x4 @bw r90", "neck_extension_isometric 3x4 @rpe6 r60"]],
    ["b", "grip_and_pulling_endurance", ["pull_up 4x6 @rpe8 r120", "chest_supported_row 3x10 @rpe8 r90", "dumbbell_static_hold 3x40s @rpe8 r90", "dumbbell_crush_grip_hold 3x30s @rpe8 r60", "dumbbell_wrist_curl 3x12 @rpe7 r60", "face_pull 3x15 @rpe7 r60"]],
    ["c", "frames_and_bracing", ["medicine_ball_scoop_toss 3x4 @bw r90", "goblet_squat 3x8 @rpe7 r90", "floor_press 3x6 @rpe8 r120", "single_leg_rdl 3x6 @rpe7 r90", "self_resisted_neck_isometric 3x4 @rpe6 r60", "side_plank 3x30s @rpe7 r60"]]
  ]
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
