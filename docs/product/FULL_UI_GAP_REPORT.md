# Kolosseum Function-Complete UI Gap Report

Source: FULL-UI-00 / GitHub issue #798

This report is generated deterministically from `product/ui/function_manifest.json`.
Counts are project-state facts. They are not product, coach, athlete, readiness or quality scores.

## Overall function state

- implemented: 282
- partial: 0
- missing: 0
- prohibited: 0

## Product areas

### Identity and account access

Slice: FULL-UI-02

Area state: implemented

Implemented: 13 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `account_create` — Create athlete or coach account
- `account_sign_in` — Sign in to an existing account
- `authenticated_session` — Persist authenticated browser session
- `email_verification` — Display and complete email verification
- `password_reset` — Forgotten-password and reset flow
- `account_state_message` — Display active, suspended, closed and deleted account states
- `role_redirect` — Redirect to the lawful actor home route
- `terms_version` — Display current terms and consent versions
- `consent_history` — Display consent history
- `profile_update` — Update display name and email
- `password_change` — Change password
- `account_close_request` — Request account closure
- `sign_out` — Sign out and clear browser authentication state

### Athlete onboarding and declarations

Slice: FULL-UI-03

Area state: implemented

Implemented: 9 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `onboarding_staged` — Complete staged athlete onboarding
- `activity_declaration` — Declare activity
- `execution_scope_declaration` — Declare execution scope
- `beta_acknowledgement` — Accept product acknowledgement
- `jurisdiction_acknowledgement` — Accept jurisdiction acknowledgement
- `accessibility_preferences` — Set accessibility and instruction-density preferences
- `onboarding_review` — Review and confirm onboarding declarations
- `onboarding_completion` — Persist onboarding completion state
- `declaration_history` — Display current and historical declarations

### Coach onboarding and commercial state

Slice: FULL-UI-04

Area state: implemented

Implemented: 9 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `coach_profile_setup` — Create coach profile
- `coach_terms` — Accept coach terms
- `subscription_state` — Display current subscription state
- `seat_allowance` — Display seat allowance and usage
- `checkout_entry` — Open checkout
- `payment_return` — Handle payment success and cancellation
- `billing_portal` — Open billing portal
- `entitlement_error` — Display factual entitlement failure
- `webhook_confirmation` — Record trusted Stripe webhook confirmation

### Coach–athlete relationships

Slice: FULL-UI-05

Area state: implemented

Implemented: 10 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `relationship_invite_create` — Create coach invitation
- `relationship_invite_receive` — Receive athlete invitation
- `relationship_accept` — Accept relationship
- `relationship_decline` — Decline invitation
- `relationship_cancel` — Cancel pending invitation
- `relationship_revoke` — Revoke accepted relationship
- `relationship_expiry` — Display expired relationship
- `relationship_lists` — Display pending and accepted relationships
- `relationship_audit` — Display relationship detail and audit facts
- `relationship_history_preserved` — Preserve historical records after relationship closure

### Coach overview

Slice: FULL-UI-06

Area state: implemented

Implemented: 7 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `overview_factual_counts` — Display factual coach counts
- `overview_relationships` — Display connected and pending athletes
- `overview_assignment_queue` — Display assignments requiring action
- `overview_upcoming_events` — Display upcoming events
- `overview_open_sessions` — Display open sessions
- `overview_completed_since_review` — Display sessions completed since review
- `overview_direct_links` — Link directly to athlete, event, programme, assignment and review records

### Athlete directory and athlete profile

Slice: FULL-UI-07

Area state: implemented

Implemented: 13 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `athlete_search_filter` — Search and filter connected athletes
- `athlete_relationship_state` — Display relationship state
- `athlete_identity_activity` — Display athlete identity and activity
- `athlete_current_programme` — Display current programme assignment
- `athlete_current_event` — Display current event link
- `athlete_assignment_history` — Display assignment history
- `athlete_event_history` — Display event-link history
- `athlete_strength_history` — Display strength-reference history
- `athlete_bodyweight_history` — Display bodyweight history
- `athlete_notes_list` — Display coach notes and visibility
- `athlete_session_history` — Display athlete session history
- `athlete_relationship_revoke` — Revoke relationship from profile
- `athlete_archive_inactive` — Archive inactive relationship without deleting history

