// DEV NOTE: API boundary surface. A self-directed athlete's own maxes, so a
// "% of 1RM" prescription becomes a real weight. The athlete enters a tested
// or estimated max for each lift their programme prescribes as a percentage;
// where they haven't, the estimated max from what they actually lifted
// (logged sets) is used. With neither, the session gives an effort target
// (RPE) instead of a percentage of a max nobody has recorded.
//
// How weights are set is the athlete's choice (saved with their maxes):
// - "progression" (the default for beginners): the weight comes from what
//   they lifted last time on that lift - every rep made, add a little; reps
//   missed, the same again; missed twice at the same weight, 10% off. The
//   first time, they pick a light technique weight. No RPE: a beginner can't
//   judge reps in reserve yet.
// - "percent_1rm" (the default from amateur up): % of their max.
// - "rpe": an effort target.
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
import {
  defaultLoadingMethod,
  LOADING_METHODS,
  type LiftSession,
  type LoadingMethod,
  percentForRpe,
  progressionIncrement,
  progressionPrescription,
  rpeForPercentage,
  effortWithoutMax
} from "./athlete_loading_rules.js";
import { getAthleteExperienceLevel, getAthleteProgrammeExercises } from "./athlete_onboarding_service.js";
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
type SavedMaxes = { preferred_weight_unit: "kg" | "lb"; maxes: AthleteMax[]; loading_method: LoadingMethod | null };

let registry: Map<string, Json> | null = null;
function registryEntry(id: string): Json | null {
  if (!registry) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    registry = new Map(Object.values(isRecord(doc?.entries) ? doc.entries : {}).filter(isRecord).map((entry) => [text(entry.exercise_id), entry]));
  }
  return registry.get(id) ?? null;
}
function exerciseLabel(id: string): string | null {
  const entry = registryEntry(id);
  return entry ? text(entry.display_label) || id : null;
}

