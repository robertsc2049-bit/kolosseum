// DEV NOTE: API boundary surface. Kolosseum programmes: coach-written
// programmes that an athlete without a coach runs. The app runs programmes;
// coaches write them.
//
// - A catalogue author (an account whose email is in the server's
//   KOLOSSEUM_PROGRAMME_AUTHORS setting) writes a programme in the ordinary
//   programme builder, activates it, then lists it for athletes with who it
//   suits: levels, sports (none = a general programme for any sport) and
//   training days a week.
// - An athlete starts a listed programme. Their sessions then come from that
//   programme's sessions in order, not the generated engine programme; their
//   own way of setting weights (athlete_maxes_service.ts) and every safety
//   step (pain, stand-down, readiness, match week, equipment) still apply.
// - A run pins the exact programme version it started with, so editing or
//   archiving a programme never changes a run in progress.
//
// - Coaches see every listed programme and can copy one into their own
//   library as a draft - theirs to change and assign like any other.
// - A listing can name the programme that follows it (off-season build ->
//   in-season, fight camp -> between camps). When an athlete finishes a
//   programme they're offered that one, or to run it again.
//
// Listings and runs are account events (latest wins), like maxes and
// equipment.

import crypto from "node:crypto";
import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { loadActiveCoachTemplateById, loadExecutableCoachTemplateById, orderedTemplateSessions, saveCoachProgrammeTemplate, templateRecordInput } from "./beta18_programme_template_service.js";
import { getAthleteTrainingPlan, getAthleteTrainingProfile } from "./athlete_onboarding_service.js";
import { programmeFit, programmeShape } from "./programme_fit.js";

type Json = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

const LISTING_EVENT = "kolosseum_programme_listing";
const RUN_STARTED = "athlete_programme_run_started";
const RUN_ENDED = "athlete_programme_run_ended";
const LEVELS = ["beginner", "amateur", "pro"] as const;
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export class ProgrammeCatalogueError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

export type ProgrammeListing = {
  listing_id: string;
  author_user_id: string;
  template_id: string;
  title: string;
  summary: string;
  levels: string[];
  activity_ids: string[];
  days_per_week: number;
  // The programme to offer when an athlete finishes this one ("" for none).
  next_listing_id: string;
  listed: boolean;
  updated_at: string;
};

export type ProgrammeRun = {
  run_id: string;
  listing_id: string;
  author_user_id: string;
  template_id: string;
  title: string;
  started_at: string;
};

