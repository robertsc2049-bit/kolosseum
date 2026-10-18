// DEV NOTE: Bodyweight lifts (pull-ups, dips, chin-ups, push-ups...): the
// weight actually moved is the athlete's bodyweight plus whatever they added
// (minus band assistance). Street lifting is scored on exactly that - a 75 kg
// lifter's +20 kg pull-up moves 95 kg - so maxes, strength relative to
// bodyweight and attempts use bodyweight + added, never the added weight alone.
import fs from "node:fs";
import path from "node:path";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// A lift whose registry equipment includes "bodyweight" (read once).
let bodyweightLifts: Set<string> | null = null;
export function isBodyweightLift(exerciseId: string): boolean {
  if (!bodyweightLifts) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    bodyweightLifts = new Set(Object.values(isRecord(doc?.entries) ? doc.entries : {}).filter(isRecord)
      .filter((entry) => Array.isArray(entry.equipment_requirements) && entry.equipment_requirements.includes("bodyweight"))
      .map((entry) => text(entry.exercise_id)));
  }
  return bodyweightLifts.has(exerciseId.replace(/__r[0-9]+$/u, ""));
}

// Bodyweight + added (added may be 0, or negative for band assistance).
export function systemLoadKg(bodyweightKg: number, addedKg: number | null | undefined): number | null {
  const total = bodyweightKg + (Number.isFinite(addedKg) ? Number(addedKg) : 0);
  return total > 0 ? Math.round(total * 10) / 10 : null;
}