### Strength-reference management

Slice: FULL-UI-08

Area state: implemented

Implemented: 11 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `strength_tested_1rm` — Add tested 1RM
- `strength_estimated_1rm` — Add estimated 1RM
- `strength_training_max` — Add training max
- `strength_effective_date` — Validate effective date
- `strength_source_note` — Record source note
- `strength_unit_conversion` — Display converted reference values
- `strength_effective_selection` — Select current effective record
- `strength_superseded_history` — Display superseded history
- `strength_immutable_add` — Add a new immutable effective record
- `strength_missing_requirements` — Display missing references for selected programme
- `strength_resolved_source` — Display athlete-facing resolved-load source

### Standalone events

Slice: FULL-UI-09

Area state: implemented

Implemented: 13 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `events_section` — Open separate Events section
- `event_create_compile` — Create and compile coach-owned event
- `event_search_filter` — Search and filter event library
- `event_detail` — Open event detail
- `event_version_edit` — Create immutable future event version
- `event_cancel_archive` — Cancel or archive event
- `event_countdown` — Display factual event countdown
- `event_metadata` — Display location, timezone, notes, activity and type
- `event_linked_athletes` — Display linked-athlete list
- `event_linked_programme` — Display linked programme per athlete
- `event_link_unlink` — Link and unlink athlete
- `event_history_preserved` — Preserve assignment and session history after unlink
- `event_validation` — Validate conflicts and past dates

### Programme library

Slice: FULL-UI-10

Area state: implemented

Implemented: 13 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `programme_states` — Display draft, complete, active, archived and superseded states
- `programme_search_filter` — Search, filter and sort programmes
- `programme_new` — Create programme
- `programme_duplicate` — Duplicate programme version
- `programme_detail` — Open programme detail
- `programme_preview` — Preview complete programme structure
- `programme_complete` — Save a fully-validated draft as a complete template, pending activation
- `programme_activate` — Activate programme
- `programme_archive` — Archive programme
- `programme_version_metadata` — Compare factual version metadata
- `programme_assignment_usage` — Display assignment usage before archive
- `programme_immutable_active` — Prevent edits to active and archived versions
- `programme_activation_validation` — Display full activation validation summary

### Programme builder

Slice: FULL-UI-11

Area state: implemented

Implemented: 25 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `builder_identity` — Edit programme identity and activity
- `builder_ordered_blocks` — Build ordered blocks
- `builder_block_type` — Set explicit block type
- `builder_week_count` — Set weeks per block
- `builder_block_actions` — Add, remove, duplicate and reorder blocks
- `builder_week_actions` — Add, remove, duplicate and reorder weeks
- `builder_session_actions` — Add, remove, duplicate and reorder sessions
- `builder_session_composition` — Compose 1-12 exercises per session, grouped into supersets or circuits
- `builder_coaching_notes` — Add coaching notes at session and exercise level
- `builder_work_item_segment` — Mark exercises as warm-up, working, or cool-down
- `builder_exercise_info` — View written instructions, coaching cues and common faults for the selected exercise
- `builder_registry_exercises` — Select registry-backed exercises
- `builder_role` — Set primary or accessory role
- `builder_sets` — Set planned sets
- `builder_repetitions` — Set fixed repetitions or range
- `builder_loading` — Set percentage, fixed load, bodyweight or RPE
- `builder_prescription_mode` — Prescribe reps, a timed hold, or a distance per exercise
- `builder_tempo` — Set an optional coaching tempo per exercise
- `builder_load_unit` — Set load unit
- `builder_rest` — Set rest time
- `builder_summary` — Display deterministic structure summary
- `builder_unsaved_warning` — Warn about unsaved changes
- `builder_save_feedback` — Display save state and confirmation
- `builder_validation_links` — Link validation failures to fields
- `builder_keyboard_mobile` — Operate builder by keyboard and phone

### Event-to-programme calendar

Slice: FULL-UI-12

Area state: implemented

