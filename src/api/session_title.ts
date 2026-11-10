// What a coach or athlete calls a recorded session: the programme's own
// session title ("Squat day"), a Kolosseum programme's, or - for sessions
// recorded before titles were stored - "<programme> · session N"; never a
// list of identical "Training session"s.
type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function plannedSessionTitle(plannedSession: unknown, programmeName?: unknown): string {
  const planned = isRecord(plannedSession) ? plannedSession : {};
  const run = isRecord(planned.programme_run) ? planned.programme_run : {};
  const position = isRecord(planned.template_position) ? planned.template_position : {};
  const own = text(planned.title) || text(planned.name) || text(run.session_title);
  if (own) return own;
  // A self-coached athlete's own week (athlete_training_week.ts): which day
  // of it, as the session screen says (walkthrough 11).
  const week = isRecord(planned.own_training) ? planned.own_training : null;
  if (week?.today === true) return "Today's session";
  const day = Number(week?.day_number);
  const days = Number(week?.days_total);
  if (week && Number.isInteger(day) && day > 0 && Number.isInteger(days) && days > 0) {
    const weekNumber = Number(week.week_number);
    return `My training · Day ${day} of ${days}${Number.isInteger(weekNumber) && weekNumber > 0 ? ` · week ${weekNumber}` : ""}${week.lighter === true ? " (lighter)" : ""}`;
  }
  const index = Number(position.template_session_index);
  const programme = text(programmeName) || text(run.title);
  if (programme && Number.isInteger(index) && index >= 0) return `${programme} · session ${index + 1}`;
  return "Training session";
}
