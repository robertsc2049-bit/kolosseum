
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sourcePath = new URL("../src/api/sessions.handlers.ts", import.meta.url);
const source = fs.readFileSync(sourcePath, "utf8");

test("sessions.handlers source contract: planSession rejects non-object JSON bodies with explicit badRequest contract", () => {
  assert.match(
    source,
    /else throw badRequest\("Invalid JSON body \(expected object\)"\);/
  );
});

test("sessions.handlers source contract: planSession normalizes undefined or null body to safe empty input before delegation", () => {
  assert.match(
    source,
    /else if \(typeof bodyUnknown === "undefined" \|\| bodyUnknown === null\) input = \{\};/
  );
});

test("sessions.handlers source contract: planSession still delegates only normalized input to planSessionService without duplicating response-shape coverage", () => {
  assert.match(
    source,
    /const out = await planSessionService\(input\);/
  );

  assert.doesNotMatch(
    source,
    /const out = await planSessionService\(bodyUnknown\);/
  );

  assert.doesNotMatch(
    source,
    /const out = await planSessionService\(req\.body\);/
  );
});
