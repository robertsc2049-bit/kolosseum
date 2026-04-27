# S39 - Coach Non-Binding Note Pack

## Target

Define exact coach note rules and UI copy.

## Invariant

Coach notes are non-binding platform records only.

Coach notes must be stored outside engine truth.

Coach notes must not:

- be read by the engine
- change Phase 1 declarations
- re-run compilation
- alter legality
- alter session selection
- alter substitutions
- alter progression
- alter future sessions
- create readiness language
- create safety language
- create recommendation language
- create judgement
- create score
- create ranking

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:

- linked athlete note access
- coach-authored non-binding note creation
- factual note storage
- note visibility to coach
- note visibility to linked athlete when surfaced
- explicit non-binding UI copy
- proof that note is outside engine truth

Excluded:

- engine-readable note input
- engine authority
- advice generation
- recommendation generation
- readiness assessment
- safety assessment
- medical or rehabilitation language
- scoring
- ranking
- judgement
- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- evidence envelope
- export proof
- messaging
- team runtime
- organisation runtime

## Required Coach Note Flow

The coach note flow must follow this order.

1. Coach account exists.
2. Athlete account exists.
3. Coach athlete link exists.
4. Coach athlete link is accepted.
5. Coach opens linked athlete note surface.
6. Coach writes note text.
7. Platform displays non-binding note copy.
8. Coach saves note.
9. Platform stores note outside engine truth.
10. Engine input remains unchanged.
11. Future engine output remains unaffected.

No other flow is part of S39.

## Required Actor Scope

Allowed actor:

- coach

Allowed target actor:

- athlete

Allowed execution scope:

- coach_managed

Coach notes are invalid for unlinked athletes.

Coach notes are invalid for revoked links.

Coach notes are invalid for pending links.

Coach notes are invalid if submitted as engine input.

## Required UI Copy

The coach note surface must display this exact copy:

"Coach notes are non-binding. They are stored outside engine truth and do not change session legality, compilation, substitutions, progression, or future sessions."

The athlete-facing note surface, where shown, must display this exact copy:

"This coach note is non-binding. It does not change your engine-generated session or future sessions."

No alternative wording is part of S39.

## Required Event Outputs

S39 allows only the following event types:

- coach_note_surface_opened
- coach_athlete_link_verified
- coach_note_saved
- coach_note_visibility_recorded

Any other event type is outside this pack.

## Event Shape

Every coach note event must include:

- event_id
- coach_id
- athlete_id
- note_id
- event_type
- actor
- occurred_at_utc

Link verification events must also include:

- link_id
- link_status

Note saved events must also include:

- note_storage_scope
- engine_readable
- engine_truth_mutated
- future_effect

Visibility events must also include:

- visibility_status
- ui_copy_id

## Event Meaning Lock

coach_note_surface_opened means the coach opened the note surface for a linked athlete.

coach_athlete_link_verified means the platform confirmed the coach athlete link was accepted and active.

coach_note_saved means the platform stored the coach note outside engine truth.

coach_note_visibility_recorded means the platform recorded note visibility and required non-binding UI copy.

These meanings must not be expanded.

## Required Storage Rules

Allowed note_storage_scope values:

- platform_metadata_only

Required engine_readable value:

- false

Required engine_truth_mutated value:

- false

Required future_effect value:

- false

No other storage behaviour exists in S39.

## Allowed Visibility Status Values

Allowed visibility_status values:

- visible_to_authoring_coach
- visible_to_linked_athlete
- visible_to_authoring_coach_and_linked_athlete

No other visibility status exists in S39.

## Coach Note Boundary

A coach may:

- write a non-binding note
- save a note outside engine truth
- view their saved note
- expose a note to the linked athlete where the UI permits
- comment on observed factual artefacts

A coach may not:

- create engine input through a note
- create future-session changes through a note
- alter substitutions through a note
- alter progression through a note
- alter legality through a note
- mark readiness through a note
- declare safety through a note
- issue binding advice through a note
- create judgement through a note
- create score or ranking through a note
- write notes for unlinked athletes

