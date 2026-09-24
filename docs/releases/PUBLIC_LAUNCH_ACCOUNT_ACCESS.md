<!-- DEV NOTE: LAUNCH-03 public account-access authority. This reconciles existing persisted account and relationship implementation for public-launch preparation. It does not create engine truth, organisation scope, or billing-provider activation. -->

# Public Launch Account Registration and Access

Status: LAUNCH-03 account-access authority.

Public account actors are exactly `athlete` and `coach`. Public registration must create one explicit role and one explicit account state against a unique canonical identity. There is no implicit role promotion and no organisation, team, gym, federation or enterprise account scope in this release.

## Coach journey

A coach may open registration, create a coach account, verify the required contact state, enter the LAUNCH-02 commercial path, and reach coach onboarding. LAUNCH-03 does not connect the billing provider; provider activation belongs to LAUNCH-04.

A coach has no athlete-data authority merely because the coach is authenticated or paid. Athlete access requires an accepted, non-revoked `individual_coach_athlete` relationship for that exact coach and athlete.

## Athlete journey

An athlete may create an individual account or participate through the existing invitation path, complete account setup and required declarations, then use athlete-owned surfaces. Without separate relationship authority, athlete visibility is self-only.

## Access lifecycle

The launch path requires persistent proof of registration, email verification, sign-in, sign-out, invalid/revoked session denial, disabled-account denial, explicit actor typing, athlete self access, assigned-coach access and unassigned-coach denial.

Persistent evidence is provided by:

- `test/full_ui_02c_identity_account_persistent_http.integration.test.mjs`
- `test/full_ui_25_relationship_lifecycle_persistent.integration.test.mjs`

Both are indexed by the authoritative DB-backed integration composition.

## Engine boundary

Account state, role, email/contact state, session/authentication metadata and relationship permission state are product/access state only. They are not deterministic engine inputs and cannot change compile output for identical lawful engine input.

## Proof

    node --test test/launch_03_public_account_access.test.mjs
    node scripts/launch_03_public_account_access_guard.mjs

PASS token: `PUBLIC_LAUNCH_ACCOUNT_ACCESS: PASS`

LAUNCH-03 does not authorise public launch. Final authority remains LAUNCH-10.
