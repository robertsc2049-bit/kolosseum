// DEV NOTE: API boundary surface. Pain carry-forward: a pain report in a
// session opens a pain flag that later sessions never ignore. It records
// facts only - it never diagnoses, scores risk or gives treatment advice.
//
// - A flag covers the joint the athlete said hurt (every exercise loading it,
//   by the registry's joint_stress_tags), or just the reported exercise when
//   no joint was given ("other").
// - It stays open until the athlete checks in pain-free or their coach
//   clears it.
// - Before a session that contains an affected exercise, the athlete must
//   check in (once per session). "Still sore" either swaps each affected
//   exercise for a recommended alternative that does not load the joint, or
//   leaves them out - for that session only.
//
// Flags are derived, not stored: pain reports are the session's own runtime
// events; check-ins and coach clears are product account events.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { PoolClient } from "pg";

import { painFreeAlternatives } from "@kolosseum/engine/phases/phase4.js";
import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";

type Json = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

export const PAIN_AREAS = Object.freeze(["knee", "hip", "lumbar_low", "shoulder", "elbow", "wrist", "ankle", "neck", "other"] as const);
export type PainArea = (typeof PAIN_AREAS)[number];
const JOINT_AREAS: ReadonlySet<string> = new Set(PAIN_AREAS.filter((area) => area !== "other"));
const AREA_LABELS: Record<string, string> = {
  knee: "knee", hip: "hip", lumbar_low: "lower back", shoulder: "shoulder", elbow: "elbow",
  wrist: "wrist", ankle: "ankle", neck: "neck"
};

const CHECK_IN_EVENT = "athlete_pain_check_in";
const CLEAR_EVENT = "athlete_pain_flag_cleared";

export class PainFlagError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const toIso = (v: unknown) => (v instanceof Date ? v.toISOString() : text(v));
// A repeat of an exercise in a session ("back_squat__r2") is that exercise.
const baseExerciseId = (id: string) => id.replace(/__r[0-9]+$/u, "");

type RegistryExercise = { label: string; joints: string[] };
let registryCache: Map<string, RegistryExercise> | null = null;
function registryExercise(exerciseId: string): RegistryExercise | undefined {
  if (!registryCache) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    registryCache = new Map(Object.values(isRecord(doc?.entries) ? doc.entries : {}).filter(isRecord).map((entry) => [
      text(entry.exercise_id),
      { label: text(entry.display_label) || text(entry.exercise_id), joints: Array.isArray(entry.joint_stress_tags) ? entry.joint_stress_tags.map(String) : [] }
    ]));
  }
  return registryCache.get(exerciseId);
}
const exerciseLabel = (exerciseId: string, customName?: string) =>
  customName || registryExercise(baseExerciseId(exerciseId))?.label || exerciseId;

export function painFlagKey(exerciseId: string, area: string | null): string {
  return area && JOINT_AREAS.has(area) ? `area:${area}` : `exercise:${baseExerciseId(exerciseId)}`;
}

// Does this flag cover this session exercise? A joint flag covers every
// exercise the registry says loads that joint; an exercise flag covers that
// exercise (and its repeats).
function flagCovers(flagKey: string, exerciseId: string): boolean {
  const base = baseExerciseId(exerciseId);
  if (flagKey.startsWith("area:")) return (registryExercise(base)?.joints ?? []).includes(flagKey.slice(5));
  return flagKey === `exercise:${base}`;
}

type PainReport = { session_id: string; exercise_id: string; area: string | null; at: string };
type CheckIn = { flag_key: string; status: "pain_free" | "still_sore"; plan: "swap" | "skip" | null; at: string };
type Clear = { flag_key: string; at: string; by: string };

export type PainFlag = {
  flag_key: string;
  area: string | null;
  reported_exercise_ids: string[];
  first_reported_at: string;
  last_reported_at: string;
  latest_check_in: CheckIn | null;
};

async function loadFacts(client: QueryClient, athleteUserId: string) {
  const reports = await client.query(
    `SELECT re.session_id, re.event, re.created_at
     FROM runtime_events re JOIN sessions s ON s.session_id = re.session_id
     WHERE s.beta_subject_user_id = $1
       AND re.event->>'type' = 'PAIN_REPORT' AND re.event->>'pain_reported' = 'true'
     ORDER BY re.created_at, re.seq`,
    [athleteUserId]
  );
  const events = await client.query(
    `SELECT event_type, event_payload, occurred_at FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3)
     ORDER BY occurred_at, event_id`,
    [athleteUserId, CHECK_IN_EVENT, CLEAR_EVENT]
  );
  const lastSession = await client.query(
    `SELECT max(created_at) AS at FROM sessions WHERE beta_subject_user_id = $1`,
    [athleteUserId]
  );
  const painReports: PainReport[] = (reports.rows ?? []).map((row: Json) => {
    const event = isRecord(row.event) ? row.event : {};
    const area = text(event.pain_area);
    return { session_id: text(row.session_id), exercise_id: text(event.exercise_id), area: area || null, at: toIso(row.created_at) };
  });
  const checkIns: CheckIn[] = [];
  const clears: Clear[] = [];
  for (const row of events.rows ?? []) {
    const payload = isRecord(row.event_payload) ? row.event_payload : {};
    const at = toIso(row.occurred_at);
    if (row.event_type === CHECK_IN_EVENT) {
      const status = payload.status === "pain_free" ? "pain_free" : "still_sore";
      const plan = payload.plan === "skip" ? "skip" : payload.plan === "swap" ? "swap" : null;
      checkIns.push({ flag_key: text(payload.flag_key), status, plan, at });
    }
    else clears.push({ flag_key: text(payload.flag_key), at, by: text(payload.cleared_by_user_id) });
  }
  const lastSessionAt = toIso(lastSession.rows?.[0]?.at) || null;
  return { painReports, checkIns, clears, lastSessionAt };
}