Implemented: 11 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `calendar_select_existing_event` — Select existing standalone event
- `calendar_single_event_truth` — Use standalone event as date source
- `calendar_start_date` — Set preparation start date
- `calendar_required_weeks` — Display required weeks
- `calendar_allocated_weeks` — Display allocated weeks
- `calendar_allocation_state` — Display balanced, under or over allocation
- `calendar_fit_final` — Fit final block
- `calendar_dates` — Display block and week dates
- `calendar_partial_week` — Display partial final week
- `calendar_activation_fail` — Fail activation when unbalanced
- `calendar_event_source` — Retain standalone event as authoritative source

### Athlete-specific assignment

Slice: FULL-UI-13

Area state: implemented

Implemented: 12 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `assignment_from_profile` — Assign from athlete profile
- `assignment_select_programme` — Select active programme
- `assignment_select_event` — Select optional linked event
- `assignment_preflight` — Preflight missing strength references
- `assignment_exact_version` — Display exact programme version
- `assignment_confirmation` — Confirm assignment creation
- `assignment_current_detail` — Display current assignment
- `assignment_replace` — Replace assignment
- `assignment_cancel` — Cancel future assignment
- `assignment_history` — Display assignment history
- `assignment_separate_event` — Display event link and assignment separately
- `assignment_preserve_sessions` — Preserve prior compiled sessions

### Athlete Today

Slice: FULL-UI-14

Area state: implemented

Implemented: 9 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `today_programme` — Display current programme
- `today_assignment_version` — Display assignment version
- `today_next_session` — Display next executable session
- `today_event_countdown` — Display assigned event and countdown
- `today_block_week` — Display block and week context
- `today_resolved_load_source` — Display resolved load and source
- `today_empty_states` — Display all declared empty and unavailable states
- `today_visible_notes` — Display visible coach notes
- `today_start_continue` — Start or continue current session

### Session execution

Slice: FULL-UI-15

Area state: implemented

Implemented: 19 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `session_overview` — Display pre-start session overview
- `session_ordered_exercises` — Display ordered exercises, grouped and annotated with coach notes
- `session_exercise_howto` — Expand written instructions, coaching cues and common faults for the current exercise
- `session_prescription` — Display sets, reps or a timed hold or distance, tempo, load and rest
- `session_coaching_notes` — Show the coach's session-level notes before the athlete starts
- `session_rest_timer` — Countdown prescribed rest with a completion cue
- `session_start` — Start session
- `session_complete_work` — Mark work complete
- `session_skip_reason` — Skip lawful work with factual reason
- `session_partial` — Record partial completion
- `session_stop_return` — Stop and return later
- `session_return_continue` — Continue returned session
- `session_return_skip` — Finish without remaining work
- `session_substitution` — Request and display lawful substitution
- `session_pain_input` — Record contract-permitted pain input
- `session_completion_summary` — Display completion summary
- `session_idempotent_retry` — Display idempotent retry state
- `session_reload_recovery` — Recover session after refresh
- `session_terminal_guard` — Prevent terminal-session resurrection

### Athlete history

Slice: FULL-UI-16

Area state: implemented

Implemented: 9 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `history_list` — Display session list
- `history_filters` — Filter by status, date, activity, programme and event
- `history_detail` — Open session detail
- `history_planned_recorded` — Display planned versus recorded state
- `history_split_return` — Display split and return record
- `history_partial_skip` — Display partial and skip record
- `history_provenance` — Display programme, assignment and event provenance
- `history_export` — Export athlete history
- `history_empty_unavailable` — Display empty and unavailable states

### Coach review and live status

Slice: FULL-UI-17

Area state: implemented

Implemented: 12 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `review_athlete_search` — Select and search athlete
- `review_open_sessions` — Display open sessions
- `review_completed_queue` — Display completed sessions awaiting review
- `review_factual_detail` — Display factual session detail
- `review_provenance` — Display event, programme and assignment provenance
- `review_live_status` — Display live read-only status
- `review_note_create` — Create non-binding coach note
- `review_note_list` — Display coach-note list
- `review_note_visibility` — Display note visibility
- `review_nonbinding_copy` — Display exact non-binding note copy
- `review_no_override` — Prevent coach override of engine truth
- `review_state` — Store reviewed or unreviewed product state

### Notifications and task state

Slice: FULL-UI-18

Area state: implemented

