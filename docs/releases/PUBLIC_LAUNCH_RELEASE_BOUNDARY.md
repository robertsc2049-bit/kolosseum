<!-- DEV NOTE: LAUNCH-00 release preparation authority. This document defines which existing surfaces may be prepared for the next public launch. It does not itself authorise public launch, implement product capability, alter engine law, alter registry law, define pricing, or rewrite historical controlled-launch evidence. -->

# Kolosseum Public Launch Release Boundary

Slice: LAUNCH-00
Release name: Kolosseum Public Launch
Status: current release preparation authority
Activation state: NOT YET AUTHORISED
Final acceptance gate: LAUNCH-10
Final acceptance statement: `PUBLIC_LAUNCH_ACCEPTANCE: GO`

## Purpose

This document establishes the current release boundary for the next Kolosseum public launch from the repository's actual tracked state.

Implementation existence is not release activation. A function may exist, be tested, and be reachable in development while remaining outside this launch boundary.

This document supersedes the historical founder-group-only controlled-launch boundary for this new release's activation decisions only. It does not change the meaning, result, or evidence of the historical controlled launch.

The historical record remains final for its original scope:

- `docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md`
- `docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json`

Those files must not be rewritten to pretend they authorised this later release.

## Authority position

For current public-launch preparation, read in this order:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
2. `docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.md`
3. `docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json`
4. canonical engine and registry law for the behaviour they own
5. `product/ui/function_manifest.json` for current implementation existence
6. `ci/evidence/reg_full_09_final_registry_acceptance.v1.json` for accepted registry scope
7. `docs/roadmap/ADMIN_08_FINAL_REPOSITORY_ADMINISTRATIVE_ACCEPTANCE_GATE.md` for repository administrative closure
8. existing v1 release documents for the historical First Lawful Run boundary and inherited invariants

The machine-readable JSON is the closed-world release-preparation manifest paired with this document. If the two disagree, LAUNCH-00 fails.

## Historical v1 and controlled-launch position

`docs/v1/V1_RELEASE_BOUNDARY.md`, `docs/v1/V1_ACCEPTANCE_GATE.md`, `docs/v1/V1_NOT_IN_SCOPE.md`, and `docs/v1/V1_DOC_AUTHORITY_MAP.md` remain valid records for the First Lawful Run and its original scope.

LAUNCH-00 does not retroactively relabel later implementation as v1. It creates a new release-preparation authority above the historical founder-group-only controlled-launch activation limit.

The previous controlled-launch decision remains a factual historical GO for the named founder group only. LAUNCH-00 does not alter that decision or its release tag.

## Public launch actors

Permitted public actors for this release candidate are:

- athlete
- coach

`founder_admin` remains operator-only and is not a public actor.

The following current manifest actors are not public launch actors under LAUNCH-00:

- `org_owner`
- `shared`

No later role becomes public merely because implementation exists.

## Permitted activity scope

The public launch candidate uses the exact REG-FULL-09 accepted activity scope:

- `powerlifting`
- `general_strength`
- `rugby_union`
- `strongman`

The activity set is closed world. An activity outside REG-FULL-09 accepted scope is not permitted by LAUNCH-00.

## Public launch candidate product areas

The following current implemented product areas may be prepared for the public launch candidate:

- `identity_account`
- `athlete_onboarding`
- `coach_commercial`
- `relationships`
- `coach_overview`
- `athlete_directory`
- `strength_references`
- `programme_library`
- `programme_builder`
- `assignments`
- `athlete_today`
- `session_execution`
- `athlete_history`
- `coach_review`
- `notifications`
- `data_rights`
- `status_support`
- `cross_product_quality`

All functions in these areas must resolve in `product/ui/function_manifest.json` and remain implemented. LAUNCH-01 will perform the next function-level launch classification and reachability lock.

## Operator-only area

The following area may remain available only to its authorised operator role and is not public launch scope:

- `founder_admin`

Operator-only existence is not public product activation.

## Implemented but not launched

The following current areas remain implemented but are not authorised for this public launch candidate by LAUNCH-00:

- `events`
- `event_calendar_binding`
- `organisation_billing`
- `messaging`
- `progress_photos`
- `body_metrics_habits`
- `exercise_reference_media`
- `exercise_content`
- `device_sync`
- `video_feedback`
- `progress_insights`
- `athlete_goals`
- `weekly_checkins`
- `coach_branding`
- `programme_marketplace`
- `attendance_events`

