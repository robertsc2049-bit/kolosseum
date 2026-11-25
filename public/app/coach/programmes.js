import { api } from "../core/api.js";
import { elements } from "../core/elements.js";
import { todayDateOnly } from "../core/format.js";
import { handleError, hideBusy, showBusy, showNotice } from "../core/notices.js";
import { closedPlace, openedPlace } from "../core/shell.js";
import { saveState, state } from "../core/state.js";
import { refreshCoachAssignments } from "./athletes.js";
import { closeTemplateBuilder, confirmRecoveredTemplateReplacement, openTemplateBuilder, renderTemplateRecovery } from "./builder.js";
import { templateRecordToDraft } from "./draft.js";
import { localEventCompileSummary } from "./eventPlan.js";

export async function loadTemplateExercises() {
  if (state.templateExercises.length > 0) return state.templateExercises;

  const response = await api("GET", "/templates/exercises");
  state.templateExercises = Array.isArray(response.exercises) ? response.exercises : [];
  saveState();

  if (state.templateExercises.length < 4) {
    throw new Error("The active exercise registry must contain at least four exercises.");
  }

  return state.templateExercises;
}

export async function refreshTemplates(options = {}) {
  const coachUserId = state.profile?.coachUserId ?? "";
  // No coach id yet (mid sign-in): never ask with an empty coach_user_id.
  if (state.role !== "coach" || !coachUserId) return [];
  const response = await api(
    "GET",
    `/templates?coach_user_id=${encodeURIComponent(coachUserId)}`
  );

  state.coachTemplates = Array.isArray(response.templates) ? response.templates : [];
  saveState();
  renderTemplateLibrary();

  if (!options.quiet) showNotice("Programme library refreshed.");
  return state.coachTemplates;
}

// FULL-UI-05A: factual programme library presentation.
// These helpers read persisted product records only and do not affect deterministic training computation.
function programmeVersionNumber(template) {
  const version = Number(template?.template_version ?? 0);
  return Number.isInteger(version) && version > 0 ? version : 1;
}

function programmeAssignmentUsage(templateId) {
  const records = state.coachAssignments
    .filter((assignment) => {
      const recordedTemplateId = String(
        assignment?.templateId ??
        assignment?.record?.template_id ??
        ""
      );
      const storedStatus = String(
        assignment?.record?.assignment_status ??
        assignment?.assignmentStatus ??
        "assigned"
      );
      return (
        recordedTemplateId === String(templateId ?? "") &&
        storedStatus === "assigned"
      );
    })
    .filter((assignment, index, all) =>
      all.findIndex((candidate) =>
        String(candidate.assignmentId ?? candidate.record?.assignment_id ?? "") ===
        String(assignment.assignmentId ?? assignment.record?.assignment_id ?? "")
      ) === index
    )
    .sort((left, right) => String(
      right?.recordedAt ??
      right?.record?.requested_at_iso8601 ??
      ""
    ).localeCompare(String(
      left?.recordedAt ??
      left?.record?.requested_at_iso8601 ??
      ""
    )));

  const athleteIds = new Set(
    records
      .map((assignment) => String(
        assignment?.athleteUserId ??
        assignment?.record?.assigned_athlete_id ??
        ""
      ))
      .filter(Boolean)
  );

  return {
    records,
    assignmentCount: records.length,
    athleteCount: athleteIds.size,
    latestAt: String(
      records[0]?.recordedAt ??
      records[0]?.record?.requested_at_iso8601 ??
      ""
    )
  };
}

// DEV NOTE: programmePreviewRepetitions()/Duration()/Distance()/
// Prescription()/Load()/Html() moved to programmeDraft.ts/
// CoachProgrammePreviewPanel.tsx.

