// DEV NOTE: API boundary surface. The equipment a self-directed athlete has.
// Until they say, a full gym is assumed (today's behaviour). Once set:
// - their exercise recommendations only offer what they can do with it;
// - at session creation an exercise they can't do (e.g. a named yoke walk with
//   no yoke) is swapped for a recommended alternative that fits, marked as a
//   substitute ("No yoke - Farmer's carry instead"), or, with nothing
//   suitable, kept and flagged so the athlete can skip it or improvise.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { alternativesFor, canDoWithEquipment } from "@kolosseum/engine/phases/phase4.js";
import { pool } from "../db/pool.js";

type Json = Record<string, unknown>;

const EQUIPMENT_EVENT = "athlete_equipment_saved";
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const baseExerciseId = (id: string) => id.replace(/__r[0-9]+$/u, "");

export class AthleteEquipmentError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

type Registry = { equipment: Map<string, string>; exercises: Map<string, { label: string; needs: string[] }> };
let registry: Registry | null = null;
function reg(): Registry {
  if (!registry) {
    const load = (name: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", name, `${name}.registry.json`), "utf8"));
    const equipment = new Map(Object.values(isRecord(load("equipment").entries) ? load("equipment").entries : {}).filter(isRecord)
      .map((e) => [text(e.equipment_id), text(e.display_label) || text(e.equipment_id)]));
    const exercises = new Map(Object.values(isRecord(load("exercise").entries) ? load("exercise").entries : {}).filter(isRecord)
      .map((e) => [text(e.exercise_id), { label: text(e.display_label) || text(e.exercise_id), needs: Array.isArray(e.equipment_requirements) ? e.equipment_requirements.map(String) : [] }]));
    registry = { equipment, exercises };
  }
  return registry;
}

// Always available, so never asked for.
const ALWAYS = new Set(["bodyweight", "open_floor_space"]);

// The equipment the athlete has, or null when they haven't said (full gym).
export async function getAthleteEquipment(userId: string): Promise<string[] | null> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, EQUIPMENT_EVENT]
  );
  const payload = result.rows?.[0]?.event_payload;
  if (!isRecord(payload) || payload.full_gym === true || !Array.isArray(payload.available_equipment)) return null;
  return payload.available_equipment.map(String).filter((id) => reg().equipment.has(id));
}

export async function describeAthleteEquipment(userId: string): Promise<Readonly<Json>> {
  const have = await getAthleteEquipment(userId);
  return Object.freeze({
    full_gym: have === null,
    available_equipment: have ?? [],
    options: [...reg().equipment].filter(([id]) => !ALWAYS.has(id)).map(([equipment_id, display_name]) => ({ equipment_id, display_name }))
  });
}

// Save the athlete's equipment: { full_gym: true } or { available_equipment: [...] }.
export async function saveAthleteEquipment(userId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new AthleteEquipmentError("athlete_equipment_invalid", 422);
  const errors: Json = {};
  for (const key of Object.keys(input)) if (key !== "full_gym" && key !== "available_equipment") errors[key] = "Not part of your equipment.";
  const fullGym = input.full_gym === true;
  const list = Array.isArray(input.available_equipment) ? input.available_equipment.map(String) : null;
  if (!fullGym && !list) errors.available_equipment = "Choose the equipment you have, or a full gym.";
  const unknown = (list ?? []).filter((id) => !reg().equipment.has(id));
  if (unknown.length) errors.available_equipment = `Unknown equipment: ${unknown.join(", ")}.`;
  if (Object.keys(errors).length) throw new AthleteEquipmentError("athlete_equipment_invalid", 422, errors);
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, EQUIPMENT_EVENT,
      JSON.stringify(fullGym ? { full_gym: true, schema_version: "athlete_equipment_v1" } : { available_equipment: [...new Set(list)], schema_version: "athlete_equipment_v1" })]
  );
  return describeAthleteEquipment(userId);
}

// Swap or flag exercises the athlete can't do with their equipment.
export async function applyAthleteEquipment(
  userId: string,
  context: { activity_id: string; experience_level?: string },
  exercises: Json[]
): Promise<Json[]> {
  const have = await getAthleteEquipment(userId);
  if (!have) return exercises;
  const inSession = new Set(exercises.map((e) => baseExerciseId(text(e.exercise_id))));
  return exercises.map((exercise) => {
    const id = baseExerciseId(text(exercise.exercise_id));
    const known = reg().exercises.get(id);
    if (!known || canDoWithEquipment(id, have)) return exercise;
    const haveSet = new Set([...have, ...ALWAYS]);
    const missing = known.needs.filter((need) => !haveSet.has(need)).map((need) => reg().equipment.get(need) ?? need);
    const alternative = alternativesFor({ activity_id: context.activity_id, experience_level: context.experience_level, exercise_id: id, constraints: { available_equipment: have } })
      .find((alt) => !inSession.has(alt));
    if (!alternative) return { ...exercise, equipment_missing: missing };
    inSession.add(alternative);
    return {
      ...exercise,
      exercise_id: alternative,
      display_name: reg().exercises.get(alternative)?.label ?? alternative,
      equipment_swap: { from_exercise_id: text(exercise.exercise_id), from_display_name: text(exercise.display_name) || known.label, missing }
    };
  });
}
