// DEV NOTE: Programmes a coach sells outside the app and gives in it. The
// athlete pays the coach however they agree (the app never takes payment);
// the coach then gives that athlete one of their active programmes by email.
// The athlete accepts and runs it like a Kolosseum programme
// (programme_catalogue_service.ts): their own way of setting weights, every
// safety step, the exact version given. They never pay for the app.
//
// - A programme athlete is not a coaching client: no seat, and the coach sees
//   only each grant's state (given, running, dormant, finished...) - never
//   the athlete's training. Coaching them means a normal relationship invite.
// - The coach's plan allows a number of active programme athletes
//   (KOLOSSEUM_PROGRAMME_ATHLETE_ALLOWANCE, 50 by default), separate from
//   coaching seats. Active = started, not stopped or finished, with a
//   session in the last 28 days; a dormant athlete stops counting. A full
//   allowance stops new grants only - an athlete always runs what they paid
//   for, even when coming back takes the coach over.
// - A coach can take a grant back only before it's accepted.
// - Grants are the coach's account events (given, revoked); accepting and
//   declining are the athlete's. Erasing an athlete strips their email from
//   the coach's grants (gdpr_erasure_service.ts).
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { loadActiveCoachTemplateById, loadExecutableCoachTemplateById, nextTemplateSessionIndex } from "./beta18_programme_template_service.js";
import { getCurrentProgrammeRun, programmeRunTotalSessions } from "./programme_catalogue_service.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const GIVEN = "programme_grant_given";
const REVOKED = "programme_grant_revoked";
const ACCEPTED = "programme_grant_accepted";
const DECLINED = "programme_grant_declined";
const RUN_STARTED = "athlete_programme_run_started";
const RUN_ENDED = "athlete_programme_run_ended";
export const DORMANT_DAYS = 28;
const DEFAULT_ALLOWANCE = 50;

export class ProgrammeGrantError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export function programmeAthleteAllowance(): number {
  const value = Number(process.env.KOLOSSEUM_PROGRAMME_ATHLETE_ALLOWANCE);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_ALLOWANCE;
}

const canonicalEmail = (value: unknown) => text(value).toLowerCase();
const validEmail = (email: string) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/u.test(email) && email.length <= 254;

type Grant = { grant_id: string; coach_user_id: string; template_id: string; title: string; athlete_email: string; given_at: string; revoked: boolean };

async function grantsBy(where: "coach" | "email" | "id", value: string): Promise<Grant[]> {
  const column = where === "coach" ? "g.user_id" : where === "email" ? "g.event_payload->>'athlete_email'" : "g.event_payload->>'grant_id'";
  const result = await pool.query(
    `SELECT g.user_id, g.event_payload, g.occurred_at,
       EXISTS (SELECT 1 FROM product_account_events r WHERE r.user_id = g.user_id AND r.event_type = $2 AND r.event_payload->>'grant_id' = g.event_payload->>'grant_id') AS revoked
     FROM product_account_events g
     WHERE g.event_type = $1 AND ${column} = $3
     ORDER BY g.occurred_at DESC, g.event_id DESC`,
    [GIVEN, REVOKED, value]
  );
  return (result.rows ?? []).filter((row) => isRecord(row.event_payload)).map((row) => ({
    grant_id: text(row.event_payload.grant_id),
    coach_user_id: text(row.user_id),
    template_id: text(row.event_payload.template_id),
    title: text(row.event_payload.title),
    athlete_email: text(row.event_payload.athlete_email),
    given_at: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : text(row.occurred_at),
    revoked: row.revoked === true
  }));
}

async function athleteIdForEmail(email: string): Promise<string | null> {
  if (!email) return null;
  const result = await pool.query(`SELECT user_id FROM product_accounts WHERE email_canonical = $1 AND actor_type = 'athlete'`, [email]);
  return text(result.rows?.[0]?.user_id) || null;
}

// The athlete's answers to their grants, and their runs of granted programmes.
async function athleteGrantFacts(athleteUserId: string): Promise<{ answers: Map<string, "accepted" | "declined">; runs: Array<{ run_id: string; grant_id: string; started_at: string; ended: boolean }> }> {
  const result = await pool.query(
    `SELECT event_type, event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3, $4, $5)
     ORDER BY occurred_at ASC, event_id ASC`,
    [athleteUserId, ACCEPTED, DECLINED, RUN_STARTED, RUN_ENDED]
  );
  const answers = new Map<string, "accepted" | "declined">();
  const runs: Array<{ run_id: string; grant_id: string; started_at: string; ended: boolean }> = [];
  for (const row of result.rows ?? []) {
    const payload = isRecord(row.event_payload) ? row.event_payload : {};
    if (row.event_type === ACCEPTED) answers.set(text(payload.grant_id), "accepted");
    else if (row.event_type === DECLINED && !answers.has(text(payload.grant_id))) answers.set(text(payload.grant_id), "declined");
    else if (row.event_type === RUN_STARTED && text(payload.grant_id)) runs.push({ run_id: text(payload.run_id), grant_id: text(payload.grant_id), started_at: text(payload.started_at), ended: false });
    else if (row.event_type === RUN_ENDED) { const run = runs.find((entry) => entry.run_id === text(payload.run_id)); if (run) run.ended = true; }
  }
  return { answers, runs };
}

