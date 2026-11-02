// DEV NOTE: Coaching packages. A coach or a gym lists what they offer - a
// name, a price and how often it's paid (monthly, weekly or one-off), a
// short description, and what's included each period: programming, a number
// of check-in calls and in-person sessions, session reviews, messaging.
// Athletes pay the coach or gym directly (nothing is taken in the app). A
// gym's packages name which of its confirmed coaches deliver them. Athletes
// see active packages on the coach's share page, under a gym when choosing
// one, and on their coach's card. Removing a package archives it.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export class ServicePackageError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "ServicePackageError";
  }
}

const BILLING = new Set(["monthly", "weekly", "one_off"]);
const CURRENCIES = new Set(["GBP", "EUR", "USD"]);
const REVIEWS = new Set(["none", "weekly", "every_session"]);
export const MAX_PACKAGES = 12;
const MAX_PER_PERIOD = 30;

type Includes = {
  programming: boolean;
  checkin_calls: number;
  in_person_sessions: number;
  session_reviews: "none" | "weekly" | "every_session";
  messaging: boolean;
};

const PERIOD: Record<string, string> = { monthly: "a month", weekly: "a week", one_off: "" };

// "£80 a month", "£45", "Free".
export function priceLabel(priceMinor: number, currency: string, billing: string): string {
  if (priceMinor === 0) return "Free";
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: priceMinor % 100 ? 2 : 0 }).format(priceMinor / 100);
  return billing === "one_off" ? amount : `${amount} ${PERIOD[billing]}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// What's included, as lines anyone can read.
export function includesSummary(includes: Includes, billing: string): string[] {
  const per = billing === "one_off" ? "" : ` ${PERIOD[billing]}`;
  return [
    includes.programming ? "Programming" : "",
    includes.checkin_calls ? `${plural(includes.checkin_calls, "check-in call", "check-in calls")}${per}` : "",
    includes.in_person_sessions ? `${plural(includes.in_person_sessions, "in-person session", "in-person sessions")}${per}` : "",
    includes.session_reviews === "every_session" ? "Every session reviewed" : includes.session_reviews === "weekly" ? "Weekly session review" : "",
    includes.messaging ? "Messaging with your coach" : ""
  ].filter(Boolean);
}

function normaliseIncludes(raw: unknown, errors: Json): Includes {
  const input = isRecord(raw) ? raw : {};
  const count = (key: string) => {
    const n = input[key] === undefined || input[key] === null || input[key] === "" ? 0 : Number(input[key]);
    if (!Number.isInteger(n) || n < 0 || n > MAX_PER_PERIOD) {
      errors[key] = `0 to ${MAX_PER_PERIOD}.`;
      return 0;
    }
    return n;
  };
  const reviews = text(input.session_reviews) || "none";
  if (!REVIEWS.has(reviews)) errors.session_reviews = "None, weekly or every session.";
  return {
    programming: input.programming === true,
    checkin_calls: count("checkin_calls"),
    in_person_sessions: count("in_person_sessions"),
    session_reviews: (REVIEWS.has(reviews) ? reviews : "none") as Includes["session_reviews"],
    messaging: input.messaging === true
  };
}

type PackageInput = { name: string; description: string | null; price_minor: number; currency: string; billing: string; includes: Includes };

function normalisePackage(input: unknown): PackageInput {
  if (!isRecord(input)) throw new ServicePackageError("package_invalid", 422);
  const errors: Json = {};
  const name = text(input.name);
  if (!name || name.length > 80) errors.name = "A name up to 80 characters.";
  const description = text(input.description);
  if (description.length > 500) errors.description = "Up to 500 characters.";
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000 || Math.round(price * 100) !== Math.round(price * 100 * 1000) / 1000) errors.price = "A price like 80 or 45.50.";
  const currency = text(input.currency) || "GBP";
  if (!CURRENCIES.has(currency)) errors.currency = "GBP, EUR or USD.";
  const billing = text(input.billing);
  if (!BILLING.has(billing)) errors.billing = "Monthly, weekly or one-off.";
  const includes = normaliseIncludes(input.includes, errors);
  if (!includes.programming && !includes.checkin_calls && !includes.in_person_sessions && includes.session_reviews === "none" && !includes.messaging) {
    errors.includes = "Say what's included.";
  }
  if (Object.keys(errors).length) throw new ServicePackageError("package_invalid", 422, errors);
  return { name, description: description || null, price_minor: Math.round(price * 100), currency, billing, includes };
}

function packageView(row: Json, coachNames: Map<string, string> = new Map()): Json {
  const includes = (isRecord(row.includes) ? row.includes : {}) as Includes;
  const billing = String(row.billing);
  const deliveredBy = Array.isArray(row.delivered_by) ? (row.delivered_by as string[]) : [];
  return {
    package_id: String(row.package_id),
    name: String(row.name),
    description: text(row.description) || null,
    price: Number(row.price_minor) / 100,
    currency: String(row.currency),
    billing,
    price_label: priceLabel(Number(row.price_minor), String(row.currency), billing),
    includes,
    includes_summary: includesSummary(includes, billing),
    delivered_by: deliveredBy.map((id) => ({ coach_user_id: id, display_name: coachNames.get(id) ?? "A coach" }))
  };
}

// --- A coach's own packages ----------------------------------------------------

async function coachPackages(coachUserId: string): Promise<Json[]> {
  const result = await pool.query(
    `SELECT * FROM product_service_packages WHERE coach_user_id = $1 AND archived_at IS NULL ORDER BY price_minor, created_at`,
    [coachUserId]
  );
  return result.rows.map((row) => packageView(row));
}

export async function listCoachPackages(coachUserId: string): Promise<Json> {
  return { ok: true, packages: await coachPackages(coachUserId), max_packages: MAX_PACKAGES };
}

export async function saveCoachPackage(coachUserId: string, packageId: string | null, input: unknown): Promise<Json> {
  const pkg = normalisePackage(input);
  if (packageId) {
    const updated = await pool.query(
      `UPDATE product_service_packages SET name = $3, description = $4, price_minor = $5, currency = $6, billing = $7, includes = $8::jsonb, updated_at = now()
       WHERE package_id = $1 AND coach_user_id = $2 AND archived_at IS NULL RETURNING package_id`,
      [packageId, coachUserId, pkg.name, pkg.description, pkg.price_minor, pkg.currency, pkg.billing, JSON.stringify(pkg.includes)]
    );
    if (!updated.rows.length) throw new ServicePackageError("package_not_found", 404);
  }
  else {
    const count = await pool.query(`SELECT count(*)::int AS n FROM product_service_packages WHERE coach_user_id = $1 AND archived_at IS NULL`, [coachUserId]);
    if (Number(count.rows[0]?.n) >= MAX_PACKAGES) throw new ServicePackageError("package_limit_reached", 409);
    await pool.query(
      `INSERT INTO product_service_packages (package_id, coach_user_id, name, description, price_minor, currency, billing, includes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [`pkg_${crypto.randomUUID().replaceAll("-", "")}`, coachUserId, pkg.name, pkg.description, pkg.price_minor, pkg.currency, pkg.billing, JSON.stringify(pkg.includes)]
    );
  }
  return listCoachPackages(coachUserId);
}

