// DEV NOTE: API boundary surface (pure). When a stand-down is still in force.
//
// - Head injury: until someone confirms a medical professional has cleared the
//   athlete to train. The "no training until" date is the earliest one the
//   professional gave - it passing is not clearance and ends nothing.
// - Another medical reason: until its date, or earlier on clearance.
//
// Kolosseum prescribes nothing about the return: once the athlete is cleared
// their sessions come as they were written.

export type StandDownFacts = Readonly<{ reason: string; from_date: string; until_date: string; schema_version?: string }>;

// Stand-downs recorded before clearance was required (v1) ended on their date.
// An athlete who has had a session since that date was already back training
// under that rule, and isn't locked out again.
export function standDownInForce(standDown: StandDownFacts, onDate: string, lastSessionDate: string | null = null): boolean {
  if (standDown.from_date > onDate) return false;
  if (onDate <= standDown.until_date) return true;
  if (standDown.reason !== "head_injury") return false;
  return !(standDown.schema_version === "stand_down_v1" && lastSessionDate !== null && lastSessionDate > standDown.until_date);
}
