// @law: Product UI Completion
// @severity: high
// @scope: product-ui

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const manifestPath = path.join(repoRoot, "product", "ui", "function_manifest.json");

const REQUIRED_AREA_IDS = [
  "identity_account",
  "athlete_onboarding",
  "coach_commercial",
  "relationships",
  "coach_overview",
  "athlete_directory",
  "strength_references",
  "events",
  "programme_library",
  "programme_builder",
  "event_calendar_binding",
  "assignments",
  "athlete_today",
  "session_execution",
  "athlete_history",
  "coach_review",
  "notifications",
  "data_rights",
  "status_support",
  "founder_admin",
  "cross_product_quality"
];
const REQUIRED_FUNCTION_IDS = [
  "account_create",
  "account_sign_in",
  "authenticated_session",
  "email_verification",
  "password_reset",
  "account_state_message",
  "role_redirect",
  "terms_version",
  "consent_history",
  "profile_update",
  "password_change",
  "account_close_request",
  "sign_out",
  "onboarding_staged",
  "activity_declaration",
  "execution_scope_declaration",
  "beta_acknowledgement",
  "jurisdiction_acknowledgement",
  "accessibility_preferences",
  "onboarding_review",
  "onboarding_completion",
  "declaration_history",
  "coach_profile_setup",
  "coach_terms",
  "subscription_state",
  "seat_allowance",
  "checkout_entry",
  "payment_return",
  "billing_portal",
  "entitlement_error",
  "relationship_invite_create",
  "relationship_invite_receive",
  "relationship_accept",
  "relationship_decline",
  "relationship_cancel",
  "relationship_revoke",
  "relationship_expiry",
  "relationship_lists",
  "relationship_audit",
  "relationship_history_preserved",
  "overview_factual_counts",
  "overview_relationships",
  "overview_assignment_queue",
  "overview_upcoming_events",
  "overview_open_sessions",
  "overview_completed_since_review",
  "overview_direct_links",
  "athlete_search_filter",
  "athlete_relationship_state",
  "athlete_identity_activity",
  "athlete_current_programme",
  "athlete_current_event",
  "athlete_assignment_history",
  "athlete_event_history",
  "athlete_strength_history",
  "athlete_bodyweight_history",
  "athlete_notes_list",
  "athlete_session_history",
  "athlete_relationship_revoke",
  "athlete_archive_inactive",
  "strength_tested_1rm",
  "strength_estimated_1rm",
  "strength_training_max",
  "strength_effective_date",
  "strength_source_note",
  "strength_unit_conversion",
  "strength_effective_selection",
  "strength_superseded_history",
  "strength_immutable_add",
  "strength_missing_requirements",
  "strength_resolved_source",
  "events_section",
  "event_create_compile",
  "event_search_filter",
  "event_detail",
  "event_version_edit",
  "event_cancel_archive",
  "event_countdown",
  "event_metadata",
  "event_linked_athletes",
  "event_linked_programme",
  "event_link_unlink",
  "event_history_preserved",
  "event_validation",
  "programme_states",
  "programme_search_filter",
  "programme_new",
  "programme_duplicate",
  "programme_detail",
  "programme_preview",
  "programme_complete",
  "programme_activate",
  "programme_archive",
  "programme_version_metadata",
  "programme_assignment_usage",
  "programme_immutable_active",
  "programme_activation_validation",
  "builder_identity",
  "builder_ordered_blocks",
  "builder_block_type",
  "builder_week_count",
  "builder_block_actions",
  "builder_week_actions",
  "builder_session_actions",
  "builder_session_composition",
  "builder_coaching_notes",
  "builder_work_item_segment",
  "builder_registry_exercises",
  "builder_role",
  "builder_sets",
  "builder_repetitions",
  "builder_loading",
  "builder_load_unit",
  "builder_rest",
  "builder_summary",
  "builder_unsaved_warning",
  "builder_save_feedback",
  "builder_validation_links",
  "builder_keyboard_mobile",
  "calendar_select_existing_event",
  "calendar_single_event_truth",
  "calendar_start_date",
  "calendar_required_weeks",
  "calendar_allocated_weeks",
  "calendar_allocation_state",
  "calendar_fit_final",
  "calendar_dates",
  "calendar_partial_week",
  "calendar_activation_fail",
  "calendar_event_source",
  "assignment_from_profile",
  "assignment_select_programme",
  "assignment_select_event",
  "assignment_preflight",
  "assignment_exact_version",
  "assignment_confirmation",
  "assignment_current_detail",
  "assignment_replace",
  "assignment_cancel",
  "assignment_history",
  "assignment_separate_event",
  "assignment_preserve_sessions",
  "today_programme",
  "today_assignment_version",
  "today_next_session",
  "today_event_countdown",
  "today_block_week",
  "today_resolved_load_source",
  "today_empty_states",
  "today_visible_notes",
  "today_start_continue",
  "session_overview",
  "session_ordered_exercises",
  "session_prescription",
  "session_start",
  "session_complete_work",
  "session_skip_reason",
  "session_partial",
  "session_stop_return",
  "session_return_continue",
  "session_return_skip",
  "session_substitution",
  "session_pain_input",
  "session_completion_summary",
  "session_idempotent_retry",
  "session_reload_recovery",
  "session_terminal_guard",
  "history_list",
  "history_filters",
  "history_detail",
  "history_planned_recorded",
  "history_split_return",
  "history_partial_skip",
  "history_provenance",
  "history_export",
  "history_empty_unavailable",
  "review_athlete_search",
  "review_open_sessions",
  "review_completed_queue",
  "review_factual_detail",
  "review_provenance",
  "review_live_status",
  "review_note_create",
  "review_note_list",
  "review_note_visibility",
  "review_nonbinding_copy",
  "review_no_override",
  "review_state",
  "notification_relationship",
  "notification_assignment",
  "notification_event",
  "notification_programme",
  "notification_session",
  "notification_note",
  "notification_billing",
  "notification_read_state",
  "notification_deep_link",
  "data_terms_current",
  "data_consent_history",
  "data_export_request",
  "data_export_status",
  "data_export_download",
  "data_deletion_request",
  "data_deletion_review",
  "data_deletion_confirm",
  "data_deletion_status",
  "data_retention_copy",
  "status_current",
  "support_report_problem",
  "support_context",
  "support_description",
  "support_secret_boundary",
  "support_retry",
  "support_history",
  "admin_auth",
  "admin_account_search",
  "admin_account_state",
  "admin_entitlement",
  "admin_payment",
  "admin_support",
  "admin_test_users",
  "admin_data_requests",
  "admin_audit_action",
  "admin_no_engine_override",
  "quality_responsive",
  "quality_keyboard",
  "quality_focus",
  "quality_semantics",
  "quality_announcements",
  "quality_contrast",
  "quality_reduced_motion",
  "quality_loading",
  "quality_duplicate_submit",
  "quality_route_states",
  "quality_unsaved",
  "quality_destructive_confirm",
  "quality_friendly_errors",
  "quality_deep_links",
  "quality_refresh_recovery",
  "quality_server_authority"
];
const REQUIRED_ROUTE_IDS = [
  "athlete_today",
  "athlete_session",
  "athlete_history",
  "coach_overview",
  "coach_athletes",
  "coach_athlete_detail",
  "coach_events",
  "coach_event_detail",
  "coach_programmes",
  "coach_programme_detail",
  "coach_review",
  "coach_review_athlete",
  "shared_account"
];

