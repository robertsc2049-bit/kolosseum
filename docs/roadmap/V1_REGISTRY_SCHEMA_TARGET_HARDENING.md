# S20 - v1 registry schema target hardening

## Status

Accepted as a guard-hardening slice.

Recorded at UTC: 2026-06-05T08:25:41Z

## Context

The v0 release lane is closed.

S18 created v1 boundary guard scaffolding.

S19 enforced the locked v1 activity set.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 locked activity set guard commit: d5df834ea0997ddef20a2a537d8c4e7b0754f90e

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This slice hardens the v1 registry schema target before registry expansion content begins. It does not add registry records, exercise records, equipment records, substitution edges, templates, UI, database migrations, auth provider integration, billing, proof, export, or commercial surfaces.

## Purpose

S20 turns the v1 registry expansion target into executable schema expectations.

The goal is to prevent future registry expansion from silently missing required domains, required fields, locked activity constraints, or copy/legal boundaries.

## Locked v1 activities

The registry schema target remains limited to:

- powerlifting
- general_strength
- rugby_union

No v1 registry schema target may imply support for other active activities.

## Registry domains requiring schema targets

The following registry domains require schema target coverage before content expansion:

- activity_registry
- movement_pattern_registry
- exercise_registry
- equipment_registry
- exercise_activity_applicability_registry
- exercise_equipment_compatibility_registry
- substitution_edge_registry
- programme_template_registry
- instruction_display_copy_registry
- copy_legal_claim_boundary_registry

## Minimum required field groups

Activity registry target fields:

- activity_id
- display_label
- allowed_movement_patterns
- allowed_exercise_families
- allowed_equipment_classes
- allowed_programme_template_types
- allowed_substitution_scope
- excluded_claim_language
- copy_legal_boundary_notes

Movement pattern registry target fields:

- movement_pattern_id
- display_label
- activity_applicability
- exercise_family
- substitution_scope
- copy_legal_boundary_notes

Exercise registry target fields:

- exercise_id
- display_label
- movement_pattern_id
- primary_activity_applicability
- secondary_activity_applicability
- equipment_requirements
- equipment_alternatives
- difficulty_tier
- joint_stress_tags
- stimulus_intent
- instruction_short_text
- instruction_detail_text
- contraindication_or_exclusion_tags
- substitution_eligibility
- template_eligibility
- copy_legal_boundary_flags

Equipment registry target fields:

- equipment_id
- display_label
- equipment_class
- activity_applicability
- movement_pattern_applicability
- substitution_relevance
- template_relevance
- low_equipment_alternative_relevance
- copy_legal_boundary_notes

Substitution edge registry target fields:

- substitution_edge_id
- source_exercise_id
- target_exercise_id
- movement_pattern_preservation
- stimulus_intent_preservation
- equipment_change_type
- excluded_equipment_handling
- joint_stress_handling
- activity_applicability
- difficulty_tier_compatibility
- deterministic_ordering_key
- copy_legal_boundary_notes

Programme template registry target fields:

- template_id
- activity_id
- template_version
- intended_programme_length
- session_frequency
- movement_pattern_coverage
- exercise_eligibility
- equipment_requirements
- substitution_compatibility
- progression_mode_boundary
- copy_legal_boundary_notes
- status

Copy/legal boundary registry target fields:

- copy_id
- copy_category
- allowed_phrase
- forbidden_phrase_references
- supported_surface
- activity_applicability
- status

## Explicitly forbidden schema target drift

Schema target hardening must reject:

- missing locked activity references
- additional active activity ids
- unknown registry domain names
- registry domains without required fields
- schema targets that imply strongman support
- schema targets that imply bodybuilding support
- schema targets that imply weightlifting support
- schema targets that imply combat sport support
- combat_sports
- schema targets that imply tactical pack support
- schema targets that imply rehabilitation pack support
- schema targets that imply youth pack support
- schema targets that imply organisation, team, gym, federation, marketplace, messaging, EPOS, gym access, or broad analytics scope

## CI integration

S20 adds:

- ci/guards/v1_registry_schema_target_guard.mjs

and wires it into:

- npm.cmd run lint:fast

The guard should run after the S19 locked activity set guard.

## Acceptance criteria

S20 is accepted when:

- this document exists
- the S20 CI guard exists
- the S20 guard is indexed in docs/GUARDS_INDEX.md
- lint:fast invokes the S20 guard
- required registry domains are listed
- required field groups are listed
- locked activities remain powerlifting, general_strength, and rugby_union
- excluded schema drift examples are rejected
- no registry content is added
- no template content is added
- no UI screen is added
- no database migration is added
- no package version is changed
- no tag is created or moved
- lint:fast passes

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not add database migrations in this slice.

Do not add registry content in this slice.

Do not add templates in this slice.

Do not add UI screens in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

The next lane is S21 - v1 registry domain scaffold.

S21 may create inert schema target artefacts if needed, but it must not add registry content records.
- tactical_pack
- rehabilitation_pack
- youth_pack
- team_dashboard
- gym_access
- broad_analytics

Exact forbidden drift tokens checked by CI:

- combat_sports
- tactical_pack
- rehabilitation_pack
- youth_pack
- organisation
- team_dashboard
- gym_access
- marketplace
- messaging
- epos
- broad_analytics
