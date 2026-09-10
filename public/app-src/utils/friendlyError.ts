// DEV NOTE: ported from public/app/app.js's factualAccountStateMessage()/
// friendlyError()/genericFriendlyMessageForStatus() (the legacy shell already
// enforces the rule that an unmapped internal reason/failure token must
// never become the user's only message on its own - the person using the
// product always sees plain, factual, actionable copy instead of a raw
// code). The legacy app.js bundle and this Vite-built React app don't share
// a module graph, so this is a deliberate one-time port rather than a
// shared import - keep the two message tables in sync if either grows.

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const ACCOUNT_STATE_MESSAGES: Record<string, string> = {
  suspended: "This account is suspended. Workspace access is unavailable.",
  closed: "This account is closed. Sign-in and workspace access are unavailable.",
  deleted: "This account has been deleted. Sign-in and workspace access are unavailable."
};

function factualAccountStateMessage(accountState: unknown): string {
  return ACCOUNT_STATE_MESSAGES[String(accountState ?? "")] ?? "This account is not currently active.";
}

export const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  account_email_invalid: "Enter a valid email address.",
  account_display_name_invalid: "Enter a display name of 80 characters or fewer.",
  account_password_too_short: "Passwords must contain at least 12 characters.",
  account_password_too_long: "The password is too long.",
  account_actor_type_invalid: "Choose an athlete or coach account.",
  account_activity_invalid: "Choose a supported primary activity.",
  account_acceptance_required: "Accept the terms and account consent before continuing.",
  account_acceptance_version_mismatch: "The terms or consent version changed. Review the current versions and try again.",
  account_email_already_registered: "An account already uses this email address.",
  account_existing_role_mismatch: "This existing identity belongs to a different account type.",
  account_sign_in_failed: "The email or password is incorrect.",
  account_temporarily_locked: "Sign-in is temporarily locked after repeated failed attempts.",
  account_session_missing: "Sign in to continue.",
  account_session_invalid: "The sign-in session has expired.",
  account_csrf_invalid: "The account request could not be authorised. Refresh and try again.",
  account_unavailable: "This account is not currently active.",
  account_challenge_invalid: "The six-digit code is invalid or expired.",
  account_current_password_invalid: "The current password is incorrect.",
  account_closure_confirmation_required: "Type CLOSE exactly to request closure.",
  auth_email_invalid: "Enter a valid email address.",
  auth_display_name_required: "Enter your display name.",
  acknowledgement_not_accepted: "Both beta acknowledgements are required.",
  jurisdiction_not_acknowledged: "Both beta acknowledgements are required.",
  stored_relationship_access_denied: "This athlete connection is not active.",
  stored_relationship_or_assignment_access_denied: "Connect the athlete and record an assignment first.",
  stored_compile_context_missing: "The athlete must complete account setup before this assignment can run.",
  stored_assignment_missing: "No current assignment was found for this coach.",
  athlete_history_access_denied: "Training history is not available for this account.",
  relationship_identity_required: "Enter a valid athlete account code.",
  coach_note_text_required: "Enter a note before recording it.",
  coach_access_denied: "This coach account is not active.",
  template_name_invalid: "Enter a programme name.",
  blocks_required: "Add at least one training block.",
  block_count_invalid: "A programme must contain between one and twelve training blocks.",
  block_name_too_long: "Training block names must be 120 characters or fewer.",
  block_type_invalid: "Choose a supported training block type.",
  week_count_per_block_invalid: "Each training block must contain between one and 52 weeks.",
  total_week_count_invalid: "A programme cannot contain more than 104 weeks.",
  weeks_required: "Add at least one week.",
  session_count_per_week_invalid: "Each week must contain between one and seven sessions.",
  session_work_item_count_invalid: "Each session must contain between one and 12 exercises.",
  session_coaching_notes_too_long: "Session coaching notes must be 500 characters or fewer.",
  work_item_coaching_notes_too_long: "Exercise coaching notes must be 500 characters or fewer.",
  work_item_segment_invalid: "Choose warm-up, working, or cool-down for each exercise.",
  work_item_group_type_invalid: "Choose superset, circuit, or leave the exercise ungrouped.",
  work_item_group_type_requires_group: "Grouping type requires a group of at least two exercises.",
  work_item_group_too_small: "A group needs at least two exercises.",
  work_item_group_not_contiguous: "Grouped exercises must be next to each other in the session.",
  work_item_group_type_mismatch: "All exercises in a group must share the same grouping type.",
  exercise_not_in_active_registry: "Choose exercises from the active exercise registry.",
  duplicate_exercise_in_session: "Each exercise in a session must be unique.",
  planned_sets_invalid: "Sets must be between 1 and 20.",
  planned_reps_invalid: "Fixed reps must be between 1 and 100.",
  rep_mode_invalid: "Choose fixed reps or a rep range.",
  rep_range_min_invalid: "The minimum reps must be between 1 and 100.",
  rep_range_max_invalid: "The maximum reps must be between 1 and 100.",
  rep_range_order_invalid: "The maximum reps cannot be lower than the minimum reps.",
  prescription_mode_invalid: "Choose reps, duration, or distance for each exercise.",
  work_item_tempo_invalid: "Tempo must look like 3-1-X-0.",
  duration_mode_invalid: "Choose a fixed hold or a hold range.",
  planned_duration_seconds_invalid: "The hold must be between 1 and 1,800 seconds.",
  duration_range_min_invalid: "The minimum hold must be between 1 and 1,800 seconds.",
  duration_range_max_invalid: "The maximum hold must be between 1 and 1,800 seconds.",
  duration_range_order_invalid: "The maximum hold cannot be lower than the minimum hold.",
  distance_mode_invalid: "Choose a fixed distance or a distance range.",
  distance_unit_invalid: "Choose meters or feet.",
  planned_distance_value_invalid: "Distance must be between 0.1 and 10,000.",
  distance_range_min_invalid: "The minimum distance must be between 0.1 and 10,000.",
  distance_range_max_invalid: "The maximum distance must be between 0.1 and 10,000.",
  distance_range_order_invalid: "The maximum distance cannot be lower than the minimum distance.",
  load_mode_invalid: "Choose percentage, weight, bodyweight, RPE, Borg, or CR10 loading.",
  percent_1rm_invalid: "Percentage must be between 1 and 100.",
  weight_value_invalid: "Weight must be between 0.25 and 1,000.",
  weight_value_invalid_precision_invalid: "Weight may use up to three decimal places.",
  weight_unit_invalid: "Choose kilograms or pounds.",
  rpe_value_invalid: "RPE must be a whole number between 1 and 10.",
  stored_rpe_value_invalid: "RPE must be a whole number between 1 and 10.",
  borg_value_invalid: "Borg must be a whole number between 6 and 20.",
  stored_borg_value_invalid: "Borg must be a whole number between 6 and 20.",
  cr10_value_invalid: "CR10 must be between 0 and 10 in half-point steps.",
  stored_cr10_value_invalid: "CR10 must be between 0 and 10 in half-point steps.",
  rest_seconds_invalid: "Rest must be between 0 and 900 seconds.",
  active_or_archived_template_is_immutable: "Active and archived templates cannot be edited. Duplicate the template to create a new version.",
  only_draft_can_complete: "Only a draft template can be marked complete.",
  only_complete_can_activate: "Only a complete template can be activated.",
  template_not_found: "The template could not be found.",
  stored_template_not_active: "Select an active template owned by this coach.",
  stored_template_activity_mismatch: "The template activity does not match the athlete activity.",
  assigned_template_sessions_exhausted: "Every session in this assigned programme has already been created.",
  athlete_one_rep_max_missing: "The athlete profile is missing a current 1RM reference required by this session.",
  relationship_access_denied: "The coach-athlete relationship is not active.",
  profile_identity_required: "Select a connected athlete.",
  benchmark_value_invalid: "Strength reference values must be between 0.25 and 1,500.",
  benchmark_exercise_invalid: "Choose an exercise from the active registry.",
  benchmark_effective_date_invalid: "Enter a valid effective date.",
  load_rounding_increment_invalid: "Load rounding must be between 0.25 and 25.",
  bodyweight_invalid: "Bodyweight must be between 10 and 500.",
  event_plan_invalid: "Complete the event details before compiling the calendar.",
  event_plan_unknown_field: "The event contains an unsupported field.",
  event_plan_id_invalid: "The event plan identifier is invalid.",
  event_name_invalid: "Enter an event name of 120 characters or fewer.",
  event_type_invalid_for_activity: "Choose an event type supported by this programme activity.",
  event_date_invalid: "Enter a valid event date.",
  programme_start_date_invalid: "Enter a valid programme start date.",
  event_must_follow_programme_start: "The event date must be after the programme start date.",
  event_week_count_invalid: "The event must be between one and 104 training weeks from the programme start.",
  event_location_too_long: "The event location must be 200 characters or fewer.",
  event_timezone_invalid: "Enter a valid timezone such as Europe/London.",
  event_notes_too_long: "Event notes must be 1,000 characters or fewer.",
  block_week_count_invalid: "Each block must contain between one and 52 weeks.",
  block_week_count_mismatch: "The block week input must match the weeks currently contained in that block.",
  event_week_allocation_unbalanced: "The programme blocks must allocate exactly the number of weeks available before the event.",
  event_date_in_past: "The event date cannot be in the past when a programme is activated.",
  event_programme_week_count_mismatch: "The programme week count must match the event preparation calendar.",
  event_not_active: "Select an active event.",
  event_activity_mismatch: "The event activity does not match the athlete.",
  template_not_active_for_activity: "Select an active programme for this athlete activity."
};

// FULL-UI-22 cross-product quality (ported): an unmapped internal reason/
// failure token must never become the user's only message on its own - it
// stays available via ApiRequestError.code/.payload for diagnosis, but the
// person using the product always sees plain, factual, actionable copy
// instead of a raw code.
export function genericFriendlyMessageForStatus(status: number): string {
  if (status === 401) return "Sign in again to continue.";
  if (status === 403) return "This action is not available for this account.";
  if (status === 404) return "That record could not be found.";
  if (status === 409) return "That could not be completed because something changed. Refresh and try again.";
  if (status === 423) return "This account is not currently active.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (typeof status === "number" && status >= 500) return "Something went wrong on our end. Try again in a moment.";
  return "That request could not be completed. Try again, or report this problem if it continues.";
}

export function friendlyErrorMessage(payload: unknown, status: number): string {
  const record = isRecord(payload) ? payload : {};
  const reason = String(record.error ?? record.reason ?? record.failure_token ?? `request_${status}`);

  if (reason === "account_unavailable") {
    return factualAccountStateMessage(record.account_state);
  }

  return FRIENDLY_ERROR_MESSAGES[reason] ?? genericFriendlyMessageForStatus(status);
}
