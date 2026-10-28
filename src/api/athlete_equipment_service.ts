// DEV NOTE: API boundary surface. The equipment a self-directed athlete has.
// Until they say, a full gym is assumed (today's behaviour). Once set:
// - their exercise recommendations only offer what they can do with it;
// - at session creation an exercise they can't do (e.g. a named yoke walk with
//   no yoke) is swapped for a recommended alternative that fits, marked as a
//   substitute ("No yoke - Farmer's carry instead"), or, with nothing
//   suitable, kept and flagged so the athlete can skip it or improvise.
// An athlete can also choose their gyms (up to 3, from approved listings -
// gym_listing_service.ts) and name one their main gym: their equipment is
// then the main gym's listed equipment plus their own list (their home kit).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { alternativesFor, canDoWithEquipment } from "@kolosseum/engine/phases/phase4.js";
import { pool } from "../db/pool.js";

type Json = Record<string, unknown>;

const EQUIPMENT_EVENT = "athlete_equipment_saved";
export const GYMS_EVENT = "athlete_gyms_saved";
const MAX_GYMS = 3;
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

async function latestPayload(userId: string, eventType: string): Promise<Json | null> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, eventType]
  );
  const payload = result.rows?.[0]?.event_payload;
  return isRecord(payload) ? payload : null;
}

// The athlete's own list (their home kit when they have a main gym), or
// null when they haven't given one.
async function ownEquipment(userId: string): Promise<string[] | null> {
  const payload = await latestPayload(userId, EQUIPMENT_EVENT);
  if (!payload || payload.full_gym === true || !Array.isArray(payload.available_equipment)) return null;
  return payload.available_equipment.map(String).filter((id) => reg().equipment.has(id));
}

type ChosenGym = { org_id: string; display_name: string; area: string; equipment: string[]; listed: boolean };

// The gyms the athlete chose, in their order, main gym first. A gym that's
// no longer listed (hidden by an admin, or closed) stays in the list but
// lends no equipment.
async function chosenGyms(userId: string): Promise<{ gyms: ChosenGym[]; main_org_id: string | null }> {
  const payload = await latestPayload(userId, GYMS_EVENT);
  const ids = Array.isArray(payload?.gym_org_ids) ? payload.gym_org_ids.map(String) : [];
  if (!ids.length) return { gyms: [], main_org_id: null };
  const result = await pool.query(
    `SELECT l.org_id, l.display_name, l.area, l.equipment, (l.listing_status = 'approved' AND o.org_state = 'active') AS listed
     FROM product_gym_listings l JOIN product_organisations o ON o.org_id = l.org_id WHERE l.org_id = ANY($1::text[])`,
    [ids]
  );
  const byId = new Map(result.rows.map((row) => [String(row.org_id), {
    org_id: String(row.org_id), display_name: text(row.display_name), area: text(row.area),
    equipment: Array.isArray(row.equipment) ? row.equipment.map(String).filter((id: string) => reg().equipment.has(id)) : [],
    listed: row.listed === true
  }]));
  const gyms = ids.map((id: string) => byId.get(id)).filter((gym): gym is ChosenGym => !!gym);
  const main = text(payload?.main_org_id);
  return { gyms, main_org_id: gyms.some((gym) => gym.org_id === main) ? main : null };
}

// The equipment anyone can list (bodyweight and floor space go without saying).
export function equipmentOptions(): { equipment_id: string; display_name: string }[] {
  return [...reg().equipment].filter(([id]) => !ALWAYS.has(id)).map(([equipment_id, display_name]) => ({ equipment_id, display_name }));
}

// The equipment the athlete has, or null when they haven't said (full gym):
// their main gym's (while it's listed) plus their own list, else their list.
export async function getAthleteEquipment(userId: string): Promise<string[] | null> {
  const own = await ownEquipment(userId);
  const { gyms, main_org_id } = await chosenGyms(userId);
  const main = gyms.find((gym) => gym.org_id === main_org_id && gym.listed);
  if (main) return [...new Set([...main.equipment, ...(own ?? [])])];
  return own;
}

export async function describeAthleteEquipment(userId: string): Promise<Readonly<Json>> {
  const own = await ownEquipment(userId);
  const { gyms, main_org_id } = await chosenGyms(userId);
  const main = gyms.find((gym) => gym.org_id === main_org_id && gym.listed) ?? null;
  return Object.freeze({
    full_gym: own === null && !main,
    available_equipment: own ?? [],
    gyms: gyms.map(({ org_id, display_name, area, equipment, listed }) => ({ org_id, display_name, area, equipment_count: equipment.length, listed })),
    main_gym: main ? { org_id: main.org_id, display_name: main.display_name, equipment: main.equipment } : null,
    options: equipmentOptions()
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

// Save the athlete's gyms: { gym_org_ids: [...up to 3], main_org_id }. Only
// listed (approved) gyms can be newly chosen; an empty list clears them.
export async function saveAthleteGyms(userId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new AthleteEquipmentError("athlete_gyms_invalid", 422);
  const errors: Json = {};
  for (const key of Object.keys(input)) if (key !== "gym_org_ids" && key !== "main_org_id") errors[key] = "Not part of your gyms.";
  const ids = Array.isArray(input.gym_org_ids) ? [...new Set(input.gym_org_ids.map(String).map((id) => id.trim()).filter(Boolean))] : null;
  if (!ids) errors.gym_org_ids = "Choose your gyms.";
  else if (ids.length > MAX_GYMS) errors.gym_org_ids = `Choose up to ${MAX_GYMS} gyms.`;
  const main = text(input.main_org_id) || (ids?.[0] ?? "");
  if (ids?.length && !ids.includes(main)) errors.main_org_id = "Your main gym must be one of your gyms.";
  if (ids?.length && !Object.keys(errors).length) {
    const previous = new Set((await chosenGyms(userId)).gyms.map((gym) => gym.org_id));
    const listed = await pool.query(
      `SELECT l.org_id FROM product_gym_listings l JOIN product_organisations o ON o.org_id = l.org_id
       WHERE l.org_id = ANY($1::text[]) AND l.listing_status = 'approved' AND o.org_state = 'active'`,
      [ids]
    );
    const ok = new Set(listed.rows.map((row) => String(row.org_id)));
    const unknown = ids.filter((id) => !ok.has(id) && !previous.has(id));
    if (unknown.length) errors.gym_org_ids = "That gym isn't listed.";
  }
  if (Object.keys(errors).length) throw new AthleteEquipmentError("athlete_gyms_invalid", 422, errors);
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, GYMS_EVENT,
      JSON.stringify({ gym_org_ids: ids, main_org_id: ids!.length ? main : null, schema_version: "athlete_gyms_v1" })]
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