export async function archiveCoachPackage(coachUserId: string, packageId: string): Promise<Json> {
  const archived = await pool.query(
    `UPDATE product_service_packages SET archived_at = now(), updated_at = now() WHERE package_id = $1 AND coach_user_id = $2 AND archived_at IS NULL RETURNING package_id`,
    [packageId, coachUserId]
  );
  if (!archived.rows.length) throw new ServicePackageError("package_not_found", 404);
  return listCoachPackages(coachUserId);
}

// What athletes see of a coach's packages (share page, their coach's card).
export async function publicCoachPackages(coachUserId: string): Promise<Json[]> {
  return (await coachPackages(coachUserId)).map(({ package_id, name, description, price_label, includes_summary, billing }) => ({ package_id, name, description, price_label, includes_summary, billing }));
}

// --- A gym's packages --------------------------------------------------------------

async function confirmedCoaches(orgId: string): Promise<Map<string, string>> {
  const result = await pool.query(
    `SELECT g.coach_user_id, a.display_name FROM product_coach_gyms g JOIN product_accounts a ON a.user_id = g.coach_user_id
     WHERE g.org_id = $1 AND g.link_status = 'confirmed' AND a.account_state = 'active' ORDER BY a.display_name`,
    [orgId]
  );
  return new Map(result.rows.map((row) => [String(row.coach_user_id), text(row.display_name) || "A coach"]));
}

