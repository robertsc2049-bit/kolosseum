import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachAssignments, loadCoachTemplates } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-05A programme library (read-only) - the metric cards,
// search/filter/sort and card list. Ported from public/app/app.js's
// programmeFamilyId/programmeVersionNumber/programmeFamilyVersions/
// programmeDisplayState/programmeAssignmentUsage/programmeSearchText/
// filteredProgrammeTemplates/templateStatusBadge/templateCard/
// renderTemplateLibrary. The programme DETAIL panel (version family, usage,
// activation validation, structure preview) and the entire builder view
// stay legacy - out of scope for this slice - so this hook and
// CoachProgrammeLibraryPanel.tsx never touch templateRecordToDraft(),
// programmePreviewHtml(), programmeActivationIssues() or any of the
// mutation endpoints (complete/activate/duplicate/archive/create). Cards
// still show those actions (matching legacy exactly) but each dispatches a
// bridge CustomEvent that a listener in app.js (near its other
// kolosseum:* reverse-bridge listeners) forwards to the existing,
// untouched legacy mutation functions - see CoachProgrammeLibraryPanel.tsx.
//
// Same "call the hook independently per mount point" pattern as
// useCoachEventsLibrary.ts (CoachEventsMetricCards/CoachEventsListPanel) -
// two small redundant fetches rather than a shared module store, since the
// metric-cards root and the library-panel root are non-adjacent DOM
// containers in index.html.
const CHANGED_EVENT = "kolosseum:templates-changed";

export type CoachProgrammeLibraryState = {
  loading: boolean;
  error: string | null;
  templates: JsonRecord[];
  assignments: JsonRecord[];
};

const initialState: CoachProgrammeLibraryState = {
  loading: true,
  error: null,
  templates: [],
  assignments: []
};

export function useCoachProgrammeLibrary() {
  const [state, setState] = useState<CoachProgrammeLibraryState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [templates, assignments] = await Promise.all([
        loadCoachTemplates(coachUserId),
        loadCoachAssignments(coachUserId)
      ]);
      setState({ loading: false, error: null, templates, assignments });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The programme library could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}

export function programmeFamilyId(template: JsonRecord): string {
  return String(template?.template_family_id ?? template?.template_id ?? "");
}

export function programmeVersionNumber(template: JsonRecord): number {
  const version = Number(template?.template_version ?? 0);
  return Number.isInteger(version) && version > 0 ? version : 1;
}

export function programmeFamilyVersions(template: JsonRecord, allTemplates: JsonRecord[]): JsonRecord[] {
  const familyId = programmeFamilyId(template);
  return allTemplates
    .filter((candidate) => programmeFamilyId(candidate) === familyId)
    .sort((left, right) =>
      programmeVersionNumber(left) - programmeVersionNumber(right) ||
      String(left.updated_at_iso8601 ?? "").localeCompare(String(right.updated_at_iso8601 ?? ""))
    );
}

export function programmeDisplayState(template: JsonRecord, allTemplates: JsonRecord[]): string {
  const storedState = String(template?.template_status ?? "draft");
  if (storedState === "draft") return "draft";

  const version = programmeVersionNumber(template);
  const laterPublishedVersion = programmeFamilyVersions(template, allTemplates).some(
    (candidate) =>
      programmeVersionNumber(candidate) > version &&
      ["active", "archived"].includes(String(candidate.template_status ?? ""))
  );

  if (laterPublishedVersion) return "superseded";
  if (storedState === "archived") return "archived";
  if (storedState === "complete") return "complete";
  return "active";
}

export type ProgrammeAssignmentUsage = {
  records: JsonRecord[];
  assignmentCount: number;
  athleteCount: number;
  latestAt: string;
};

// Works directly against the raw /coach-workspace/assignments records (the
// same shape legacy's own state.coachAssignments[].record carries) - see
// this file's own DEV NOTE above for why no normalisation layer is needed.
export function programmeAssignmentUsage(templateId: string, assignments: JsonRecord[]): ProgrammeAssignmentUsage {
  const records = assignments
    .filter((assignment) => {
      const recordedTemplateId = String(assignment?.template_id ?? "");
      const storedStatus = String(assignment?.assignment_status ?? "assigned");
      return recordedTemplateId === String(templateId ?? "") && storedStatus === "assigned";
    })
    .filter((assignment, index, all) =>
      all.findIndex((candidate) => String(candidate.assignment_id ?? "") === String(assignment.assignment_id ?? "")) === index
    )
    .sort((left, right) =>
      String(right?.requested_at_iso8601 ?? "").localeCompare(String(left?.requested_at_iso8601 ?? ""))
    );

  const athleteIds = new Set(
    records.map((assignment) => String(assignment?.assigned_athlete_id ?? "")).filter(Boolean)
  );

  return {
    records,
    assignmentCount: records.length,
    athleteCount: athleteIds.size,
    latestAt: String(records[0]?.requested_at_iso8601 ?? "")
  };
}

export function programmeSearchText(template: JsonRecord): string {
  const eventPlan = template?.event_plan && typeof template.event_plan === "object" ? (template.event_plan as JsonRecord) : {};

  return [
    template?.template_name,
    template?.description,
    template?.activity_id,
    template?.template_id,
    template?.template_family_id,
    template?.template_version,
    template?.template_status,
    eventPlan?.event_name,
    eventPlan?.event_type,
    eventPlan?.location
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

export type ProgrammeSortMode = "updated_desc" | "name_asc" | "version_desc" | "usage_desc";

export function filteredProgrammeTemplates(
  templates: JsonRecord[],
  assignments: JsonRecord[],
  options: { search: string; statusFilter: string; activityFilter: string; sortMode: ProgrammeSortMode }
): JsonRecord[] {
  const search = options.search.trim().toLowerCase();

  const visible = templates.filter((template) => {
    if (options.statusFilter !== "all" && programmeDisplayState(template, templates) !== options.statusFilter) {
      return false;
    }
    if (options.activityFilter !== "all" && String(template.activity_id ?? "") !== options.activityFilter) {
      return false;
    }
    return !search || programmeSearchText(template).includes(search);
  });

  visible.sort((left, right) => {
    if (options.sortMode === "name_asc") {
      return (
        String(left.template_name ?? "").localeCompare(String(right.template_name ?? "")) ||
        programmeVersionNumber(right) - programmeVersionNumber(left)
      );
    }

    if (options.sortMode === "version_desc") {
      return (
        programmeVersionNumber(right) - programmeVersionNumber(left) ||
        String(left.template_name ?? "").localeCompare(String(right.template_name ?? ""))
      );
    }

    if (options.sortMode === "usage_desc") {
      return (
        programmeAssignmentUsage(String(right.template_id), assignments).assignmentCount -
          programmeAssignmentUsage(String(left.template_id), assignments).assignmentCount ||
        String(right.updated_at_iso8601 ?? "").localeCompare(String(left.updated_at_iso8601 ?? ""))
      );
    }

    return String(right.updated_at_iso8601 ?? "").localeCompare(String(left.updated_at_iso8601 ?? ""));
  });

  return visible;
}
