/**
 * engine/src/render/session_text.ts
 *
 * Deterministic, stable session text rendering for CLI/debug output.
 *
 * Contract expectations (tests pin this):
 * - Use an em dash between exercise_id and sets/reps: \u2014
 * - Percent intensity renders as "@ 75%" (NO "1RM" suffix)
 * - Rest renders as "rest 180s" (NO parentheses)
 *
 * Behaviour:
 * - Renders ONLY exercises with status "pending" (or missing status).
 *   Completed/skipped are preserved in session JSON truth, but hidden from the sheet by default.
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

function getStatus(ex: Record<string, unknown>): "pending" | "completed" | "skipped" {
  const s = ex.status;
  if (s === "completed" || s === "skipped" || s === "pending") return s;
  return "pending";
}

export function renderSessionText(session: unknown): RenderedSessionText {
  const warnings: string[] = [];

  if (!isRecord(session)) {
    return { title: "Session", lines: [], warnings: ["session_not_object"] };
  }

  const sid = typeof session.session_id === "string" ? session.session_id : "UNKNOWN";
  const title = `Session ${sid}`;

  const exs = Array.isArray(session.exercises) ? session.exercises : [];

  const lines: string[] = [];
  for (const exAny of exs) {
    if (!isRecord(exAny)) {
      lines.push(`${lines.length + 1}) [invalid_exercise]`);
      continue;
    }

    // Default behaviour: hide completed/skipped from printed sheet.
    const st = getStatus(exAny);
    if (st !== "pending") continue;

    const n = lines.length + 1;
    const id = typeof exAny.exercise_id === "string" ? exAny.exercise_id : "UNKNOWN_EXERCISE";

    // IMPORTANT: preserve legacy string exactly for tests (em dash)
    const setsReps =
      typeof exAny.sets === "number" && typeof exAny.reps === "number" ? ` \u2014 ${exAny.sets}x${exAny.reps}` : "";

    const intensity = formatIntensity(exAny.intensity);
    const intensityTxt = intensity ? ` ${intensity}` : "";

    const restTxt = typeof exAny.rest_seconds === "number" ? ` rest ${exAny.rest_seconds}s` : "";

    const subTxt = typeof exAny.substituted_from === "string" ? ` (sub for ${exAny.substituted_from})` : "";

    lines.push(`${n}) ${id}${setsReps}${intensityTxt}${restTxt}${subTxt}`);
  }

  return { title, lines, warnings };
}