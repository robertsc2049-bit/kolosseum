// DEV NOTE: Product application static-surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const server = fs.readFileSync(path.join(root, "src", "server.ts"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "app", "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "public", "app", "app.js"), "utf8");

test("product application is served independently from diagnostic UI", () => {
  assert.match(server, /const productAppDir = path\.join\(publicDir, "app"\);/u);
  assert.match(server, /app\.use\("\/app", express\.static\(productAppDir\)\);/u);
  assert.match(server, /return res\.redirect\(302, "\/app\/"\);/u);
});

test("product application contains bounded athlete and coach workspaces", () => {
  assert.match(html, /id="view-today"/u);
  assert.match(html, /id="view-session"/u);
  assert.match(html, /id="view-history"/u);
  assert.match(html, /id="view-coach-overview"/u);
  assert.match(html, /id="view-athletes"/u);
  assert.match(html, /id="view-assign"/u);
  assert.match(html, /id="view-review"/u);
  assert.match(html, /id="view-account"/u);
});

test("normal product surface does not expose diagnostic output panels", () => {
  assert.doesNotMatch(html, /Raw trace|Raw state|Console|phase1Input|beta17Output/u);
  assert.doesNotMatch(js, /\/ui\/v0-session-runner/u);
});

test("product UI uses real persisted application endpoints", () => {
  for (const route of [
    "/sessions/beta-auth",
    "/sessions/beta-acknowledgement",
    "/sessions/beta-declaration",
    "/blocks/compile?create_session=true&beta_path=true",
    "/sessions/beta-athlete-history",
    "/sessions/beta-coach-profile",
    "/sessions/beta-coach-relationship",
    "/sessions/beta-coach-assignment",
    "/sessions/beta-coach-artefacts",
    "/sessions/beta-coach-notes"
  ]) {
    assert.ok(js.includes(route), `Expected application route ${route}`);
  }
});

test("product UI assets are substantive", () => {
  assert.ok(html.length > 10000);
  assert.ok(css.length > 15000);
  assert.ok(js.length > 25000);
});
