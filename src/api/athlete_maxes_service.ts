// DEV NOTE: API boundary surface. A self-directed athlete's own maxes, so a
// "% of 1RM" prescription becomes a real weight. The athlete enters a tested
// or estimated max for each lift their programme prescribes as a percentage;
// where they haven't, the estimated max from what they actually lifted
// (logged sets) is used. With neither, the session gives an effort target
// (RPE) instead of a percentage of a max nobody has recorded.
//
// Loads are worked out by the same shared arithmetic as coach-assigned
// sessions (resolveStrengthReferenceLoad). Maxes are stored as the athlete's
// own account events; a coach's strength profile for their athlete is
// separate and unchanged.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { resolveStrengthReferenceLoad } from "../../shared/strength-reference/strengthReferenceLifecycle.mjs";
import { getAthleteProgrammeExercises } from "./athlete_onboarding_service.js";
import { getProgressInsightsForAthlete } from "./progress_insights_service.js";

type Json = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

const MAXES_EVENT = "athlete_maxes_saved";
const BASES = new Set(["tested_1rm", "estimated_1rm"]);
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const baseExerciseId = (id: string) => id.replace(/__r[0-9]+$/u, "");

export class AthleteMaxesError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

export type AthleteMax = { exercise_id: string; value: number; unit: "kg" | "lb"; basis: "tested_1rm" | "estimated_1rm"; effective_date: string };
type SavedMaxes = { preferred_weight_unit: "kg" | "lb"; maxes: AthleteMax[] };

let labels: Map<string, string> | null = null;
function exerciseLabel(id: string): string | null {
  if (!labels) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    labels = new Map(Object.values(isRecord(doc?.entries) ? doc.entries : {}).filter(isRecord)
      .map((entry) => [text(entry.exercise_id), text(entry.display_label) || text(entry.exercise_id)]));
  }
  return labels.get(id) ?? null;
}

async function latestSaved(client: QueryClient, userId: string): Promise<SavedMaxes> {
  const result = await client.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, MAXES_EVENT]
  );
  const payload = result.rows?.[0]?.event_payload;
  const unit = isRecord(payload) && payload.preferred_weight_unit === "lb" ? "lb" : "kg";
  const maxes = isRecord(payload) && Array.isArray(payload.maxes) ? (payload.maxes.filter(isRecord) as unknown as AthleteMax[]) : [];
  return { preferred_weight_unit: unit, maxes };
}

// Latest estimated max per lift from what the athlete logged in training.
async function trainingEstimates(userId: string): Promise<Map<string, { value: number; unit: "kg" | "lb"; date: string }>> {
  const insights = await getProgressInsightsForAthlete(userId).catch(() => null);
  const trends = isRecord(insights) && Array.isArray(insights.training_e1rm_trends) ? insights.training_e1rm_trends.filter(isRecord) : [];
  return new Map(trends
    .filter((t) => Number.isFinite(Number(t.current_e1rm)) && Number(t.current_e1rm) > 0)
    .map((t) => [text(t.exercise_id), { value: Number(t.current_e1rm), unit: t.unit === "lb" ? "lb" : "kg", date: text(t.current_date) }]));
}

