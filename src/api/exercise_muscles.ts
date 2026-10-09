// DEV NOTE: Product-side muscle map for the exercise library (pure data, no
// database, no engine). The engine selects exercises by movement pattern; the
// muscles are for people: a coach or athlete browsing or filtering the library
// by muscle group. Every registry exercise resolves to target and secondary
// muscles - its movement pattern's default, or its own entry below - and each
// muscle belongs to one of the muscle groups a coach filters by.

export type MuscleGroupId =
  | "neck" | "shoulders" | "rotator_cuff" | "chest" | "back" | "traps"
  | "biceps" | "triceps" | "forearms_grip" | "abs_obliques" | "lower_back"
  | "glutes" | "hip_flexors" | "quads" | "hamstrings" | "adductors" | "calves_shins"
  | "conditioning";

export const MUSCLE_GROUPS: readonly Readonly<{ id: MuscleGroupId; label: string }>[] = Object.freeze([
  { id: "neck", label: "Neck" },
  { id: "shoulders", label: "Shoulders" },
  { id: "rotator_cuff", label: "Rotator cuff" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back and lats" },
  { id: "traps", label: "Traps" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms_grip", label: "Forearms and grip" },
  { id: "abs_obliques", label: "Abs and obliques" },
  { id: "lower_back", label: "Lower back" },
  { id: "glutes", label: "Glutes and hips" },
  { id: "hip_flexors", label: "Hip flexors" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "adductors", label: "Adductors" },
  { id: "calves_shins", label: "Calves and shins" },
  { id: "conditioning", label: "Conditioning" }
].map((group) => Object.freeze(group as { id: MuscleGroupId; label: string })));

export const MUSCLES: Readonly<Record<string, Readonly<{ label: string; group: MuscleGroupId }>>> = Object.freeze({
  sternocleidomastoid: { label: "Sternocleidomastoid", group: "neck" },
  splenius: { label: "Neck extensors (splenius)", group: "neck" },
  deltoid_anterior: { label: "Front deltoid", group: "shoulders" },
  deltoid_lateral: { label: "Side deltoid", group: "shoulders" },
  deltoid_posterior: { label: "Rear deltoid", group: "shoulders" },
  supraspinatus: { label: "Supraspinatus", group: "rotator_cuff" },
  infraspinatus: { label: "Infraspinatus and teres minor", group: "rotator_cuff" },
  subscapularis: { label: "Subscapularis", group: "rotator_cuff" },
  pectoralis_major_sternal: { label: "Chest (lower and mid pec)", group: "chest" },
  pectoralis_major_clavicular: { label: "Upper chest (clavicular pec)", group: "chest" },
  pectoralis_minor: { label: "Pectoralis minor", group: "chest" },
  serratus_anterior: { label: "Serratus anterior", group: "chest" },
  latissimus_dorsi: { label: "Lats and teres major", group: "back" },
  rhomboids: { label: "Rhomboids", group: "back" },
  trapezius_middle: { label: "Middle traps", group: "back" },
  trapezius_lower: { label: "Lower traps", group: "back" },
  trapezius_upper: { label: "Upper traps", group: "traps" },
  levator_scapulae: { label: "Levator scapulae", group: "traps" },
  biceps_brachii: { label: "Biceps", group: "biceps" },
  brachialis: { label: "Brachialis", group: "biceps" },
  triceps_brachii: { label: "Triceps", group: "triceps" },
  brachioradialis: { label: "Brachioradialis", group: "forearms_grip" },
  wrist_flexors: { label: "Wrist and finger flexors", group: "forearms_grip" },
  wrist_extensors: { label: "Wrist extensors", group: "forearms_grip" },
  forearm_rotators: { label: "Pronators and supinators", group: "forearms_grip" },
  rectus_abdominis: { label: "Rectus abdominis", group: "abs_obliques" },
  transverse_abdominis: { label: "Transverse abdominis", group: "abs_obliques" },
  obliques: { label: "Obliques", group: "abs_obliques" },
  erector_spinae: { label: "Spinal erectors", group: "lower_back" },
  quadratus_lumborum: { label: "Quadratus lumborum", group: "lower_back" },
  gluteus_maximus: { label: "Glute max", group: "glutes" },
  hip_abductors: { label: "Glute med and min (hip abductors)", group: "glutes" },
  hip_external_rotators: { label: "Deep hip rotators", group: "glutes" },
  hip_flexors: { label: "Hip flexors (iliopsoas)", group: "hip_flexors" },
  quadriceps: { label: "Quadriceps", group: "quads" },
  hamstrings: { label: "Hamstrings", group: "hamstrings" },
  hip_adductors: { label: "Adductors", group: "adductors" },
  gastrocnemius: { label: "Gastrocnemius", group: "calves_shins" },
  soleus: { label: "Soleus", group: "calves_shins" },
  tibialis_anterior: { label: "Tibialis anterior", group: "calves_shins" },
  cardiorespiratory: { label: "Heart and lungs", group: "conditioning" }
});

export type ExerciseMuscles = Readonly<{ target: readonly string[]; secondary: readonly string[] }>;
const m = (target: string[], secondary: string[] = []): ExerciseMuscles => ({ target, secondary });

// What a movement pattern trains when an exercise has no entry of its own.
export const PATTERN_MUSCLES: Readonly<Record<string, ExerciseMuscles>> = Object.freeze({
  squat: m(["quadriceps", "gluteus_maximus"], ["hip_adductors", "erector_spinae", "soleus"]),
  hinge: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["hip_adductors", "quadriceps", "trapezius_upper", "wrist_flexors"]),
  single_leg_squat: m(["quadriceps", "gluteus_maximus"], ["hip_adductors", "hip_abductors", "soleus"]),
  single_leg_hinge: m(["hamstrings", "gluteus_maximus"], ["hip_abductors", "erector_spinae"]),
  knee_extension_isolation: m(["quadriceps"]),
  knee_flexion_isolation: m(["hamstrings"], ["gastrocnemius"]),
  hip_abduction_isolation: m(["hip_abductors"], ["hip_external_rotators"]),
  hip_adduction_isolation: m(["hip_adductors"]),
  hip_extension_isolation: m(["gluteus_maximus"], ["hamstrings"]),
  hip_flexion_isolation: m(["hip_flexors"], ["quadriceps"]),
  calf_raise: m(["gastrocnemius", "soleus"]),
  tibialis_raise: m(["tibialis_anterior"]),
  horizontal_push: m(["pectoralis_major_sternal"], ["pectoralis_major_clavicular", "deltoid_anterior", "triceps_brachii"]),
  incline_push: m(["pectoralis_major_clavicular"], ["deltoid_anterior", "triceps_brachii"]),
  decline_push: m(["pectoralis_major_sternal"], ["triceps_brachii", "deltoid_anterior"]),
  vertical_push: m(["deltoid_anterior"], ["deltoid_lateral", "triceps_brachii", "pectoralis_major_clavicular", "serratus_anterior"]),
  angled_push: m(["deltoid_anterior", "pectoralis_major_clavicular"], ["triceps_brachii", "serratus_anterior", "obliques"]),
  horizontal_pull: m(["latissimus_dorsi", "trapezius_middle", "rhomboids"], ["deltoid_posterior", "biceps_brachii", "brachialis", "erector_spinae"]),
  vertical_pull: m(["latissimus_dorsi"], ["biceps_brachii", "brachialis", "trapezius_lower", "rhomboids"]),
  scapular_retraction: m(["trapezius_middle", "rhomboids"], ["deltoid_posterior", "infraspinatus"]),
  scapular_protraction: m(["serratus_anterior"], ["pectoralis_minor"]),
  scapular_upward_rotation: m(["trapezius_lower", "serratus_anterior"], ["trapezius_upper"]),
  scapular_depression: m(["trapezius_lower", "latissimus_dorsi"], ["pectoralis_minor"]),
  shoulder_external_rotation: m(["infraspinatus"], ["deltoid_posterior"]),
  shoulder_internal_rotation: m(["subscapularis"], ["pectoralis_major_sternal", "latissimus_dorsi"]),
  shoulder_abduction_isolation: m(["deltoid_lateral"], ["supraspinatus", "trapezius_upper"]),
  shoulder_horizontal_abduction_isolation: m(["deltoid_posterior"], ["infraspinatus", "trapezius_middle", "rhomboids"]),
  elbow_flexion_isolation: m(["biceps_brachii"], ["brachialis", "brachioradialis"]),
  elbow_extension_isolation: m(["triceps_brachii"]),
  forearm_flexion_isolation: m(["wrist_flexors"]),
  forearm_extension_isolation: m(["wrist_extensors"], ["brachioradialis"]),
  grip_crush: m(["wrist_flexors"]),
  grip_support: m(["wrist_flexors"], ["trapezius_upper", "wrist_extensors"]),
  carry_bilateral: m(["wrist_flexors", "trapezius_upper"], ["quadratus_lumborum", "erector_spinae", "gluteus_maximus", "obliques"]),
  carry_unilateral: m(["obliques", "quadratus_lumborum"], ["wrist_flexors", "trapezius_upper", "hip_abductors"]),
  core_anti_extension: m(["rectus_abdominis", "transverse_abdominis"], ["obliques", "serratus_anterior"]),
  core_anti_rotation: m(["obliques", "transverse_abdominis"], ["rectus_abdominis", "gluteus_maximus"]),
  core_anti_lateral_flexion: m(["obliques", "quadratus_lumborum"], ["hip_abductors", "transverse_abdominis"]),
  trunk_flexion: m(["rectus_abdominis"], ["obliques"]),
  trunk_extension: m(["erector_spinae"], ["gluteus_maximus", "hamstrings"]),
  rotation: m(["obliques"], ["rectus_abdominis", "gluteus_maximus", "deltoid_anterior"]),
  locomotion_walk: m(["cardiorespiratory"], ["gluteus_maximus", "quadriceps", "gastrocnemius"]),
  locomotion_run: m(["cardiorespiratory"], ["quadriceps", "hamstrings", "gluteus_maximus", "gastrocnemius", "soleus"]),
  locomotion_crawl: m(["transverse_abdominis", "deltoid_anterior"], ["serratus_anterior", "quadriceps", "hip_flexors", "cardiorespiratory"]),
  jump_vertical: m(["quadriceps", "gluteus_maximus", "gastrocnemius"], ["hamstrings", "soleus"]),
  jump_horizontal: m(["gluteus_maximus", "quadriceps", "hamstrings"], ["gastrocnemius", "soleus"]),
  sprint_acceleration: m(["gluteus_maximus", "quadriceps", "hamstrings"], ["gastrocnemius", "soleus", "hip_flexors"]),
  sprint_max_velocity: m(["hamstrings", "gluteus_maximus", "hip_flexors"], ["gastrocnemius", "soleus", "quadriceps"]),
  deceleration: m(["quadriceps", "gluteus_maximus"], ["hamstrings", "hip_abductors", "soleus"]),
  change_of_direction: m(["quadriceps", "gluteus_maximus", "hip_adductors"], ["hip_abductors", "hamstrings", "gastrocnemius"]),
  throw_slam: m(["rectus_abdominis", "latissimus_dorsi"], ["obliques", "deltoid_anterior", "triceps_brachii", "gluteus_maximus"]),
  conditioning_cyclical: m(["cardiorespiratory"], ["quadriceps", "gluteus_maximus", "gastrocnemius"]),
  conditioning_row: m(["cardiorespiratory"], ["quadriceps", "gluteus_maximus", "latissimus_dorsi", "trapezius_middle", "biceps_brachii"]),
  conditioning_sled: m(["quadriceps", "gluteus_maximus"], ["gastrocnemius", "hamstrings", "cardiorespiratory"]),
  neck_isometric: m(["sternocleidomastoid", "splenius"], ["trapezius_upper", "levator_scapulae"])
});

// Exercises whose muscles differ from their pattern's.
export const EXERCISE_MUSCLES: Readonly<Record<string, ExerciseMuscles>> = Object.freeze({
  // Squat
  front_squat: m(["quadriceps", "gluteus_maximus"], ["erector_spinae", "rectus_abdominis", "hip_adductors"]),
  zercher_squat: m(["quadriceps", "gluteus_maximus"], ["erector_spinae", "rectus_abdominis", "biceps_brachii", "hip_adductors"]),
  overhead_squat: m(["quadriceps", "gluteus_maximus"], ["deltoid_anterior", "deltoid_lateral", "trapezius_upper", "trapezius_lower", "erector_spinae", "transverse_abdominis"]),
  low_bar_back_squat: m(["gluteus_maximus", "quadriceps", "hip_adductors"], ["hamstrings", "erector_spinae", "soleus"]),
  box_squat: m(["gluteus_maximus", "quadriceps"], ["hamstrings", "hip_adductors", "erector_spinae"]),
  leg_press: m(["quadriceps", "gluteus_maximus"], ["hip_adductors", "soleus"]),
  hack_squat: m(["quadriceps"], ["gluteus_maximus", "hip_adductors", "soleus"]),
  split_squat: m(["quadriceps", "gluteus_maximus"], ["hip_adductors", "hip_abductors", "soleus"]),
  // Hinge
  sumo_deadlift: m(["gluteus_maximus", "quadriceps", "hip_adductors"], ["hamstrings", "erector_spinae", "trapezius_upper", "wrist_flexors"]),
  deficit_deadlift: m(["gluteus_maximus", "hamstrings", "erector_spinae", "quadriceps"], ["hip_adductors", "trapezius_upper", "wrist_flexors"]),
  block_pull: m(["gluteus_maximus", "erector_spinae"], ["hamstrings", "trapezius_upper", "wrist_flexors"]),
  rack_pull: m(["gluteus_maximus", "erector_spinae", "trapezius_upper"], ["hamstrings", "latissimus_dorsi", "wrist_flexors"]),
  partial_deadlift: m(["gluteus_maximus", "erector_spinae"], ["hamstrings", "trapezius_upper", "wrist_flexors"]),
  romanian_deadlift: m(["hamstrings", "gluteus_maximus"], ["erector_spinae", "hip_adductors", "wrist_flexors"]),
  stiff_leg_deadlift: m(["hamstrings", "gluteus_maximus", "erector_spinae"], ["hip_adductors", "wrist_flexors"]),
  good_morning: m(["hamstrings", "erector_spinae", "gluteus_maximus"], ["hip_adductors"]),
  trap_bar_deadlift: m(["quadriceps", "gluteus_maximus", "hamstrings"], ["erector_spinae", "trapezius_upper", "wrist_flexors"]),
  kettlebell_deadlift: m(["gluteus_maximus", "hamstrings"], ["quadriceps", "erector_spinae", "wrist_flexors"]),
  snatch_grip_deadlift: m(["gluteus_maximus", "hamstrings", "erector_spinae", "trapezius_upper"], ["quadriceps", "rhomboids", "trapezius_middle", "wrist_flexors"]),
  kettlebell_swing: m(["gluteus_maximus", "hamstrings"], ["erector_spinae", "deltoid_anterior", "wrist_flexors", "cardiorespiratory"]),
  tire_flip: m(["gluteus_maximus", "quadriceps", "hamstrings"], ["erector_spinae", "deltoid_anterior", "triceps_brachii", "biceps_brachii"]),
  power_clean: m(["gluteus_maximus", "quadriceps", "trapezius_upper"], ["hamstrings", "erector_spinae", "gastrocnemius", "deltoid_anterior"]),
  clean: m(["gluteus_maximus", "quadriceps", "trapezius_upper"], ["hamstrings", "erector_spinae", "gastrocnemius", "deltoid_anterior"]),
  hang_power_clean: m(["gluteus_maximus", "quadriceps", "trapezius_upper"], ["hamstrings", "erector_spinae", "deltoid_anterior"]),
  clean_and_jerk: m(["gluteus_maximus", "quadriceps", "trapezius_upper", "deltoid_anterior"], ["hamstrings", "erector_spinae", "triceps_brachii", "gastrocnemius"]),
  snatch: m(["gluteus_maximus", "quadriceps", "trapezius_upper"], ["hamstrings", "erector_spinae", "deltoid_anterior", "deltoid_lateral", "trapezius_lower", "triceps_brachii"]),
  power_snatch: m(["gluteus_maximus", "quadriceps", "trapezius_upper"], ["hamstrings", "erector_spinae", "deltoid_lateral", "trapezius_lower"]),
  hang_snatch: m(["gluteus_maximus", "quadriceps", "trapezius_upper"], ["hamstrings", "erector_spinae", "deltoid_lateral", "trapezius_lower"]),
  snatch_pull: m(["gluteus_maximus", "hamstrings", "trapezius_upper"], ["quadriceps", "erector_spinae", "gastrocnemius"]),
  clean_pull: m(["gluteus_maximus", "hamstrings", "trapezius_upper"], ["quadriceps", "erector_spinae", "gastrocnemius"]),
  atlas_stone_over_bar: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["biceps_brachii", "latissimus_dorsi", "quadriceps", "wrist_flexors"]),
  atlas_stone_load: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["biceps_brachii", "latissimus_dorsi", "quadriceps", "wrist_flexors"]),
  axle_deadlift: m(["gluteus_maximus", "hamstrings", "erector_spinae", "wrist_flexors"], ["quadriceps", "trapezius_upper"]),
  keg_load: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["biceps_brachii", "quadriceps", "deltoid_anterior"]),
  frame_deadlift: m(["gluteus_maximus", "quadriceps", "erector_spinae"], ["hamstrings", "trapezius_upper", "wrist_flexors"]),
  fingal_fingers_flip: m(["gluteus_maximus", "erector_spinae", "deltoid_anterior"], ["hamstrings", "triceps_brachii", "quadriceps"]),
  sandbag_to_shoulder: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["biceps_brachii", "trapezius_upper", "quadriceps", "obliques"]),
  strongman_log_clean: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["biceps_brachii", "quadriceps", "trapezius_upper"]),
  power_stairs_carry: m(["gluteus_maximus", "quadriceps", "hamstrings"], ["erector_spinae", "trapezius_upper", "wrist_flexors"]),
  // Single leg
  lateral_lunge: m(["quadriceps", "gluteus_maximus", "hip_adductors"], ["hip_abductors", "hamstrings"]),
  curtsy_lunge: m(["gluteus_maximus", "quadriceps", "hip_abductors"], ["hip_adductors"]),
  step_up: m(["quadriceps", "gluteus_maximus"], ["hamstrings", "hip_abductors", "gastrocnemius"]),
  box_step_up: m(["quadriceps", "gluteus_maximus"], ["hamstrings", "hip_abductors", "gastrocnemius"]),
  single_leg_good_morning: m(["hamstrings", "gluteus_maximus", "erector_spinae"], ["hip_abductors"]),
  // Isolation and accessories
  band_terminal_knee_extension: m(["quadriceps"]),
  nordic_curl: m(["hamstrings"], ["gluteus_maximus", "gastrocnemius"]),
  copenhagen_plank: m(["hip_adductors", "obliques"], ["quadratus_lumborum", "transverse_abdominis"]),
  glute_ham_raise: m(["hamstrings", "gluteus_maximus"], ["gastrocnemius", "erector_spinae"]),
  reverse_hyper: m(["gluteus_maximus", "hamstrings", "erector_spinae"]),
  seated_calf_raise: m(["soleus"], ["gastrocnemius"]),
  standing_calf_raise: m(["gastrocnemius", "soleus"]),
  single_leg_calf_raise: m(["gastrocnemius", "soleus"]),
  // Presses
  close_grip_bench_press: m(["triceps_brachii", "pectoralis_major_sternal"], ["deltoid_anterior", "pectoralis_major_clavicular"]),
  floor_press: m(["triceps_brachii", "pectoralis_major_sternal"], ["deltoid_anterior"]),
  pin_press: m(["triceps_brachii", "pectoralis_major_sternal"], ["deltoid_anterior"]),
  push_up: m(["pectoralis_major_sternal"], ["triceps_brachii", "deltoid_anterior", "serratus_anterior", "rectus_abdominis"]),
  incline_push_up: m(["pectoralis_major_sternal"], ["triceps_brachii", "deltoid_anterior", "serratus_anterior"]),
  feet_elevated_push_up: m(["pectoralis_major_clavicular", "pectoralis_major_sternal"], ["triceps_brachii", "deltoid_anterior", "serratus_anterior"]),
  dip: m(["pectoralis_major_sternal", "triceps_brachii"], ["deltoid_anterior", "pectoralis_minor"]),
  pike_push_up: m(["deltoid_anterior"], ["triceps_brachii", "trapezius_upper", "serratus_anterior"]),
  handstand_push_up: m(["deltoid_anterior", "triceps_brachii"], ["deltoid_lateral", "trapezius_upper", "serratus_anterior"]),
  thruster: m(["quadriceps", "gluteus_maximus", "deltoid_anterior"], ["triceps_brachii", "trapezius_upper", "cardiorespiratory"]),
  push_jerk: m(["deltoid_anterior", "quadriceps", "gluteus_maximus"], ["triceps_brachii", "trapezius_upper", "gastrocnemius"]),
  split_jerk: m(["deltoid_anterior", "quadriceps", "gluteus_maximus"], ["triceps_brachii", "trapezius_upper", "gastrocnemius"]),
  strongman_log_press: m(["deltoid_anterior", "triceps_brachii"], ["quadriceps", "gluteus_maximus", "trapezius_upper", "pectoralis_major_clavicular"]),
  axle_bar_press: m(["deltoid_anterior", "triceps_brachii"], ["quadriceps", "trapezius_upper", "wrist_flexors"]),
  circus_dumbbell_press: m(["deltoid_anterior", "triceps_brachii"], ["obliques", "quadriceps", "wrist_flexors"]),
  viking_press: m(["deltoid_anterior", "triceps_brachii"], ["deltoid_lateral", "trapezius_upper", "quadriceps"]),
  arnold_press: m(["deltoid_anterior", "deltoid_lateral"], ["triceps_brachii", "trapezius_upper"]),
  landmine_press: m(["deltoid_anterior", "pectoralis_major_clavicular"], ["triceps_brachii", "serratus_anterior", "obliques"]),
  // Pulls
  pendlay_row: m(["latissimus_dorsi", "trapezius_middle", "rhomboids"], ["deltoid_posterior", "biceps_brachii", "erector_spinae", "hamstrings"]),
  wide_grip_barbell_row: m(["trapezius_middle", "rhomboids", "deltoid_posterior"], ["latissimus_dorsi", "biceps_brachii", "erector_spinae"]),
  single_arm_dumbbell_row: m(["latissimus_dorsi", "trapezius_middle", "rhomboids"], ["deltoid_posterior", "biceps_brachii", "obliques"]),
  inverted_row: m(["latissimus_dorsi", "trapezius_middle", "rhomboids"], ["deltoid_posterior", "biceps_brachii", "rectus_abdominis"]),
  chin_up: m(["latissimus_dorsi", "biceps_brachii"], ["brachialis", "trapezius_lower", "rhomboids"]),
  upright_row: m(["deltoid_lateral", "trapezius_upper"], ["deltoid_anterior", "biceps_brachii", "brachialis"]),
  pullover: m(["latissimus_dorsi", "pectoralis_major_sternal"], ["triceps_brachii", "serratus_anterior"]),
  muscle_up: m(["latissimus_dorsi", "triceps_brachii", "pectoralis_major_sternal"], ["biceps_brachii", "deltoid_anterior", "rectus_abdominis"]),
  rope_climb: m(["latissimus_dorsi", "biceps_brachii", "wrist_flexors"], ["brachialis", "brachioradialis", "rectus_abdominis"]),
  // Shoulder girdle
  face_pull: m(["deltoid_posterior", "trapezius_middle", "infraspinatus"], ["rhomboids", "trapezius_lower"]),
  band_pull_apart: m(["deltoid_posterior", "trapezius_middle", "rhomboids"], ["infraspinatus"]),
  shrug: m(["trapezius_upper"], ["levator_scapulae", "wrist_flexors"]),
  wall_slide: m(["serratus_anterior", "trapezius_lower"], ["infraspinatus"]),
  front_raise: m(["deltoid_anterior"], ["pectoralis_major_clavicular", "serratus_anterior"]),
  // Arms
  hammer_curl: m(["brachioradialis", "brachialis"], ["biceps_brachii"]),
  zottman_curl: m(["biceps_brachii", "brachioradialis"], ["brachialis", "wrist_extensors"]),
  preacher_curl: m(["brachialis", "biceps_brachii"], ["brachioradialis"]),
  concentration_curl: m(["brachialis", "biceps_brachii"], ["brachioradialis"]),
  wrist_roller_roll: m(["wrist_flexors", "wrist_extensors"], ["deltoid_anterior"]),
  levering: m(["wrist_extensors", "forearm_rotators"], ["brachioradialis"]),
  // Carries and grip
  front_rack_carry: m(["rectus_abdominis", "transverse_abdominis", "biceps_brachii"], ["erector_spinae", "trapezius_upper", "gluteus_maximus"]),
  yoke_walk: m(["quadriceps", "gluteus_maximus", "erector_spinae"], ["trapezius_upper", "transverse_abdominis", "gastrocnemius"]),
  atlas_stone_carry: m(["biceps_brachii", "erector_spinae", "transverse_abdominis"], ["latissimus_dorsi", "gluteus_maximus", "quadriceps"]),
  sandbag_carry: m(["biceps_brachii", "erector_spinae", "transverse_abdominis"], ["latissimus_dorsi", "gluteus_maximus"]),
  keg_carry: m(["biceps_brachii", "erector_spinae", "transverse_abdominis"], ["latissimus_dorsi", "gluteus_maximus"]),
  husafell_stone_carry: m(["biceps_brachii", "erector_spinae", "transverse_abdominis"], ["latissimus_dorsi", "gluteus_maximus"]),
  conans_wheel_carry: m(["biceps_brachii", "erector_spinae", "quadriceps"], ["gluteus_maximus", "transverse_abdominis"]),
  duck_walk: m(["quadriceps", "gluteus_maximus", "wrist_flexors"], ["hip_adductors", "trapezius_upper", "erector_spinae"]),
  single_arm_front_rack_carry: m(["obliques", "quadratus_lumborum", "biceps_brachii"], ["deltoid_anterior", "transverse_abdominis"]),
  single_arm_overhead_carry: m(["deltoid_anterior", "deltoid_lateral", "obliques"], ["triceps_brachii", "trapezius_upper", "serratus_anterior", "quadratus_lumborum"]),
  hercules_hold: m(["wrist_flexors", "trapezius_upper"], ["latissimus_dorsi", "deltoid_posterior", "transverse_abdominis"]),
  towel_hang: m(["wrist_flexors"], ["latissimus_dorsi", "forearm_rotators"]),
  pinch_block_hold: m(["wrist_flexors"], ["forearm_rotators"]),
  plate_pinch: m(["wrist_flexors"], ["forearm_rotators"]),
  block_weight_pinch: m(["wrist_flexors"], ["forearm_rotators"]),
  hub_lift: m(["wrist_flexors"], ["wrist_extensors"]),
  // Core
  dead_bug: m(["rectus_abdominis", "transverse_abdominis"], ["obliques", "hip_flexors"]),
  band_resisted_dead_bug: m(["rectus_abdominis", "transverse_abdominis"], ["obliques", "hip_flexors", "latissimus_dorsi"]),
  bird_dog: m(["erector_spinae", "gluteus_maximus", "transverse_abdominis"], ["obliques", "deltoid_anterior"]),
  toes_to_bar: m(["rectus_abdominis", "hip_flexors"], ["latissimus_dorsi", "obliques", "wrist_flexors"]),
  // Throws
  medicine_ball_chest_pass: m(["pectoralis_major_sternal", "triceps_brachii"], ["deltoid_anterior", "rectus_abdominis"]),
  rotational_medicine_ball_throw: m(["obliques", "gluteus_maximus"], ["rectus_abdominis", "deltoid_anterior", "hip_adductors"]),
  medicine_ball_rotational_throw: m(["obliques", "gluteus_maximus"], ["rectus_abdominis", "deltoid_anterior", "hip_adductors"]),
  medicine_ball_scoop_toss: m(["gluteus_maximus", "hamstrings", "obliques"], ["quadriceps", "deltoid_anterior"]),
  backward_overhead_medicine_ball_throw: m(["gluteus_maximus", "hamstrings", "erector_spinae"], ["quadriceps", "deltoid_anterior", "gastrocnemius"]),
  wall_ball: m(["quadriceps", "gluteus_maximus", "deltoid_anterior"], ["triceps_brachii", "cardiorespiratory"]),
  burpee: m(["cardiorespiratory", "quadriceps", "pectoralis_major_sternal"], ["gluteus_maximus", "triceps_brachii", "rectus_abdominis"]),
  burpee_broad_jump: m(["cardiorespiratory", "gluteus_maximus", "quadriceps"], ["pectoralis_major_sternal", "hamstrings", "triceps_brachii"]),
  lateral_bound: m(["gluteus_maximus", "hip_abductors", "quadriceps"], ["hip_adductors", "gastrocnemius"]),
  pogo_jump: m(["gastrocnemius", "soleus"], ["quadriceps", "tibialis_anterior"]),
  // Conditioning
  double_under: m(["cardiorespiratory", "gastrocnemius", "soleus"], ["deltoid_anterior", "wrist_flexors"]),
  ski_erg: m(["cardiorespiratory", "latissimus_dorsi"], ["triceps_brachii", "rectus_abdominis", "gluteus_maximus"]),
  stair_climber: m(["cardiorespiratory"], ["quadriceps", "gluteus_maximus", "gastrocnemius"]),
  backward_sled_drag: m(["quadriceps"], ["gastrocnemius", "tibialis_anterior", "cardiorespiratory"]),
  lateral_sled_drag: m(["hip_abductors", "hip_adductors", "quadriceps"], ["gluteus_maximus", "cardiorespiratory"]),
  sled_rope_pull: m(["latissimus_dorsi", "biceps_brachii", "wrist_flexors"], ["trapezius_middle", "rhomboids", "cardiorespiratory"]),
  vehicle_pull: m(["gluteus_maximus", "quadriceps", "latissimus_dorsi"], ["hamstrings", "biceps_brachii", "wrist_flexors", "erector_spinae"]),
  sled_drag: m(["gluteus_maximus", "hamstrings", "quadriceps"], ["gastrocnemius", "cardiorespiratory"]),
  // Neck
  neck_flexion_isometric: m(["sternocleidomastoid"]),
  neck_extension_isometric: m(["splenius"], ["trapezius_upper"]),
  neck_lateral_flexion_isometric: m(["sternocleidomastoid", "splenius"], ["levator_scapulae", "trapezius_upper"]),
  // Library batch 1: shoulders, rotator cuff, arms, forearms and neck
  barbell_front_raise: m(["deltoid_anterior"], ["pectoralis_major_clavicular", "serratus_anterior", "trapezius_upper"]),
  cable_front_raise: m(["deltoid_anterior"], ["pectoralis_major_clavicular", "serratus_anterior"]),
  suspension_front_raise: m(["deltoid_anterior"], ["serratus_anterior", "rectus_abdominis", "trapezius_lower"]),
  seated_barbell_overhead_press: m(["deltoid_anterior"], ["deltoid_lateral", "triceps_brachii", "pectoralis_major_clavicular", "trapezius_upper"]),
  seated_dumbbell_shoulder_press: m(["deltoid_anterior"], ["deltoid_lateral", "triceps_brachii", "trapezius_upper"]),
  smith_machine_shoulder_press: m(["deltoid_anterior"], ["deltoid_lateral", "triceps_brachii"]),
  cable_shoulder_press: m(["deltoid_anterior"], ["deltoid_lateral", "triceps_brachii"]),
  elevated_pike_push_up: m(["deltoid_anterior"], ["triceps_brachii", "trapezius_upper", "serratus_anterior"]),
  cable_upright_row: m(["deltoid_lateral", "trapezius_upper"], ["deltoid_anterior", "biceps_brachii", "brachialis"]),
  dumbbell_upright_row: m(["deltoid_lateral", "trapezius_upper"], ["deltoid_anterior", "biceps_brachii"]),
  incline_dumbbell_lateral_raise: m(["deltoid_lateral"], ["supraspinatus", "deltoid_anterior"]),
  side_lying_lateral_raise: m(["deltoid_lateral"], ["supraspinatus", "deltoid_posterior"]),
  cable_y_raise: m(["deltoid_lateral", "trapezius_lower"], ["supraspinatus", "serratus_anterior"]),
  suspension_y_raise: m(["deltoid_lateral", "trapezius_lower"], ["deltoid_posterior", "supraspinatus", "rectus_abdominis"]),
  full_can_lateral_raise: m(["supraspinatus", "deltoid_lateral"], ["deltoid_anterior", "serratus_anterior"]),
  barbell_rear_delt_row: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "infraspinatus", "biceps_brachii"]),
  dumbbell_rear_delt_row: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "infraspinatus"]),
  cable_rear_delt_row: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "infraspinatus"]),
  machine_reverse_fly: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "infraspinatus"]),
  rear_delt_inverted_row: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "biceps_brachii", "rectus_abdominis"]),
  suspension_reverse_fly: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "infraspinatus"]),
  suspension_rear_delt_row: m(["deltoid_posterior"], ["trapezius_middle", "rhomboids", "biceps_brachii"]),
  supported_dumbbell_external_rotation: m(["infraspinatus"], ["deltoid_posterior", "supraspinatus"]),
  machine_external_rotation: m(["infraspinatus"], ["deltoid_posterior"]),
  suspension_external_rotation: m(["infraspinatus"], ["deltoid_posterior", "trapezius_lower"]),
  supine_dumbbell_internal_rotation: m(["subscapularis"], ["pectoralis_major_sternal"]),
  machine_internal_rotation: m(["subscapularis"], ["pectoralis_major_sternal", "latissimus_dorsi"]),
  triceps_dip: m(["triceps_brachii"], ["pectoralis_major_sternal", "deltoid_anterior"]),
  assisted_dip: m(["triceps_brachii", "pectoralis_major_sternal"], ["deltoid_anterior"]),
  bench_dip: m(["triceps_brachii"], ["deltoid_anterior", "pectoralis_major_sternal"]),
  machine_dip: m(["triceps_brachii"], ["pectoralis_major_sternal", "deltoid_anterior"]),
  barbell_overhead_triceps_extension: m(["triceps_brachii"]),
  dumbbell_overhead_triceps_extension: m(["triceps_brachii"]),
  single_arm_dumbbell_overhead_extension: m(["triceps_brachii"]),
  cable_lying_triceps_extension: m(["triceps_brachii"]),
  single_arm_cable_pushdown: m(["triceps_brachii"]),
  dumbbell_kickback: m(["triceps_brachii"], ["deltoid_posterior"]),
  close_grip_push_up: m(["triceps_brachii", "pectoralis_major_sternal"], ["deltoid_anterior", "rectus_abdominis"]),
  suspension_triceps_extension: m(["triceps_brachii"], ["rectus_abdominis", "serratus_anterior"]),
  incline_dumbbell_curl: m(["biceps_brachii"], ["brachialis", "brachioradialis"]),
  machine_curl: m(["biceps_brachii"], ["brachialis"]),
  spider_curl: m(["brachialis", "biceps_brachii"], ["brachioradialis"]),
  suspension_biceps_curl: m(["biceps_brachii", "brachialis"], ["brachioradialis", "rectus_abdominis"]),
  rope_hammer_curl: m(["brachioradialis", "brachialis"], ["biceps_brachii"]),
  reverse_curl: m(["brachioradialis", "brachialis"], ["biceps_brachii", "wrist_extensors"]),
  dumbbell_pronation: m(["forearm_rotators"], ["wrist_flexors"]),
  dumbbell_supination: m(["forearm_rotators"], ["biceps_brachii"]),
  grip_machine_squeeze: m(["wrist_flexors"]),
  lying_plate_neck_flexion: m(["sternocleidomastoid"], ["splenius"]),
  lying_plate_neck_lateral_flexion: m(["sternocleidomastoid", "splenius"], ["levator_scapulae", "trapezius_upper"]),
  neck_harness_extension: m(["splenius"], ["trapezius_upper", "levator_scapulae"]),
  machine_neck_flexion: m(["sternocleidomastoid"]),
  machine_neck_extension: m(["splenius"], ["trapezius_upper"]),
  machine_neck_lateral_flexion: m(["sternocleidomastoid", "splenius"], ["levator_scapulae"]),
  band_neck_retraction: m(["splenius"], ["sternocleidomastoid"]),
  chin_tuck: m(["splenius", "sternocleidomastoid"]),
  wall_neck_bridge_front: m(["sternocleidomastoid"], ["rectus_abdominis"]),
  wall_side_neck_bridge: m(["sternocleidomastoid", "splenius"], ["obliques"]),
  wall_rear_neck_bridge: m(["splenius"], ["trapezius_upper", "erector_spinae"])
});

