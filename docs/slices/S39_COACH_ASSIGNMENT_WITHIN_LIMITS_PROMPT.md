S39 — Coach Assignment Within Limits

You are creating S39 — Coach Assignment Within Limits for Kolosseum v0.

Use the existing Kolosseum v0 doctrine:
- v0 is the Deterministic Execution Alpha.
- v0 supports individual_user and coach only.
- v0 supports individual and coach_managed execution only.
- v0 is Phase 1 through Phase 6 only.
- Coach assignment is permitted only as a platform visibility/access control.
- Coaches may assign existing lawful artefacts/sessions within system limits.
- Coaches may not override engine decisions, alter legality, edit Phase 1, trigger substitutions, trigger progression, mutate registries, or bypass compile.
- Tier/payment state controls access/visibility/seat limits only and must never affect engine legality, artefact content, artefact hash, determinism, or compile validity.

Create the full slice artefacts:
1. docs/slices/S39_COACH_ASSIGNMENT_WITHIN_LIMITS.md
2. db/schema/coach_assignments.sql
3. tests/s39/coach_assignment_within_limits.negative.json
4. tests/s39/run_coach_assignment_within_limits_negative_tests.mjs

The markdown must include:
- purpose
- v0 scope boundary
- assignment semantics
- status model
- target rules
- database model
- full API contract
- permission rules
- tier cap rules
- hash invariance rules
- negative tests
- acceptance criteria
- final non-mutation rule

The SQL must define:
- public.coach_assignment_status enum with assigned and revoked
- public.coach_assignments table
- assignment_id
- coach_user_id
- athlete_user_id
- coach_athlete_link_id
- session_id
- compiled_artefact_id
- assignment_status
- assigned_artefact_hash
- assigned_at
- revoked_at
- created_by
- created_at
- updated_at
- exactly-one-target constraint
- revoked_at/status consistency constraint
- assigned_artefact_hash sha256 lowercase hex constraint
- duplicate active assignment prevention
- immutability trigger preventing target/hash/identity mutation
- revoked assignment cannot be reactivated

The tests must prove:
- valid linked coach can assign existing lawful artefact
- unlinked coach cannot assign
- invited/revoked/expired/rejected links cannot assign
- both targets and no target fail
- missing/non-lawful target fails
- assignment cannot edit Phase 1
- assignment cannot force substitution
- assignment cannot bypass compile gate
- assignment cannot create engine output
- assignment cannot mutate artefact hash
- payment/tier state cannot change artefact content
- active tier cap denial cannot change artefact content
- duplicate active assignment fails
- revoked assignment cannot be reactivated
- coach cannot revoke another coach assignment
- athlete cannot assign through coach route
- assignment cannot mutate registries

Keep the implementation deterministic, closed-world, and platform-side. Do not add advisory, medical, safety, readiness, outcome, optimisation, or evidence/export language.