<!-- DEV NOTE: V1 relationship-permission guard control surface. This document binds reusable fail-closed product/auth permission guard functions for coach-athlete access. It does not implement engine behaviour, registry content, broad RBAC, organisation roles, team roles, gym roles, federation roles, database migrations, auth providers, UI, messaging, social connections, marketplace, or coach discovery. -->

# V1 Relationship Permission Guards

Status: active v1 relationship-permission guard boundary document.
Slice: S-V1-15.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds reusable relationship permission guard functions for v1 coach-athlete access.

The guards enforce explicit product/auth permission state only.

Permission failure is product/auth failure, not engine decision.

Permission guard output must not become deterministic engine truth.

## Active v1 guard functions

S-V1-15 activates these reusable guard functions:

- assertRelationshipPermissionInput
- assertCoachCanViewAthlete
- assertAthleteCanViewOwnData
- assertCoachAthleteAccess
- assertSurfaceCanUseRelationshipPermissionGuard
- compileIgnoringRelationshipPermissionGuards

These functions are intended to be reused by:

- coach notes
- factual artefact viewing
- live session status
- factual history

S-V1-15 does not rewire those surfaces yet. Rewiring must happen only in later explicit slices.

## Source of permission truth

The guard functions must reuse the S-V1-14 individual coach-athlete relationship acceptance boundary.

Coach access requires accepted individual coach-athlete relationship permission state.

Athlete access requires own-data access unless a later explicit permission slice activates a wider athlete permission.

Accepted invitation alone is not enough.

Account state alone is not enough.

Lifecycle state alone is not enough.

Billing state is not enough.

Support/operator state is not enough.

## Fail-closed rule

The guard functions must fail closed for:

- missing actor
- missing actor_type
- missing user_id
- missing target athlete id
- missing relationship records
- non-coach/non-athlete actor types
- unknown surface id
- unassigned coach
- invited relationship state
- rejected relationship state
- revoked relationship state
- expired relationship state
- relationship scope outside individual coach-athlete
- athlete attempting to view another athlete
- attempted engine-visible permission fields
- attempted registry authority fields
- attempted assignment authority fields
- attempted broad RBAC fields
- attempted team, organisation, organization, gym, unit, federation, enterprise, social, friend, messaging, chat, marketplace, or coach discovery fields

## Failure boundary

Permission failure must be reported as product/auth failure.

Permission failure must not be reported as:

- engine failure
- deterministic compile failure
- registry failure
- replay failure
- proof failure
- substitution failure
- legality failure
- programme assignment decision

The stable product/auth failure code is:

- relationship_permission_product_auth_failure

The stable copy id is:

- RELATIONSHIP_PERMISSION_ACCESS_DENIED

The failure object must mark:

- product_auth_failure = true
- engine_decision = false
- engine_visible = false

## Surface boundary

The only active reusable surface ids for S-V1-15 are:

- coach_notes
- session_artefacts
- live_session_status
- factual_history

The guard may map `factual_history` to the legacy history scope key `history_counts` where a scoped relationship record provides that key.

Unknown surface ids must fail closed.

If a relationship record contains a scope object and that scope object does not permit the requested surface, access is refused.

## Compatibility boundary

S-V1-15 may accept existing read-surface relationship/link shapes where they are already used by coach notes, artefacts, live status, or history.

Compatibility is limited to viewing permission checks only.

Compatibility must not widen relationship law.

Compatibility must not create relationship authority.

Compatibility must not create assignment authority.

Compatibility must not create team, organisation, organization, gym, unit, federation, enterprise, social, friend, messaging, chat, marketplace, or coach discovery scope.

New canonical surfaces should prefer the S-V1-14 relationship record shape.

## Engine boundary

Relationship permission guard state is product/auth state only.

Relationship permission guard decisions do not mutate engine truth.

The engine must not read:

- permission guard result
- permission failure reason
- actor identity
- coach identity
- athlete identity
- relationship id
- relationship state
- relationship scope
- assigned-only visibility state
- surface id
- product/auth failure state

If engine output changes because relationship permission guard data changed, the implementation is invalid.

## Copy boundary

Copy remains factual.

Permitted copy identifiers are:

- RELATIONSHIP_PERMISSION_ACCESS_GRANTED
- RELATIONSHIP_PERMISSION_ACCESS_DENIED
- RELATIONSHIP_PERMISSION_PRODUCT_AUTH_FAILURE
- RELATIONSHIP_PERMISSION_PRODUCT_AUTH_ONLY

Copy must not imply coaching outcome, safety, suitability, readiness, recommendation, optimisation, ranking, medical meaning, operational meaning, external approval, social connection, team membership, organisation role, gym role, federation role, or broad RBAC authority.

## Explicit non-scope

S-V1-15 does not implement or activate:

- engine behaviour
- registry content
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles
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
- proof implementation
- server surface rewiring

## Final rule

If coach-athlete access is not explicitly permitted by accepted individual relationship permission state, the guard must fail closed.

If athlete access is not own-data access, the guard must fail closed.

If relationship permission guard data changes engine truth, this slice is invalid.