function fail(reason) {
  console.error("FULL_UI_COMPLETION_GUARD_FAIL:" + reason);
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, ...relativePath.split("/")), "utf8");
}

function discoverApiRoutes() {
  const mounts = [
    ["src/api/sessions.routes.ts", "/sessions"],
    ["src/api/beta17_coach_note_write.routes.ts", "/sessions"],
    ["src/api/blocks.routes.ts", "/blocks"],
    ["src/api/templates.routes.ts", "/templates"],
    ["src/api/coach_workspace.routes.ts", "/coach-workspace"],
    ["src/api/product_account.routes.ts", "/account"],
    ["src/api/product_notification.routes.ts", "/account"],
    ["src/api/product_support.routes.ts", "/account"],
    ["src/api/product_admin.routes.ts", "/admin"],
    ["src/api/progress_photos.routes.ts", "/progress-photos"],
    ["src/api/body_metrics.routes.ts", "/body-metrics"],
    ["src/api/habit_tracking.routes.ts", "/habits"],
    ["src/api/exercise_reference_media.routes.ts", "/exercises"],
    ["src/api/device_sync.routes.ts", "/device-sync"]
  ];
  const routes = [];
  const pattern = /(?:router|[A-Za-z][A-Za-z0-9]*Router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/gu;

  for (const [relativePath, mount] of mounts) {
    const source = read(relativePath);
    for (const match of source.matchAll(pattern)) {
      routes.push(
        match[1].toUpperCase() + " " +
        (match[2] === "/" ? mount : (mount + match[2])).replace(/\/+/gu, "/")
      );
    }
  }

  routes.push("GET /health");
  return [...new Set(routes)].sort();
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
const areas = Array.isArray(manifest.product_areas) ? manifest.product_areas : [];
const functions = areas.flatMap((area) =>
  Array.isArray(area.functions) ? area.functions : []
);

for (const areaId of REQUIRED_AREA_IDS) {
  if (!areas.some((area) => area.area_id === areaId)) {
    fail("missing_area:" + areaId);
  }
}

for (const routeId of REQUIRED_ROUTE_IDS) {
  if (!routes.some((route) => route.route_id === routeId)) {
    fail("missing_route:" + routeId);
  }
}

for (const functionId of REQUIRED_FUNCTION_IDS) {
  if (!functions.some((item) => item.function_id === functionId)) {
    fail("missing_function:" + functionId);
  }
}

const functionIds = functions.map((item) => item.function_id);
if (new Set(functionIds).size !== functionIds.length) {
  fail("duplicate_function_id");
}

for (const item of functions) {
  for (const key of [
    "function_id",
    "label",
    "actors",
    "api_routes",
    "persistence",
    "state",
    "coverage"
  ]) {
    if (item[key] === undefined || item[key] === null) {
      fail("function_field_missing:" + item.function_id + ":" + key);
    }
  }

  if (item.state === "implemented") {
    if (item.route_id && !routes.some((route) => route.route_id === item.route_id)) {
      fail("implemented_route_missing:" + item.function_id);
    }
    if (!item.direct_test) {
      fail("implemented_test_missing:" + item.function_id);
    }
    if (item.persistence === "localStorage_only") {
      fail("local_storage_only_completion:" + item.function_id);
    }
  }

  if (item.state === "prohibited" && !item.governing_boundary) {
    fail("prohibited_boundary_missing:" + item.function_id);
  }
}

for (const capability of manifest.prohibited_capabilities ?? []) {
  if (!capability.governing_boundary) {
    fail("prohibited_capability_boundary_missing:" + capability.capability_id);
  }
}

for (const item of manifest.api_route_catalog ?? []) {
  for (const key of [
    "method",
    "path",
    "source",
    "tracked_by_area"
  ]) {
    if (
      typeof item[key] !== "string" ||
      item[key].trim() === ""
    ) {
      fail(
        "api_route_catalog_field_missing:" +
        item.method +
        " " +
        item.path +
        ":" +
        key
      );
    }
  }
}

const catalog = (manifest.api_route_catalog ?? [])
  .map((item) => item.method + " " + item.path)
  .sort();
const discovered = discoverApiRoutes();

if (JSON.stringify(catalog) !== JSON.stringify(discovered)) {
  fail("api_route_catalog_drift");
}

const index = read("public/app/index.html");
if (!index.includes('/app/route_bootstrap.js')) {
  fail("route_bootstrap_not_loaded");
}

const bootstrap = read("public/app/route_bootstrap.js");
for (const routeId of REQUIRED_ROUTE_IDS) {
  if (!bootstrap.includes(routeId)) {
    fail("runtime_route_missing:" + routeId);
  }
}

const forbiddenCompletionEvidence = [
  "powershell_only",
  "direct_api_only",
  "database_edit_only",
  "diagnostic_ui_only"
];

for (const item of functions) {
  if (
    item.state === "implemented" &&
    forbiddenCompletionEvidence.includes(item.persistence)
  ) {
    fail("invalid_completion_evidence:" + item.function_id);
  }
}

if (!process.exitCode) {
  console.log(
    "OK: FULL-UI-01 completion guard (" +
    areas.length + " areas, " +
    functions.length + " functions, " +
    routes.length + " routes)"
  );
}
