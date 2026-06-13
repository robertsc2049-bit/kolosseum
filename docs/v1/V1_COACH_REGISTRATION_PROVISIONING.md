<!-- DEV NOTE: V1 coach-registration/provisioning control surface. This document binds the minimum coach account path for v1. It does not implement an auth provider, create database schema, create UI, create payment scope, create team/org/gym/federation scope, or alter engine truth. -->

# V1 Coach Registration or Provisioning

Status: active v1 provisioning-boundary document.
Slice: S-V1-12.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 coach registration or provisioning path.

The purpose of the path is to create or accept a coach platform identity as product/auth state only.

It is not an organisation account system, team account system, gym account system, federation account system, enterprise account management system, marketplace seller system, coach discovery system, payment system, or deterministic engine input.

## Active v1 path

V1 supports exactly one coach registration/provisioning path for this slice:

1. accept explicit coach identity input
2. require account_role = coach
3. create a coach platform identity record shape
4. mark the identity as product/auth state only
5. return factual copy identifiers only
6. refuse any input that attempts to become engine truth
7. refuse any adjacent scope role or account type

## Required coach identity fields

The minimal coach registration/provisioning input for S-V1-12 is:

- coach_user_id
- email
- display_name
- account_role
- account_state
- accepted_terms_version
- created_at_iso8601

The only valid account_role is coach.

The permitted account_state values are:

- invited
- active

These values control platform access state only. They do not create deterministic engine truth.

## Output boundary

The provisioning output may include:

- coach_user_id
- email
- display_name
- account_role
- account_state
- accepted_terms_version
- created_at_iso8601
- product_auth_state_only
- engine_visible
- copy_ids

The output must mark:

- product_auth_state_only = true
- engine_visible = false

## Engine boundary

Coach identity is product/auth state only.

Coach registration cannot affect deterministic compile output.

Coach registration state must not become:

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

- coach identity
- coach email
- coach display name
- coach account state
- coach accepted terms version
- coach registration source
- coach onboarding state
- coach billing state
- coach entitlement state
- coach support state

If deterministic compile output changes because coach registration/provisioning data changed, the implementation is invalid.

## Refusal boundary

The path must refuse:

- missing coach_user_id
- missing email
- missing display_name
- missing accepted_terms_version
- missing created_at_iso8601
- account_role not equal to coach
- account_state outside invited or active
- unknown top-level fields
- attempted engine-visible fields
- attempted compile-influencing fields

## Copy boundary

Copy remains factual.

Permitted copy identifiers are:

- COACH_REGISTRATION_FORM_TITLE
- COACH_REGISTRATION_CREATED
- COACH_REGISTRATION_REJECTED
- COACH_REGISTRATION_PRODUCT_AUTH_ONLY

Copy must not imply recommendation, optimisation, ranking, safety, readiness, suitability, coaching quality, training effectiveness, medical meaning, operational meaning, or external approval.

## Explicit non-scope

S-V1-12 does not implement or activate:

- auth provider implementation
- password or session implementation
- product UI
- database migrations
- payment implementation
- enterprise billing
- enterprise account management
- organisation admin
- organization admin
- team admin
- gym admin
- unit admin
- federation admin
- marketplace
- coach discovery
- coach directory
- messaging
- chat
- EPOS
- gym access
- full dashboards
- registry content
- engine behaviour
- proof implementation
- relationship implementation
- assignment implementation

## Final rule

If the actor is not a coach, this path refuses the request.

If coach registration data changes deterministic compile output, this slice is invalid.
