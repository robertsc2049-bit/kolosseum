// Training-plan vocabulary shared by onboarding and the session screen. The
// season/competition split mirrors the engine's cycle models
// (engine/src/phases/phase4/periodisation.ts); a test keeps them in step.

export type PlanDateKind = "season" | "competition" | "none";

// Team and racket sports plan towards a season; general strength has no
// competition; every other sport plans towards a competition, race or fight.
export const SEASON_ACTIVITIES: readonly string[] = Object.freeze([
  "rugby_union", "rugby_league", "rugby_sevens", "american_football", "ice_hockey", "football_soccer",
  "basketball", "netball", "volleyball", "field_hockey", "cricket", "tennis"
]);

export function planDateKind(activityId: unknown): PlanDateKind {
  const id = String(activityId ?? "");
  if (!id || id === "general_strength") return "none";
  return SEASON_ACTIVITIES.includes(id) ? "season" : "competition";
}

export const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

const PHASE_LABELS: Record<string, string> = {
  off_season: "Off-season",
  pre_season: "Pre-season",
  in_season: "In-season",
  transition: "Transition",
  accumulation: "Accumulation",
  intensification: "Intensification",
  peak: "Peak",
  base: "Base",
  build: "Build",
  specific: "Competition-specific",
  taper: "Taper"
};

export function phaseLabel(phase: unknown): string {
  return PHASE_LABELS[String(phase ?? "")] ?? "";
}

export function focusLabel(focus: unknown): string {
  const words = String(focus ?? "").split("_").filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

// "Pre-season · Week 2 of 4 · Session 2 of 3: Upper body strength"
export function trainingCycleSummary(cycle: Record<string, unknown> | null | undefined): string | null {
  if (!cycle || typeof cycle !== "object") return null;
  const parts: string[] = [];
  const phase = phaseLabel(cycle.macro_phase);
  if (phase) parts.push(phase);
  if (Number.isInteger(cycle.meso_week)) parts.push(`Week ${cycle.meso_week} of 4`);
  const perWeek = Number(cycle.sessions_per_week);
  const slot = Number(cycle.session_slot);
  const session = Number.isInteger(perWeek) && Number.isInteger(slot) ? `Session ${(slot % perWeek) + 1} of ${perWeek}` : "";
  const focus = focusLabel(cycle.day_focus);
  if (session || focus) parts.push([session, focus].filter(Boolean).join(": "));
  return parts.length ? parts.join(" · ") : null;
}

export function planDatesLabel(fields: Record<string, unknown>): string {
  if (fields.no_fixed_date === true) return "No fixed date";
  if (fields.season_start_date && fields.season_end_date) return `Season ${fields.season_start_date} to ${fields.season_end_date}`;
  if (fields.competition_date) return `Next competition ${fields.competition_date}`;
  return "Not declared";
}
