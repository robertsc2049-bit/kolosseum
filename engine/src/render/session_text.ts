/**
 * engine/src/render/session_text.ts
 *
 * Deterministic, stable session text rendering for CLI/debug output.
 *
 * Contract expectations (tests pin this):
 * - Use an em dash between exercise_id and sets/reps: \u2014
 * - Percent intensity renders as "@ 75%" (NO "1RM" suffix)
 * - Rest renders as "rest 180s" (NO parentheses)
 */
export type RenderedSessionText = {
  title: string;
  lines: string[];
  warnings: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function formatIntensity(i: unknown): string | null {
  if (!isRecord(i)) return null;

  const t = i.type;
  const v = i.value;

  if (t === "percent_1rm" && typeof v === "number") return `@ ${v}%`;
  if (t === "rpe" && (typeof v === "number" || typeof v === "string")) return `@ RPE ${v}`;
  if (t === "load" && (typeof v === "number" || typeof v === "string")) return `@ ${v}`;

  return null;
}

export function renderSessionText(session: unknown): RenderedSessionText {
  const warnings: string[] = [];

  if (!isRecord(session)) {
    return { title: "Session", lines: [], warnings: ["session_not_object"] };
  }

  const sid = typeof session.session_id === "string" ? session.session_id : "UNKNOWN";
  const title = `Session ${sid}`;

  const exs = Array.isArray(session.exercises) ? session.exercises : [];
  const lines = exs.map((ex, idx) => {
    const n = idx + 1;

    if (!isRecord(ex)) return `${n}) [invalid_exercise]`;

    const id = typeof ex.exercise_id === "string" ? ex.exercise_id : "UNKNOWN_EXERCISE";

    // IMPORTANT: preserve legacy string exactly for tests (em dash)
    const setsReps =
      typeof ex.sets === "number" && typeof ex.reps === "number" ? ` \u2014 ${ex.sets}x${ex.reps}` : "";

    const intensity = formatIntensity(ex.intensity);
    const intensityTxt = intensity ? ` ${intensity}` : "";

    const restTxt = typeof ex.rest_seconds === "number" ? ` rest ${ex.rest_seconds}s` : "";

    const subTxt = typeof ex.substituted_from === "string" ? ` (sub for ${ex.substituted_from})` : "";

    return `${n}) ${id}${setsReps}${intensityTxt}${restTxt}${subTxt}`;
  });

  return { title, lines, warnings };
}