async function lastSessionDay(runId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT max(created_at) AS last FROM sessions WHERE planned_session->'programme_run'->>'run_id' = $1`,
    [runId]
  );
  const last = result.rows?.[0]?.last;
  return last instanceof Date ? last.toISOString().slice(0, 10) : last ? String(last).slice(0, 10) : null;
}

export type GrantState = "pending" | "declined" | "revoked" | "accepted" | "active" | "dormant" | "finished" | "stopped";

// A grant's state, as far as the coach may see it.
async function grantState(grant: Grant, today: string): Promise<GrantState> {
  if (grant.revoked) return "revoked";
  const athleteId = await athleteIdForEmail(grant.athlete_email);
  if (!athleteId) return "pending";
  const { answers, runs } = await athleteGrantFacts(athleteId);
  const answer = answers.get(grant.grant_id);
  if (!answer) return "pending";
  if (answer === "declined") return "declined";
  const run = runs.filter((entry) => entry.grant_id === grant.grant_id).at(-1);
  if (!run) return "accepted";
  const template = await loadExecutableCoachTemplateById(grant.coach_user_id, grant.template_id);
  const total = template ? await programmeRunTotalSessions({ run_id: run.run_id, listing_id: "", author_user_id: grant.coach_user_id, template_id: grant.template_id, title: grant.title, started_at: run.started_at }) : 0;
  const done = await nextTemplateSessionIndex(run.run_id);
  if (total > 0 && done >= total) return "finished";
  if (run.ended) return "stopped";
  const last = (await lastSessionDay(run.run_id)) ?? run.started_at.slice(0, 10);
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000);
  return days > DORMANT_DAYS ? "dormant" : "active";
}

// The coach's grants and their allowance: how many programme athletes are
// active of how many allowed.
export async function listCoachProgrammeGrants(coachUserId: string, today = new Date().toISOString().slice(0, 10)): Promise<Readonly<Json>> {
  const grants = await grantsBy("coach", coachUserId);
  const rows = await Promise.all(grants.map(async (grant) => ({
    grant_id: grant.grant_id, template_id: grant.template_id, title: grant.title, athlete_email: grant.athlete_email, given_at: grant.given_at,
    state: await grantState(grant, today)
  })));
  const active = rows.filter((row) => row.state === "active").length;
  return Object.freeze({ ok: true, grants: rows, usage: { active, allowance: programmeAthleteAllowance(), dormant_after_days: DORMANT_DAYS } });
}

export async function giveProgrammeGrant(coachUserId: string, templateIdInput: unknown, input: unknown): Promise<Readonly<Json>> {
  const body = isRecord(input) ? input : {};
  const email = canonicalEmail(body.athlete_email);
  if (!validEmail(email)) throw new ProgrammeGrantError("programme_grant_email_invalid", 422);
  const clientRequestId = text(body.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(clientRequestId)) throw new ProgrammeGrantError("programme_grant_client_request_id_invalid", 422);
  const template = await loadActiveCoachTemplateById(coachUserId, text(templateIdInput));
  if (!template) throw new ProgrammeGrantError("programme_grant_template_not_active", 409);
  const grantId = `pg_${crypto.createHash("sha256").update(`${coachUserId}|${clientRequestId}`).digest("hex").slice(0, 32)}`;
  // A repeat of the same request is the same grant.
  const existing = (await grantsBy("id", grantId))[0];
  if (existing) return Object.freeze({ ok: true, added: false, grant: existing });
  const usage = (await listCoachProgrammeGrants(coachUserId)).usage as { active: number; allowance: number };
  if (usage.active >= usage.allowance) throw new ProgrammeGrantError("programme_grant_allowance_full", 409);
  const open = (await grantsBy("coach", coachUserId)).filter((grant) => grant.athlete_email === email && grant.template_id === text(template.template_id) && !grant.revoked);
  for (const grant of open) {
    const state = await grantState(grant, new Date().toISOString().slice(0, 10));
    if (state === "pending" || state === "accepted" || state === "active" || state === "dormant") throw new ProgrammeGrantError("programme_grant_already_given", 409);
  }
  const grant = { grant_id: grantId, template_id: text(template.template_id), title: text(template.template_name) || "Programme", athlete_email: email };
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [grantId, coachUserId, GIVEN, JSON.stringify(grant)]
  );
  return Object.freeze({ ok: true, added: true, grant });
}

export async function revokeProgrammeGrant(coachUserId: string, grantIdInput: unknown): Promise<Readonly<Json>> {
  const grant = (await grantsBy("id", text(grantIdInput))).find((entry) => entry.coach_user_id === coachUserId);
  if (!grant) throw new ProgrammeGrantError("programme_grant_not_found", 404);
  const state = await grantState(grant, new Date().toISOString().slice(0, 10));
  if (state === "revoked") return Object.freeze({ ok: true, state });
  // Once accepted it's the athlete's: they paid for it.
  if (state !== "pending" && state !== "declined") throw new ProgrammeGrantError("programme_grant_already_accepted", 409);
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [`pgr_${grant.grant_id}`, coachUserId, REVOKED, JSON.stringify({ grant_id: grant.grant_id })]
  );
  return Object.freeze({ ok: true, state: "revoked" });
}

async function athleteEmail(athleteUserId: string): Promise<string> {
  const result = await pool.query(`SELECT email_canonical FROM product_accounts WHERE user_id = $1 AND actor_type = 'athlete'`, [athleteUserId]);
  return canonicalEmail(result.rows?.[0]?.email_canonical);
}

async function coachName(coachUserId: string): Promise<string> {
  const result = await pool.query(`SELECT display_name FROM product_accounts WHERE user_id = $1`, [coachUserId]);
  return text(result.rows?.[0]?.display_name) || "Your coach";
}

// On a coach's programme, sessions come from the coach: a granted
// programme waits until they've finished with that coach.
async function hasCoachProgramme(athleteUserId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1
     ORDER BY effective_at DESC, created_at DESC, record_id DESC, record_sha256 DESC LIMIT 1`,
    [athleteUserId]
  );
  const latest = result.rows?.[0]?.record_payload;
  return isRecord(latest) && (text(latest.assignment_status) || "assigned") === "assigned";
}

