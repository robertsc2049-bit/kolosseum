<!-- DEV NOTE: Developer documentation surface. This index describes repository product surfaces, but release, engine, registry, legal, and CI authority remain in their governing records and executable checks. -->

# Product Surface Index

Document class: current product surface index

Status: current working reference

Historical filename: `V0_SURFACE_INDEX.md`

Authority: non-canonical and engine-inert

Evidence base: active release-boundary records, `product/ui/function_manifest.json`, and `docs/product/FULL_UI_GAP_REPORT.md`

## 1. Purpose and interpretation rule

This document maps what is implemented on `main`, which boundary owns it, who uses it, where it persists, whether it can affect the deterministic engine, and whether it is normally reachable through product UI.

The filename is retained for stable links. It does not mean every listed surface belongs to v0. The governing release boundary determines classification; implementation evidence determines existence. An implemented surface may therefore be v1, controlled-launch, operator-only, or post-v1 without becoming active v0.

If this index conflicts with a canonical release, engine, registry, legal, or CI source, that source wins and this index must be repaired.

## 2. Authority and evidence order

Use these surfaces in order:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md` and the release records it points to classify scope.
2. `docs/v1/V1_RELEASE_BOUNDARY.md`, `docs/v1/V1_NOT_IN_SCOPE.md`, and `docs/v1/V1_ACCEPTANCE_GATE.md` distinguish v1, controlled-launch support, and post-v1 scope.
3. `product/ui/function_manifest.json` records implemented product functions, actors, persistence, routes, tests, and delivery slices.
4. `docs/product/FULL_UI_GAP_REPORT.md` is the generated UI-completion report. Its current result is 317 implemented, zero partial, zero missing, and zero prohibited.
5. `docs/roadmap/REG_FULL_09_FINAL_REGISTRY_ACCEPTANCE_GATE.md` and `ci/evidence/reg_full_09_final_registry_acceptance.v1.json` own current registry acceptance.
6. `docs/product/CURRENT_PROJECT_DOCS_STATUS.md` is the current documentation pointer. Historical slice records remain evidence for their named work, not current classification authority.

Existence does not change a release boundary. In particular, a current implemented post-v1 surface is not active v0 or v1 merely because it is present in the manifest or reachable in the UI.

## 3. Classification and lifecycle keys

Classification is one of:

- `active-v0`: part of the frozen v0 execution/product foundation.
- `v1`: part of the First Lawful Run coach-athlete boundary.
- `post-v1`: implemented beyond the canonical v1 boundary; implementation is not launch authority.
- `controlled-launch`: separately sliced launch support allowed by the v1 controlled-launch extension.
- `operator-only`: role-gated operational or founder administration, not ordinary athlete/coach scope.
- `product-design-reference`: engine-inert product or design documentation.
- `diagnostic-only`: fenced diagnostics, fixtures, previews, or test-only presentation.
- `future-platform`: direction not currently implemented as the described product capability.

Lifecycle is separate from classification:

- `current`: implemented or actively relied upon now.
- `historical`: retained evidence for a completed named stage.
- `diagnostic`: not a normal product path.
- `future`: not currently implemented as the described capability.

## 4. Current manifest product areas

The table below is the complete area-level reconciliation of the current function manifest. Persistence names are the manifest's storage categories. “UI” means ordinary discoverability through a route or lawful in-product action; role-gated surfaces still count as normally reachable for their authorised actor.

<!-- ADMIN-04:MANIFEST-SURFACE-TABLE:START -->
| Area ID | Product area | Classification | Owning boundary / slice | Actor | Persistence | Engine impact | UI | Lifecycle |
|---|---|---|---|---|---|---|---|---|
| `identity_account` | Identity and account access | `v1` | S-V1-11–S-V1-15; FULL-UI-02 | athlete, coach | server authoritative records | None; authentication cannot alter engine truth | Yes | `current` |
| `athlete_onboarding` | Athlete onboarding and declarations | `v1` | S-V1-16–S-V1-19; FULL-UI-03 | athlete | server product records | Declared input only; engine validation remains authoritative | Yes | `current` |
| `coach_commercial` | Coach onboarding and commercial state | `controlled-launch` | S-V1-12 and S-V1-P-01–P-04; FULL-UI-04 | coach | authoritative account records and append-only account/profile events | None; commercial state is engine-inert | Yes | `current` |
| `relationships` | Coach–athlete relationships | `v1` | S-V1-20–S-V1-23; FULL-UI-05 | athlete, coach | server product records | None; relationship authority only | Yes | `current` |
| `coach_overview` | Coach overview | `v1` | V1 coach-athlete path; FULL-UI-06 | coach | authoritative/product records and navigation cache | None; factual read model only | Yes | `current` |
| `athlete_directory` | Athlete directory and athlete profile | `v1` | V1 coach-athlete path; FULL-UI-07 | athlete, coach | authoritative and product records | None; access-scoped factual records | Yes | `current` |
| `strength_references` | Strength-reference management | `v1` | V1 declaration/input boundary; FULL-UI-08 | athlete, coach | append-only immutable snapshots | Declared input only; no hidden inference | Yes | `current` |
| `events` | Standalone events | `post-v1` | FULL-UI-09 | coach | server product records | None | Yes | `current` |
| `programme_library` | Programme library | `v1` | V1 template and assignment boundary; FULL-UI-10 | coach | authoritative and product records | None until lawful compile input is selected | Yes | `current` |
| `programme_builder` | Programme builder | `v1` | V1 template system; FULL-UI-11 | coach | active registry, registry reads, product records, navigation cache | Produces declared programme input; cannot override compiler or registry law | Yes | `current` |
| `event_calendar_binding` | Event-to-programme calendar | `post-v1` | FULL-UI-12 | coach | server product records | None | Yes | `current` |
| `assignments` | Athlete-specific assignment | `v1` | V1 assignment boundary; FULL-UI-13 | coach | authoritative and product records | Selects lawful compile input; does not alter engine rules | Yes | `current` |
| `athlete_today` | Athlete Today | `v1` | V1 minimum acceptance path; FULL-UI-14 | athlete | product records and server sessions | Factual presentation of assigned/session state | Yes | `current` |
| `session_execution` | Session execution | `v1` | Active v0 engine foundation plus V1 mobile execution; FULL-UI-15 | athlete | product records, registry reads, navigation cache, server sessions | Calls deterministic compile/runtime paths; UI has no engine authority | Yes | `current` |
| `athlete_history` | Athlete history | `v1` | V1 factual history boundary; FULL-UI-16 | athlete | server sessions | None; factual read-only history | Yes | `current` |
| `coach_review` | Coach review and live status | `v1` | V1 factual coach view and notes; FULL-UI-17 | coach | authoritative and product records | None; notes and status remain engine-invisible | Yes | `current` |
| `notifications` | Notifications and task state | `controlled-launch` | S-V1-R-01/R-02 and later area extensions; FULL-UI-18 | athlete, coach | server product records | None; factual delivery state only | Yes | `current` |
| `data_rights` | Data rights and consent | `controlled-launch` | Controlled-launch legal/data support; FULL-UI-19 | athlete, coach | server account records | None | Yes | `current` |
| `status_support` | Status, support and error reporting | `controlled-launch` | S-V1-P-07 and controlled-launch support; FULL-UI-20 | athlete, coach | runtime health and product records | None; reports health and factual errors | Yes | `current` |
| `founder_admin` | Founder and admin operations | `operator-only` | FULL-UI-21 | founder admin | server product records | None; explicit no-engine-override boundary | Role-gated | `current` |
| `organisation_billing` | Organisation owner billing and roster (v1 shell) | `post-v1` | FULL-UI-26 and later organisation slices | athlete, coach, organisation owner | server product records | None; organisation/commercial state is engine-inert | Role-gated | `current` |
| `messaging` | Coach-athlete messaging | `post-v1` | FULL-UI-27 and later messaging extensions | athlete, coach | server product records | None | Yes | `current` |
| `cross_product_quality` | Cross-product quality | `v1` | FULL-UI-22 | athlete, coach | product records and navigation cache | None | Yes | `current` |
| `progress_photos` | Athlete progress photos | `post-v1` | FULL-UI-28 | athlete, coach | server product records | None; factual media only | Yes | `current` |
| `body_metrics_habits` | Body metrics and habits | `post-v1` | FULL-UI-29 | athlete, coach | server product records | None; factual records must not drive inference or readiness | Yes | `current` |
| `exercise_reference_media` | Exercise reference media | `post-v1` | FULL-UI-30 | athlete, coach | server registry reads | None; registry presentation only | Yes, embedded | `current` |
| `exercise_content` | Exercise coaching content | `post-v1` | FULL-UI-35 | athlete, coach | server registry reads | None; content cannot alter engine law | Yes, embedded | `current` |
| `device_sync` | Device sync | `controlled-launch` | S-V1-P-05/P-06; FULL-UI-31 | athlete, coach | server product records | None; provider scores and engine coupling are prohibited | Yes | `current` |
| `video_feedback` | Exercise video feedback | `post-v1` | FULL-UI-32 | athlete, coach | server product records | None; feedback is non-authoritative | Yes | `current` |
| `progress_insights` | Progress insights | `post-v1` | FULL-UI-36 | athlete, coach | server product records | None; no ranking, prediction, or readiness inference | Yes | `current` |
| `athlete_goals` | Athlete goal-setting | `post-v1` | FULL-UI-37 | athlete, coach | server product records | None; goals do not alter engine truth | Yes | `current` |
| `weekly_checkins` | Athlete weekly check-in | `post-v1` | FULL-UI-64 | athlete, coach | server product records | None; factual communication record | Yes | `current` |
| `coach_branding` | Coach branding preference | `post-v1` | FULL-UI-65 | athlete, coach | server product records | None | Yes | `current` |
| `programme_marketplace` | Programme template marketplace visibility | `post-v1` | FULL-UI-67 | coach | server product records | None; copied templates still require lawful compile | Yes | `current` |
| `attendance_events` | Attendance events - invite and RSVP | `post-v1` | FULL-UI-76 | athlete, coach | server product records | None | Yes | `current` |
<!-- ADMIN-04:MANIFEST-SURFACE-TABLE:END -->

The manifest title for `organisation_billing` retains “v1 shell” as implementation history. The canonical v1 boundary expressly excludes organisations, teams, gyms, enterprise billing, messaging, marketplace, and full dashboards. This index therefore classifies the implemented areas by the canonical boundary rather than by a legacy title.

## 5. Active v0 foundation and registry-supported scope

| Surface | Classification | Owner | Actor | Persistence | Engine impact | UI | Lifecycle |
|---|---|---|---|---|---|---|---|
| Deterministic declaration, compile, substitution, session execution, split/return, partial completion, and factual runtime events | `active-v0` | v0 completion and engine public-contract records | athlete through lawful adapters; coach only where authorised | canonical artefacts and factual append-only runtime/session records | Authoritative deterministic engine behaviour | Reached through V1 execution UI; engine remains independently governed | `current` |
| Accepted registry bundle | `v1` | REG-FULL-09 | coach, athlete, compiler | active registries | Declared registry input under registry and engine law | Read through builder, assignment, session, and reference UI | `current` |

Current REG-FULL-09 acceptance is `PASS`. The supported active activity scope is `powerlifting`, `general_strength`, `rugby_union`, and `strongman`. Its accepted production evidence records 244 exercises, 14 programme templates, and 898 substitution edges. These are current registry facts; they do not silently widen v0.

## 6. Organisation, attendance, notifications, builder, marketplace, and reporting

- Organisation owner billing, membership, roster visibility, organisation-aware messaging, and gym/team privacy modes are implemented and role-gated. They remain `post-v1` because canonical v1 excludes organisation, team, gym, and enterprise scope.
- Attendance events are implemented for eligible coach/organisation contexts, including recurrence, invitation/roster state, RSVP, cancellation, skip, and reschedule where declared. They remain `post-v1`.
- Notifications are implemented as factual product records and UI/deep-link state. Core and launch notifications are `controlled-launch`; notification types attached to post-v1 areas do not promote those areas into v1.
- The programme library and builder are current `v1` surfaces backed by active registry reads and persisted drafts/templates. Their output remains declared product input; compiler, substitution, and registry law remain authoritative.
- Marketplace visibility, release, cloning, and history are implemented `post-v1` surfaces. Payment remains off-platform in the declared implementation; no marketplace launch is authorised by existence.
- Athlete history and factual coach review belong to `v1`. Broader progress photos, metrics/habits, goals, check-ins, video feedback, and progress-insight rollups are implemented `post-v1`; none may imply ranking, prediction, readiness, suitability, safety, or medical judgement.

## 7. Historical, diagnostic, reference, and future surfaces

| Surface | Classification | Owner | UI | Lifecycle | Meaning |
|---|---|---|---|---|---|
| S36–S52 implementation records | classification follows the current area above | named historical slices | Superseded by current routed surfaces where applicable | `historical` | Retained proof of incremental v0/pilot/coach-review work; not the complete current product map. |
| S53 renderer and S54 static preview | `diagnostic-only` | S53/S54 | No normal production navigation | `diagnostic` | Fixture-backed preview artefacts without live API, auth, storage, or route authority. |
| Legacy public UI diagnostics fence | `diagnostic-only` | diagnostic fence | Disabled unless explicitly enabled | `diagnostic` | Does not prove a product capability is launchable. |
| `docs/product/CURRENT_PROJECT_DOCS_STATUS.md` | `product-design-reference` | documentation currency governance | No | `current` | Pointer to current documentation authority and evidence. |
| `docs/product/FULL_UI_GAP_REPORT.md` | `product-design-reference` | manifest report generator | No | `current` | Generated implementation-completeness report, not release authority. |
| Brand/feel parameter documents | `product-design-reference` | product/design documentation | No | `current` | Engine-inert visual and copy direction. |

The following remain `future-platform` unless later named boundary and implementation evidence activate them:

- federation and cross-entity governance runtime beyond the implemented organisation scope;
- gym access control and EPOS;
- real wearable-provider OAuth/SDK integration beyond the controlled simulated/factual device boundary;
- athlete or coach ranking, predictive readiness, capability inference, automated coaching, or medical/safety conclusions;
- enterprise-wide commercial/analytics capabilities beyond the implemented role-gated organisation surfaces;
- new activities outside the accepted active registry set.

Do not describe implemented organisation, messaging, marketplace, attendance, or progress surfaces as nonexistent. Describe them as current implementation under a post-v1 boundary.

## 8. Controlled-launch limit

Controlled-launch implementation does not authorise public availability. The active controlled-launch decision remains limited to its named founder group and expressly does not authorise marketplace, organisation, gym, team, federation, enterprise-dashboard, messaging, or other post-v1 launch scope.

## 9. Maintenance rule

Any change to `product/ui/function_manifest.json` must keep the manifest table reconciled through `test/admin_04_product_surface_index_reconciliation.test.mjs`.

For a new major surface record:

- its governing release classification and named owner;
- authorised actor;
- persistence category;
- engine impact;
- normal UI reachability;
- lifecycle state.

Never infer release classification from implementation alone. Never use this index to change engine, registry, legal, commercial, or release authority.
