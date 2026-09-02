<!-- DEV NOTE: LAUNCH-01 release-surface authority. This document explains the executable closed-world manifest; it does not implement or activate product capability. -->

# Public Launch Surface Manifest

Slice: LAUNCH-01
Release: Kolosseum Public Launch
Authority: LAUNCH-00

The machine authority is `docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.json`.

LAUNCH-01 classifies the exact current `product/ui/function_manifest.json` inventory. It does not infer release availability from implementation presence. The source UI manifest is blob-pinned and count-pinned at 35 product areas and 317 functions, so any added, removed or silently changed function fails closed until this authority is explicitly reconciled.

## Classifications

`launch_active`:

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

`launch_operator_only`:

- `founder_admin`

`implemented_not_launched`:

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

The current manifest has no areas classified `historical`, `diagnostic` or `future`. Those categories remain explicit closed-world vocabulary rather than implicit availability states.

## Function records

The executable guard deterministically materializes every current function into a release record containing function ID, actor ownership, route/action, persistence, implementation and release authority, direct test, persistent integration proof where applicable, commercial entitlement where applicable, engine impact and launch classification.

Functions inherit their launch classification from their exact product-area classification. Function-level overrides are forbidden unless a later release authority explicitly creates such a mechanism.

`coach_commercial` is a launch-active target area but its commercial entitlement remains downstream-gated by LAUNCH-02, LAUNCH-04 and LAUNCH-10. Payment or entitlement state cannot alter deterministic engine truth.

Implementation routes for excluded post-v1 areas may exist in the repository. That implementation fact is not release reachability. LAUNCH-01 keeps those functions out of the materialized public launch surface.

## Executable proof

    node --test test/launch_01_public_launch_surface_manifest.test.mjs
    node scripts/launch_01_public_launch_surface_guard.mjs

The final public launch decision still belongs only to LAUNCH-10.