## Blocked Conditions

The coach note flow must not continue when any of the following are true:

| Condition | Required blocked_reason |
|---|---|
| coach_id is missing | missing_coach_id |
| athlete_id is missing | missing_athlete_id |
| note_id is missing | missing_note_id |
| actor is not coach | invalid_actor |
| coach athlete link is missing | link_missing |
| coach athlete link is pending | link_pending |
| coach athlete link is refused | link_refused |
| coach athlete link is revoked | link_revoked |
| coach athlete link is expired | link_expired |
| note storage scope is not platform_metadata_only | invalid_note_storage_scope |
| note is engine-readable | engine_readable_note_attempt |
| note would mutate engine truth | engine_truth_mutation_attempt |
| note would affect future sessions | future_effect_attempt |
| note would mutate Phase 1 | phase1_mutation_attempt |
| note would trigger recompilation | recompilation_attempt |
| note would alter legality | legality_mutation_attempt |
| note would override engine output | engine_override_attempt |
| note would create readiness language | readiness_claim_attempt |
| note would create safety language | safety_claim_attempt |
| note would create recommendation | recommendation_attempt |
| note would create judgement | judgement_attempt |
| note would create score | score_attempt |
| note would create ranking | ranking_attempt |
| required UI copy is missing | missing_non_binding_ui_copy |
| event_type is outside allowed set | invalid_event_type |

No fallback is permitted.

No automatic linking is permitted.

No inferred coach authority is permitted.

No note may become engine truth.

No note may be read by the engine.

No note may affect future sessions.

## Forbidden Note Semantics

The following note semantics are forbidden:

- must do
- should do
- needs to do
- ready for
- not ready for
- safe to
- unsafe to
- recommended
- recommendation
- increase next session
- reduce next session
- progression changed
- substitute this
- catch up
- failed
- poor adherence
- non-compliant
- underperformed

## Operator Checklist

S39 passes only if the operator can show:

- coach exists
- athlete exists
- accepted coach athlete link exists
- coach_note_surface_opened exists
- coach_athlete_link_verified exists
- coach_note_saved exists
- coach_note_visibility_recorded exists
- required non-binding UI copy is present
- note_storage_scope is platform_metadata_only
- engine_readable is false
- engine_truth_mutated is false
- future_effect is false
- unlinked athlete note is blocked
- pending link note is blocked
- revoked link note is blocked
- coach note does not mutate Phase 1
- coach note does not re-run compilation
- coach note does not alter legality
- coach note does not override engine output
- coach note does not create readiness, safety, recommendation, judgement, score, ranking, or future-session effect

## Minimum Demonstration Record

A valid S39 demonstration record must contain:

- slice: S39
- proof_name: coach_non_binding_note_pack
- coach_id: coach_manual_v0_001
- athlete_id: athlete_manual_v0_001
- link_id: link_manual_v0_001
- link_status: accepted
- note_id: note_manual_v0_001
- note_storage_scope: platform_metadata_only
- engine_readable: false
- engine_truth_mutated: false
- future_effect: false
- required_coach_ui_copy_present: true
- required_athlete_ui_copy_present: true
- unlinked_note_blocked: true
- pending_link_note_blocked: true
- revoked_link_note_blocked: true
- engine_authority_created: false
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- engine_output_overridden: false
- readiness_claim_present: false
- safety_claim_present: false
- recommendation_present: false
- judgement_present: false
- score_present: false
- ranking_present: false
- event_count: 4

## Final Operator Sentence

"A coach can save a non-binding note for an accepted linked athlete, stored outside engine truth, not read by the engine, and with no effect on future sessions."

## Final Rule

If a coach note becomes engine-readable, mutates engine truth, affects future sessions, changes Phase 1, re-runs compilation, alters legality, overrides engine output, or creates readiness, safety, recommendation, judgement, score, or ranking language, the S39 coach note flow does not exist.