Implemented: 9 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `notification_relationship` — Notify relationship invitation and state changes
- `notification_assignment` — Notify assignment create, replace and cancel
- `notification_event` — Notify event link, unlink and cancel
- `notification_programme` — Notify programme availability
- `notification_session` — Notify session completion
- `notification_note` — Notify visible coach note
- `notification_billing` — Notify billing or entitlement action
- `notification_read_state` — Mark notifications read or unread
- `notification_deep_link` — Open notification target

### Data rights and consent

Slice: FULL-UI-19

Area state: implemented

Implemented: 10 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `data_terms_current` — Display current consent and terms
- `data_consent_history` — Display consent history
- `data_export_request` — Request data export
- `data_export_status` — Display export status
- `data_export_download` — Download available export
- `data_deletion_request` — Request deletion
- `data_deletion_review` — Review deletion consequences
- `data_deletion_confirm` — Confirm deletion
- `data_deletion_status` — Display deletion status
- `data_retention_copy` — Display retention boundary copy

### Status, support and error reporting

Slice: FULL-UI-20

Area state: implemented

Implemented: 7 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `status_current` — Display current factual platform status
- `support_report_problem` — Report a problem
- `support_context` — Attach route, timestamp, browser and correlation ID
- `support_description` — Record user description
- `support_secret_boundary` — Hide engine internals and secrets
- `support_retry` — Offer retry and recovery actions
- `support_history` — Display support request history

### Founder and admin operations

Slice: FULL-UI-21

Area state: implemented

Implemented: 10 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `admin_auth` — Guard founder and admin sign-in
- `admin_account_search` — Search accounts
- `admin_account_state` — Review account state
- `admin_entitlement` — Review coach entitlement and seats
- `admin_payment` — Review payment state
- `admin_support` — Review support and error records
- `admin_test_users` — Manage test users
- `admin_data_requests` — Review export and deletion requests
- `admin_audit_action` — Record operational action audit
- `admin_no_engine_override` — Prevent admin engine override

### Organisation owner billing and roster (v1 shell)

Slice: FULL-UI-26

Area state: implemented

Implemented: 11 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `org_owner_auth` — Organisation owner self-service identity
- `org_owner_organisations` — Create and list owned organisations
- `org_owner_roster` — Invite, list and remove coach roster memberships by email
- `org_owner_billing` — View seat usage and change the org's seat plan
- `org_owner_athlete_visibility` — View athlete-level visibility scoped by the organisation's declared visibility mode
- `org_owner_audit_log` — View the organisation's recorded activity log
- `coach_org_membership` — Coach reads, accepts and leaves org memberships from their own session
- `coach_org_roster_visibility` — Coach reads fellow coaches in a shared (team) org they're an active member of - individual (gym) orgs stay coach-private
- `org_coach_messaging` — Org owner and an active-member coach exchange threaded messages with live delivery and photo/video attachments, API-only
- `org_athlete_messaging` — Org owner and an athlete currently coached by one of the org's active coaches exchange threaded messages with live delivery and photo/video attachments, gated to team (shared-visibility) orgs only
- `athlete_org_context` — Athlete reads which org(s) their own accepted coach relationship gives them team context for - org_id, org_name and visibility_mode only, never a teammate roster

### Coach-athlete messaging

Slice: FULL-UI-27

Area state: implemented

Implemented: 1 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `coach_athlete_messaging` — Coach and athlete exchange threaded messages with live delivery and photo/video attachments while their relationship is accepted

### Cross-product quality

Slice: FULL-UI-22

Area state: implemented

Implemented: 16 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `quality_responsive` — Support phone, tablet and desktop
- `quality_keyboard` — Support keyboard navigation
- `quality_focus` — Display visible focus
- `quality_semantics` — Use semantic labels and headings
- `quality_announcements` — Announce status and errors
- `quality_contrast` — Meet colour contrast requirements
- `quality_reduced_motion` — Respect reduced-motion preference
- `quality_loading` — Display persistent loading state
- `quality_duplicate_submit` — Prevent duplicate submissions
- `quality_route_states` — Display route-level empty, error and unavailable states
- `quality_unsaved` — Protect unsaved changes
- `quality_destructive_confirm` — Confirm destructive actions
- `quality_friendly_errors` — Display user-facing errors rather than raw tokens
- `quality_deep_links` — Support stable lawful deep links
- `quality_refresh_recovery` — Recover route after refresh
- `quality_server_authority` — Keep core server records authoritative over local cache

