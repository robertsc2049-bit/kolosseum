<!-- DEV NOTE: V1 account-boundary control surface. This document freezes v1 account role scope for implementation planning. It does not implement auth, create database schema, grant access, define organisation scope, or alter engine truth. -->

# V1 Account Model Boundary

Status: active v1 account-boundary document.
Slice: S-V1-11.
Release boundary: v1 First Lawful Run.

## Purpose

This document defines the v1 account model boundary before auth, account, invitation, and relationship implementation work widens.

The account model exists to identify who can use the v1 coach-athlete product. It does not create organisation, team, gym, unit, federation, enterprise, marketplace, messaging, billing, dashboard, or access-control scope.

## Active v1 account roles

V1 supports coach and athlete only.

The active v1 account roles are exactly:

- coach
- athlete

No other account role is active v1 product scope.

## Coach account boundary

A coach account may be used to:

- hold coach identity metadata
- accept platform account terms where lawful
- participate in explicit coach-athlete relationships
- assign lawful programmes only where a later relationship/assignment slice permits it
- view factual records only where a later permission slice permits it

A coach account must not:

- become organisation scope
- become team scope
- become gym scope
- become unit scope
- become federation scope
- become enterprise scope
- become marketplace seller scope
- bypass coach-athlete relationship authority
- alter deterministic engine truth
- alter programme legality
- alter compile output
- alter substitution legality
- alter replay truth
- alter proof truth
- alter factual history

## Athlete account boundary

An athlete account may be used to:

- hold athlete identity metadata
- accept platform account terms where lawful
- own athlete declarations
- accept or reject explicit coach-athlete relationships where a later relationship slice permits it
- execute assigned sessions where a later assignment/execution slice permits it
- view factual records where a later permission slice permits it

An athlete account must not:

- become organisation scope
- become team scope
- become gym scope
- become unit scope
- become federation scope
- become enterprise scope
- become marketplace buyer scope
- bypass declaration ownership
- alter deterministic engine truth
- alter programme legality
- alter compile output
- alter substitution legality
- alter replay truth
- alter proof truth
- alter factual history

## Dormant future roles

Dormant future roles may be documented only as dormant.

The following roles are dormant and not active v1 product scope:

- organisation_admin
- organization_admin
- team_admin
- gym_admin
- unit_admin
- federation_admin
- enterprise_admin
- marketplace_seller
- marketplace_buyer
- support_operator
- auditor

Dormant roles must not appear in active v1 account flows, account schemas, runtime routes, UI surfaces, entitlement checks, dashboards, billing flows, marketplace flows, or engine inputs.

## Account state and engine truth

Account state is platform state only.

Account state must not alter engine truth.

The engine must not read:

- account role
- account status
- account invite status
- account verification status
- account billing status
- account entitlement status
- account support status
- dormant future role state

Account state must not become:

- canonical engine input
- registry authority
- legality authority
- substitution truth
- progression truth
- runtime event truth
- replay truth
- proof truth
- factual history truth

If engine output changes because of account state, the implementation is invalid.

## Allowed account states

Account lifecycle states may be documented for platform use only.

Permitted platform account lifecycle states for v1 planning are:

- invited
- active
- disabled
- deleted

These states control platform access only. They do not create engine truth.

## Explicit non-scope

S-V1-11 does not create or modify:

- auth provider implementation
- product UI
- API routes
- database migrations
- payment implementation
- enterprise billing
- organisation scope
- organization scope
- team scope
- gym scope
- unit scope
- federation scope
- marketplace
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

If an account role is not coach or athlete, it is not active v1 account scope.

If account state changes engine truth, the slice is invalid.