// Catalogue authors, by email, from the server's settings.
function authorEmails(): Set<string> {
  return new Set(String(process.env.KOLOSSEUM_PROGRAMME_AUTHORS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function isProgrammeCatalogueAuthor(userId: string): Promise<boolean> {
  const emails = authorEmails();
  if (emails.size === 0) return false;
  const result = await pool.query(`SELECT email_canonical FROM product_accounts WHERE user_id = $1 AND actor_type = 'coach'`, [userId]);
  const email = text(result.rows?.[0]?.email_canonical).toLowerCase();
  return emails.has(email);
}

async function appendEvent(client: QueryClient, userId: string, type: string, payload: Json): Promise<void> {
  await client.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, type, JSON.stringify(payload)]
  );
}

function listingFrom(payload: unknown, authorUserId: string, at: unknown): ProgrammeListing | null {
  if (!isRecord(payload) || !text(payload.listing_id) || !text(payload.template_id)) return null;
  return {
    listing_id: text(payload.listing_id),
    author_user_id: authorUserId,
    template_id: text(payload.template_id),
    title: text(payload.title),
    summary: text(payload.summary),
    levels: Array.isArray(payload.levels) ? payload.levels.map(text).filter(Boolean) : [],
    activity_ids: Array.isArray(payload.activity_ids) ? payload.activity_ids.map(text).filter(Boolean) : [],
    days_per_week: Number(payload.days_per_week) || 0,
    next_listing_id: text(payload.next_listing_id),
    listed: payload.listed !== false,
    updated_at: at instanceof Date ? at.toISOString() : text(at)
  };
}

// Every listing's latest state (authors may have unlisted some).
async function allListings(): Promise<ProgrammeListing[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (event_payload->>'listing_id') user_id, event_payload, occurred_at
     FROM product_account_events
     WHERE event_type = $1
     ORDER BY event_payload->>'listing_id', occurred_at DESC, event_id DESC`,
    [LISTING_EVENT]
  );
  const authors = authorEmails();
  const listings = (result.rows ?? []).map((row) => listingFrom(row.event_payload, text(row.user_id), row.occurred_at)).filter((l): l is ProgrammeListing => l !== null);
  // A listing only shows while its author is still a catalogue author.
  if (authors.size === 0) return [];
  const authorIds = [...new Set(listings.map((l) => l.author_user_id))];
  const allowed = new Set<string>();
  for (const id of authorIds) if (await isProgrammeCatalogueAuthor(id)) allowed.add(id);
  return listings.filter((l) => allowed.has(l.author_user_id));
}

// List (or relist, or unlist) one of the author's active programmes for athletes.
export async function saveProgrammeListing(authorUserId: string, templateIdInput: string, input: unknown): Promise<ProgrammeListing> {
  if (!(await isProgrammeCatalogueAuthor(authorUserId))) throw new ProgrammeCatalogueError("programme_catalogue_author_required", 403);
  const templateId = text(templateIdInput);
  const template = await loadActiveCoachTemplateById(authorUserId, templateId);
  if (!template) throw new ProgrammeCatalogueError("programme_catalogue_template_not_active", 409);
  if (!isRecord(input)) throw new ProgrammeCatalogueError("programme_catalogue_listing_invalid", 422);
  const fieldErrors: Json = {};
  const levels = Array.isArray(input.levels) ? [...new Set(input.levels.map(text))] : [];
  if (levels.length === 0 || levels.some((l) => !LEVELS.includes(l as (typeof LEVELS)[number]))) fieldErrors.levels = "Choose at least one level: beginner, amateur or pro.";
  const activityIds = Array.isArray(input.activity_ids) ? [...new Set(input.activity_ids.map(text).filter(Boolean))] : [];
  const days = Number(input.days_per_week);
  if (!Number.isInteger(days) || days < 1 || days > 7) fieldErrors.days_per_week = "Choose 1 to 7 training days a week.";
  const summary = text(input.summary);
  if (summary.length > 400) fieldErrors.summary = "Keep the summary under 400 characters.";
  // One listing per programme family: a new version replaces the old one.
  const listingId = `programme_${text(template.template_family_id) || templateId}`;
  // The next programme is another of the author's own listings.
  const nextListingId = text(input.next_listing_id);
  if (nextListingId) {
    const own = (await allListings()).some((l) => l.listing_id === nextListingId && l.author_user_id === authorUserId);
    if (nextListingId === listingId || !own) fieldErrors.next_listing_id = "Choose another of your published programmes, or none.";
  }
  if (Object.keys(fieldErrors).length) throw new ProgrammeCatalogueError("programme_catalogue_listing_invalid", 422, fieldErrors);

  const payload = {
    listing_id: listingId,
    template_id: templateId,
    title: text(input.title) || text(template.template_name) || "Kolosseum programme",
    summary,
    levels,
    activity_ids: activityIds,
    days_per_week: days,
    next_listing_id: nextListingId,
    listed: input.listed !== false,
    schema_version: "kolosseum_programme_listing_v1"
  };
  const client = await pool.connect();
  try { await appendEvent(client, authorUserId, LISTING_EVENT, payload); }
  finally { client.release(); }
  return listingFrom(payload, authorUserId, new Date())!;
}

// The author's own listing for a programme family, if any.
export async function getProgrammeListingForTemplate(authorUserId: string, templateIdInput: string): Promise<Readonly<Json>> {
  const author = await isProgrammeCatalogueAuthor(authorUserId);
  if (!author) return Object.freeze({ catalogue_author: false, listing: null });
  const listings = await allListings();
  const templateId = text(templateIdInput);
  const template = await loadExecutableCoachTemplateById(authorUserId, templateId);
  const listingId = template ? `programme_${text(template.template_family_id) || templateId}` : "";
  // The author's other listings: what can follow this programme.
  const others = listings
    .filter((l) => l.author_user_id === authorUserId && l.listing_id !== listingId)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((l) => ({ listing_id: l.listing_id, title: l.title, listed: l.listed }));
  return Object.freeze({
    catalogue_author: true,
    listing: listings.find((l) => l.listing_id === listingId && l.author_user_id === authorUserId) ?? null,
    other_listings: others
  });
}

export async function getCurrentProgrammeRun(userId: string): Promise<ProgrammeRun | null> {
  const result = await pool.query(
    `SELECT event_type, event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3)
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, RUN_STARTED, RUN_ENDED]
  );
  const row = result.rows?.[0];
  if (!row || row.event_type !== RUN_STARTED || !isRecord(row.event_payload)) return null;
  const p = row.event_payload;
  return {
    run_id: text(p.run_id), listing_id: text(p.listing_id), author_user_id: text(p.author_user_id),
    template_id: text(p.template_id), title: text(p.title), started_at: text(p.started_at)
  };
}