async function gymPackages(orgId: string, coaches: Map<string, string>): Promise<Json[]> {
  const result = await pool.query(
    `SELECT * FROM product_service_packages WHERE org_id = $1 AND archived_at IS NULL ORDER BY price_minor, created_at`,
    [orgId]
  );
  return result.rows.map((row) => {
    const view = packageView(row, coaches);
    // A coach the gym no longer confirms drops off the package.
    return { ...view, delivered_by: (view.delivered_by as Json[]).filter((coach) => coaches.has(String(coach.coach_user_id))) };
  });
}

export async function listGymPackages(orgId: string): Promise<Json> {
  const coaches = await confirmedCoaches(orgId);
  return {
    ok: true,
    packages: await gymPackages(orgId, coaches),
    coaches: [...coaches.entries()].map(([coach_user_id, display_name]) => ({ coach_user_id, display_name })),
    max_packages: MAX_PACKAGES
  };
}

export async function saveGymPackage(orgId: string, packageId: string | null, input: unknown): Promise<Json> {
  const pkg = normalisePackage(input);
  const coaches = await confirmedCoaches(orgId);
  const raw = isRecord(input) && Array.isArray(input.delivered_by) ? input.delivered_by.map(text) : [];
  const deliveredBy = [...new Set(raw)].filter(Boolean);
  if (deliveredBy.some((id) => !coaches.has(id))) throw new ServicePackageError("package_invalid", 422, { delivered_by: "Only coaches your gym has confirmed." });
  if (packageId) {
    const updated = await pool.query(
      `UPDATE product_service_packages SET name = $3, description = $4, price_minor = $5, currency = $6, billing = $7, includes = $8::jsonb, delivered_by = $9, updated_at = now()
       WHERE package_id = $1 AND org_id = $2 AND archived_at IS NULL RETURNING package_id`,
      [packageId, orgId, pkg.name, pkg.description, pkg.price_minor, pkg.currency, pkg.billing, JSON.stringify(pkg.includes), deliveredBy]
    );
    if (!updated.rows.length) throw new ServicePackageError("package_not_found", 404);
  }
  else {
    const count = await pool.query(`SELECT count(*)::int AS n FROM product_service_packages WHERE org_id = $1 AND archived_at IS NULL`, [orgId]);
    if (Number(count.rows[0]?.n) >= MAX_PACKAGES) throw new ServicePackageError("package_limit_reached", 409);
    await pool.query(
      `INSERT INTO product_service_packages (package_id, org_id, name, description, price_minor, currency, billing, includes, delivered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
      [`pkg_${crypto.randomUUID().replaceAll("-", "")}`, orgId, pkg.name, pkg.description, pkg.price_minor, pkg.currency, pkg.billing, JSON.stringify(pkg.includes), deliveredBy]
    );
  }
  return listGymPackages(orgId);
}

export async function archiveGymPackage(orgId: string, packageId: string): Promise<Json> {
  const archived = await pool.query(
    `UPDATE product_service_packages SET archived_at = now(), updated_at = now() WHERE package_id = $1 AND org_id = $2 AND archived_at IS NULL RETURNING package_id`,
    [packageId, orgId]
  );
  if (!archived.rows.length) throw new ServicePackageError("package_not_found", 404);
  return listGymPackages(orgId);
}

// What athletes see of a listed gym's packages, with who delivers each.
export async function publicGymPackages(orgIds: string[]): Promise<Map<string, Json[]>> {
  const out = new Map<string, Json[]>();
  for (const orgId of [...new Set(orgIds)].filter(Boolean)) {
    const coaches = await confirmedCoaches(orgId);
    const packages = (await gymPackages(orgId, coaches)).map(({ package_id, name, description, price_label, includes_summary, billing, delivered_by }) => ({ package_id, name, description, price_label, includes_summary, billing, delivered_by }));
    if (packages.length) out.set(orgId, packages);
  }
  return out;
}
