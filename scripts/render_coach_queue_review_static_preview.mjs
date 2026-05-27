import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderCoachQueueReviewReadModel,
} from "../dist/src/coachQueueReviewUiRenderer.js";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(currentFile), "..");
const fixturePath = join(
  repoRoot,
  "test",
  "fixtures",
  "coach-queue-review",
  "expected_route_responses.json",
);
const outputPath = join(
  repoRoot,
  "previews",
  "coach-queue-review",
  "static-preview.html",
);

function readExpectedResponses() {
  return JSON.parse(readFileSync(fixturePath, "utf8")).responses;
}

function renderExample(title, response) {
  const rendered = renderCoachQueueReviewReadModel(response);

  return [
    `<section class="preview-example" data-example="${title}">`,
    `<h2>${title}</h2>`,
    rendered.html,
    `</section>`,
  ].join("\n");
}

function renderPage() {
  const responses = readExpectedResponses();

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Coach Queue Review â€” Static Preview</title>",
    "<style>",
    ":root { color-scheme: dark; }",
    "body { margin: 0; font-family: Arial, sans-serif; background: #080b0a; color: #eef6ee; }",
    ".preview-shell { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }",
    ".preview-notice { border: 1px solid #314338; background: #101713; padding: 16px; border-radius: 12px; color: #c7d8ca; }",
    ".preview-example { margin-top: 24px; padding: 20px; border: 1px solid #233127; border-radius: 16px; background: #0d120f; }",
    ".kq-shell { display: grid; gap: 18px; }",
    ".kq-header, .kq-card, .kq-empty, .kq-error { border: 1px solid #26372c; border-radius: 14px; padding: 16px; background: #111812; }",
    ".kq-list { display: grid; gap: 14px; }",
    ".kq-card[data-status='review_required'] { border-color: #7ca86f; }",
    ".kq-card[data-status='blocked'] { border-color: #88704f; }",
    ".kq-card[data-status='available'] { border-color: #405444; }",
    ".kq-eyebrow, .kq-muted { color: #9fb3a3; }",
    "h1, h2, h3, h4, p { margin-top: 0; }",
    "ul { margin-bottom: 0; }",
    "</style>",
    "</head>",
    "<body>",
    '<main class="preview-shell">',
    "<h1>Coach Queue Review â€” Static Preview</h1>",
    '<section class="preview-notice">',
    "<p><strong>Static non-production preview.</strong></p>",
    "<p>This page uses committed fixture responses and renderer output only. It has no live API, database, sign-in dependency, route registration, runtime queue integration, or production navigation.</p>",
    "</section>",
    renderExample("Primary coach queue fixture", responses.primary_coach_queue),
    renderExample("Empty coach queue fixture", responses.empty_coach_queue),
    renderExample("Missing coach identifier fixture", responses.missing_coach_id),
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

const page = renderPage();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, page, "utf8");


// S55 brand-aligned static styling patch start
{
  const { readFileSync, writeFileSync } = await import("node:fs");

  const previewUrl = new URL("../previews/coach-queue-review/static-preview.html", import.meta.url);
  let html = readFileSync(previewUrl, "utf8");

  const cssLink = '<link rel="stylesheet" href="./static-preview.css">';
  if (!html.includes(cssLink)) {
    html = html.replace("</head>", `  ${cssLink}
</head>`);
  }

  const bodyClass = "kqr-brand-static-preview";
  if (!html.includes(bodyClass)) {
    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
      if (match.includes("class=")) {
        return match.replace(/class="([^"]*)"/, `class="$1 ${bodyClass}"`);
      }

      return `<body${attrs} class="${bodyClass}">`;
    });
  }

  const heading = '<header class="kqr-static-header"><p class="kqr-static-kicker">Static preview</p><h1>Coach Queue Review — Static Preview</h1><p class="kqr-static-sub">Fixture backed review surface. Non-production static preview only.</p></header>';
  if (!html.includes("kqr-static-header") && !html.includes("Coach Queue Review — Static Preview")) {
    html = html.replace(/<body([^>]*)>/i, (match) => `${match}
  ${heading}`);
  }

  const banner = '<div class="kqr-static-banner"><strong>Static preview</strong>Fixture backed review surface. Non-production static preview only.</div>';
  if (!html.includes("kqr-static-banner")) {
    html = html.replace(/<body([^>]*)>/i, (match) => `${match}
  ${banner}`);
  }

  writeFileSync(previewUrl, html);
}
// S55 brand-aligned static styling patch end