export function programmeActivationIssues(template) {
  const draft = templateRecordToDraft(template);
  const issues = [];
  const supportedActivities = new Set([
    "powerlifting",
    "general_strength",
    "rugby_union",
    "strongman",
    "hyrox",
    "crossfit",
    "football_soccer",
    "netball",
    "basketball",
    "rugby_sevens",
    "field_hockey",
    "ice_hockey",
    "volleyball",
    "cricket",
    "american_football",
    "athletics",
    "swimming",
    "olympic_weightlifting",
    "cycling",
    "rowing",
    "kayaking",
    "boxing",
    "wrestling",
    "judo",
    "brazilian_jiu_jitsu",
    "muay_thai",
    "mma",
    "tennis",
    "triathlon",
    "rugby_league",
    "street_lifting",
    "grip_sport"
  ]);
  const supportedBlockTypes = new Set([
    "general",
    "volume",
    "strength",
    "peak",
    "deload",
    "custom"
  ]);
  const registryIds = new Set(
    state.templateExercises
      .map((exercise) => String(exercise.exercise_id ?? ""))
      .filter(Boolean)
  );

  const addIssue = (code, message, path) => {
    issues.push({ code, message, path });
  };

  if (String(template?.template_status ?? "draft") !== "draft") {
    addIssue(
      "only_draft_can_complete",
      "Only a draft programme can be marked complete.",
      "programme"
    );
  }

  if (!String(draft?.template_name ?? "").trim()) {
    addIssue(
      "template_name_required",
      "Programme name is required.",
      "programme name"
    );
  }

  if (!supportedActivities.has(String(draft?.activity_id ?? ""))) {
    addIssue(
      "activity_id_invalid",
      "Choose a supported activity.",
      "activity"
    );
  }

  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];

  if (blocks.length < 1 || blocks.length > 12) {
    addIssue(
      "block_count_invalid",
      "Programme must contain between one and 12 blocks.",
      "blocks"
    );
  }

  const totalWeeks = blocks.reduce(
    (total, block) =>
      total + (Array.isArray(block?.weeks) ? block.weeks.length : 0),
    0
  );

  if (totalWeeks < 1 || totalWeeks > 104) {
    addIssue(
      "total_week_count_invalid",
      "Programme must contain between one and 104 weeks.",
      "weeks"
    );
  }

  blocks.forEach((block, blockIndex) => {
    const blockPath = `Block ${blockIndex + 1}`;
    const weeks = Array.isArray(block?.weeks) ? block.weeks : [];

    if (!supportedBlockTypes.has(String(block?.block_type ?? ""))) {
      addIssue(
        "block_type_invalid",
        `${blockPath} has an unsupported block type.`,
        blockPath
      );
    }

    if (weeks.length < 1 || weeks.length > 52) {
      addIssue(
        "week_count_per_block_invalid",
        `${blockPath} must contain between one and 52 weeks.`,
        blockPath
      );
    }

    weeks.forEach((week, weekIndex) => {
      const weekPath = `${blockPath}, week ${weekIndex + 1}`;
      const sessions = Array.isArray(week?.sessions) ? week.sessions : [];

      if (sessions.length < 1 || sessions.length > 7) {
        addIssue(
          "session_count_per_week_invalid",
          `${weekPath} must contain between one and seven sessions.`,
          weekPath
        );
      }

      sessions.forEach((session, sessionIndex) => {
        const sessionPath = `${weekPath}, session ${sessionIndex + 1}`;
        const workItems = Array.isArray(session?.work_items)
          ? session.work_items
          : [];

        if (workItems.length < 1 || workItems.length > 12) {
          addIssue(
            "session_work_item_count_invalid",
            `${sessionPath} must contain between one and 12 exercises.`,
            sessionPath
          );
        }

        if (String(session?.coaching_notes ?? "").length > 500) {
          addIssue(
            "session_coaching_notes_too_long",
            `${sessionPath} coaching notes must be 500 characters or fewer.`,
            sessionPath
          );
        }

        const groupOrderIndices = new Map();
        const groupTypes = new Map();
        workItems.forEach((workItem, workItemIndex) => {
          const groupId = String(workItem?.group_id ?? "");
          if (!groupId) return;
          const orderIndices = groupOrderIndices.get(groupId) ?? [];
          orderIndices.push(workItemIndex + 1);
          groupOrderIndices.set(groupId, orderIndices);
          groupTypes.set(groupId, groupTypes.get(groupId) ?? new Set());
          groupTypes.get(groupId).add(String(workItem?.group_type ?? ""));
        });

        for (const [groupId, orderIndices] of groupOrderIndices) {
          if (orderIndices.length < 2) {
            addIssue(
              "work_item_group_too_small",
              `${sessionPath} has a grouped exercise without a partner.`,
              sessionPath
            );
          }

          const sorted = [...orderIndices].sort((a, b) => a - b);
          for (let index = 1; index < sorted.length; index += 1) {
            if (sorted[index] !== sorted[index - 1] + 1) {
              addIssue(
                "work_item_group_not_contiguous",
                `${sessionPath} has a group with non-adjacent exercises.`,
                sessionPath
              );
              break;
            }
          }

          if (groupTypes.get(groupId).size > 1) {
            addIssue(
              "work_item_group_type_mismatch",
              `${sessionPath} has a group with mismatched grouping types.`,
              sessionPath
            );
          }
        }

        workItems.forEach((workItem, workItemIndex) => {
          const itemPath = `${sessionPath}, exercise ${workItemIndex + 1}`;
          const exerciseId = String(workItem?.exercise_id ?? "");

          if (!exerciseId) {
            addIssue(
              "exercise_required",
              `${itemPath} requires an exercise.`,
              itemPath
            );
          }
          else if (registryIds.size > 0 && !registryIds.has(exerciseId)) {
            addIssue(
              "exercise_not_in_active_registry",
              `${itemPath} is not in the active exercise registry.`,
              itemPath
            );
          }

          if (!["primary", "accessory"].includes(String(workItem?.role ?? ""))) {
            addIssue(
              "role_invalid",
              `${itemPath} requires a primary or accessory role.`,
              itemPath
            );
          }

          if (!["warm_up", "working", "cool_down"].includes(String(workItem?.segment ?? ""))) {
            addIssue(
              "work_item_segment_invalid",
              `${itemPath} requires a warm-up, working, or cool-down segment.`,
              itemPath
            );
          }

          const groupType = String(workItem?.group_type ?? "");
          if (!["straight", "superset", "circuit"].includes(groupType)) {
            addIssue(
              "work_item_group_type_invalid",
              `${itemPath} has an unsupported grouping type.`,
              itemPath
            );
          }
          else if (!String(workItem?.group_id ?? "") && groupType !== "straight") {
            addIssue(
              "work_item_group_type_requires_group",
              `${itemPath} has a grouping type without a group.`,
              itemPath
            );
          }

          if (String(workItem?.coaching_notes ?? "").length > 500) {
            addIssue(
              "work_item_coaching_notes_too_long",
              `${itemPath} coaching notes must be 500 characters or fewer.`,
              itemPath
            );
          }

          const sets = Number(workItem?.planned_sets);
          if (!Number.isInteger(sets) || sets < 1 || sets > 30) {
            addIssue(
              "planned_sets_invalid",
              `${itemPath} sets must be between one and 30.`,
              itemPath
            );
          }

          const prescriptionMode = ["duration", "distance"].includes(workItem?.prescription_mode)
            ? workItem.prescription_mode
            : "reps";

          if (!["reps", "duration", "distance"].includes(String(workItem?.prescription_mode ?? "reps"))) {
            addIssue(
              "prescription_mode_invalid",
              `${itemPath} has an unsupported prescription type.`,
              itemPath
            );
          }

          const tempo = String(workItem?.tempo ?? "");
          if (tempo && !/^[0-9Xx]-[0-9Xx]-[0-9Xx]-[0-9Xx]$/u.test(tempo)) {
            addIssue(
              "work_item_tempo_invalid",
              `${itemPath} tempo must look like 3-1-X-0.`,
              itemPath
            );
          }

          if (prescriptionMode === "reps") {
            if (workItem?.rep_mode === "range") {
              const minimum = Number(workItem?.rep_min);
              const maximum = Number(workItem?.rep_max);

              if (
                !Number.isInteger(minimum) ||
                minimum < 1 ||
                minimum > 100
              ) {
                addIssue(
                  "rep_range_min_invalid",
                  `${itemPath} minimum repetitions must be between one and 100.`,
                  itemPath
                );
              }

              if (
                !Number.isInteger(maximum) ||
                maximum < 1 ||
                maximum > 100
              ) {
                addIssue(
                  "rep_range_max_invalid",
                  `${itemPath} maximum repetitions must be between one and 100.`,
                  itemPath
                );
              }

              if (
                Number.isFinite(minimum) &&
                Number.isFinite(maximum) &&
                maximum < minimum
              ) {
                addIssue(
                  "rep_range_order_invalid",
                  `${itemPath} maximum repetitions cannot be lower than the minimum.`,
                  itemPath
                );
              }
            }
            else {
              const repetitions = Number(workItem?.planned_reps);
              if (
                !Number.isInteger(repetitions) ||
                repetitions < 1 ||
                repetitions > 100
              ) {
                addIssue(
                  "planned_reps_invalid",
                  `${itemPath} repetitions must be between one and 100.`,
                  itemPath
                );
              }
            }
          }
          else if (prescriptionMode === "duration") {
            if (!["fixed", "range"].includes(String(workItem?.duration_mode ?? ""))) {
              addIssue(
                "duration_mode_invalid",
                `${itemPath} has an unsupported duration mode.`,
                itemPath
              );
            }
            else if (workItem?.duration_mode === "range") {
              const minimum = Number(workItem?.duration_min_seconds);
              const maximum = Number(workItem?.duration_max_seconds);

              if (!Number.isInteger(minimum) || minimum < 1 || minimum > 1800) {
                addIssue(
                  "duration_range_min_invalid",
                  `${itemPath} minimum hold must be between one and 1,800 seconds.`,
                  itemPath
                );
              }

              if (!Number.isInteger(maximum) || maximum < 1 || maximum > 1800) {
                addIssue(
                  "duration_range_max_invalid",
                  `${itemPath} maximum hold must be between one and 1,800 seconds.`,
                  itemPath
                );
              }

              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue(
                  "duration_range_order_invalid",
                  `${itemPath} maximum hold cannot be lower than the minimum.`,
                  itemPath
                );
              }
            }
            else {
              const duration = Number(workItem?.planned_duration_seconds);
              if (!Number.isInteger(duration) || duration < 1 || duration > 1800) {
                addIssue(
                  "planned_duration_seconds_invalid",
                  `${itemPath} hold must be between one and 1,800 seconds.`,
                  itemPath
                );
              }
            }
          }
          else if (prescriptionMode === "distance") {
            if (!["meters", "feet"].includes(String(workItem?.distance_unit ?? ""))) {
              addIssue(
                "distance_unit_invalid",
                `${itemPath} requires meters or feet.`,
                itemPath
              );
            }

            if (!["fixed", "range"].includes(String(workItem?.distance_mode ?? ""))) {
              addIssue(
                "distance_mode_invalid",
                `${itemPath} has an unsupported distance mode.`,
                itemPath
              );
            }
            else if (workItem?.distance_mode === "range") {
              const minimum = Number(workItem?.distance_min_value);
              const maximum = Number(workItem?.distance_max_value);

              if (!Number.isFinite(minimum) || minimum < 0.1 || minimum > 10000) {
                addIssue(
                  "distance_range_min_invalid",
                  `${itemPath} minimum distance must be between 0.1 and 10,000.`,
                  itemPath
                );
              }

              if (!Number.isFinite(maximum) || maximum < 0.1 || maximum > 10000) {
                addIssue(
                  "distance_range_max_invalid",
                  `${itemPath} maximum distance must be between 0.1 and 10,000.`,
                  itemPath
                );
              }

              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue(
                  "distance_range_order_invalid",
                  `${itemPath} maximum distance cannot be lower than the minimum.`,
                  itemPath
                );
              }
            }
            else {
              const distance = Number(workItem?.planned_distance_value);
              if (!Number.isFinite(distance) || distance < 0.1 || distance > 10000) {
                addIssue(
                  "planned_distance_value_invalid",
                  `${itemPath} distance must be between 0.1 and 10,000.`,
                  itemPath
                );
              }
            }
          }

          const loadMode = String(workItem?.load_mode ?? "");
          if (!["percent_1rm", "fixed_weight", "bodyweight", "rpe", "borg", "cr10"].includes(loadMode)) {
            addIssue(
              "load_mode_invalid",
              `${itemPath} has an unsupported loading mode.`,
              itemPath
            );
          }
          else if (loadMode === "percent_1rm") {
            const percentage = Number(workItem?.percent_1rm);
            if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
              addIssue(
                "percent_1rm_invalid",
                `${itemPath} percentage must be between one and 100.`,
                itemPath
              );
            }
          }
          else if (loadMode === "fixed_weight") {
            const weight = Number(workItem?.weight_value);
            if (!Number.isFinite(weight) || weight < 0.25 || weight > 1000) {
              addIssue(
                "weight_value_invalid",
                `${itemPath} fixed load must be between 0.25 and 1,000.`,
                itemPath
              );
            }

            if (!["kg", "lb"].includes(String(workItem?.weight_unit ?? ""))) {
              addIssue(
                "weight_unit_invalid",
                `${itemPath} requires kilograms or pounds.`,
                itemPath
              );
            }
          }
          else if (loadMode === "rpe") {
            const rpeValue = Number(workItem?.rpe_value);
            if (!Number.isInteger(rpeValue) || rpeValue < 1 || rpeValue > 10) {
              addIssue(
                "rpe_value_invalid",
                `${itemPath} RPE must be a whole number between one and 10.`,
                itemPath
              );
            }
          }
          else if (loadMode === "borg") {
            const borgValue = Number(workItem?.borg_value);
            if (!Number.isInteger(borgValue) || borgValue < 6 || borgValue > 20) {
              addIssue(
                "borg_value_invalid",
                `${itemPath} Borg rating must be a whole number between 6 and 20.`,
                itemPath
              );
            }
          }
          else if (loadMode === "cr10") {
            const cr10Value = Number(workItem?.cr10_value);
            if (!Number.isFinite(cr10Value) || cr10Value < 0 || cr10Value > 10 || !Number.isInteger(cr10Value * 2)) {
              addIssue(
                "cr10_value_invalid",
                `${itemPath} CR10 rating must be between zero and 10 in half-point steps.`,
                itemPath
              );
            }
          }

          const rest = Number(workItem?.rest_seconds);
          if (!Number.isInteger(rest) || rest < 0 || rest > 900) {
            addIssue(
              "rest_seconds_invalid",
              `${itemPath} rest must be between zero and 900 seconds.`,
              itemPath
            );
          }
        });
      });
    });
  });

  if (draft?.event_plan) {
    const summary = localEventCompileSummary(draft);

    if (!summary?.valid) {
      addIssue(
        "event_plan_invalid",
        summary?.reason ?? "Event calendar details are incomplete.",
        "event calendar"
      );
    }
    else {
      if (summary.allocation_state !== "balanced") {
        addIssue(
          "event_week_allocation_unbalanced",
          "Programme weeks must exactly match the event preparation calendar.",
          "event calendar"
        );
      }

      if (
        String(draft.event_plan.event_date ?? "") &&
        String(draft.event_plan.event_date) < todayDateOnly()
      ) {
        addIssue(
          "event_date_in_past",
          "Event date cannot be in the past when the programme is activated.",
          "event date"
        );
      }
    }
  }

  return issues;
}

