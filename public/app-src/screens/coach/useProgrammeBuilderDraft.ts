import { useEffect, useState } from "react";

import { loadTemplateExercises } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { type ProgrammeDraft } from "./programmeDraft";

// DEV NOTE: FULL-UI-05B programme builder - first slices. The builder
// itself (open/close, the block/week/session/exercise tree, add/remove/
// reorder, field edits, event-calendar binding, save/complete/activate)
// stays entirely legacy for now - this hook only mirrors
// state.templateDraft for React panels that need to react to it
// (CoachProgrammeBuilderFactsPanel.tsx's block/week/session counts,
// CoachProgrammeBuilderValidationList.tsx's completion checks). Legacy
// broadcasts kolosseum:programme-draft-changed with the current draft (or
// null once closed) from broadcastProgrammeDraft(), called from every
// place state.templateDraft's shape can change (updateTemplateFacts()/
// renderTemplateBuilderState()) and from clearTemplateDraftState() on
// close/discard - see app.js's own DEV NOTE next to those.
// templateExercises is fetched independently once per mount (it never
// changes mid-session and is only needed for the validation list's
// exercise-registry check) rather than threaded through the bridge event.
const CHANGED_EVENT = "kolosseum:programme-draft-changed";

export function useProgrammeBuilderDraft() {
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
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
      const detail = (event as CustomEvent<{ draft: ProgrammeDraft | null }>).detail;
      setDraft(detail?.draft ?? null);
    }
    document.addEventListener(CHANGED_EVENT, handleChanged);
    return () => {
      document.removeEventListener(CHANGED_EVENT, handleChanged);
    };
  }, []);

  return { draft, templateExercises };
}
