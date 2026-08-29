import { useEffect, useState } from "react";

import { loadTemplateExercises } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { type ProgrammeDraft } from "./programmeDraft";

// DEV NOTE: FULL-UI-05B programme builder - first slices. The builder
// itself (open/close, add/remove/reorder, field edits, event-calendar
// binding, save/complete/activate) stays entirely legacy for now - this
// hook only mirrors state.templateDraft and its save/dirty/recovery
// status for React panels that need to react to it
// (CoachProgrammeBuilderFactsPanel.tsx's block/week/session counts,
// CoachProgrammeBuilderValidationList.tsx's completion checks,
// CoachProgrammeBuilderSaveBadge.tsx/SaveDetail.tsx's status text).
// Legacy broadcasts kolosseum:programme-draft-changed with the current
// draft (or null once closed) plus saving/saveError/dirty/recovered/
// savedAt from broadcastProgrammeDraft(), called from every place
// state.templateDraft's shape or save/dirty state can change
// (updateTemplateFacts()/renderTemplateBuilderState()) and from
// clearTemplateDraftState() on close/discard - see app.js's own DEV NOTE
// next to those.
// templateExercises is fetched independently once per mount (it never
// changes mid-session and is only needed for the validation list's
// exercise-registry check) rather than threaded through the bridge event.
const CHANGED_EVENT = "kolosseum:programme-draft-changed";

export type ProgrammeBuilderDraftDetail = {
  draft: ProgrammeDraft | null;
  saving: boolean;
  saveError: string;
  dirty: boolean;
  recovered: boolean;
  savedAt: string;
};

const initialDetail: ProgrammeBuilderDraftDetail = {
  draft: null,
  saving: false,
  saveError: "",
  dirty: false,
  recovered: false,
  savedAt: ""
};

export function useProgrammeBuilderDraft() {
  const [detail, setDetail] = useState<ProgrammeBuilderDraftDetail>(initialDetail);
  const [templateExercises, setTemplateExercises] = useState<JsonRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadTemplateExercises()
      .then((exercises) => {
        if (!cancelled) setTemplateExercises(exercises);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleChanged(event: Event) {
      const eventDetail = (event as CustomEvent<Partial<ProgrammeBuilderDraftDetail>>).detail;
      setDetail({
        draft: eventDetail?.draft ?? null,
        saving: eventDetail?.saving === true,
        saveError: eventDetail?.saveError ?? "",
        dirty: eventDetail?.dirty === true,
        recovered: eventDetail?.recovered === true,
        savedAt: eventDetail?.savedAt ?? ""
      });
    }
    document.addEventListener(CHANGED_EVENT, handleChanged);
    return () => {
      document.removeEventListener(CHANGED_EVENT, handleChanged);
    };
  }, []);

  return { ...detail, templateExercises };
}