const later = (a: string, b: string | null | undefined) => !b || Date.parse(a) > Date.parse(b);

// Open flags: the latest pain report for the key is after the latest
// pain-free check-in or coach clear for it.
export function derivePainFlags(facts: { painReports: PainReport[]; checkIns: CheckIn[]; clears: Clear[] }): PainFlag[] {
  const byKey = new Map<string, PainReport[]>();
  for (const report of facts.painReports) {
    const key = painFlagKey(report.exercise_id, report.area);
    byKey.set(key, [...(byKey.get(key) ?? []), report]);
  }
  const flags: PainFlag[] = [];
  for (const [key, reports] of byKey) {
    const lastReport = reports[reports.length - 1].at;
    const closedAt = [
      ...facts.checkIns.filter((c) => c.flag_key === key && c.status === "pain_free").map((c) => c.at),
      ...facts.clears.filter((c) => c.flag_key === key).map((c) => c.at)
    ].sort().pop();
    if (closedAt && !later(lastReport, closedAt)) continue;
    const open = closedAt ? reports.filter((r) => later(r.at, closedAt)) : reports;
    const checkIn = facts.checkIns.filter((c) => c.flag_key === key && later(c.at, lastReport)).pop() ?? null;
    flags.push({
      flag_key: key,
      area: key.startsWith("area:") ? key.slice(5) : null,
      reported_exercise_ids: [...new Set(open.map((r) => baseExerciseId(r.exercise_id)))],
      first_reported_at: open[0].at,
      last_reported_at: lastReport,
      latest_check_in: checkIn
    });
  }
  return flags.sort((a, b) => a.first_reported_at.localeCompare(b.first_reported_at));
}

// A check-in answers "how is it now?" for the next session: it counts when
// it is newer than both the latest pain report and the latest session.
function pendingCheckIn(flag: PainFlag, lastSessionAt: string | null): CheckIn | null {
  const checkIn = flag.latest_check_in;
  return checkIn && later(checkIn.at, lastSessionAt) ? checkIn : null;
}

function describeFlag(flag: PainFlag, lastSessionAt: string | null): Json {
  const where = flag.area ? `your ${AREA_LABELS[flag.area] ?? flag.area}` : exerciseLabel(flag.reported_exercise_ids[0]);
  return {
    flag_key: flag.flag_key,
    area: flag.area,
    where,
    reported_exercises: flag.reported_exercise_ids.map((id) => ({ exercise_id: id, display_name: exerciseLabel(id) })),
    first_reported_at: flag.first_reported_at,
    last_reported_at: flag.last_reported_at,
    latest_check_in: flag.latest_check_in,
    check_in_due: pendingCheckIn(flag, lastSessionAt) === null
  };
}

export async function getAthletePainFlags(athleteUserId: string): Promise<Readonly<Json>> {
  const client = await pool.connect();
  try {
    const facts = await loadFacts(client, athleteUserId);
    return Object.freeze({ flags: derivePainFlags(facts).map((flag) => describeFlag(flag, facts.lastSessionAt)) });
  }
  finally { client.release(); }
}

async function appendEvent(client: QueryClient, userId: string, eventType: string, payload: Json, at: string) {
  await client.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, eventType, JSON.stringify(payload), at]
  );
}

// The athlete's answer to "how is it now?" for one open flag.
export async function recordPainCheckIn(athleteUserId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new PainFlagError("pain_check_in_invalid", 422);
  const fieldErrors: Json = {};
  for (const key of Object.keys(input)) if (!["flag_key", "status", "plan"].includes(key)) fieldErrors[key] = "Not part of a pain check-in.";
  const flagKey = text(input.flag_key);
  const status = input.status;
  const plan = input.plan ?? null;
  if (status !== "pain_free" && status !== "still_sore") fieldErrors.status = "Say whether it is pain-free or still sore.";
  if (status === "still_sore" && plan !== "swap" && plan !== "skip") fieldErrors.plan = "Choose to swap those exercises or leave them out.";
  if (status === "pain_free" && plan !== null) fieldErrors.plan = "A pain-free check-in has no plan.";
  if (Object.keys(fieldErrors).length) throw new PainFlagError("pain_check_in_invalid", 422, fieldErrors);
  const client = await pool.connect();
  try {
    const facts = await loadFacts(client, athleteUserId);
    if (!derivePainFlags(facts).some((flag) => flag.flag_key === flagKey)) {
      throw new PainFlagError("pain_flag_not_open", 404, { flag_key: "This pain flag is not open." });
    }
    await appendEvent(client, athleteUserId, CHECK_IN_EVENT, { flag_key: flagKey, status, plan, schema_version: "pain_check_in_v1" }, new Date().toISOString());
  }
  finally { client.release(); }
  return getAthletePainFlags(athleteUserId);
}

