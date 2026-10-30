// DEV NOTE: A coach's public share page and its QR code
// (coach_share_link_service.ts). Public and unauthenticated, GET-only, and
// only while the coach has the link switched on - otherwise a plain 404, the
// same as an address that never existed. It shows only what the coach shows
// their athletes. "Train with me" opens the app with ?coach=<slug>; the app
// keeps that through sign-up or sign-in and offers to send the coach a
// coaching request.
import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import { publicCoachCard, qrPng, qrSvg } from "./coach_share_link_service.js";

export const coachSharePageRouter = Router();

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

// Per IP: these pages are public.
const sharePageRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

// The address the QR code points at: the configured public app address
// when there is one, so a QR code never carries a forged Host header.
export function publicOrigin(request: Request): string {
  try {
    if (process.env.KOLOSSEUM_PUBLIC_APP_URL) return new URL(process.env.KOLOSSEUM_PUBLIC_APP_URL).origin;
  }
  catch {
    // fall through to the request's own origin
  }
  return `${request.protocol}://${request.get("host") ?? "127.0.0.1:3000"}`;
}

function notFound(response: Response) {
  return response.status(404).type("text/plain").send("This coach link isn't available.");
}

export function sharePageHtml(card: Record<string, unknown>, pageUrl: string): string {
  const name = String(card.display_name);
  const business = card.business_name ? String(card.business_name) : "";
  const title = business ? `${name} · ${business}` : name;
  const tagline = card.tagline ? String(card.tagline) : "";
  const accent = card.brand_color ? String(card.brand_color) : "#b4552d";
  const gyms = Array.isArray(card.gyms) ? (card.gyms as string[]) : [];
  const slug = encodeURIComponent(String(card.slug));
  const description = tagline || `Train with ${title} on Kolosseum.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - Kolosseum</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:type" content="profile">
<style>
:root { --accent: ${accent}; --bg: #f6f4f1; --card: #fff; --text: #1c1a17; --muted: #6b665e; --line: #e4e0da; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg: #141312; --card: #1f1d1b; --text: #f2efea; --muted: #a8a299; --line: #34312d; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; display: grid; place-items: center; padding: 24px 16px; }
main { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--line); border-top: 6px solid var(--accent); border-radius: 14px; padding: 28px 24px; }
.eyebrow { margin: 0 0 6px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0; font-size: 26px; line-height: 1.2; }
.business { margin: 4px 0 0; font-size: 18px; font-weight: 600; color: var(--accent); }
.tagline { margin: 14px 0 0; }
.gyms { margin: 18px 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 15px; }
.gyms li::before { content: "Coaches at "; }
.gyms li + li::before { content: "and "; }
.cta { display: block; margin-top: 24px; padding: 14px 16px; border-radius: 10px; background: var(--accent); color: #fff; text-align: center; font-weight: 700; text-decoration: none; font-size: 17px; }
.small { margin: 14px 0 0; font-size: 14px; color: var(--muted); text-align: center; }
footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); text-align: center; }
</style>
</head>
<body>
<main>
<p class="eyebrow">Coach</p>
<h1>${escapeHtml(name)}</h1>
${business ? `<p class="business">${escapeHtml(business)}</p>` : ""}
${tagline ? `<p class="tagline">${escapeHtml(tagline)}</p>` : ""}
${gyms.length ? `<ul class="gyms">${gyms.map((gym) => `<li>${escapeHtml(gym)}</li>`).join("")}</ul>` : ""}
<a class="cta" href="/app/?coach=${slug}">Train with me</a>
<p class="small">Create a free athlete account, or sign in, and ${escapeHtml(name)} gets your request. They'll invite you if they can take you on.</p>
<footer>Training on Kolosseum</footer>
</main>
</body>
</html>`;
}

coachSharePageRouter.get(
  "/c/:slug",
  sharePageRateLimit,
  asyncHandler(async (request, response) => {
    const card = await publicCoachCard(request.params.slug);
    if (!card) return notFound(response);
    const pageUrl = `${publicOrigin(request)}/c/${encodeURIComponent(String(card.slug))}`;
    response.set("Cache-Control", "no-cache");
    response.set("X-Content-Type-Options", "nosniff");
    return response.status(200).type("html").send(sharePageHtml(card, pageUrl));
  })
);

// The coach's card for the app (the sign-up banner and the ask card).
coachSharePageRouter.get(
  "/c/:slug/card",
  sharePageRateLimit,
  asyncHandler(async (request, response) => {
    const card = await publicCoachCard(request.params.slug);
    if (!card) return response.status(404).json({ ok: false, error: "coach_share_link_not_found" });
    response.set("Cache-Control", "no-cache");
    return response.status(200).json({ ok: true, coach: card });
  })
);

coachSharePageRouter.get(
  "/c/:slug/qr.png",
  sharePageRateLimit,
  asyncHandler(async (request, response) => {
    const card = await publicCoachCard(request.params.slug);
    if (!card) return notFound(response);
    const url = `${publicOrigin(request)}/c/${encodeURIComponent(String(card.slug))}`;
    response.set("Cache-Control", "no-cache");
    if (request.query.download !== undefined) response.attachment(`${String(card.slug)}-qr.png`);
    return response.status(200).type("png").send(qrPng(url));
  })
);

coachSharePageRouter.get(
  "/c/:slug/qr.svg",
  sharePageRateLimit,
  asyncHandler(async (request, response) => {
    const card = await publicCoachCard(request.params.slug);
    if (!card) return notFound(response);
    const url = `${publicOrigin(request)}/c/${encodeURIComponent(String(card.slug))}`;
    response.set("Cache-Control", "no-cache");
    response.set("X-Content-Type-Options", "nosniff");
    if (request.query.download !== undefined) response.attachment(`${String(card.slug)}-qr.svg`);
    return response.status(200).type("image/svg+xml").send(qrSvg(url));
  })
);
