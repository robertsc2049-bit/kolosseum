export type EquipmentTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";

export type Pattern =
  | "hinge"
  | "squat"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "carry"
  | "rotation"
  | "locomotion";

export type StimulusIntent =
  | "strength"
  | "hypertrophy"
  | "power"
  | "skill"
  | "rehab"
  | "conditioning";

export type ROMClass = "full" | "partial" | "restricted";
export type StabilityClass = "stable" | "semi_stable" | "unstable";

export type ExerciseSignature = {
  exercise_id: string;

  // Must-match fields (in spirit) for safety + intent
  pattern: Pattern;
  stimulus_intent: StimulusIntent;

  // Constraints that affect equivalence
  rom: ROMClass;
  stability: StabilityClass;

  // Equipment requirements and equivalence tier
  equipment: string[];          // e.g. ["barbell","bench","rack"]
  equipment_tier: EquipmentTier;

  // Safety flags / risk
  joint_stress_tags: string[];  // e.g. ["shoulder_high","knee_low"]
};

export type SubstitutionConstraints = {
  banned_equipment?: string[];      // e.g. ["barbell"]
  required_equipment?: string[];    // if caller insists
  avoid_joint_stress_tags?: string[]; // e.g. ["shoulder_high"]
};

export type SubstitutionPick = {
  selected_exercise_id: string;
  score: number;
  reasons: string[];
};