const groupOf = (muscle: string): MuscleGroupId | null => MUSCLES[muscle]?.group ?? null;

// An exercise's muscles: its own entry, else its movement pattern's. A repeat
// ("back_squat__r2") is its base exercise; an athlete's own exercise
// (custom_*) has no registry pattern unless one is passed.
export function exerciseMuscles(exerciseId: string, movementPatternId: string | undefined): ExerciseMuscles | null {
  const id = exerciseId.replace(/__r[0-9]+$/, "");
  return EXERCISE_MUSCLES[id] ?? (movementPatternId ? PATTERN_MUSCLES[movementPatternId] ?? null : null);
}

// The muscle groups an exercise is filed under: the groups of its target
// muscles (secondary muscles don't put it in a group).
export function exerciseMuscleGroups(muscles: ExerciseMuscles | null): MuscleGroupId[] {
  if (!muscles) return [];
  const groups: MuscleGroupId[] = [];
  for (const muscle of muscles.target) {
    const group = groupOf(muscle);
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups;
}

// What the exercise pickers need about one exercise's muscles.
export function exerciseMuscleSummary(exerciseId: string, movementPatternId: string | undefined): Readonly<{
  target_muscles: readonly string[];
  secondary_muscles: readonly string[];
  muscle_groups: readonly MuscleGroupId[];
}> {
  const muscles = exerciseMuscles(exerciseId, movementPatternId);
  return Object.freeze({
    target_muscles: Object.freeze([...(muscles?.target ?? [])]),
    secondary_muscles: Object.freeze([...(muscles?.secondary ?? [])]),
    muscle_groups: Object.freeze(exerciseMuscleGroups(muscles))
  });
}

// The muscle fields an exercise option carries in every picker's list: the
// groups it's filed under, and its target and secondary muscles by name.
export function exerciseMuscleFields(exerciseId: string, movementPatternId: string | undefined): Readonly<{
  muscle_groups: readonly MuscleGroupId[];
  target_muscles: readonly string[];
  secondary_muscles: readonly string[];
}> {
  const summary = exerciseMuscleSummary(exerciseId, movementPatternId);
  const label = (muscle: string) => MUSCLES[muscle]?.label ?? muscle;
  return Object.freeze({
    muscle_groups: summary.muscle_groups,
    target_muscles: Object.freeze(summary.target_muscles.map(label)),
    secondary_muscles: Object.freeze(summary.secondary_muscles.map(label))
  });
}
