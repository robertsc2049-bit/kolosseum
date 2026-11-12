// A gym or club owner's first week in the org console (walkthrough 14):
// what they need first comes first, a reload keeps them signed in, and any of
// the app's sports can be chosen. The session restore is proven against a real
// database in org_owner_identity_persistent.integration.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { V1_ACTIVITY_IDS } from "../shared/v1-boundary/v1ActivityRegistry.mjs";

const html = readFileSync("public/org/index.html", "utf8");
const js = readFileSync("public/org/org.js", "utf8");

test("creating an organisation comes before data rights, account closure and help", () => {
  const at = (id) => html.indexOf(`<section id="${id}"`);
  assert.ok(at("orgCreateSection") > 0);
  for (const later of ["orgAccountSection", "orgSupportSection"]) {
    assert.ok(at("orgCreateSection") < at(later), `${later} comes after Create an organisation`);
    assert.ok(at("orgThreadDetailSection") < at(later), `${later} comes after every organisation screen`);
  }
});

test("a reload asks the server whether the owner is still signed in before showing the sign-in form", () => {
  assert.match(js, /async function restoreSession\(\) \{\s*el\("orgSignInSection"\)\.hidden = true;/u);
  assert.match(js, /const result = await api\("GET", "\/org\/session"\);/u);
  assert.match(js, /restoreSession\(\)\.catch\(\(\) => showSignedOut\(\)\);/u);
  const routes = readFileSync("src/api/org_owner.routes.ts", "utf8");
  const block = routes.slice(routes.indexOf('"/session",'), routes.indexOf('"/organisations",'));
  assert.match(block, /response\.set\("Cache-Control", "no-store"\);/u);
  assert.match(block, /if \(site && site !== "same-origin"\) \{/u, "another site's page is refused");
  assert.match(block, /csrf_token: orgOwnerCsrfTokenForSession\(raw_session_token\)/u);
});

test("an organisation can be any of the app's sports, not just six", () => {
  const select = html.slice(html.indexOf('<select id="orgCreateActivityId"'), html.indexOf("</select>", html.indexOf('<select id="orgCreateActivityId"')));
  const offered = [...select.matchAll(/<option value="([a-z_]+)">/gu)].map((match) => match[1]);
  assert.deepEqual([...offered].sort(), [...V1_ACTIVITY_IDS].sort());
});
