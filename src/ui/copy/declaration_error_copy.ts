export const DECLARATION_ERROR_COPY = {
  legal_refusal: "Execution not permitted.",
  technical_failure_prefix: "Declaration error.",
  token_copy: {
    unknown_field: "Unknown field.",
    missing_required_field: "Required field missing.",
    type_mismatch: "Field type mismatch.",
    invalid_format: "Invalid field format.",
    unknown_enum_value: "Unknown enum value.",
    explicit_null_law_violated: "Explicit null is not permitted here.",
    consent_not_granted: "Consent not granted.",
    version_mismatch: "Version mismatch.",
    invalid_actor_type: "Actor type is invalid.",
    missing_governing_authority: "Governing authority is required.",
    invalid_activity_id: "Activity is invalid.",
    missing_sport_role: "Sport role is required.",
    invalid_sport_role: "Sport role is invalid.",
    role_generalisation_violation: "Role declaration is invalid for this mode.",
    invalid_location_type: "Location type is invalid.",
    invalid_equipment_profile: "Equipment profile is invalid.",
    invalid_presentation_flag: "Presentation flag is invalid.",
    invalid_movement_blacklist: "Movement blacklist is invalid.",
    role_goal_without_role: "Role-specific goal requires a role declaration.",
    forbidden_primary_goal: "Primary goal is not permitted.",
    missing_record_target: "Record target is required.",
  },
} as const;

export type DeclarationTechnicalFailureToken = keyof typeof DECLARATION_ERROR_COPY.token_copy;