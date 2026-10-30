// DEV NOTE: A coach's share link. The coach switches on a public page at
// /c/<slug> (with a QR code) to post on social media or print for the gym
// wall. It shows only what the coach already shows their athletes - name,
// business name, tagline, colour and gyms - and only while switched on.
// Someone who follows it signs up or signs in as an athlete and asks the
// coach to coach them (coaching_request_service.ts, source 'share_link');
// the coach invites them or dismisses it from the same Requests list.
import zlib from "node:zlib";

import qrcode from "qrcode-generator";

import { pool } from "../db/pool.js";
import { loadCoachBrandPreference } from "./coach_branding_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// Words a link can't be, so a coach's page can't pass itself off as part of
// Kolosseum.
const RESERVED_SLUGS = new Set([
  "admin", "app", "api", "org", "kolosseum", "support", "help", "login", "signin", "sign-in",
  "signup", "sign-up", "register", "account", "settings", "coach", "coaches", "athlete", "official", "team", "staff"
]);

export class CoachShareLinkError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "CoachShareLinkError";
  }
}

// "Old Tyme Strength" -> "old-tyme-strength".
export function slugFrom(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

async function suggestedSlug(coachUserId: string): Promise<string> {
  const account = await pool.query(`SELECT display_name FROM product_accounts WHERE user_id = $1`, [coachUserId]);
  const preference = await loadCoachBrandPreference(coachUserId).catch(() => null);
  const base = slugFrom(text(preference?.business_name) || text(account.rows[0]?.display_name)) || "coach";
  let candidate = base.length >= 3 && !RESERVED_SLUGS.has(base) ? base : `${base}-coaching`.replace(/^-/, "");
  for (let n = 2; n < 50; n += 1) {
    const taken = await pool.query(`SELECT 1 FROM product_coach_share_links WHERE slug = $1 AND coach_user_id <> $2`, [candidate, coachUserId]);
    if (!taken.rows.length) return candidate;
    candidate = `${base.slice(0, 36)}-${n}`;
  }
  return candidate;
}

function linkPayload(row: Json | undefined, suggested: string): Json {
  return {
    ok: true,
    share_link: row
      ? { slug: String(row.slug), enabled: row.enabled === true, path: `/c/${String(row.slug)}` }
      : null,
    suggested_slug: suggested
  };
}

export async function getCoachShareLink(coachUserId: string): Promise<Json> {
  const result = await pool.query(`SELECT slug, enabled FROM product_coach_share_links WHERE coach_user_id = $1`, [coachUserId]);
  return linkPayload(result.rows[0], result.rows[0] ? String(result.rows[0].slug) : await suggestedSlug(coachUserId));
}

// Turn the link on or off, or change its address.
export async function saveCoachShareLink(coachUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input) || typeof input.enabled !== "boolean") {
    throw new CoachShareLinkError("coach_share_link_invalid", 422, { enabled: "On or off." });
  }
  const slug = text(input.slug).toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.includes("--")) {
    throw new CoachShareLinkError("coach_share_link_slug_invalid", 422, { slug: "3-40 letters, numbers and dashes." });
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new CoachShareLinkError("coach_share_link_slug_reserved", 422, { slug: "Pick a different address." });
  }
  try {
    await pool.query(
      `INSERT INTO product_coach_share_links (coach_user_id, slug, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (coach_user_id) DO UPDATE SET slug = EXCLUDED.slug, enabled = EXCLUDED.enabled, updated_at = now()`,
      [coachUserId, slug, input.enabled]
    );
  }
  catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new CoachShareLinkError("coach_share_link_slug_taken", 409, { slug: "Another coach has that address." });
    }
    throw error;
  }
  return getCoachShareLink(coachUserId);
}

// The coach behind a switched-on link, or null.
export async function coachUserIdForLink(slugInput: unknown): Promise<string | null> {
  const slug = text(slugInput).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) return null;
  const result = await pool.query(
    `SELECT s.coach_user_id FROM product_coach_share_links s JOIN product_accounts a ON a.user_id = s.coach_user_id
     WHERE s.slug = $1 AND s.enabled AND a.account_state = 'active'`,
    [slug]
  );
  return result.rows.length ? String(result.rows[0].coach_user_id) : null;
}

// What the public page shows - the same things the coach's athletes see.
export async function publicCoachCard(slugInput: unknown): Promise<Json | null> {
  const coachUserId = await coachUserIdForLink(slugInput);
  if (!coachUserId) return null;
  const [account, preference, gyms] = await Promise.all([
    pool.query(`SELECT display_name FROM product_accounts WHERE user_id = $1`, [coachUserId]),
    loadCoachBrandPreference(coachUserId).catch(() => null),
    pool.query(
      `SELECT COALESCE(l.display_name, g.gym_name) AS gym_name, COALESCE(NULLIF(l.area, ''), g.area) AS area
       FROM product_coach_gyms g LEFT JOIN product_gym_listings l ON l.org_id = g.org_id
       WHERE g.coach_user_id = $1 AND g.link_status IN ('confirmed', 'unlisted')
       ORDER BY g.created_at`,
      [coachUserId]
    )
  ]);
  const color = text(preference?.brand_color);
  return {
    slug: text(slugInput).toLowerCase(),
    display_name: text(account.rows[0]?.display_name) || "A coach",
    business_name: text(preference?.business_name) || null,
    tagline: text(preference?.brand_tagline) || null,
    brand_color: /^#[0-9a-f]{6}$/i.test(color) ? color : null,
    gyms: gyms.rows.map((row) => (text(row.area) ? `${text(row.gym_name)}, ${text(row.area)}` : text(row.gym_name)))
  };
}

// --- QR code ------------------------------------------------------------

function qrMatrix(url: string): boolean[][] {
  const code = qrcode(0, "M");
  code.addData(url, "Byte");
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
}

const QUIET_ZONE = 4;

export function qrSvg(url: string): string {
  const matrix = qrMatrix(url);
  const size = matrix.length + QUIET_ZONE * 2;
  const path: string[] = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 10}" height="${size * 10}" shape-rendering="crispEdges">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${path.join("")}"/></svg>`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// A black-on-white greyscale PNG, big enough to post or print.
export function qrPng(url: string, scale = 16): Buffer {
  const matrix = qrMatrix(url);
  const modules = matrix.length + QUIET_ZONE * 2;
  const width = modules * scale;
  const raw = Buffer.alloc((width + 1) * width, 0xff);
  for (let y = 0; y < width; y += 1) {
    const rowStart = y * (width + 1);
    raw[rowStart] = 0; // filter: none
    const my = Math.floor(y / scale) - QUIET_ZONE;
    for (let x = 0; x < width; x += 1) {
      const mx = Math.floor(x / scale) - QUIET_ZONE;
      if (my >= 0 && mx >= 0 && my < matrix.length && mx < matrix.length && matrix[my][mx]) raw[rowStart + 1 + x] = 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(width, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}
