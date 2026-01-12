import { ExerciseSignature, SubstitutionConstraints, SubstitutionPick } from "./types.js";

function setHasAny(a: Set<string>, b: string[]): boolean {
  for (const x of b) if (a.has(x)) return true;
  return false;
}

function intersectCount(a: Set<string>, b: string[]): number {
  let c = 0;
  for (const x of b) if (a.has(x)) c++;
  return c;
}

function tierScore(tier: string): number {
  switch (tier) {
    case "TIER_1": return 40;
    case "TIER_2": return 25;
    case "TIER_3": return 12;
    case "TIER_4": return 0;
    default: return 0;
  }
}

function stabilityScore(stability: string): number {
  switch (stability) {
    case "stable": return 15;
    case "semi_stable": return 8;
    case "unstable": return 0;
    default: return 0;
  }
}

function romScore(rom: string): number {
  switch (rom) {
    case "full": return 10;
    case "partial": return 5;
    case "restricted": return 0;
    default: return 0;
  }
}

export function scoreCandidate(
  target: ExerciseSignature,
  candidate: ExerciseSignature,
  constraints: SubstitutionConstraints
): { score: number; reasons: string[]; disqualified: boolean } {
  const reasons: string[] = [];
  let score = 0;

  // 0) Hard disqualifiers (SAFETY FIRST)
  const bannedEquip = new Set((constraints.banned_equipment ?? []).map(x => x.toLowerCase()));
  const candEquipLower = candidate.equipment.map(x => x.toLowerCase());

  if (setHasAny(bannedEquip, candEquipLower)) {
    return { score: -1, reasons: ["DISQUALIFIED: uses banned equipment"], disqualified: true };
  }

  const avoidStress = new Set((constraints.avoid_joint_stress_tags ?? []).map(x => x.toLowerCase()));
  const candStressLower = candidate.joint_stress_tags.map(x => x.toLowerCase());
  if (setHasAny(avoidStress, candStressLower)) {
    return { score: -1, reasons: ["DISQUALIFIED: triggers avoided joint stress tag"], disqualified: true };
  }

  const requiredEquip = new Set((constraints.required_equipment ?? []).map(x => x.toLowerCase()));
  if (requiredEquip.size > 0) {
    const candSet = new Set(candEquipLower);
    for (const req of requiredEquip) {
      if (!candSet.has(req)) {
        return { score: -1, reasons: ["DISQUALIFIED: missing required equipment"], disqualified: true };
      }
    }
  }

  // 1) Stimulus intent match (very high weight)
  if (candidate.stimulus_intent === target.stimulus_intent) {
    score += 200;
    reasons.push("stimulus_intent: match");
  } else {
    score -= 200;
    reasons.push("stimulus_intent: mismatch");
  }

  // 2) Pattern match (high)
  if (candidate.pattern === target.pattern) {
    score += 120;
    reasons.push("pattern: match");
  } else {
    score -= 120;
    reasons.push("pattern: mismatch");
  }

  // 3) Equipment overlap + tier (medium-high)
  const tEquip = new Set(target.equipment.map(x => x.toLowerCase()));
  const overlap = intersectCount(tEquip, candEquipLower);
  score += overlap * 6;
  reasons.push(`equipment_overlap: ${overlap}`);

  score += tierScore(candidate.equipment_tier);
  reasons.push(`equipment_tier: ${candidate.equipment_tier}`);

  // 4) Stability similarity (medium)
  score += stabilityScore(candidate.stability);
  reasons.push(`stability: ${candidate.stability}`);

  // 5) ROM similarity (medium-low)
  score += romScore(candidate.rom);
  reasons.push(`rom: ${candidate.rom}`);

  // 6) Small bonus if candidate shares stress tags profile (not avoided)
  const tStress = new Set(target.joint_stress_tags.map(x => x.toLowerCase()));
  const stressOverlap = intersectCount(tStress, candStressLower);
  score += stressOverlap * 2;
  reasons.push(`stress_profile_overlap: ${stressOverlap}`);

  return { score, reasons, disqualified: false };
}

export function pickBestSubstitute(
  target: ExerciseSignature,
  candidates: ExerciseSignature[],
  constraints: SubstitutionConstraints = {}
): SubstitutionPick | null {
  const scored = candidates
    .filter(c => c.exercise_id !== target.exercise_id)
    .map(c => {
      const s = scoreCandidate(target, c, constraints);
      return { candidate: c, ...s };
    })
    .filter(x => !x.disqualified);

  if (scored.length === 0) return null;

  // Deterministic: sort by score desc, then exercise_id asc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.candidate.exercise_id.localeCompare(b.candidate.exercise_id);
  });

  const best = scored[0];
  return {
    selected_exercise_id: best.candidate.exercise_id,
    score: best.score,
    reasons: best.reasons
  };
}
