import { useState } from "react";

import { loadExerciseContent, loadExerciseReferenceMedia } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-05B/FULL-UI-35 programme builder per-exercise "info"
// toggle - the last remaining call site of app.js's former
// loadExerciseHowto()/renderExerciseHowto() (see components/
// ExerciseHowtoBody.tsx's own DEV NOTE for the shared render logic, used
// with respectDensity={false} since the coach is authoring a template for
// potentially many athletes, not viewing their own declared instruction-
// density preference). A hook rather than a self-contained component,
// since BuilderWorkItem needs the button (inside .builder-action-row, a
// flex row) and the panel (a standalone block after it) at two different
// DOM positions sharing one toggle state - see BuilderWorkItem in
// CoachProgrammeBuilderTree.tsx. howtoCache is a module-level Map shared
// across every mounted instance (several work items can reference the
// same exercise_id) - the same caching legacy's exerciseContentCache/
// exerciseReferenceMediaCache, and the athlete session view's own
// howtoCache in useAthleteSessionExecution.ts, both already do. Fetches
// only on the closed -> open transition, matching legacy's
// toggleTemplateWorkItemInfo() exactly: re-opening after the exercise
// selection changed underneath does not refetch until the panel is
// closed and reopened.
export type ExerciseHowtoStatus = "idle" | "loading" | "loaded" | "error";

const howtoCache = new Map<string, { content: JsonRecord; referenceMedia: JsonRecord | null }>();

export function useExerciseHowto(exerciseId: string) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<ExerciseHowtoStatus>("idle");
  const [result, setResult] = useState<{ content: JsonRecord; referenceMedia: JsonRecord | null } | null>(null);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!exerciseId) return;

    const cached = howtoCache.get(exerciseId);
    if (cached) {
      setResult(cached);
      setStatus("loaded");
      return;
    }

    setStatus("loading");
    try {
      const [content, referenceMediaResult] = await Promise.all([
        loadExerciseContent(exerciseId),
        loadExerciseReferenceMedia(exerciseId).catch(() => null)
      ]);
      const referenceMedia = (referenceMediaResult?.reference_media as JsonRecord | undefined) ?? null;
      const loaded = { content, referenceMedia };
      howtoCache.set(exerciseId, loaded);
      setResult(loaded);
      setStatus("loaded");
    }
    catch {
      setStatus("error");
    }
  }

  return { expanded, status, result, toggle: () => { toggle().catch(() => {}); } };
}
