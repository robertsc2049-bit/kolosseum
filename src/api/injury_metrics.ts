// DEV NOTE: The injury log, worked out (pure: no clock, no database).
// Injuries a coach records for their athlete - body area, side, type, how it
// happened, whether it's stopped them training - with days lost, severity
// (the consensus bands: minimal 1-3 days, mild 4-7, moderate 8-28, severe
// over 28), re-injuries, and the athlete's availability. Facts only: no
// diagnosis, symptoms or notes, and the product never gives medical advice.
// Who sees it: the athlete's own coach and a team's head coach. Teammates'
// coaches and org owners see availability status only; gym owners nothing.

type Json = Record<string, unknown>;

export const INJURY_AREAS: Readonly<Record<string, string>> = {
  head: "Head", neck: "Neck", shoulder: "Shoulder", upper_arm: "Upper arm", elbow: "Elbow", forearm: "Forearm", wrist_hand: "Wrist / hand",
  chest: "Chest / ribs", upper_back: "Upper back", lower_back: "Lower back", abdomen: "Abdomen", hip_groin: "Hip / groin",
  thigh_front: "Thigh (front)", thigh_back: "Hamstring", knee: "Knee", lower_leg: "Calf / shin", achilles: "Achilles", ankle: "Ankle", foot: "Foot"
};
export const INJURY_TYPES: Readonly<Record<string, string>> = {
  muscle: "Muscle strain", tendon: "Tendon", ligament: "Ligament sprain", joint: "Joint / cartilage", bone: "Bone (incl. stress)",
  contusion: "Bruise / dead leg", concussion: "Concussion", nerve: "Nerve", other: "Other"
};
export const INJURY_MECHANISMS: Readonly<Record<string, string>> = { non_contact: "Non-contact", contact: "Contact", overuse: "Gradual / overuse", unknown: "Not known" };
export const INJURY_CONTEXTS: Readonly<Record<string, string>> = { training: "Training", match: "Match / competition", gym: "Gym", outside_sport: "Outside sport" };
export const INJURY_SIDES: Readonly<Record<string, string>> = { left: "Left", right: "Right", both: "Both", none: "" };
export const INJURY_STATUSES: Readonly<Record<string, string>> = { out: "Out - not training", modified: "Modified training", returned: "Back to full training" };

// Where a pain report in a session lands on the injury map (pain_flag_service PAIN_AREAS).
const PAIN_AREA_FOR: Readonly<Record<string, string>> = { knee: "knee", hip_groin: "hip", lower_back: "lumbar_low", shoulder: "shoulder", elbow: "elbow", wrist_hand: "wrist", ankle: "ankle", neck: "neck" };

export type InjuryRecord = Readonly<{
  id: string; occurred_on: string; area: string; side: string; type: string; mechanism: string; context: string;
  // The status history, oldest first: the first entry is the status on the day of injury.
  history: ReadonlyArray<Readonly<{ on: string; status: string; expected_return?: string | null }>>;
  returned_on?: string | null;
}>;

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY));
const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function severityOf(daysLost: number): string {
  if (daysLost <= 0) return "no_time_lost";
  if (daysLost <= 3) return "minimal";
  if (daysLost <= 7) return "mild";
  if (daysLost <= 28) return "moderate";
  return "severe";
}
export const SEVERITY_LABELS: Readonly<Record<string, string>> = { no_time_lost: "No time lost", minimal: "Minimal (1-3 days)", mild: "Mild (4-7 days)", moderate: "Moderate (8-28 days)", severe: "Severe (over 28 days)" };

export function injuryName(injury: Pick<InjuryRecord, "area" | "side" | "type">): string {
  const side = INJURY_SIDES[injury.side] ?? "";
  const area = INJURY_AREAS[injury.area] ?? injury.area;
  const type = injury.type === "other" ? "" : ` (${(INJURY_TYPES[injury.type] ?? injury.type).toLowerCase()})`;
  return `${side ? `${side.toLowerCase()} ` : ""}${area.toLowerCase()}${type}`;
}

// Days lost: days the athlete was out of full training (out or modified)
// from the injury until they returned (or until today, still going).
// Modified days count separately, so "days lost" stays the strict number.
export function worked(injury: InjuryRecord, today: string): Json {
  const end = injury.returned_on ?? today;
  let out = 0;
  let modified = 0;
  const history = [...injury.history].sort((a, b) => a.on.localeCompare(b.on));
  history.forEach((entry, index) => {
    const until = index + 1 < history.length ? history[index + 1].on : end;
    const span = days(entry.on, until < entry.on ? entry.on : until);
    if (entry.status === "out") out += span;
    else if (entry.status === "modified") modified += span;
  });
  const status = injury.returned_on ? "returned" : history.at(-1)?.status ?? "out";
  const expected = [...history].reverse().find((entry) => entry.expected_return)?.expected_return ?? null;
  return {
    id: injury.id, occurred_on: injury.occurred_on, area: injury.area, side: injury.side, type: injury.type, mechanism: injury.mechanism, context: injury.context,
    name: injuryName(injury), status, expected_return: status === "returned" ? null : expected, returned_on: injury.returned_on ?? null,
    days_lost: out, days_modified: modified, severity: severityOf(out), ongoing: status !== "returned",
    history
  };
}

