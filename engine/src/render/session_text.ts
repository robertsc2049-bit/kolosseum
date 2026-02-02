// engine/src/render/session_text.ts
export type Intensity =
  | { type: "percent_1rm"; value: number }
  | { type: "rpe"; value: number }
  | { type: "load"; value: number };

export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";
  block_id?: string;
  item_id?: string;
  sets?: number;
  reps?: number;
  intensity?: Intensity;
  rest_seconds?: number;
  substituted_from?: string;
};

export type Phase6SessionOutput = {
  session_id: string;
  status: "ready";
  exercises: Phase6SessionExercise[];
};

export type RenderedSessionText = {
  title: string;
  lines: string[];
  warnings: string[];
};

function fmtIntensity(i?: Intensity): string | undefined {
  if (!i) return undefined;
  if (i.type === "percent_1rm") return `${i.value}%1RM`;
  if (i.type === "rpe") return `RPE ${i.value}`;
  if (i.type === "load") return `${i.value}kg`;
  return undefined;
}

function hasNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function renderSessionText(session: Phase6SessionOutput): RenderedSessionText {
  const title = `Session ${session.session_id}`;
  const lines: string[] = [];
  const warnings: string[] = [];

  const exs = Array.isArray(session.exercises) ? session.exercises : [];

  if (exs.length === 0) {
    lines.push("(no exercises)");
    return { title, lines, warnings };
  }

  for (let idx = 0; idx < exs.length; idx++) {
    const ex = exs[idx];
    const n = idx + 1;

    const parts: string[] = [`${n}) ${String(ex.exercise_id)}`];

    const sets = ex.sets;
    const reps = ex.reps;
    const intensity = fmtIntensity(ex.intensity);
    const rest = ex.rest_seconds;

    const prescriptionBits: string[] = [];
    if (hasNumber(sets) && hasNumber(reps)) prescriptionBits.push(`${sets}x${reps}`);
    else if (hasNumber(sets) || hasNumber(reps)) warnings.push(`partial prescription for ${ex.exercise_id}`);

    if (intensity) prescriptionBits.push(`@ ${intensity}`);
    if (hasNumber(rest)) prescriptionBits.push(`(rest ${rest}s)`);

    if (prescriptionBits.length > 0) {
      parts.push("—", prescriptionBits.join(" "));
    } else {
      warnings.push(`missing prescription for ${ex.exercise_id}`);
    }

    if (typeof ex.substituted_from === "string" && ex.substituted_from.length > 0) {
      parts.push(`[sub for ${ex.substituted_from}]`);
    }

    lines.push(parts.join(" "));
  }

  return { title, lines, warnings };
}