// DEV NOTE: programmeVersionFamilyHtml()/programmeUsageHtml() moved to
// CoachProgrammeDetailPanel.tsx's VersionFamilyList()/UsageList().

// DEV NOTE: FULL-UI-05A programme detail facts/version-family/usage/
// actions moved to React - see
// public/app-src/screens/coach/CoachProgrammeDetailPanel.tsx/
// useCoachProgrammeDetail.ts, mounted at #programme-detail-header-root/
// #programme-detail-root. The activation validation summary, structure
// preview and marketplace sharing/release sub-panel also moved - see
// CoachProgrammeValidationPanel.tsx/CoachProgrammePreviewPanel.tsx/
// CoachProgrammeMarketplaceSharingPanel.tsx (programmeActivationIssues()
// itself stays here too, since completeTemplateById()/
// currentTemplateBuilderIssues() still call it directly) - mounted at
// #programme-validation-root/#programme-preview-root/
// #programme-marketplace-sharing-root. programmeValidationHtml()/
// programmePreviewHtml()/refreshTemplateSharingPreference()/
// confirmSaveTemplateSharing()/refreshTemplateReleaseHistory()/
// confirmReleaseTemplate() themselves had zero remaining callers once each
// changed in turn and were deleted. All mount points open on the same
// kolosseum:open-programme-detail event this function's caller,
// openProgrammeDetail(), still dispatches to - React and this function
// each react to it independently. This function now only handles the
// panel's hidden-toggle.
function renderProgrammeDetail() {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === state.selectedTemplateId
  );

  if (!template) {
    elements.templateDetailPanel.hidden = true;
    return;
  }

  elements.templateDetailPanel.hidden = false;
}