// The athlete's injuries, worked out, plus what a coach needs to act on.
export function analyseInjuries(injuries: readonly InjuryRecord[], today: string, windowStart: string, painAreasInWindow: readonly string[] = []): Json {
  const rows = injuries.map((injury) => worked(injury, today)).sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)));
  const current = rows.find((row) => row.ongoing) ?? null;
  const inWindow = rows.filter((row) => String(row.occurred_on) >= windowStart || (row.ongoing as boolean) || String(row.returned_on ?? "") >= windowStart);
  // Days lost inside the window only (an injury from before it counts from the window's start).
  const daysLostInWindow = inWindow.reduce((sum, row) => {
    const injury = injuries.find((entry) => entry.id === row.id)!;
    const clipped = { ...injury, history: injury.history.map((entry) => ({ ...entry, on: entry.on < windowStart ? windowStart : entry.on })) };
    return sum + Number(worked(clipped, today).days_lost);
  }, 0);
  const recentReturn = rows.find((row) => row.returned_on && days(String(row.returned_on), today) <= 28) ?? null;
  // A re-injury: the same area and side again within 2 months of returning
  // from it (early recurrence); within 12 months is a recurrence.
  const repeats = rows.map((row) => {
    const earlier = rows.find((other) => other.id !== row.id && other.area === row.area && other.side === row.side && String(other.occurred_on) < String(row.occurred_on) && other.returned_on);
    if (!earlier) return null;
    const gap = days(String(earlier.returned_on), String(row.occurred_on));
    return gap <= 61 ? { id: row.id, kind: "early", earlier: earlier.id, gap } : gap <= 365 ? { id: row.id, kind: "recurrence", earlier: earlier.id, gap } : null;
  }).filter(Boolean) as Json[];
  // Pain reported in the same place as an injury they're back from (8 weeks).
  const painSameArea = rows.find((row) => row.returned_on && days(String(row.returned_on), today) <= 56 && PAIN_AREA_FOR[String(row.area)] && painAreasInWindow.includes(PAIN_AREA_FOR[String(row.area)])) ?? null;
  return {
    rows, current, days_lost_window: daysLostInWindow, in_window: inWindow.length,
    recent_return: recentReturn, repeats, pain_same_area: painSameArea,
    availability: current ? { status: current.status === "out" ? "unavailable" : "modified", reason: `Injury: ${current.name}`, until: current.expected_return } : null
  };
}

export function injuryFindings(analysis: Json, today: string): Json[] {
  const out: Json[] = [];
  const current = analysis.current as Json | null;
  if (current?.status === "out") out.push({ id: "injury_out", section: "injuries", level: "alert", text: `Out injured: ${current.name}, since ${shortDate(String(current.occurred_on))}${current.expected_return ? ` - expected back around ${shortDate(String(current.expected_return))}` : ""}.` });
  else if (current?.status === "modified") out.push({ id: "injury_modified", section: "injuries", level: "watch", text: `Training modified for an injury: ${current.name}, since ${shortDate(String(current.occurred_on))}.` });
  const repeats = (analysis.repeats ?? []) as Json[];
  const early = repeats.find((repeat) => repeat.kind === "early");
  if (early) {
    const row = ((analysis.rows ?? []) as Json[]).find((entry) => entry.id === early.id);
    if (row) out.push({ id: "injury_reinjury", section: "injuries", level: "alert", text: `Re-injury: ${row.name} again ${early.gap} days after returning from the last one.` });
  }
  else {
    const recurrence = repeats.find((repeat) => repeat.kind === "recurrence");
    const row = recurrence ? ((analysis.rows ?? []) as Json[]).find((entry) => entry.id === recurrence.id) : null;
    if (row) out.push({ id: "injury_recurrence", section: "injuries", level: "watch", text: `The same injury twice in a year: ${row.name}.` });
  }
  const painSame = analysis.pain_same_area as Json | null;
  if (painSame) out.push({ id: "injury_pain_same_area", section: "injuries", level: "alert", text: `Pain reported in the same place as their recent ${painSame.name} injury.` });
  const back = analysis.recent_return as Json | null;
  if (back && !current) out.push({ id: "injury_returned", section: "injuries", level: "watch", text: `Back from a ${back.name} injury ${days(String(back.returned_on), today)} days ago (${back.days_lost} days lost).` });
  return out;
}

export function injuryActionFor(id: string): string | null {
  if (id === "injury_out") return "Follow their medical team's plan. Keep their programme replaced with what they're cleared to do, and plan the return in stages.";
  if (id === "injury_modified") return "Check their sessions only include what they're cleared for, and agree the next step back with their physio.";
  if (id === "injury_reinjury") return "Coming back too soon is the usual cause. Talk to their physio before the next step and slow the return.";
  if (id === "injury_recurrence") return "Look at what keeps causing it - load spikes, a weak link, the return plan - with their physio.";
  if (id === "injury_pain_same_area") return "Ask them about it today and check with their physio before more high-intensity work.";
  if (id === "injury_returned") return "Rebuild load in steps of no more than 10-20% a week and keep an eye on pain in the same area.";
  return null;
}

// For a team: injuries per 1000 hours and days lost per 1000 hours (burden).
// Under 100 hours a rate per 1000 is noise (one injury in 7 hours reads as
// 143), so only the counts are given.
export const MIN_RATE_EXPOSURE_HOURS = 100;
export function injuryRates(injuries: number, daysLost: number, exposureHours: number): Json {
  const enough = exposureHours >= MIN_RATE_EXPOSURE_HOURS;
  const per = (value: number) => (enough ? Math.round((value / exposureHours) * 1000 * 10) / 10 : null);
  return { injuries, days_lost: daysLost, exposure_hours: Math.round(exposureHours), incidence_per_1000h: per(injuries), burden_per_1000h: per(daysLost), ...(enough ? {} : { rates_need_hours: MIN_RATE_EXPOSURE_HOURS }) };
}