// The athlete's grants: waiting for an answer, and the ones they own.
export async function listAthleteProgrammeGrants(athleteUserId: string): Promise<Readonly<Json>> {
  const email = await athleteEmail(athleteUserId);
  const grants = (await grantsBy("email", email)).filter((grant) => !grant.revoked);
  const { answers, runs } = await athleteGrantFacts(athleteUserId);
  const current = await getCurrentProgrammeRun(athleteUserId);
  const rows = await Promise.all(grants.filter((grant) => answers.get(grant.grant_id) !== "declined").map(async (grant) => ({
    grant_id: grant.grant_id, title: grant.title, coach_name: await coachName(grant.coach_user_id), given_at: grant.given_at,
    accepted: answers.get(grant.grant_id) === "accepted",
    running: Boolean(current && runs.some((run) => run.run_id === current.run_id && run.grant_id === grant.grant_id))
  })));
  return Object.freeze({ ok: true, grants: rows, has_coach_programme: await hasCoachProgramme(athleteUserId) });
}

async function ownGrant(athleteUserId: string, grantIdInput: unknown): Promise<Grant> {
  const email = await athleteEmail(athleteUserId);
  const grant = (await grantsBy("id", text(grantIdInput))).find((entry) => entry.athlete_email === email && !entry.revoked);
  if (!grant) throw new ProgrammeGrantError("programme_grant_not_found", 404);
  return grant;
}

// Accept a grant and start it - or start an owned one again (from the top).
export async function startProgrammeGrant(athleteUserId: string, grantIdInput: unknown): Promise<Readonly<Json>> {
  const grant = await ownGrant(athleteUserId, grantIdInput);
  if (await hasCoachProgramme(athleteUserId)) throw new ProgrammeGrantError("programme_grant_coach_programme_active", 409);
  if (!(await loadExecutableCoachTemplateById(grant.coach_user_id, grant.template_id))) throw new ProgrammeGrantError("programme_grant_not_found", 404);
  const { answers } = await athleteGrantFacts(athleteUserId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const append = (type: string, payload: Json) => client.query(
      "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at) VALUES ($1, $2, $3, $4::jsonb, clock_timestamp())",
      [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, athleteUserId, type, JSON.stringify(payload)]
    );
    if (answers.get(grant.grant_id) !== "accepted") await append(ACCEPTED, { grant_id: grant.grant_id, coach_user_id: grant.coach_user_id });
    const current = await getCurrentProgrammeRun(athleteUserId);
    if (current) await append(RUN_ENDED, { run_id: current.run_id, reason: "switched_programme" });
    await append(RUN_STARTED, {
      run_id: `programme_run_${crypto.randomUUID().replace(/-/gu, "")}`,
      listing_id: "", grant_id: grant.grant_id, author_user_id: grant.coach_user_id, template_id: grant.template_id,
      title: grant.title, started_at: new Date().toISOString(), schema_version: "athlete_programme_run_v1"
    });
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
  return listAthleteProgrammeGrants(athleteUserId);
}

export async function declineProgrammeGrant(athleteUserId: string, grantIdInput: unknown): Promise<Readonly<Json>> {
  const grant = await ownGrant(athleteUserId, grantIdInput);
  const { answers } = await athleteGrantFacts(athleteUserId);
  if (answers.get(grant.grant_id) === "accepted") throw new ProgrammeGrantError("programme_grant_already_accepted", 409);
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [`pgd_${grant.grant_id}`, athleteUserId, DECLINED, JSON.stringify({ grant_id: grant.grant_id })]
  );
  return listAthleteProgrammeGrants(athleteUserId);
}
