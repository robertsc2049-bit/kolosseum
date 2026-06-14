<!-- DEV NOTE: V1 coach-athlete relationship acceptance control surface. This document binds explicit individual coach-athlete relationship state and assigned-only viewing permission. It does not implement teams, organisations, gyms, federations, social connections, messaging, database migrations, auth providers, UI, payment, assignment, or engine behaviour. -->

# V1 Coach-Athlete Relationship Acceptance

Status: active v1 coach-athlete relationship acceptance boundary document.
Slice: S-V1-14.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 coach-athlete relationship acceptance path.

The path creates an explicit individual relationship state between one coach account and one athlete account.

The relationship state is platform permission state only.

It is not a team relationship, organisation relationship, organization relationship, gym relationship, unit relationship, federation relationship, enterprise relationship, social connection, friend connection, messaging channel, marketplace connection, assignment authority, or deterministic engine input.

## Active v1 path

V1 supports exactly one coach-athlete relationship shape for S-V1-14:

1. coach account exists as product/auth state
2. athlete account exists as product/auth state
3. athlete account invitation may have been accepted
4. coach-athlete relationship record is explicitly created
5. relationship state must be accepted before coach visibility exists
6. relationship scope must be individual_coach_athlete
7. permission surface must remain assigned-only

Accepted athlete invitation is not enough by itself.

Accepted relationship state is required.

## Relationship input

The minimal relationship acceptance input for S-V1-14 is:

- relationship_id
- coach_user_id
- athlete_user_id
- relationship_state
- relationship_scope
- accepted_at_iso8601
- created_at_iso8601
- updated_at_iso8601
- revoked_at_iso8601
- expires_at_iso8601

The permitted relationship_state values are:

- invited
- accepted
- rejected
- revoked
- expired

The only valid relationship_scope is individual_coach_athlete.

Accepted relationships require accepted_at_iso8601.

Revoked relationships require revoked_at_iso8601.

Expired relationships require expires_at_iso8601.

## Output boundary

Relationship output may include:

- relationship_id
- coach_user_id
- athlete_user_id
- relationship_state
- relationship_scope
- accepted_at_iso8601
- created_at_iso8601
- updated_at_iso8601
- revoked_at_iso8601
- expires_at_iso8601
- product_permission_state_only
- engine_visible
- copy_ids

The output must mark:

- product_permission_state_only = true
- engine_visible = false

## Permission boundary

Coach can view assigned athletes only.

Assigned means:

- relationship_state is accepted
- relationship_scope is individual_coach_athlete
- coach_user_id matches the requesting coach
- athlete_user_id matches the requested athlete
- relationship is not revoked
- relationship is not expired

Athlete can view own data only unless explicitly permitted.

For S-V1-14, explicit athlete-to-athlete permission is not active. Therefore:

- an athlete may view their own athlete data
- an athlete may not view another athlete's data
- a coach may not view an unassigned athlete's data
- a coach may not view data through invited, rejected, revoked, or expired relationship state

## Engine boundary

Coach-athlete relationship state is product permission state only.

Relationship changes do not mutate engine truth.

Relationship state must not become:

- canonical engine input
- registry authority
- legality authority
- substitution truth
- progression truth
- runtime event truth
- replay truth
- proof truth
- factual history truth
- programme assignment truth
- compile authority

The engine must not read:

- relationship_id
- coach_user_id
- athlete_user_id
- relationship_state
- relationship_scope
- accepted_at_iso8601
- revoked_at_iso8601
- expires_at_iso8601
- assigned-only visibility state
- access decision state

If engine truth changes because relationship data changed, the implementation is invalid.

## Refusal boundary

The path must refuse:

- missing relationship_id
- missing coach_user_id
- missing athlete_user_id
- missing relationship_state
- missing relationship_scope
- relationship_scope not equal to individual_coach_athlete
- relationship_state outside invited, accepted, rejected, revoked, or expired
- accepted relationship without accepted_at_iso8601
- revoked relationship without revoked_at_iso8601
- expired relationship without expires_at_iso8601
- unknown top-level fields
- attempted engine-visible fields
- attempted assignment-authority fields
- attempted team, organisation, organization, gym, unit, federation, enterprise, social, friend, marketplace, messaging, or chat scope

## Copy boundary

Copy remains factual.

Permitted copy identifiers are:

- COACH_ATHLETE_RELATIONSHIP_CREATED
- COACH_ATHLETE_RELATIONSHIP_ACCEPTED
- COACH_ATHLETE_RELATIONSHIP_REJECTED
- COACH_ATHLETE_RELATIONSHIP_REVOKED
- COACH_ATHLETE_RELATIONSHIP_EXPIRED
- COACH_ATHLETE_RELATIONSHIP_ACCESS_GRANTED
- COACH_ATHLETE_RELATIONSHIP_ACCESS_DENIED
- COACH_ATHLETE_RELATIONSHIP_PRODUCT_PERMISSION_ONLY

Copy must not imply coaching outcome, safety, suitability, readiness, recommendation, optimisation, ranking, medical meaning, operational meaning, external approval, social connection, or team membership.

## Explicit non-scope

S-V1-14 does not implement or activate:

- teams
- organisations
- organizations
- gyms
- units
- federations
- enterprise relationships
- friends
- social connections
- social graph
- messaging
- chat
- marketplace
- coach discovery
- coach directory
- auth provider implementation
- password or session implementation
- product UI
- database migrations
- payment implementation
- enterprise billing
- assignment implementation
- programme assignment authority
- registry content
- engine behaviour
- proof implementation

## Final rule

If a coach is not assigned to an athlete through an accepted individual coach-athlete relationship, coach access is refused.

If an athlete is not viewing their own data, athlete access is refused.

If relationship data changes engine truth, this slice is invalid.
