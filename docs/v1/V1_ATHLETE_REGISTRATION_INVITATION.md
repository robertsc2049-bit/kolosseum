<!-- DEV NOTE: V1 athlete-registration/invitation control surface. This document binds the minimum athlete account and invite/accept path for v1. It does not implement an auth provider, create database schema, create UI, create payment scope, create social/team/org/gym/federation scope, create a coach-athlete relationship, or alter engine truth. -->

# V1 Athlete Registration or Invitation

Status: active v1 athlete-registration/invitation boundary document.
Slice: S-V1-13.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 athlete registration or invitation path.

The path creates or accepts an athlete platform identity and an athlete account invitation as product/auth state only.

It is not a friends system, social system, team invite system, organisation invite system, organization invite system, gym invite system, unit invite system, federation invite system, marketplace system, coach discovery system, payment system, or deterministic engine input.

## Active v1 path

V1 supports exactly two athlete account path shapes for this slice:

1. athlete self registration/provisioning record shape
2. athlete account invitation record shape, including invited, accepted, rejected, and expired invitation states

These shapes are product/auth state only.

They do not create a coach-athlete relationship.

They do not grant coach visibility.

They do not grant assignment authority.

They do not alter engine truth.

## Athlete registration input

The minimal athlete registration/provisioning input for S-V1-13 is:

- athlete_user_id
- email
- display_name
- account_role
- account_state
- accepted_terms_version
- created_at_iso8601

The only valid account_role is athlete.

The permitted account_state values are:

- invited
- active

These values control platform access state only. They do not create deterministic engine truth.

## Athlete invitation input

The minimal athlete invitation input for S-V1-13 is:

- invite_id
- invited_by_coach_user_id
- athlete_email
- athlete_display_name
- invitation_target_role
- invitation_scope
- invitation_state
- invited_at_iso8601
- expires_at_iso8601
- accepted_at_iso8601
- accepted_by_athlete_user_id

The only valid invitation_target_role is athlete.

The only valid invitation_scope is athlete_account_access.

The permitted invitation_state values are:

- invited
- accepted
- rejected
- expired

Accepted invitations require accepted_at_iso8601 and accepted_by_athlete_user_id.

Invited, rejected, and expired invitations must not create a coach-athlete relationship.

Accepted invitations in S-V1-13 still do not create a coach-athlete relationship. Relationship creation belongs to a later explicit relationship slice.

## Output boundary

Athlete registration output may include:

- athlete_user_id
- email
- display_name
- account_role
- account_state
- accepted_terms_version
- created_at_iso8601
- product_auth_state_only
- engine_visible
- copy_ids

Athlete invitation output may include:

- invite_id
- invited_by_coach_user_id
- athlete_email
- athlete_display_name
- invitation_target_role
- invitation_scope
- invitation_state
- invited_at_iso8601
- expires_at_iso8601
- accepted_at_iso8601
- accepted_by_athlete_user_id
- product_auth_state_only
- engine_visible
- relationship_created
- copy_ids

The output must mark:

- product_auth_state_only = true
- engine_visible = false
- relationship_created = false for invitation records

## Engine boundary

Athlete identity is product/auth state only.

Athlete registration cannot affect engine truth.

Athlete invitation cannot affect engine truth.

Athlete registration and invitation state must not become:

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
- coach-athlete relationship truth

The engine must not read:

- athlete identity
- athlete email
- athlete display name
- athlete account state
- athlete accepted terms version
- athlete invitation state
- athlete invitation source
- athlete onboarding state
- athlete billing state
- athlete entitlement state
- athlete support state

If engine truth changes because athlete registration/invitation data changed, the implementation is invalid.

## Refusal boundary

The path must refuse:

- missing athlete_user_id for registration
- missing invite_id for invitation
- missing email fields
- missing display_name or athlete_display_name
- missing accepted_terms_version for registration
- missing created_at_iso8601 for registration
- missing invited_at_iso8601 for invitation
- missing expires_at_iso8601 for invitation
- account_role not equal to athlete
- invitation_target_role not equal to athlete
- invitation_scope not equal to athlete_account_access
- account_state outside invited or active
- invitation_state outside invited, accepted, rejected, or expired
- accepted invitation without accepted_at_iso8601
- accepted invitation without accepted_by_athlete_user_id
- unknown top-level fields
- attempted engine-visible fields
- attempted relationship-created fields
- attempted compile-influencing fields
- friends, social, team, organisation, organization, gym, unit, federation, enterprise, marketplace, coach discovery, messaging, or chat scope

## Copy boundary

Invite copy must not imply coaching outcome, safety, suitability, or readiness.

Copy remains factual.

Permitted copy identifiers are:

- ATHLETE_REGISTRATION_FORM_TITLE
- ATHLETE_REGISTRATION_CREATED
- ATHLETE_REGISTRATION_REJECTED
- ATHLETE_INVITATION_CREATED
- ATHLETE_INVITATION_ACCEPTED
- ATHLETE_INVITATION_REJECTED
- ATHLETE_INVITATION_EXPIRED
- ATHLETE_INVITATION_PRODUCT_AUTH_ONLY

Copy must not imply recommendation, optimisation, ranking, safety, readiness, suitability, coaching outcome, training effectiveness, medical meaning, operational meaning, or external approval.

## Explicit non-scope

S-V1-13 does not implement or activate:

- friends
- social
- social feed
- team invites
- organisation invites
- organization invites
- gym invites
- unit invites
- federation invites
- enterprise invites
- marketplace
- coach discovery
- coach directory
- messaging
- chat
- auth provider implementation
- password or session implementation
- product UI
- database migrations
- payment implementation
- enterprise billing
- enterprise account management
- registry content
- engine behaviour
- proof implementation
- relationship implementation
- assignment implementation

## Final rule

If the actor is not an athlete, registration refuses the request.

If the invitation target is not athlete account access, invitation refuses the request.

If athlete registration or invitation data changes engine truth, this slice is invalid.
