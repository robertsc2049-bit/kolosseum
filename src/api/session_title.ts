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
  const index = Number(position.template_session_index);
  const programme = text(programmeName) || text(run.title);
  if (programme && Number.isInteger(index) && index >= 0) return `${programme} · session ${index + 1}`;
  return "Training session";
}
