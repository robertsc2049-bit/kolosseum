import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachTemplates, loadTemplateExercises } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-05A programme activation validation summary (read-
// only) - see CoachProgrammeValidationPanel.tsx/programmeDraft.ts. Opens
// on kolosseum:open-programme-detail (the same bridge event
// CoachProgrammeLibraryPanel.tsx's "View detail" and
// CoachProgrammeDetailPanel.tsx's version-family rows already dispatch)
// and refetches on kolosseum:templates-changed, same as
// useCoachProgrammeDetail.ts - a separate hook rather than reusing that
// one, since this mount point needs templateExercises (for the exercise-
// registry check) instead of assignments/relationships.
const OPEN_EVENT = "kolosseum:open-programme-detail";
const CHANGED_EVENT = "kolosseum:templates-changed";

export type CoachProgrammeValidationState = {
  templateId: string;
  loading: boolean;
  error: string | null;
  templates: JsonRecord[];
  templateExercises: JsonRecord[];
};

const initialState: CoachProgrammeValidationState = {
  templateId: "",
  loading: false,
  error: null,
  templates: [],
  templateExercises: []
};

export function useCoachProgrammeValidation() {
  const [state, setState] = useState<CoachProgrammeValidationState>(initialState);
  const templateIdRef = useRef("");

  useEffect(() => {
    templateIdRef.current = state.templateId;
  }, [state.templateId]);

  const load = useCallback(async (templateId: string) => {
    setState((current) => ({ ...current, templateId, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [templates, templateExercises] = await Promise.all([
        loadCoachTemplates(coachUserId),
        loadTemplateExercises()
      ]);
      setState({ templateId, loading: false, error: null, templates, templateExercises });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The activation validation summary could not be loaded. Check your connection and try again."
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
