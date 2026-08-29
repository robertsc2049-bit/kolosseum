import { useEffect, useState } from "react";

import { type ProgrammeDraft } from "./programmeDraft";

// DEV NOTE: FULL-UI-05B programme builder - first slice. The builder
// itself (open/close, the block/week/session/exercise tree, add/remove/
// reorder, field edits, event-calendar binding, save/complete/activate)
// stays entirely legacy for now - this hook only mirrors
// state.templateDraft for React panels that need to react to it (starting
// with CoachProgrammeBuilderFactsPanel.tsx's block/week/session counts).
// Legacy broadcasts kolosseum:programme-draft-changed with the current
// draft (or null once closed) from broadcastProgrammeDraft(), called from
// every place state.templateDraft's shape can change
// (updateTemplateFacts()) and from clearTemplateDraftState() on close/
// discard - see app.js's own DEV NOTE next to those.
const CHANGED_EVENT = "kolosseum:programme-draft-changed";

export function useProgrammeBuilderDraft() {
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);

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

  return { draft };
}