// Lifts that take no external load, and work that isn't loaded by weight at all.
function isBodyweightLift(id: string): boolean {
  const required = registryEntry(id)?.equipment_requirements;
  return Array.isArray(required) && required.includes("bodyweight");
}
const NOT_WEIGHT_LOADED = /^(jump_|sprint_|conditioning_|locomotion_|throw_slam|deceleration|change_of_direction|neck_isometric)/u;
function isWeightLoaded(id: string): boolean {
  return !NOT_WEIGHT_LOADED.test(text(registryEntry(id)?.movement_pattern_id));
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
  const method = isRecord(payload) && LOADING_METHODS.has(text(payload.loading_method)) ? (text(payload.loading_method) as LoadingMethod) : null;
  return { preferred_weight_unit: unit, maxes, loading_method: method };
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
      if (intensity?.type !== "percent_1rm" && intensity?.type !== "rpe") continue;
      const id = item.kind === "fixed" ? text(item.exercise_id) : text(item.selected_exercise_id);
      if (id && exerciseLabel(id) && !isBodyweightLift(id) && isWeightLoaded(id) && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export async function getAthleteMaxes(userId: string): Promise<Readonly<Json>> {
  const client = await pool.connect();
  let saved: SavedMaxes;
  try { saved = await latestSaved(client, userId); }
  finally { client.release(); }
  const [lifts, estimates, level] = await Promise.all([percentageLifts(userId), trainingEstimates(userId), getAthleteExperienceLevel(userId)]);
  const ids = [...lifts, ...saved.maxes.map((m) => m.exercise_id).filter((id) => !lifts.includes(id))];
  return Object.freeze({
    preferred_weight_unit: saved.preferred_weight_unit,
    loading_method: saved.loading_method ?? defaultLoadingMethod(level),
    loading_method_chosen: saved.loading_method !== null,
    experience_level: level ?? null,
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
  for (const key of Object.keys(input)) if (key !== "preferred_weight_unit" && key !== "maxes" && key !== "loading_method") fieldErrors[key] = "Not part of your maxes.";
  if (input.loading_method !== undefined && !LOADING_METHODS.has(text(input.loading_method))) fieldErrors.loading_method = "Choose how your weights are set.";
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
    // A save without a loading method keeps the one already chosen.
    const loadingMethod = input.loading_method === undefined ? (await latestSaved(client, userId)).loading_method : (text(input.loading_method) as LoadingMethod);
    await client.query(
      `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
       VALUES ($1, $2, $3, $4::jsonb, now())`,
      [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, MAXES_EVENT,
        JSON.stringify({ preferred_weight_unit: unit, maxes, ...(loadingMethod ? { loading_method: loadingMethod } : {}), schema_version: "athlete_maxes_v1" })]
    );
  }
  finally { client.release(); }
  return getAthleteMaxes(userId);
}

// Every prescribed set the athlete logged, per lift, per session, newest
// session first (the latest log of each set).
async function liftHistory(userId: string): Promise<Map<string, LiftSession[]>> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (re.session_id, re.event->>'exercise_id', re.event->>'set_index')
      re.session_id, s.created_at AS session_created_at, re.event->>'exercise_id' AS exercise_id,
      (re.event->>'reps')::int AS reps, (re.event->>'load_value')::numeric AS load_value, re.event->>'load_unit' AS load_unit
    FROM runtime_events re
    JOIN sessions s ON s.session_id = re.session_id
    WHERE s.beta_subject_user_id = $1
      AND re.event->>'type' = 'SET_LOG_REPORT'
      AND re.event->>'set_index' IS NOT NULL
      AND re.event->>'reps' IS NOT NULL
    ORDER BY re.session_id, re.event->>'exercise_id', re.event->>'set_index', re.seq DESC
    `,
    [userId]
  );
  const bySession = new Map<string, { at: number; lift: string; sets: LiftSession["sets"] }>();
  for (const row of result.rows ?? []) {
    const lift = baseExerciseId(text(row.exercise_id));
    const key = `${text(row.session_id)}|${lift}`;
    const entry = bySession.get(key) ?? { at: new Date(row.session_created_at).getTime(), lift, sets: [] };
    entry.sets.push({ reps: Number(row.reps), load: row.load_value === null || row.load_value === undefined ? 0 : Number(row.load_value), unit: row.load_unit === "lb" ? "lb" : "kg" });
    bySession.set(key, entry);
  }
  const history = new Map<string, LiftSession[]>();
  for (const entry of [...bySession.values()].sort((a, b) => b.at - a.at)) {
    history.set(entry.lift, [...(history.get(entry.lift) ?? []), { sets: entry.sets }]);
  }
  return history;
}

const targetRepsOf = (exercise: Json) => {
  const range = isRecord(exercise.rep_range) ? exercise.rep_range : null;
  const reps = Number(range?.maximum ?? exercise.reps);
  return Number.isFinite(reps) && reps > 0 ? reps : 5;
};

// Set every weight-loaded lift in a self-directed session the athlete's way
// (see the top of this file): from their last session, as % of their max, or
// as an effort target.
export async function resolveAthleteSessionLoads(userId: string, exercises: Json[], level?: string): Promise<Json[]> {
  const loadedLift = (e: Json) => isRecord(e.intensity) && (e.intensity.type === "percent_1rm" || e.intensity.type === "rpe") && !isRecord(e.resolved_load);
  if (!exercises.some(loadedLift)) return exercises;
  const client = await pool.connect();
  let saved: SavedMaxes;
  try { saved = await latestSaved(client, userId); }
  finally { client.release(); }
  const method = saved.loading_method ?? defaultLoadingMethod(level);
  const unit = saved.preferred_weight_unit;
  const [estimates, history] = await Promise.all([
    method === "percent_1rm" ? trainingEstimates(userId) : Promise.resolve(new Map()),
    method === "rpe" ? Promise.resolve(new Map<string, LiftSession[]>()) : liftHistory(userId)
  ]);
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
  const profile = { preferred_weight_unit: unit, load_rounding_increment: unit === "lb" ? 5 : 2.5, benchmarks };

  const progression = (exercise: Json, lift: string): Json => {
    const reps = targetRepsOf(exercise);
    const increment = progressionIncrement(text(registryEntry(lift)?.movement_pattern_id), unit);
    const next = progressionPrescription(history.get(lift) ?? [], reps, increment, unit);
    if (next.basis === "first_time") return { ...exercise, load_guidance: { type: "progression", basis: "first_time", reps } };
    return {
      ...exercise,
      intensity: { type: "load", value: next.value, unit: next.unit },
      load_guidance: { type: "progression", basis: next.basis, previous: next.previous, increment: next.increment, unit: next.unit, reps }
    };
  };

  return exercises.map((exercise) => {
    if (!loadedLift(exercise)) return exercise;
    const intensity = exercise.intensity as Json;
    const lift = baseExerciseId(String(exercise.exercise_id ?? ""));
    if (!isWeightLoaded(lift)) return exercise;
    // A bodyweight lift: an effort target the programme wrote (pull-ups at
    // RPE 8) stands, except for a beginner building from what they lift (no
    // RPE); a % of 1RM never applies - it's bodyweight, or that effort for
    // someone who chose RPE.
    if (isBodyweightLift(lift)) {
      if (intensity.type === "rpe") return method === "progression" ? { ...exercise, intensity: { type: "bodyweight" } } : exercise;
      return method === "rpe"
        ? { ...exercise, intensity: { type: "rpe", value: rpeForPercentage(Number(intensity.value), targetRepsOf(exercise)) } }
        : { ...exercise, intensity: { type: "bodyweight" } };
    }
    const reps = targetRepsOf(exercise);

    if (method === "rpe") {
      return intensity.type === "rpe" ? exercise : { ...exercise, intensity: { type: "rpe", value: rpeForPercentage(Number(intensity.value), reps) } };
    }
    if (method === "progression") return progression(exercise, lift);

    // % of max: a beginner's effort target becomes a conservative percentage.
    const percent = intensity.type === "percent_1rm"
      ? Number(intensity.value)
      : Math.min(level === "beginner" ? 75 : 90, percentForRpe(Number(intensity.value), reps));
    const asPercent = { ...exercise, intensity: { type: "percent_1rm", value: percent } };
    let resolved: Readonly<Json> | null = null;
    try { resolved = benchmarks.length ? resolveStrengthReferenceLoad(profile, lift, percent) : null; }
    catch { resolved = null; }
    if (resolved) return { ...asPercent, resolved_load: resolved };
    // No max for this lift: a beginner goes by their last session; from
    // amateur up, an effort target.
    if (level === "beginner") return progression(exercise, lift);
    return { ...asPercent, load_guidance: { type: "rpe", value: effortWithoutMax(intensity, percent, reps), reason: "no_max_recorded" } };
  });
}
