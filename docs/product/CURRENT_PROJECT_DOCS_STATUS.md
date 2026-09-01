<!-- DEV NOTE: Current documentation-currency reference. This file points to current tracked authority and implementation evidence. It does not create engine, registry, release, product, legal, commercial, or CI authority. -->

# Current Project Documentation Status

Document class: product/docs currency reference
Status: current working reference
Authority: non-canonical, engine-inert
Scope: current tracked repository documentation and implementation pointers

## 1. Purpose

This document exists to stop historical notes, superseded copies, attached legacy documents, old PR summaries, and chat context from being mistaken for the current repository state.

It deliberately does not define current state by a latest PR number. Repository work continues after any individual PR, so current state must be read from the tracked authority, manifests, executable guards/tests, and current evidence surfaces named below.

If this file conflicts with a canonical authority source, executable guard/test, or authoritative registry/product manifest, that higher-authority source wins and this file must be reconciled.

## 2. Document classes and authority

### 2.1 Canonical authority

Canonical authority defines a boundary, contract, law, or acceptance requirement. Current authority pointers include:

- `docs/SPINE.md`
- `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/v1/V1_DOC_AUTHORITY_MAP.md`
- canonical engine-law documents and engine contracts
- canonical registry law, schemas, active registries, and registry bundle
- CI guards and tests that enforce the declared contracts

This file cannot widen, narrow, or replace those authorities.

### 2.2 Current working reference

A current working reference reports or points to current tracked state without creating authority. Examples include:

- this file
- `docs/product/FULL_UI_GAP_REPORT.md`
- current developer handover documentation under `docs/dev/`
- generated or factual reports whose own headers declare them non-authoritative

### 2.3 Historical documents and evidence

Historical documents record what a named slice, launch step, proof run, or repository state established at that time. They remain valid historical evidence and must not be rewritten to pretend they were generated from today's repository state.

Examples include named S-*, REG-FULL-*, FULL-UI-* and release-evidence records that preserve a completed decision or proof event.

Historical evidence may still be a required dependency for a current acceptance gate. Historical does not mean invalid; it means the record must be interpreted at its declared time and scope.

### 2.4 Superseded documents

A document is superseded only when its own status, an authority map, or a named successor says that it has been replaced. Age alone does not make a document superseded.

Old copies or old revisions of this status document are superseded by the version tracked on the current branch. They must not be used as a current repository baseline.

### 2.5 Attached legacy documents

Legacy attachments such as `Kolosseum_v0_redefinition.docx` and `Kolosseum_v0_redefinition_summary.txt` remain useful historical/product context when supplied with the project, but they are not a substitute for current tracked repository authority.

Where an attached legacy document conflicts with current tracked authority, the tracked authority wins.

## 3. Current release and boundary position

Read `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md` first as the repository's active boundary pointer, then follow the source documents it names.

The v1 authority chain remains centred on:

- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/v1/V1_DOC_AUTHORITY_MAP.md`

The final controlled-launch decision record is:

- `docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md`
- `docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json`

That record states `Decision: GO` for controlled launch only and authorises the named founder group only. It explicitly does not authorise open availability, marketplace access, organisation access, gym access, team access, federation access, enterprise dashboards, messaging, or other post-v1 scope.

Current repository implementation may contain later product surfaces beyond that controlled-launch decision. Implementation presence is not release authority. Do not use a later UI surface to silently widen the recorded controlled-launch scope.

## 4. Current UI implementation inventory

The current UI/product function authority surface is:

- `product/ui/function_manifest.json`

Its deterministic report is:

- `docs/product/FULL_UI_GAP_REPORT.md`

The current report records:

- implemented: 317
- partial: 0
- missing: 0
- prohibited: 0

The manifest, its direct tests, integration tests, and `ci/guards/full_ui_completion_guard.mjs` are the correct surfaces for determining whether a UI function is implemented. Do not infer current UI completeness from old slice summaries or PR lists.

Current implemented areas include identity/account access, athlete and coach onboarding, coach-athlete relationships, athlete directory/profile, strength references, standalone events, programme library, programme builder, event-to-programme calendar, athlete assignment, athlete Today, session execution, history, coach review/live status, notifications/task state, data rights, and later product surfaces represented in the same manifest.

## 5. Current registry acceptance and active activity scope

Final registry acceptance evidence is:

- `docs/roadmap/REG_FULL_09_FINAL_REGISTRY_ACCEPTANCE_GATE.md`
- `ci/evidence/reg_full_09_final_registry_acceptance.v1.json`
- `ci/registry/reg_full_09_final_registry_acceptance.mjs`

The current REG-FULL-09 evidence status is `PASS`.

The accepted active activity scope is:

- `powerlifting`
- `general_strength`
- `rugby_union`
- `strongman`

The acceptance evidence records zero unsupported activities, zero active candidate-only records, zero fallback records, zero duplicate IDs, and zero orphan relationships in the final accepted surface.

Do not replace this activity scope with older candidate-registry notes or historical controlled-launch seed counts.

## 6. Current exercise, template, and substitution state

REG-FULL-09 records the current accepted production state as:

- 244 exercises
- 244 resolved exercises
- 501 equipment-compatibility edges
- 676 activity relation pairs
- 2,028 applicability rows
- 14 programme templates
- 898 substitution edges
- 209 substitution sources
- 212 substitution targets
- zero programme-template coverage gaps
- zero substitution-reachability gaps

Template coverage in that evidence is:

- powerlifting: 4 templates
- general strength: 3 templates
- rugby union: 4 templates
- strongman: 3 templates
- low-equipment templates: 3

Relevant production-history pointers include:

- `docs/roadmap/REG_FULL_03_EXERCISE_REGISTRY_PRODUCTION.md`
- `docs/roadmap/REG_FULL_06_SUBSTITUTION_REGISTRY_PRODUCTION.md`
- `docs/roadmap/REG_FULL_07_PROGRAMME_TEMPLATE_PRODUCTION.md`
- `docs/roadmap/REG_FULL_09_FINAL_REGISTRY_ACCEPTANCE_GATE.md`

The final acceptance evidence is the preferred current acceptance pointer; earlier REG-FULL documents remain implementation/history records for their named stages.

## 7. Organisation, gym, and team-related implemented product surfaces

Organisation/gym/team-related implementation now exists in the current product/UI inventory. This does not by itself rewrite the controlled-launch or canonical v1 boundary.

Examples represented as implemented in `product/ui/function_manifest.json` and the generated UI report include:

- organisation-owner billing and seat-plan state
- organisation-owner athlete visibility constrained by declared visibility mode
- organisation-owner progress rollups with team/gym privacy rules
- coach organisation-membership read/accept/leave flows
- athlete organisation context limited to the athlete's own accepted coach relationship and declared visibility context
- gym-wide attendance events for eligible organisation owners

Where organisation visibility rules intentionally differ between shared-visibility team organisations and individual-visibility gym organisations, the implementation tests and services own those runtime privacy rules. This status file does not redefine them.

## 8. Attendance-event implementation

The current manifest includes `org_owner_attendance_events` as implemented.

That surface allows an eligible organisation owner to create a gym-wide attendance event without manually choosing athletes; currently accepted athletes across active coaches are auto-invited server-side. The owner can view the event roster and RSVP state, cancel the event, and skip or reschedule an occurrence within the declared implementation boundary.

Attendance-event persistence and notification behaviour have direct and persistent integration proof, including the attendance-event notification integration surface.

The current notification inventory also includes `notification_attendance_event`, which notifies an invited athlete when they are invited, when the event is cancelled, or when an occurrence is skipped or rescheduled, with a deep link to the athlete's own attendance view.

## 9. Notification surfaces

The current UI report records 16 implemented notification/task-state functions.

They cover factual notifications for relationship state, assignment state, event state, programme availability, session completion, visible coach notes, billing/entitlement action, read/unread state, deep links, marketplace-template lifecycle events, weekly check-ins, video feedback/submission, athlete goal achievement, and attendance events.

Use `product/ui/function_manifest.json`, the notification clients/routes, direct tests, and persistent integration tests to determine current notification implementation. Do not use older reminder-only documentation as a complete notification inventory.

## 10. Current programme-builder capabilities

The current UI report records 25 implemented programme-builder functions.

The implemented builder supports, among other declared functions:

- programme identity and activity selection
- ordered blocks and explicit block types
- block, week, and session add/remove/duplicate/reorder actions
- session composition with 1-12 exercises and superset/circuit grouping
- session- and exercise-level coaching notes
- warm-up, working, and cool-down segmentation
- registry-backed exercise selection and exercise information
- primary/accessory role selection
- sets and fixed/range repetition prescriptions
- percentage, fixed-load, bodyweight, or RPE loading
- repetition, timed-hold, or distance prescription modes
- optional tempo, load units, and rest time
- deterministic structure summary
- unsaved-change and save-state feedback
- validation links
- keyboard and phone operation

Programme-library, event-calendar, assignment, and activation-validation functions are separate implemented areas and should be read from the same current manifest rather than inferred from old builder slice notes.

## 11. Current developer documentation

The normal developer verification entrypoint is now reconciled across the repository:

- generic shell/documentation form: `npm run verify`
- local Windows PowerShell form: `npm.cmd run verify`

Current developer handover surfaces include:

- `README.md`
- `CONTRIBUTING.md`
- `DEV_OPERATING_RULES.md`
- `docs/DEVELOPER_ONBOARDING.md`
- `docs/COMMANDS.md`
- `docs/ARCHITECTURE.md`
- `docs/dev/GETTING_STARTED.md`
- `docs/dev/COMMAND_GUIDE.md`
- `docs/dev/CI_FAILURE_GUIDE.md`
- `docs/dev/SLICE_TEMPLATE.md`
- `docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md`
- `docs/GUARDS_INDEX.md`
- `docs/dev/FAILURE_TOKEN_INDEX.md`

Lower-level lint, test, build, and proof commands remain diagnostic or slice-specific surfaces. They do not replace `verify` as the normal developer verification entrypoint.

## 12. Controlled-launch scope versus repository implementation

The repository must be read in two dimensions:

1. what is implemented and proven in the current tracked product/registry/runtime surfaces; and
2. what the canonical release and controlled-launch authorities permit to be launched or claimed.

These are not interchangeable.

A product function can be implemented and tested while remaining outside the old controlled-launch decision scope. Conversely, a historical release decision can remain authoritative for its named launch even after the repository contains later implementation work.

When planning launch, commercial, or public claims, use the current release/boundary authority and controlled-launch decision records. When determining implementation existence, use the current manifest, code, tests, guards, schemas, and acceptance evidence.

## 13. Currency rules for future updates

Do not maintain this file by appending every merged PR.

Update this file when one of its authoritative pointer classes materially changes, for example:

- active release/boundary authority changes
- UI manifest state changes materially
- final registry acceptance or supported activity scope changes
- exercise/template/substitution acceptance changes
- a major implemented product area is added or removed
- controlled-launch or release decision scope changes
- canonical developer workflow changes

Keep historical evidence historical. Do not rewrite old proof records to match the latest repository.

Do not use an old PR number as the current repository baseline.

## 14. Current interpretation order

When sources conflict, use this practical order:

1. canonical law, active release/boundary authority, registry authority, and legal/CI authority
2. executable guards, tests, schemas, active registries, and authoritative product manifests for the behaviour they own
3. final acceptance evidence for its declared acceptance scope
4. current tracked working references, including this document and generated current-state reports
5. historical and superseded repo documents, interpreted at their declared time and status
6. attached legacy documents
7. chat notes, prompts, and founder memory

This order does not elevate this file above the authorities it points to.

## 15. Final ruling

`docs/product/CURRENT_PROJECT_DOCS_STATUS.md` is the current working documentation-currency pointer, not a frozen repository snapshot and not a new authority layer.

Current repository state must be derived from the tracked authority, current manifests, executable proof, and acceptance evidence listed here. Old PR baselines and corrupted legacy text must not be used as current-state evidence.