function openProgrammeDetail(templateId, options = {}) {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === String(templateId ?? "")
  );

  if (!template) return false;

  state.selectedTemplateId = template.template_id;
  saveState();
  renderProgrammeDetail();

  if (options.updateRoute !== false) {
    openedPlace("coach_programme_detail", { template_id: template.template_id });
  }

  if (options.scroll !== false) {
    elements.templateDetailPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return true;
}

function closeProgrammeDetail(options = {}) {
  state.selectedTemplateId = "";
  saveState();
  elements.templateDetailPanel.hidden = true;

  if (options.updateRoute !== false) closedPlace("coach_programme_detail");
}

export async function refreshProgrammeLibrary(options = {}) {
  if (state.role !== "coach" || !state.profile?.coachUserId) return [];

  if (!options.quiet) showBusy("Loading programme library…");

  try {
    const outcomes = await Promise.allSettled([
      refreshTemplates({ quiet: true }),
      refreshCoachAssignments({ quiet: true }),
      loadTemplateExercises()
    ]);

    const failures = outcomes.filter(
      (outcome) => outcome.status === "rejected"
    );

    for (const failure of failures) {
      console.error(failure.reason);
    }

    renderTemplateLibrary();

    if (failures.length > 0 && !options.quiet) {
      showNotice(
        "Some programme records could not be refreshed.",
        "error"
      );
    }

    return state.coachTemplates;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}
// DEV NOTE: templateCard()/bindTemplateLibraryActions() moved to
// CoachProgrammeLibraryPanel.tsx's TemplateCard(); templateStatusBadge()/
// programmeVersionFamilyHtml()/programmeUsageHtml() moved to
// CoachProgrammeDetailPanel.tsx (see templateStatusBadgeClass()/
// VersionFamilyList()/UsageList()) once renderProgrammeDetail() (the last
// remaining caller of each) was trimmed to just what the still-legacy
// validation/preview/marketplace sections need.

// DEV NOTE: FULL-UI-05A programme library (metric cards, search/filter/
// sort, card list) moved to React - see
// public/app-src/screens/coach/CoachProgrammeLibraryPanel.tsx/
// useCoachProgrammeLibrary.ts, mounted at #templates-metrics-root/
// #templates-library-root. The programme detail panel and builder stay
// legacy (out of scope for that slice), so this function keeps only what
// they still need, plus notifying the React side that persisted programme
// data may have changed (after any refresh or mutation) so it can refetch
// independently.
export function renderTemplateLibrary() {
  renderProgrammeDetail();
  renderTemplateRecovery();
  document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
}

export async function completeTemplateById(templateId) {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === String(templateId ?? "")
  );

  if (!template) throw new Error("The programme could not be found.");

  if (state.templateExercises.length === 0) {
    await loadTemplateExercises();
  }

  const issues = programmeActivationIssues(template);

  if (issues.length > 0) {
    openProgrammeDetail(template.template_id);
    showNotice(
      `Programme has ${issues.length} completion issue${issues.length === 1 ? "" : "s"}.`,
      "error"
    );
    return null;
  }

  showBusy("Saving complete template…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/complete`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshProgrammeLibrary({ quiet: true });
    showNotice("Programme checked - it's ready to send.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

export async function activateTemplateById(templateId) {
  showBusy("Activating programme…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/activate`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshProgrammeLibrary({ quiet: true });
    closeTemplateBuilder();
    showNotice("Programme activated and available for assignment.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

async function duplicateTemplate(templateId) {
  if (!confirmRecoveredTemplateReplacement()) {
    return null;
  }

  showBusy("Creating new programme version…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/duplicate`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshTemplates({ quiet: true });

    openTemplateBuilder(
      templateRecordToDraft(response.template),
      {
        skipRecoveryCheck: true
      }
    );

    showNotice("New draft programme version created.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

async function archiveTemplate(templateId) {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === String(templateId ?? "")
  );

  if (!template) throw new Error("The programme could not be found.");

  const usage = programmeAssignmentUsage(template.template_id);
  const confirmation = usage.assignmentCount > 0
    ? `Archive ${template.template_name} version ${programmeVersionNumber(template)}? ${usage.assignmentCount} assignment record${usage.assignmentCount === 1 ? "" : "s"} across ${usage.athleteCount} athlete${usage.athleteCount === 1 ? "" : "s"} retain this exact version.`
    : `Archive ${template.template_name} version ${programmeVersionNumber(template)}? No assignment records use this exact version.`;

  if (!globalThis.confirm(confirmation)) return null;

  showBusy("Archiving programme…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/archive`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshProgrammeLibrary({ quiet: true });
    state.selectedTemplateId = String(templateId);
    saveState();
    renderTemplateLibrary();
    showNotice("Programme archived. Existing assignments retain this version.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

// DEV NOTE: FULL-UI-05A programme library card actions - the card grid
// itself moved to CoachProgrammeLibraryPanel.tsx (React); each action
// button there dispatches one of these bridge events instead of the
// mutation logic being ported, so the underlying legacy functions
// (openProgrammeDetail/openTemplateBuilder/completeTemplateById/
// activateTemplateById/duplicateTemplate/archiveTemplate) - and the
// still-legacy detail panel/builder they open - are unchanged.
// The React library loads programmes itself; this file's own copy can lag
// (programmes added in another tab, by a script, or since sign-in), and a
// card action then silently did nothing. Reload the copy once and retry.
export async function coachTemplateById(templateId) {
  const find = () => state.coachTemplates.find((entry) => entry.template_id === templateId);
  if (!find()) await refreshTemplates({ quiet: true });
  return find();
}

document.addEventListener("kolosseum:open-programme-detail", (event) => {
  const templateId = event.detail?.template_id;
  if (!templateId) return;
  coachTemplateById(templateId)
    .then((template) => {
      if (template) { openProgrammeDetail(templateId); return; }
      closedPlace("coach_programme_detail");
      handleError(new Error("That programme could not be found - refresh the programme library."));
    })
    .catch(handleError);
});

document.addEventListener("kolosseum:edit-programme", (event) => {
  const templateId = event.detail?.template_id;
  if (!templateId) return;
  coachTemplateById(templateId)
    .then((template) => {
      if (!template) {
        handleError(new Error("That programme could not be found - refresh the programme library."));
        return null;
      }
      const status = String(template.template_status ?? "draft");
      if (status === "draft") return openTemplateBuilder(templateRecordToDraft(template));
      // Finished but not sent to anyone yet: still the coach's to change;
      // saving makes it a draft again. Sent: athletes keep the version they
      // have, so the coach edits a new one.
      if (status !== "archived" && template.sent !== true) {
        openTemplateBuilder({ ...templateRecordToDraft(template), template_status: "draft" });
        showNotice("Nobody has this programme yet, so you can still change it. Saving makes it a draft again - check it's ready and mark it ready to send when you're done.");
        return null;
      }
      return duplicateTemplate(templateId);
    })
    .catch(handleError);
});

document.addEventListener("kolosseum:complete-programme", (event) => {
  const templateId = event.detail?.template_id;
  if (templateId) completeTemplateById(templateId).catch(handleError);
});

document.addEventListener("kolosseum:activate-programme", (event) => {
  const templateId = event.detail?.template_id;
  if (templateId) activateTemplateById(templateId).catch(handleError);
});

document.addEventListener("kolosseum:duplicate-programme", (event) => {
  const templateId = event.detail?.template_id;
  if (templateId) duplicateTemplate(templateId).catch(handleError);
});

document.addEventListener("kolosseum:archive-programme", (event) => {
  const templateId = event.detail?.template_id;
  if (templateId) archiveTemplate(templateId).catch(handleError);
});

elements.templateDetailCloseButton.addEventListener(
  "click",
  closeProgrammeDetail
);

document.addEventListener("kolosseum:close-place", (event) => {
  if (event.detail?.view === "templates" && !event.detail.opening && !elements.templateDetailPanel.hidden) closeProgrammeDetail({ updateRoute: false });
});
