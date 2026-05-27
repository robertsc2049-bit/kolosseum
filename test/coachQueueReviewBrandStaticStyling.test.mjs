import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cssPath = "previews/coach-queue-review/static-preview.css";
const htmlPath = "previews/coach-queue-review/static-preview.html";
const rendererPath = "scripts/render_coach_queue_review_static_preview.mjs";
const docPath = "docs/coach-queue-review/COACH_QUEUE_REVIEW_BRAND_ALIGNED_STATIC_STYLING.md";

test("S55 coach queue review static preview has scoped Kolosseum styling", () => {
  assert.equal(fs.existsSync(cssPath), true, "S55 CSS file must exist");
  assert.equal(fs.existsSync(htmlPath), true, "S54 static preview HTML must exist");
  assert.equal(fs.existsSync(rendererPath), true, "S54 renderer script must exist");
  assert.equal(fs.existsSync(docPath), true, "S55 documentation must exist");

  const css = fs.readFileSync(cssPath, "utf8");
  const html = fs.readFileSync(htmlPath, "utf8");
  const renderer = fs.readFileSync(rendererPath, "utf8");

  for (const marker of [
    "#99cf1b",
    "kqr-brand-static-preview",
    "kqr-static-banner",
    "kqr-static-header",
    "--kqr-bg",
    "--kqr-green",
    "static-preview.css"
  ]) {
    assert.ok(
      css.includes(marker) || html.includes(marker) || renderer.includes(marker),
      `missing S55 styling marker: ${marker}`
    );
  }

  assert.ok(
    html.includes("Coach Queue Review — Static Preview"),
    "generated static preview must preserve the required preview heading"
  );

  assert.ok(
    html.includes("kqr-brand-static-preview"),
    "generated static preview must carry the S55 preview class"
  );

  assert.ok(
    html.includes("static-preview.css"),
    "generated static preview must link the S55 stylesheet"
  );

  assert.ok(
    html.includes("kqr-static-banner"),
    "generated static preview must contain the static/non-production banner"
  );
});

test("S55 remains non-production and fixture backed", () => {
  const changedSources = [
    fs.readFileSync(cssPath, "utf8"),
    fs.readFileSync(rendererPath, "utf8"),
    fs.readFileSync(docPath, "utf8")
  ].join("\n");

  const forbiddenRuntimeTerms = [
    "fetch(",
    "axios",
    "new Pool",
    "pg.",
    "express.Router",
    "app.get(",
    "app.post(",
    "createRoute",
    "registerRoute",
    "requireAuth",
    "authMiddleware",
    "login("
  ];

  for (const term of forbiddenRuntimeTerms) {
    assert.equal(
      changedSources.includes(term),
      false,
      `S55 must not introduce production/runtime integration term: ${term}`
    );
  }
});