### Athlete progress photos

Slice: FULL-UI-28

Area state: implemented

Implemented: 3 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `progress_photo_upload` — Upload dated progress photo
- `progress_photo_athlete_history` — Display own progress photo history
- `progress_photo_coach_view` — Display athlete progress photo history (read-only)

### Body metrics and habits

Slice: FULL-UI-29

Area state: implemented

Implemented: 7 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `body_metric_log` — Log a body-metric entry
- `body_metric_history_athlete` — Display own body-metric history
- `body_metric_history_coach` — Display athlete body-metric history (read-only)
- `habit_create` — Create and archive a self-defined habit
- `habit_log_completion` — Log a habit completion for a cadence unit
- `habit_streak_display` — Display current/longest streak and total completions
- `habit_history_list` — Display an athlete's habits list (read-only for coach)

### Exercise reference media

Slice: FULL-UI-30

Area state: implemented

Implemented: 1 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `exercise_reference_media_lookup` — Look up an exercise reference-media record (read-only, null until content exists)

### Exercise coaching content

Slice: FULL-UI-35

Area state: implemented

Implemented: 1 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `exercise_content_lookup` — Look up written instructions, coaching cues and common faults for a registry exercise

### Device sync

Slice: FULL-UI-31

Area state: implemented

Implemented: 6 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `device_connect` — Connect a simulated wearable device
- `device_disconnect` — Disconnect a connected device
- `device_metric_ingest` — Ingest a synced metric reading (rejects provider-computed scores outright)
- `device_connections_list_athlete` — Display own connected devices
- `device_metric_history_athlete` — Display own synced metric history
- `device_metric_history_coach` — Display athlete connected devices and synced metric history (read-only)

### Exercise video feedback

Slice: FULL-UI-32

Area state: implemented

Implemented: 5 · Partial: 0 · Missing: 0 · Prohibited: 0

#### implemented

- `video_submission_capture` — Record or upload a form-check video for a specific exercise in a session
- `video_submission_history` — Display own video submissions and coach feedback for a session
- `video_feedback_queue` — Display pending video submissions awaiting coach review, across all athletes
- `video_feedback_detail` — Display a single video submission for coach review
- `video_feedback_reply` — Reply to a video submission with text feedback, marking it reviewed

## Functions without persistent integration proof

- None

## Delivery sequence

- FULL-UI-01: implemented
- FULL-UI-02: implemented
- FULL-UI-03: implemented
- FULL-UI-04: implemented
- FULL-UI-05: implemented
- FULL-UI-06: implemented
- FULL-UI-07: implemented
- FULL-UI-08: implemented
- FULL-UI-09: implemented
- FULL-UI-10: implemented
- FULL-UI-11: implemented
- FULL-UI-12: implemented
- FULL-UI-13: implemented
- FULL-UI-14: implemented
- FULL-UI-15: implemented
- FULL-UI-16: implemented
- FULL-UI-17: implemented
- FULL-UI-18: implemented
- FULL-UI-19: implemented
- FULL-UI-20: implemented
- FULL-UI-21: implemented
- FULL-UI-22: implemented
- FULL-UI-23: implemented
- FULL-UI-24: implemented
- FULL-UI-25: implemented
- FULL-UI-26: implemented
- FULL-UI-27: implemented
- FULL-UI-28: implemented
- FULL-UI-29: implemented
- FULL-UI-30: implemented
- FULL-UI-31: implemented
- FULL-UI-32: implemented
- FULL-UI-35: implemented

## Prohibited capabilities

- `readiness_inference` — Readiness, safety, suitability, risk or optimisation inference. Boundary: Product output remains factual and deterministic.
- `engine_override` — Coach, payment, admin or UI override of engine truth. Boundary: Engine legality and deterministic output remain independent of product state.
- `diagnostic_dependency` — Diagnostic UI as a product workflow dependency. Boundary: The product UI must use public application routes only.
