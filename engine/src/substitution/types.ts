export type SubstitutionConstraints = {
  avoid_joint_stress_tags?: string[];  // disqualifier tags on candidate
  banned_equipment?: string[];         // disqualifier equipment ids/types
  available_equipment?: string[];      // if present, candidates must use allowed equipment
};

// Existing exports should remain, but ensure ExerciseSignature has:
// - exercise_id: string
// - equipment_ids?: string[] (or whatever you already use)
// - joint_stress_tags?: string[] (or whatever you already use)
// etc.
export type ExerciseSignature = {
  exercise_id: string;
  pattern?: string;
  stimulus?: string;
  equipment_ids?: string[];
  joint_stress_tags?: string[];
  // ...keep your other fields
};