This classification is deliberate. It does not describe these surfaces as missing. It records that implementation existence does not grant release activation.

The excluded capability boundary also covers organisations, organizations, teams, gyms, federation runtime, enterprise, marketplace, chat, attendance events, progress-photo and progress-insight features, body-metric/habit features, goals, weekly check-ins, video feedback, coach branding, event-calendar extensions, standalone events, device sync, exercise reference media, and exercise coaching content.

A later slice may change this only through an explicit release-boundary rewrite with matching proof. Silence is not permission.

## Commercial surface position

The existing `coach_commercial` implementation may participate in release preparation only within the existing factual account/commercial boundary.

Existing candidate functions are:

- `coach_profile_setup`
- `coach_terms`
- `subscription_state`
- `seat_allowance`
- `checkout_entry`
- `payment_return`
- `billing_portal`
- `entitlement_error`
- `webhook_confirmation`

LAUNCH-00 does not define pricing and does not implement or change payment behaviour.

Commercial activation requires the downstream commercial and billing slices and final LAUNCH-10 acceptance.

## Engine truth boundary

The following states are product, presentation, commercial, or operational state and cannot alter deterministic engine truth merely by changing value:

- payment state
- entitlement state
- UI state
- commercial state
- product state
- coach notes
- notification state

These states cannot become hidden engine inputs, legality overrides, compile-output switches, substitution overrides, replay overrides, proof overrides, or factual-history rewrites.

Existing engine and registry law remain authoritative for the behaviour they own.

## Required downstream gates

Public launch is not authorised by LAUNCH-00.

The release must still pass the named downstream lane:

1. LAUNCH-01 - Public Launch Surface Manifest
2. LAUNCH-02 - Commercial Pricing and Entitlement Freeze
3. LAUNCH-03 - Public Account Registration and Access Activation
4. LAUNCH-04 - Production Billing Lifecycle Activation
5. LAUNCH-05 - Coach Onboarding and Programme Rebuild Flow
6. LAUNCH-06 - Legal, Privacy and Data Rights Production Closure
7. LAUNCH-07 - Production Environment and Operational Closure
8. LAUNCH-08 - Real Production Cohort End-to-End Rehearsal
9. LAUNCH-09 - Public Website, Pricing and Sales Copy Closure
10. LAUNCH-10 - Final Public Launch Acceptance Gate

Only LAUNCH-10 may emit `PUBLIC_LAUNCH_ACCEPTANCE: GO`.

## Proof requirements

LAUNCH-00 must prove:

- this document and the machine-readable manifest agree;
- every classified current product area resolves in `product/ui/function_manifest.json`;
- every public-candidate function remains implemented;
- FULL-UI remains zero partial and zero missing;
- the permitted activity set exactly matches REG-FULL-09 accepted scope;
- REG-FULL-09 remains PASS;
- the historical controlled-launch decision files remain byte-identical to the pinned Git blobs;
- excluded current areas remain excluded in the LAUNCH-00 closed-world manifest;
- negative fixtures fail when an excluded area, excluded actor, or unsupported activity is promoted;
- ADMIN-08 remains part of the required GitHub acceptance chain;
- repository verification remains green.

Executable proof:

```text
node --test test/launch_00_current_release_authority.test.mjs
node scripts/launch_00_current_release_authority_guard.mjs
npm run verify
```

GitHub PR acceptance also requires the existing ADMIN-08 repository administrative closure job to pass on the exact head.

## Non-scope

LAUNCH-00 does not implement or change:

- payments;
- pricing;
- account registration behaviour;
- UI behaviour;
- database migrations;
- programme imports;
- marketplace activation;
- organisation activation;
- new registry content;
- engine behaviour.

No substantive implementation failure discovered while validating LAUNCH-00 may be hidden by widening this authority merely to make the gate pass.

## Final ruling

LAUNCH-00 establishes the release-preparation boundary for the Kolosseum Public Launch candidate.

It permits preparation of the declared athlete-coach product areas and accepted REG-FULL-09 activity scope, keeps later post-v1 surfaces explicitly unlaunched, preserves historical controlled-launch evidence, and leaves final public launch authorisation to LAUNCH-10.
