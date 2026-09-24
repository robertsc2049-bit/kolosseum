import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachAssignments, loadCoachRelationships, loadCoachTemplates } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-05A programme detail (read-only) - facts, version
// family and assignment usage. Ported from public/app/app.js's
// renderProgrammeDetail()'s title/status/meta/description/actions/
// programmeVersionFamilyHtml()/programmeUsageHtml(). The activation
// validation summary, structure preview and marketplace sharing/release
// sub-panel stay legacy (separate manifest areas/future slices) - see
// CoachProgrammeDetailPanel.tsx's own DEV NOTE.
//
// Opens on kolosseum:open-programme-detail - the same bridge event
// CoachProgrammeLibraryPanel.tsx's "View detail" button already dispatches
// (and legacy's own openProgrammeDetail() also still listens for, to keep
// the marketplace section/hash/scroll working) - mirroring
// useCoachEventDetail.ts's OPEN_EVENT_DETAIL_EVENT precedent. Also
// refetches on kolosseum:templates-changed so an action taken from this
// panel (via a bridge-dispatched legacy mutation) is reflected once it
// completes.
const OPEN_EVENT = "kolosseum:open-programme-detail";
const CHANGED_EVENT = "kolosseum:templates-changed";

export type CoachProgrammeDetailState = {
  templateId: string;
  loading: boolean;
  error: string | null;
  templates: JsonRecord[];
  assignments: JsonRecord[];
  relationships: JsonRecord[];
};

const initialState: CoachProgrammeDetailState = {
  templateId: "",
  loading: false,
  error: null,
  templates: [],
  assignments: [],
  relationships: []
};

export function useCoachProgrammeDetail() {
  const [state, setState] = useState<CoachProgrammeDetailState>(initialState);
  const templateIdRef = useRef("");

  useEffect(() => {
    templateIdRef.current = state.templateId;
  }, [state.templateId]);

  const load = useCallback(async (templateId: string) => {
    setState((current) => ({ ...current, templateId, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [templates, assignments, relationships] = await Promise.all([
        loadCoachTemplates(coachUserId),
        loadCoachAssignments(coachUserId),
        loadCoachRelationships(coachUserId)
      ]);
      setState({ templateId, loading: false, error: null, templates, assignments, relationships });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The programme detail could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const templateId = (event as CustomEvent<{ template_id?: string }>).detail?.template_id;
      if (templateId) load(templateId);
    }
    function handleChanged() {
      if (templateIdRef.current) load(templateIdRef.current);
    }
    document.addEventListener(OPEN_EVENT, handleOpen);
    document.addEventListener(CHANGED_EVENT, handleChanged);
    return () => {
      document.removeEventListener(OPEN_EVENT, handleOpen);
      document.removeEventListener(CHANGED_EVENT, handleChanged);
    };
  }, [load]);

  return { ...state };
}