// How many sessions the athlete has had on this run (the next one's index).
export async function programmeRunSessionCount(userId: string, runId: string): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::integer AS n FROM sessions WHERE beta_subject_user_id = $1 AND planned_session->'programme_run'->>'run_id' = $2`,
    [userId, runId]
  );
  return Number(result.rows?.[0]?.n ?? 0);
}

// Who a listing suits: the athlete's level, then their sport - their sport's
// own programmes first, then general ones (no sports listed).
function suits(listing: ProgrammeListing, level: string | undefined, activity: string | undefined): number {
  if (!listing.listed) return 0;
  if (level && !listing.levels.includes(level)) return 0;
  if (listing.activity_ids.length === 0) return 1;
  return activity && listing.activity_ids.includes(activity) ? 2 : 0;
}

// The athlete's view: programmes that suit them (their sport's first) and
// the one they're running.
export async function getAthleteProgrammes(userId: string): Promise<Readonly<Json>> {
  const [profile, listings, run, plan] = await Promise.all([getAthleteTrainingProfile(userId), allListings(), getCurrentProgrammeRun(userId), getAthleteTrainingPlan(userId)]);
  const today = new Date().toISOString().slice(0, 10);
  const suitable = listings
    .map((listing) => ({ listing, fit: suits(listing, profile.experience_level, profile.activity_id) }))
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => b.fit - a.fit || a.listing.days_per_week - b.listing.days_per_week || a.listing.title.localeCompare(b.listing.title));
  // How each fits the athlete: their training days, and - for a programme
  // that ends in a taper - when to start it for their competition.
  const options = await Promise.all(suitable.map(async ({ listing, fit }) => {
    const template = await loadExecutableCoachTemplateById(listing.author_user_id, listing.template_id);
    const shape = template ? programmeShape(orderedTemplateSessions(template)) : { weeks_total: 0, ends_with_taper: false };
    return {
      listing_id: listing.listing_id, title: listing.title, summary: listing.summary, levels: listing.levels,
      activity_ids: listing.activity_ids, days_per_week: listing.days_per_week, sport_specific: fit === 2,
      fit: programmeFit(shape, listing.days_per_week, plan, today)
    };
  }));
  let progress: Json | null = null;
  if (run) {
    const template = await loadExecutableCoachTemplateById(run.author_user_id, run.template_id);
    const total = template ? templateSessionCount(template) : 0;
    const done = await programmeRunSessionCount(userId, run.run_id);
    progress = { sessions_done: done, sessions_total: total };
    if (total > 0 && done >= total) progress = { ...progress, finished: true, ...whatNext(run, listings, profile) };
    // Where their next session sits.
    else if (template) progress = { ...progress, next_position: programmePosition(template, done) };
  }
  return Object.freeze({
    experience_level: profile.experience_level ?? null,
    activity_id: profile.activity_id ?? null,
    training_days_per_week: plan?.training_days_per_week ?? null,
    competition_date: plan?.competition_date ?? null,
    current: run ? { ...run, ...progress } : null,
    options
  });
}

// A finished programme: the one its author says follows it, and whether the
// athlete can run this one again. A next programme for a higher level is
// still shown, so a beginner who's finished knows what moving up leads to.
function whatNext(run: ProgrammeRun, listings: ProgrammeListing[], profile: { experience_level?: string; activity_id?: string }): Json {
  const finished = listings.find((l) => l.listing_id === run.listing_id);
  const next = finished?.next_listing_id ? listings.find((l) => l.listing_id === finished.next_listing_id && l.listed) : undefined;
  let suggestion: Json | null = null;
  if (next) {
    const fit = suits(next, profile.experience_level, profile.activity_id);
    const sportOk = next.activity_ids.length === 0 || (!!profile.activity_id && next.activity_ids.includes(profile.activity_id));
    if (fit > 0 || sportOk) {
      suggestion = {
        listing_id: next.listing_id, title: next.title, summary: next.summary, levels: next.levels,
        activity_ids: next.activity_ids, days_per_week: next.days_per_week,
        // Not for their level yet: they'd change their level to start it.
        suits_level: fit > 0
      };
    }
  }
  return { next: suggestion, can_repeat: !!finished && suits(finished, profile.experience_level, profile.activity_id) > 0 };
}

// Where a session (by its index in the run) sits in its programme: the week,
// of how many, and the block - "Week 7 of 12 - Heavy strength".
export type ProgrammePosition = { week_number: number; weeks_total: number; block_name: string; block_type: string };
export function programmePosition(template: Readonly<Json>, sessionIndex: number): ProgrammePosition | null {
  const sessions = orderedTemplateSessions(template);
  const session = sessions[sessionIndex];
  if (!session) return null;
  const weeksTotal = Math.max(0, ...sessions.map((s) => Number(s.template_week_index_global) || 0));
  const week = Number(session.template_week_index_global) || 0;
  if (!week || !weeksTotal) return null;
  return { week_number: week, weeks_total: weeksTotal, block_name: text(session.template_block_name), block_type: text(session.template_block_type) };
}

export async function programmeRunPosition(run: ProgrammeRun, sessionIndex: number): Promise<ProgrammePosition | null> {
  const template = await loadExecutableCoachTemplateById(run.author_user_id, run.template_id);
  return template ? programmePosition(template, sessionIndex) : null;
}

// How many sessions the run's programme has.
export async function programmeRunTotalSessions(run: ProgrammeRun): Promise<number> {
  const template = await loadExecutableCoachTemplateById(run.author_user_id, run.template_id);
  return template ? templateSessionCount(template) : 0;
}

function templateSessionCount(template: Readonly<Json>): number {
  const structure = isRecord(template.template_structure) ? template.template_structure : {};
  let n = 0;
  for (const block of Array.isArray(structure.blocks) ? structure.blocks.filter(isRecord) : []) {
    for (const week of Array.isArray(block.weeks) ? block.weeks.filter(isRecord) : []) {
      for (const day of Array.isArray(week.days) ? week.days.filter(isRecord) : []) {
        n += Array.isArray(day.sessions) ? day.sessions.length : 0;
      }
      n += Array.isArray(week.sessions) ? week.sessions.length : 0;
    }
  }
  return n;
}

// Whether any listed programme suits the athlete. Once one does, they run a
// Kolosseum programme - the generated programme is only the fallback while
// the catalogue has nothing for their level and sport.
export async function athleteHasProgrammeOptions(userId: string): Promise<boolean> {
  const [profile, listings] = await Promise.all([getAthleteTrainingProfile(userId), allListings()]);
  return listings.some((listing) => suits(listing, profile.experience_level, profile.activity_id) > 0);
}

// Start a programme (a listed one that suits the athlete), or stop the
// current one ({ listing_id: null }).
export async function setAthleteProgramme(userId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input) || !("listing_id" in input)) throw new ProgrammeCatalogueError("athlete_programme_invalid", 422);
  const client = await pool.connect();
  try {
    const current = await getCurrentProgrammeRun(userId);
    if (input.listing_id === null) {
      if (current) await appendEvent(client, userId, RUN_ENDED, { run_id: current.run_id, reason: "stopped_by_athlete" });
      return getAthleteProgrammes(userId);
    }
    const listingId = text(input.listing_id);
    const listing = (await allListings()).find((l) => l.listing_id === listingId && l.listed);
    if (!listing) throw new ProgrammeCatalogueError("athlete_programme_not_found", 404);
    const profile = await getAthleteTrainingProfile(userId);
    if (suits(listing, profile.experience_level, profile.activity_id) === 0) throw new ProgrammeCatalogueError("athlete_programme_not_suitable", 409);
    if (!(await loadExecutableCoachTemplateById(listing.author_user_id, listing.template_id))) throw new ProgrammeCatalogueError("athlete_programme_not_found", 404);
    if (current) await appendEvent(client, userId, RUN_ENDED, { run_id: current.run_id, reason: "switched_programme" });
    await appendEvent(client, userId, RUN_STARTED, {
      run_id: `programme_run_${crypto.randomUUID().replace(/-/gu, "")}`,
      listing_id: listing.listing_id, author_user_id: listing.author_user_id, template_id: listing.template_id,
      title: listing.title, started_at: new Date().toISOString(), schema_version: "athlete_programme_run_v1"
    });
  }
  finally { client.release(); }
  return getAthleteProgrammes(userId);
}

// Every listed programme, for a coach to browse.
export async function listProgrammesForCoaches(): Promise<Readonly<Json>> {
  const programmes = (await allListings())
    .filter((l) => l.listed)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((l) => ({ listing_id: l.listing_id, title: l.title, summary: l.summary, levels: l.levels, activity_ids: l.activity_ids, days_per_week: l.days_per_week }));
  return Object.freeze({ programmes });
}

// A coach copies a listed programme into their own library: a new draft
// they own (version 1, fresh ids), built from the exact version that's
// listed. Nothing is assigned; the catalogue copy is untouched.
export async function copyProgrammeForCoach(coachUserId: string, listingIdInput: unknown): Promise<Readonly<Json>> {
  const listingId = text(listingIdInput);
  const listing = (await allListings()).find((l) => l.listing_id === listingId && l.listed);
  if (!listing) throw new ProgrammeCatalogueError("programme_catalogue_not_found", 404);
  const template = await loadExecutableCoachTemplateById(listing.author_user_id, listing.template_id);
  if (!template) throw new ProgrammeCatalogueError("programme_catalogue_not_found", 404);
  const input = templateRecordInput(template as Json) as Json;
  delete input.template_id;
  delete input.template_family_id;
  const copy = {
    ...input,
    blocks: freshIds(input.blocks),
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: listing.title,
    description: [listing.summary, "Copied from Kolosseum programmes - yours to change before you assign it."].filter(Boolean).join(" "),
    event_plan: null,
    updated_at_iso8601: new Date().toISOString()
  };
  return saveCoachProgrammeTemplate(copy) as Promise<Readonly<Json>>;
}

// A copy gets its own block, week, day, session and exercise ids.
const ID_KEYS = new Set(["block_id", "week_id", "day_id", "session_id", "work_item_id"]);
function freshIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(freshIds);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, ID_KEYS.has(key) ? "" : freshIds(v)]));
}
