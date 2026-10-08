// DEV NOTE: What the app changed about a session on its own, in a line a coach
// can read on the review screen: weeks skipped or held to time a taper to the
// competition (peak_timing.ts), and a lighter first week back after time away
// or a head injury (programme_reentry.ts, head_injury_return.ts). Pure - reads
// only the session's own stamps.

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function dayLabel(iso: unknown): string {
  const text = typeof iso === "string" ? iso : "";
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function programmeAdjustments(plannedSession: unknown): string[] {
  if (!isRecord(plannedSession)) return [];
  const out: string[] = [];
  const position = isRecord(plannedSession.template_position) ? plannedSession.template_position : null;
  const timing = position && isRecord(position.peak_timing) ? position.peak_timing : null;
  if (timing) {
    const weeks = Number(timing.weeks ?? 0);
    const on = dayLabel(timing.competition_date);
    out.push(timing.adjustment === "skipped"
      ? `Skipped ${plural(weeks, "build week")} so the taper lands in competition week (${on})`
      : `Repeating the last build week: ${plural(weeks, "week")} to go before the taper for ${on}`);
  }
  const reentry = [position?.reentry, isRecord(plannedSession.programme_run) ? plannedSession.programme_run.reentry : null, isRecord(plannedSession.own_training) ? plannedSession.own_training.reentry : null]
    .find((r) => isRecord(r) && r.reentry_week === true) as Json | undefined;
  if (reentry) {
    out.push(reentry.after_head_injury === true
      ? "First week back after a head injury stand-down: lighter"
      : `Back after ${plural(Number(reentry.gap_days ?? 0), "day")} away: a lighter first week (a set fewer, lighter loads)`);
  }
  const headInjury = isRecord(plannedSession.head_injury_return) ? plannedSession.head_injury_return : null;
  if (headInjury && !out.some((line) => line.includes("head injury"))) {
    const held = Array.isArray(headInjury.held_back_exercise_ids) ? headInjury.held_back_exercise_ids.length : 0;
    out.push(`Back after a head injury: ${held ? `${plural(held, "exercise")} held back` : "contact and heavy work held back"}${headInjury.lighter === true ? ", the rest lighter" : ""}`);
  }
  return out;
}