// The lifts the athlete's programme prescribes as a % of 1RM (named lifts and
// their own choices), in programme order.
async function percentageLifts(userId: string): Promise<string[]> {
  const programme = await getAthleteProgrammeExercises(userId);
  const days = Array.isArray(programme.days) ? programme.days.filter(isRecord) : [];
  const ids: string[] = [];
  for (const day of days) {
    for (const item of Array.isArray(day.items) ? day.items.filter(isRecord) : []) {
      const intensity = isRecord(item.prescription) && isRecord(item.prescription.intensity) ? item.prescription.intensity : null;
      if (intensity?.type !== "percent_1rm") continue;
      const id = item.kind === "fixed" ? text(item.exercise_id) : text(item.selected_exercise_id);
      if (id && exerciseLabel(id) && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export async function getAthleteMaxes(userId: string): Promise<Readonly<Json>> {
  const client = await pool.connect();
  let saved: SavedMaxes;
  try { saved = await latestSaved(client, userId); }
  finally { client.release(); }
  const [lifts, estimates] = await Promise.all([percentageLifts(userId), trainingEstimates(userId)]);
  const ids = [...lifts, ...saved.maxes.map((m) => m.exercise_id).filter((id) => !lifts.includes(id))];
  return Object.freeze({
    preferred_weight_unit: saved.preferred_weight_unit,
    lifts: ids.map((id) => ({
      exercise_id: id,
      display_name: exerciseLabel(id) ?? id,
      in_programme: lifts.includes(id),
      entered: saved.maxes.find((m) => m.exercise_id === id) ?? null,
      from_training: estimates.get(id) ?? null
    }))
  });
}

// Save the athlete's maxes (the whole list, replacing the previous one).
export async function saveAthleteMaxes(userId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new AthleteMaxesError("athlete_maxes_invalid", 422);
  const fieldErrors: Json = {};
  for (const key of Object.keys(input)) if (key !== "preferred_weight_unit" && key !== "maxes") fieldErrors[key] = "Not part of your maxes.";
  const unit = input.preferred_weight_unit ?? "kg";
  if (unit !== "kg" && unit !== "lb") fieldErrors.preferred_weight_unit = "Choose kg or lb.";
  if (!Array.isArray(input.maxes)) fieldErrors.maxes = "Your maxes must be a list.";
  const today = new Date().toISOString().slice(0, 10);
  const maxes: AthleteMax[] = [];
  for (const entry of Array.isArray(input.maxes) ? input.maxes : []) {
    const id = isRecord(entry) ? text(entry.exercise_id) : "";
    const key = id || "maxes";
    if (!isRecord(entry) || !exerciseLabel(id)) { fieldErrors[key] = "Choose a lift from the list."; continue; }
    const value = Number(entry.value);
    if (!Number.isFinite(value) || value < 0.25 || value > 1500) { fieldErrors[id] = "Enter a weight between 0.25 and 1500."; continue; }
    const entryUnit = entry.unit === "lb" ? "lb" : entry.unit === "kg" ? "kg" : null;
    if (!entryUnit) { fieldErrors[id] = "Choose kg or lb."; continue; }
    const basis = text(entry.basis) || "tested_1rm";
    if (!BASES.has(basis)) { fieldErrors[id] = "Say whether this max was tested or estimated."; continue; }
    const date = text(entry.effective_date) || today;
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(date) || Number.isNaN(Date.parse(date)) || date > today) { fieldErrors[id] = "Enter the date of this max (not in the future)."; continue; }
    if (maxes.some((m) => m.exercise_id === id)) { fieldErrors[id] = "One max per lift."; continue; }
    maxes.push({ exercise_id: id, value: Number(value.toFixed(3)), unit: entryUnit, basis: basis as AthleteMax["basis"], effective_date: date });
  }
  if (Object.keys(fieldErrors).length) throw new AthleteMaxesError("athlete_maxes_invalid", 422, fieldErrors);
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
       VALUES ($1, $2, $3, $4::jsonb, now())`,
      [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, MAXES_EVENT,
        JSON.stringify({ preferred_weight_unit: unit, maxes, schema_version: "athlete_maxes_v1" })]
    );
  }
  finally { client.release(); }
  return getAthleteMaxes(userId);
}

// An effort target for a % of 1RM prescription when no max is recorded:
// reps in reserve from a standard RPE chart (about 3.2% of 1RM per rep),
// kept between RPE 6 and 9.
export function rpeForPercentage(percent: number, reps: number): number {
  const repsInReserve = (100 - percent) / 3.2 + 1 - reps;
  const rpe = 10 - repsInReserve;
  return Math.min(9, Math.max(6, Math.round(rpe * 2) / 2));
}

// Turn every "% of 1RM" exercise in a self-directed session into a weight
// from the athlete's maxes (entered first, then estimated from training), or
// an RPE target when there is no max.
export async function resolveAthleteSessionLoads(userId: string, exercises: Json[]): Promise<Json[]> {
  const needs = exercises.some((e) => isRecord(e.intensity) && e.intensity.type === "percent_1rm" && !isRecord(e.resolved_load));
  if (!needs) return exercises;
  const client = await pool.connect();
  let saved: SavedMaxes;
  try { saved = await latestSaved(client, userId); }
  finally { client.release(); }
  const estimates = await trainingEstimates(userId);
  const benchmarks = [
    ...saved.maxes.map((m) => ({
      benchmark_id: `athlete_max_${m.exercise_id}`, exercise_id: m.exercise_id, value: m.value, unit: m.unit,
      basis: m.basis, effective_date: m.effective_date, source_note: "entered by the athlete", replaces_reference_id: null
    })),
    ...[...estimates].filter(([id]) => !saved.maxes.some((m) => m.exercise_id === id)).map(([id, est]) => ({
      benchmark_id: `training_e1rm_${id}`, exercise_id: id, value: est.value, unit: est.unit,
      basis: "estimated_1rm", effective_date: est.date || new Date().toISOString().slice(0, 10),
      source_note: "estimated from logged training", replaces_reference_id: null
    }))
  ];
  const profile = { preferred_weight_unit: saved.preferred_weight_unit, load_rounding_increment: saved.preferred_weight_unit === "lb" ? 5 : 2.5, benchmarks };
  return exercises.map((exercise) => {
    const intensity = isRecord(exercise.intensity) ? exercise.intensity : null;
    if (intensity?.type !== "percent_1rm" || isRecord(exercise.resolved_load)) return exercise;
    const percent = Number(intensity.value);
    let resolved: Readonly<Json> | null = null;
    try { resolved = benchmarks.length ? resolveStrengthReferenceLoad(profile, baseExerciseId(String(exercise.exercise_id ?? "")), percent) : null; }
    catch { resolved = null; }
    if (resolved) return { ...exercise, resolved_load: resolved };
    const reps = Number(exercise.reps ?? (isRecord(exercise.rep_range) ? exercise.rep_range.maximum : 5));
    return { ...exercise, load_guidance: { type: "rpe", value: rpeForPercentage(percent, Number.isFinite(reps) ? reps : 5), reason: "no_max_recorded" } };
  });
}
