// DEV NOTE: Repository automation data. Position-group (sport role) programmes for the
// sports where positions train differently, consumed by
// scripts/generate_program_level_variants.mjs, which derives each role's beginner and
// pro weeks exactly as it does the sport's own week. A role variant replaces the
// sport's base programme only for an athlete who has declared a position in that
// group; everyone else keeps the sport's programme. Each role has a full-body
// session (the one-day-a-week programme) and a training week.
//
// Item format: see scripts/program_microcycles.mjs.

const NECK = "self_resisted_neck_isometric 3x4 @rpe6 r60";

// Rugby forwards: scrum, maul and ruck - maximal strength and upper-body pushing
// carry over most; heavier and lower-rep than backs, loaded carries/sled for
// drive, neck work every lifting day. Backs: acceleration and top speed with
// hamstring protection (Nordics, sprint exposure before strength work), less
// upper-body volume.
const RUGBY = {
  forwards: {
    session: ["trap_bar_deadlift 5x3 @85% r180", "bench_press 4x4 @82% r150", "chin_up 4x5 @rpe8 r120",
      "front_squat 3x4 @78% r150", NECK, "sled_push 4x15m @rpe8 r120"],
    week: [
      ["a", "lower_body_strength", ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 5x3 @85% r180", "front_squat 3x4 @78% r150",
        "nordic_curl 3x4 @bw r90", NECK, "sled_push 4x15m @rpe8 r120"]],
      ["b", "upper_body_strength", ["bench_press 5x4 @82% r150", "chin_up 4x5 @rpe8 r120", "landmine_press 3x6 @rpe8 r90",
        "chest_supported_row 4x6 @rpe8 r90", NECK, "front_rack_carry 3x30m @rpe8 r90"]],
      ["c", "full_body_power", ["medicine_ball_chest_pass 4x4 @bw r60", "back_squat 4x4 @80% r180", "romanian_deadlift 3x6 @rpe7 r120",
        "single_arm_dumbbell_row 3x8 @rpe8 r90", NECK, "farmers_carry 3x30m @rpe8 r90"]]
    ]
  },
  backs: {
    session: ["ten_metre_acceleration 5x10m @bw r120", "trap_bar_deadlift 4x3 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90",
      "landmine_press 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", NECK],
    week: [
      ["a", "speed_and_lower_power", ["ten_metre_acceleration 5x10m @bw r120", "countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 4x3 @80% r180",
        "bulgarian_split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", NECK]],
      ["b", "upper_body_strength", ["bench_press 4x5 @75% r150", "chin_up 4x6 @rpe8 r120", "landmine_press 3x6 @rpe7 r90",
        "chest_supported_row 3x8 @rpe8 r90", NECK, "pallof_press 3x10 @rpe7 r60"]],
      ["c", "top_speed_and_resilience", ["flying_twenty_sprint 4x20m @bw r180", "broad_jump_to_stick 3x3 @bw r90", "single_leg_rdl 3x6 @rpe7 r90",
        "cable_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]]
    ]
  }
};

// Football and field hockey goalkeepers: short lateral explosive dives and
// reactive jumps, not repeated sprints; shoulder care for landing and throwing.
const GOALKEEPER = (power) => ({
  session: [power, "trap_bar_deadlift 4x4 @78% r180", "lateral_lunge 3x8 @rpe7 r90",
    "dumbbell_bench_press 3x6 @rpe8 r120", "cable_external_rotation 3x12 @rpe7 r60", "pallof_press 3x10 @rpe7 r60"],
  week: [
    ["a", "lateral_power", [power, "trap_bar_deadlift 4x4 @78% r180", "lateral_lunge 3x8 @rpe7 r90",
      "nordic_curl 3x4 @bw r90", "cable_hip_adduction 3x10 @rpe7 r60", "pallof_press 3x10 @rpe7 r60"]],
    ["b", "upper_body_and_shoulder", ["dumbbell_bench_press 4x6 @rpe8 r120", "chin_up 4x6 @rpe8 r120", "medicine_ball_chest_pass 3x5 @bw r60",
      "half_kneeling_dumbbell_angled_press 3x8 @rpe7 r90", "cable_external_rotation 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]],
    ["c", "reactive_and_landing", ["countermovement_jump 4x3 @bw r90", "lateral_deceleration 4x3 @bw r90", "split_squat 3x6 @rpe8 r90",
      "single_leg_rdl 3x6 @rpe7 r90", "single_leg_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]]
  ]
});

// Rugby union forwards also scrum (neck in every plane, posture under load)
// and lift in the lineout (overhead strength) - league has neither.
const UNION_FORWARDS = {
  session: ["trap_bar_deadlift 5x3 @85% r180", "bench_press 4x4 @82% r150", "overhead_press 3x5 @rpe8 r120",
    "front_squat 3x4 @78% r150", "neck_flexion_isometric 3x5 @rpe7 r60", "sled_push 4x15m @rpe8 r120"],
  week: [
    ["a", "lower_body_strength_and_scrum", ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 5x3 @85% r180", "front_squat 3x4 @78% r150",
      "sled_push 4x15m @rpe8 r120", "neck_flexion_isometric 3x5 @rpe7 r60", "neck_extension_isometric 3x5 @rpe7 r60"]],
    ["b", "upper_body_strength_and_lineout", ["bench_press 5x4 @82% r150", "overhead_press 4x5 @rpe8 r120", "chin_up 4x5 @rpe8 r120",
      "chest_supported_row 3x6 @rpe8 r90", "neck_lateral_flexion_isometric 3x5 @rpe7 r60", "front_rack_carry 3x30m @rpe8 r90"]],
    ["c", "full_body_power", ["medicine_ball_chest_pass 4x4 @bw r60", "back_squat 4x4 @80% r180", "romanian_deadlift 3x6 @rpe7 r120",
      "nordic_curl 3x4 @bw r90", NECK, "farmers_carry 3x30m @rpe8 r90"]]
  ]
};

export const ROLE_MICROCYCLES = {
  rugby_union: { forwards: UNION_FORWARDS, backs: RUGBY.backs },
  rugby_league: RUGBY,
  // Linemen: collision strength and short-range power off the line. Skill
  // positions: acceleration and top speed, hamstrings protected.
  american_football: {
    linemen: {
      session: ["trap_bar_deadlift 5x3 @85% r180", "bench_press 5x4 @82% r150", "back_squat 4x4 @80% r180",
        "chest_supported_row 4x6 @rpe8 r90", NECK, "sled_push 4x15m @rpe8 r120"],
      week: [
        ["a", "lower_body_strength", ["medicine_ball_chest_pass 3x4 @bw r60", "back_squat 5x3 @85% r180", "trap_bar_deadlift 3x4 @78% r180",
          "bulgarian_split_squat 3x6 @rpe8 r90", NECK, "sled_push 4x15m @rpe8 r120"]],
        ["b", "upper_body_strength", ["bench_press 5x4 @82% r150", "chin_up 4x6 @rpe8 r120", "landmine_press 3x6 @rpe8 r90",
          "chest_supported_row 4x6 @rpe8 r90", NECK, "farmers_carry 3x30m @rpe8 r90"]],
        ["c", "full_body_power", ["countermovement_jump 3x3 @bw r90", "front_squat 4x4 @75% r150", "romanian_deadlift 3x6 @rpe7 r120",
          "single_arm_dumbbell_row 3x8 @rpe8 r90", NECK, "side_plank 3x30s @rpe7 r60"]]
      ]
    },
    skill: {
      session: ["ten_metre_acceleration 5x10m @bw r120", "trap_bar_deadlift 4x3 @80% r180", "bulgarian_split_squat 3x6 @rpe8 r90",
        "dumbbell_bench_press 3x6 @rpe8 r120", "nordic_curl 3x4 @bw r90", NECK],
      week: [
        ["a", "speed_and_lower_power", ["ten_metre_acceleration 5x10m @bw r120", "countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 4x3 @80% r180",
          "bulgarian_split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", NECK]],
        ["b", "upper_body_strength", ["bench_press 4x5 @75% r150", "chin_up 4x6 @rpe8 r120", "chest_supported_row 3x8 @rpe8 r90",
          "landmine_press 3x6 @rpe7 r90", NECK, "pallof_press 3x10 @rpe7 r60"]],
        ["c", "top_speed_and_resilience", ["flying_twenty_sprint 4x20m @bw r180", "lateral_bound 3x4 @bw r90", "single_leg_rdl 3x6 @rpe7 r90",
          "cable_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]]
      ]
    }
  },
  football_soccer: { goalkeeper: GOALKEEPER("lateral_bound 4x4 @bw r90") },
  field_hockey: { goalkeeper: GOALKEEPER("lateral_bound 4x4 @bw r90") },
  // Goaltenders: the butterfly loads the hips and adductors at end range, with
  // explosive lateral pushes; bilateral heavy squatting matters less.
  ice_hockey: {
    goaltender: {
      session: ["lateral_bound 4x4 @bw r90", "trap_bar_deadlift 3x4 @78% r180", "lateral_lunge 3x8 @rpe7 r90",
        "cable_hip_adduction 3x12 @rpe7 r60", "chin_up 3x6 @rpe8 r120", "pallof_press 3x10 @rpe7 r60"],
      week: [
        ["a", "lateral_power", ["lateral_bound 4x4 @bw r90", "trap_bar_deadlift 3x4 @78% r180", "lateral_lunge 3x8 @rpe7 r90",
          "cable_hip_adduction 3x12 @rpe7 r60", "lateral_sled_drag 3x20m @rpe7 r90", "pallof_press 3x10 @rpe7 r60"]],
        ["b", "upper_body_strength", ["dumbbell_bench_press 3x6 @rpe8 r120", "chin_up 4x6 @rpe8 r120", "chest_supported_row 3x8 @rpe8 r90",
          "landmine_press 3x6 @rpe7 r90", "cable_external_rotation 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]],
        ["c", "hip_and_single_leg", ["countermovement_jump 3x3 @bw r90", "split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90",
          "machine_hip_adduction 3x10 @rpe7 r60", "single_leg_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]]
      ]
    }
  },
  // Fast bowlers: the front leg brakes several times bodyweight and the trunk
  // side-flexes and rotates hard - eccentric lower body, front-leg bracing,
  // lateral trunk strength; lumbar stress injuries are the risk, so no extra
  // rotational throwing volume on top of bowling.
  cricket: {
    fast_bowler: {
      session: ["trap_bar_deadlift 4x4 @78% r180", "split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90",
        "chin_up 3x6 @rpe8 r120", "side_plank 3x30s @rpe7 r60", "pallof_press 3x10 @rpe7 r60"],
      week: [
        ["a", "lower_body_strength", ["countermovement_jump 3x3 @bw r90", "trap_bar_deadlift 4x4 @78% r180", "split_squat 3x6 @rpe8 r90",
          "nordic_curl 3x4 @bw r90", "single_leg_calf_raise 3x12 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]],
        ["b", "upper_body_and_shoulder", ["dumbbell_bench_press 3x6 @rpe8 r120", "chin_up 4x6 @rpe8 r120", "single_arm_dumbbell_row 3x8 @rpe8 r90",
          "half_kneeling_dumbbell_angled_press 3x8 @rpe7 r90", "cable_external_rotation 3x12 @rpe7 r60", "dead_bug 3x8 @rpe7 r60"]],
        ["c", "braking_and_trunk", ["drop_to_stick 3x3 @bw r90", "bulgarian_split_squat 3x6 @rpe8 r90", "single_leg_rdl 3x6 @rpe7 r90",
          "cable_hip_adduction 3x10 @rpe7 r60", "pallof_press 3x10 @rpe7 r60", "cable_anti_lateral_hold 3x20s @rpe7 r60"]]
      ]
    }
  },
  // Athletics event groups (the sport's own programme is the sprints/jumps one).
  // Throws: maximal strength and rotational/overhead power. Endurance (middle and
  // long distance): minimum-effective-dose strength and calf/Achilles capacity.
  athletics: {
    throws: {
      session: ["backward_overhead_medicine_ball_throw 4x3 @bw r90", "back_squat 4x4 @82% r180", "bench_press 4x4 @80% r150",
        "trap_bar_deadlift 3x4 @80% r180", "medicine_ball_rotational_throw 3x4 @bw r90", "chin_up 3x6 @rpe8 r120"],
      week: [
        ["a", "lower_body_strength_and_power", ["backward_overhead_medicine_ball_throw 4x3 @bw r90", "back_squat 5x3 @85% r180", "trap_bar_deadlift 3x4 @80% r180",
          "bulgarian_split_squat 3x6 @rpe8 r90", "nordic_curl 3x4 @bw r90", "side_plank 3x30s @rpe7 r60"]],
        ["b", "upper_body_strength_and_rotation", ["medicine_ball_rotational_throw 4x4 @bw r90", "bench_press 5x4 @80% r150", "chin_up 4x6 @rpe8 r120",
          "landmine_press 3x6 @rpe8 r90", "chest_supported_row 3x8 @rpe8 r90", "pallof_press 3x10 @rpe7 r60"]]
      ]
    },
    endurance: {
      session: ["trap_bar_deadlift 3x4 @78% r180", "split_squat 3x6 @rpe7 r90", "single_leg_calf_raise 3x10 @rpe8 r60",
        "single_leg_rdl 3x6 @rpe7 r90", "pogo_jump 2x10 @bw r60", "side_plank 3x30s @rpe7 r60"],
      week: [
        ["a", "strength", ["pogo_jump 2x10 @bw r60", "trap_bar_deadlift 3x4 @78% r180", "split_squat 3x6 @rpe7 r90",
          "single_leg_calf_raise 3x10 @rpe8 r60", "side_plank 3x30s @rpe7 r60"]],
        ["b", "strength_endurance_resilience", ["box_step_up 3x6 @rpe7 r90", "single_leg_rdl 3x6 @rpe7 r90", "seated_calf_raise 3x12 @rpe8 r60",
          "barbell_hip_thrust 3x6 @rpe7 r90", "dead_bug 3x8 @rpe7 r60"]]
      ]
    }
  }
};