export async function getPainFlagsForCoach(coachUserId: string, athleteUserId: string): Promise<Readonly<Json>> {
  await requireCoachAccess(coachUserId, athleteUserId);
  return getAthletePainFlags(athleteUserId);
}

// A coach clears their athlete's flag (e.g. after assessing it in person).
export async function clearPainFlagForCoach(coachUserId: string, athleteUserId: string, input: unknown): Promise<Readonly<Json>> {
  await requireCoachAccess(coachUserId, athleteUserId);
  const flagKey = isRecord(input) ? text(input.flag_key) : "";
  const client = await pool.connect();
  try {
    const facts = await loadFacts(client, athleteUserId);
    if (!derivePainFlags(facts).some((flag) => flag.flag_key === flagKey)) {
      throw new PainFlagError("pain_flag_not_open", 404, { flag_key: "This pain flag is not open." });
    }
    await appendEvent(client, athleteUserId, CLEAR_EVENT, { flag_key: flagKey, cleared_by_user_id: coachUserId, schema_version: "pain_flag_clear_v1" }, new Date().toISOString());
  }
  finally { client.release(); }
  return getAthletePainFlags(athleteUserId);
}

async function requireCoachAccess(coachUserId: string, athleteUserId: string) {
  try { await requireCoachAthleteAccess(coachUserId, athleteUserId); }
  catch { throw new PainFlagError("relationship_access_denied", 403); }
}

export type PainCarryForwardResult =
  | { ok: true; exercises: Json[] }
  | { ok: false; failure_token: "pain_check_in_required" | "pain_session_empty"; details: Json };

// Apply open pain flags to a session about to be created. Every affected
// exercise needs a check-in first; "still sore" swaps or leaves out the
// affected exercises for this session.
export async function applyPainCarryForward(
  athleteUserId: string,
  context: { activity_id: string; experience_level?: string },
  exercises: Json[]
): Promise<PainCarryForwardResult> {
  const client = await pool.connect();
  let facts: Awaited<ReturnType<typeof loadFacts>>;
  try { facts = await loadFacts(client, athleteUserId); }
  finally { client.release(); }
  const flags = derivePainFlags(facts);
  const affecting = flags.filter((flag) => exercises.some((e) => flagCovers(flag.flag_key, text(e.exercise_id))));
  if (!affecting.length) return { ok: true, exercises };

  const missing = affecting.filter((flag) => !pendingCheckIn(flag, facts.lastSessionAt));
  if (missing.length) {
    return {
      ok: false,
      failure_token: "pain_check_in_required",
      details: {
        flags: missing.map((flag) => ({
          ...describeFlag(flag, facts.lastSessionAt),
          affected_exercise_ids: exercises.map((e) => text(e.exercise_id)).filter((id) => flagCovers(flag.flag_key, id))
        }))
      }
    };
  }

  const inSession = new Set(exercises.map((e) => baseExerciseId(text(e.exercise_id))));
  const out: Json[] = [];
  for (const exercise of exercises) {
    const id = text(exercise.exercise_id);
    const flag = affecting.find((f) => flagCovers(f.flag_key, id));
    if (!flag) { out.push(exercise); continue; }
    const plan = pendingCheckIn(flag, facts.lastSessionAt)?.plan ?? "skip";
    const reason = { flag_key: flag.flag_key, area: flag.area, from_exercise_id: id, from_display_name: exerciseLabel(id, text(exercise.display_name)) };
    if (plan === "swap") {
      const alternative = painFreeAlternatives({
        activity_id: context.activity_id,
        experience_level: context.experience_level,
        exercise_id: baseExerciseId(id),
        avoid_joint_stress_tags: flag.area ? [flag.area] : []
      }).find((alt) => !inSession.has(alt) && !affecting.some((f) => flagCovers(f.flag_key, alt)));
      if (alternative) {
        inSession.add(alternative);
        out.push({ ...exercise, exercise_id: alternative, display_name: exerciseLabel(alternative), pain_swap: reason });
        continue;
      }
    }
    // Left out for this session (asked to, or nothing suitable to swap to).
  }
  if (!out.length) {
    return { ok: false, failure_token: "pain_session_empty", details: { flags: affecting.map((flag) => describeFlag(flag, facts.lastSessionAt)) } };
  }
  return { ok: true, exercises: out };
}
