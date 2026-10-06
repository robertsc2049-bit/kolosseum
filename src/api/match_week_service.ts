// DEV NOTE: API boundary surface. The athlete's match week (usual weekly
// match, race or key-session days plus one-off fixtures), stored as their own
// account events, and applied to a session about to be created - see
// match_week.ts for the rules. Days are calendar days in UTC.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { pool } from "../db/pool.js";
import { applyMatchWeek, matchContextFor, validateMatchWeek, type MatchWeek } from "./match_week.js";
import { getAthleteTrainingPlan } from "./athlete_onboarding_service.js";

type Json = Record<string, unknown>;

const MATCH_WEEK_EVENT = "athlete_match_week_saved";
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export class MatchWeekError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

let patterns: Map<string, string> | null = null;
function patternOf(id: string): string | undefined {
  if (!patterns) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    patterns = new Map(Object.values(isRecord(doc?.entries) ? doc.entries : {}).filter(isRecord)
      .map((entry) => [String(entry.exercise_id), String(entry.movement_pattern_id ?? entry.pattern ?? "")]));
  }
  return patterns.get(id);
}

export async function getMatchWeek(userId: string): Promise<MatchWeek> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, MATCH_WEEK_EVENT]
  );
  const payload = result.rows?.[0]?.event_payload;
  const validated = validateMatchWeek(isRecord(payload) ? { match_days: payload.match_days ?? [], fixtures: payload.fixtures ?? [] } : { match_days: [], fixtures: [] }, new Date());
  return validated.ok ? validated.week : { match_days: [], fixtures: [] };
}

export async function saveMatchWeek(userId: string, input: unknown): Promise<MatchWeek> {
  const validated = validateMatchWeek(input, new Date());
  if (!validated.ok) throw new MatchWeekError("match_week_invalid", 422, validated.field_errors);
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, MATCH_WEEK_EVENT,
      JSON.stringify({ ...validated.week, schema_version: "match_week_v1" })]
  );
  return validated.week;
}

export type MatchWeekResult =
  | { ok: true; exercises: Json[]; context: ReturnType<typeof matchContextFor> }
  | { ok: false; failure_token: "match_day_rest"; details: Json };

// Adjust a session about to be created for today's match-week role. A session
// with nothing left once heavy lower-body work is taken out is refused with a
// reason (rest, or train another day).
export async function applyAthleteMatchWeek(userId: string, exercises: Json[], today: Date = new Date()): Promise<MatchWeekResult> {
  const [declared, plan] = await Promise.all([getMatchWeek(userId), getAthleteTrainingPlan(userId)]);
  // The meet, race or fight the athlete declared in their training plan is a
  // match day too: a primer the day before and on the day, recovery after -
  // whether or not they also added it as a fixture.
  const competition = plan?.competition_date;
  const week: MatchWeek = competition && !declared.fixtures.some((f) => f.date === competition)
    ? { ...declared, fixtures: [...declared.fixtures, { date: competition, label: "Competition" }] }
    : declared;
  const context = matchContextFor(week, today);
  if (!context) return { ok: true, exercises, context: null };
  const adjusted = applyMatchWeek(exercises, context, patternOf);
  if (!adjusted.length) return { ok: false, failure_token: "match_day_rest", details: { match_week: context } };
  return { ok: true, exercises: adjusted, context };
}
