# V0 Active Scope Manifest

Document ID: v0_active_scope_manifest
Document title: Kolosseum v0 Active Scope Manifest
Version: 1.0.0
Status: authoritative
Scope class: closed_world
Rewrite policy: rewrite_only

## 1. Purpose

This document defines the active v0 scope boundary for Kolosseum.

Kolosseum v0 is the Deterministic Execution Alpha. It is limited to individual_user, coach, individual, coach_managed, powerlifting, rugby_union, general_strength, Phase 1 through Phase 6 only, factual runtime execution, split / return, partial completion, coach assignment, factual artefact viewing, and non-binding coach notes.

This manifest controls v0 scope enforcement only. It does not grant engine behaviour. It does not define phase behaviour. It does not expand product authority.

## 2. Closed-world rule

The v0 manifest is closed-world.

If a value is not explicitly allowed, it is not active in v0.

Unknown values fail closed.

## 3. Allowed actor types

- individual_user
- coach

## 4. Forbidden actor types

- org_admin
- team_admin
- unit_admin
- gym_admin
- pti
- federation_admin
- state_admin
- medical_user
- auditor

This list is not exhaustive. Any unlisted actor type also fails closed.

## 5. Allowed execution scopes

- individual
- coach_managed

## 6. Forbidden execution scopes

- org_managed
- team_managed
- unit_managed
- gym_managed
- state_managed
- federation_managed
- group_execution

This list is not exhaustive. Any unlisted execution scope also fails closed.

## 7. Allowed activities

- powerlifting
- rugby_union
- general_strength

## 8. Forbidden activity examples

- football_soccer
- american_football
- weightlifting
- crossfit
- running
- cycling
- swimming
- boxing
- mma
- hyrox
- bodybuilding
- military_fitness

This list is illustrative. Any activity outside the allowed activity set fails closed.

## 9. Allowed engine phases

- phase_1
- phase_2
- phase_3
- phase_4
- phase_5
- phase_6

## 10. Forbidden engine phases

- phase_7
- phase_8
- truth_projection
- evidence_generation
- evidence_sealing

Phase 7 and Phase 8 may exist as broader platform law, but they must not be reachable, callable, surfaced, exported, or claimed in active v0.

## 11. Allowed product surfaces

- onboarding
- phase1_declaration
- coach_assignment
- coach_athlete_link
- session_execution
- factual_history_counts
- factual_artefact_viewing
- non_binding_coach_notes
- split_return
- partial_completion
- operator_pilot_status

## 12. Forbidden product surfaces

- organisation_runtime
- team_runtime
- unit_runtime
- gym_runtime
- dashboards
- analytics
- rankings
- leaderboards
- messaging
- readiness_dashboard
- performance_dashboard
- evidence_export
- proof_export
- audit_export
- medical_screening
- rehab_workflow
- injury_risk_workflow
- program_optimisation
- auto_progression
- coach_override
- registry_authoring_ui
- registry_editing_ui
- billing_driven_engine_behaviour

## 13. Allowed claim classes

- scope_fact
- access_fact
- visibility_fact
- authority_limit
- factual_runtime_surface
- seat_cap_fact
- price_fact
- proof_scoped_value

Allowed claim classes do not permit stronger public language than the registered copy surface.

## 14. Forbidden claim classes

- outcome_improvement
- performance_improvement
- optimisation
- recommendation
- safety
- risk_reduction
- injury_prevention
- medical
- rehab
- readiness
- suitability
- compliance
- correction
- guarantee
- best_result
- evidence_complete
- proof_export
- coach_decision_authority
- organisation_runtime_authority

## 15. Allowed runtime events

- session_started
- work_item_completed
- work_item_skipped
- work_item_partially_completed
- session_split
- session_returned
- session_resumed
- session_ended
- extra_work_recorded
- work_modified_recorded

## 16. Forbidden runtime semantics

- advice
- recommendation
- correction
- compensation
- progression_trigger
- readiness_assessment
- safety_assessment
- medical_assessment
- rehab_assessment
- risk_assessment
- compliance_score
- adherence_score
- performance_score
- ranking
- optimisation
- automatic_recompile_from_runtime_event
- runtime_registry_mutation

Runtime may record facts. Runtime must not decide, judge, recommend, optimise, or mutate engine truth.

## 17. Allowed coach authority

- assign_within_system_limits
- view_linked_athlete_factual_artefacts
- write_non_binding_notes
- view_linked_athlete_factual_history_counts

## 18. Forbidden coach authority

- override_engine_decision
- alter_engine_legality
- edit_phase1_declaration
- trigger_substitution
- force_progression
- modify_registry
- alter_compiled_output
- edit_runtime_truth
- view_unlinked_athletes
- declare_readiness
- declare_safety
- issue_medical_advice
- rank_athletes
- create_org_runtime

Coaches may comment, never decide.

## 19. CI enforcement

CI must scan app, web, admin, server, shared, docs, marketing, emails, tests, and fixtures.

CI must fail if any scanned surface contains a forbidden actor, scope, activity, phase, product surface, claim class, runtime semantic, or coach authority.

CI must fail closed on unknown values.

## 20. Final rule

If a feature, claim, actor, scope, phase, authority, runtime semantic, or product surface is not explicitly allowed by this manifest, it is not active in v0.

This manifest does not define engine behaviour. It only controls active v0 scope enforcement.