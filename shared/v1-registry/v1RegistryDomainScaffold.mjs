// DEV NOTE:
// This module is an inert v1 registry domain scaffold.
// It defines domain ids and required field groups only.
// It must not contain registry content rows, exercise records, equipment records,
// substitution edges, template records, migrations, or UI state.

const LOCKED_V1_ACTIVITY_IDS = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const V1_REGISTRY_DOMAIN_IDS = Object.freeze([
  "activity_registry",
  "movement_pattern_registry",
  "exercise_registry",
  "equipment_registry",
  "exercise_activity_applicability_registry",
  "exercise_equipment_compatibility_registry",
  "substitution_edge_registry",
  "programme_template_registry",
  "instruction_display_copy_registry",
  "copy_legal_claim_boundary_registry"
]);

const V1_REGISTRY_DOMAIN_REQUIRED_FIELDS = Object.freeze({
  activity_registry: Object.freeze([
    "activity_id",
    "display_label",
    "allowed_movement_patterns",
    "allowed_exercise_families",
    "allowed_equipment_classes",
    "allowed_programme_template_types",
    "allowed_substitution_scope",
    "excluded_claim_language",
    "copy_legal_boundary_notes"
  ]),
  movement_pattern_registry: Object.freeze([
    "movement_pattern_id",
    "display_label",
    "activity_applicability",
    "exercise_family",
    "substitution_scope",
    "copy_legal_boundary_notes"
  ]),
  exercise_registry: Object.freeze([
    "exercise_id",
    "display_label",
    "movement_pattern_id",
    "primary_activity_applicability",
    "secondary_activity_applicability",
    "equipment_requirements",
    "equipment_alternatives",
    "difficulty_tier",
    "joint_stress_tags",
    "stimulus_intent",
    "instruction_short_text",
    "instruction_detail_text",
    "contraindication_or_exclusion_tags",
    "substitution_eligibility",
    "template_eligibility",
    "copy_legal_boundary_flags"
  ]),
  equipment_registry: Object.freeze([
    "equipment_id",
    "display_label",
    "equipment_class",
    "activity_applicability",
    "movement_pattern_applicability",
    "substitution_relevance",
    "template_relevance",
    "low_equipment_alternative_relevance",
    "copy_legal_boundary_notes"
  ]),
  exercise_activity_applicability_registry: Object.freeze([
    "applicability_id",
    "exercise_id",
    "activity_id",
    "applicability_type",
    "copy_legal_boundary_notes"
  ]),
  exercise_equipment_compatibility_registry: Object.freeze([
    "compatibility_id",
    "exercise_id",
    "equipment_id",
    "compatibility_type",
    "copy_legal_boundary_notes"
  ]),
  substitution_edge_registry: Object.freeze([
    "substitution_edge_id",
    "source_exercise_id",
    "target_exercise_id",
    "movement_pattern_preservation",
    "stimulus_intent_preservation",
    "equipment_change_type",
    "excluded_equipment_handling",
    "joint_stress_handling",
    "activity_applicability",
    "difficulty_tier_compatibility",
    "deterministic_ordering_key",
    "copy_legal_boundary_notes"
  ]),
  programme_template_registry: Object.freeze([
    "template_id",
    "activity_id",
    "template_version",
    "intended_programme_length",
    "session_frequency",
    "movement_pattern_coverage",
    "exercise_eligibility",
    "equipment_requirements",
    "substitution_compatibility",
    "progression_mode_boundary",
    "copy_legal_boundary_notes",
    "status"
  ]),
  instruction_display_copy_registry: Object.freeze([
    "copy_id",
    "copy_category",
    "allowed_phrase",
    "forbidden_phrase_references",
    "supported_surface",
    "activity_applicability",
    "status"
  ]),
  copy_legal_claim_boundary_registry: Object.freeze([
    "copy_id",
    "copy_category",
    "allowed_phrase",
    "forbidden_phrase_references",
    "supported_surface",
    "activity_applicability",
    "status"
  ])
});

const V1_REGISTRY_DOMAIN_SCAFFOLD = Object.freeze(
  V1_REGISTRY_DOMAIN_IDS.map((domainId) =>
    Object.freeze({
      domain_id: domainId,
      required_fields: V1_REGISTRY_DOMAIN_REQUIRED_FIELDS[domainId]
    })
  )
);

export {
  LOCKED_V1_ACTIVITY_IDS,
  V1_REGISTRY_DOMAIN_IDS,
  V1_REGISTRY_DOMAIN_REQUIRED_FIELDS,
  V1_REGISTRY_DOMAIN_SCAFFOLD
};