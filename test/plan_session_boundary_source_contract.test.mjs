import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession source contract: wrapped undeclared top-level fields fail hard without delegation or response-shape drift", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /const bodyUnknown = req\.body as unknown;/,
    "planSession must keep the current bodyUnknown boundary seam"
  );

  assert.match(
    source,
    /else if \(typeof bodyUnknown === "undefined" \|\| bodyUnknown === null\) input = \{\};/,
    "planSession must preserve null\/undefined normalization to {}"
  );

  assert.match(
    source,
    /else throw badRequest\("Invalid JSON body \(expected object\)"\);/,
    "planSession must preserve invalid-body rejection"
  );

  assert.match(
    source,
    /const hasTopLevelInput = Object\.prototype\.hasOwnProperty\.call\(body, "input"\);/,
    "planSession must detect wrapped input bodies explicitly"
  );

  assert.match(
    source,
    /Object\.keys\(body\)\.filter\(\(key\) => key !== "input"\)\.sort\(\)/,
    "planSession must compute undeclared top-level wrapper fields deterministically"
  );

  assert.match(
    source,
    /throw badRequest\(`Unexpected top-level field\(s\): \$\{undeclaredTopLevelFields\.join\(", "\)\}`\);/,
    "planSession must reject undeclared top-level wrapper fields"
  );

  assert.match(
    source,
    /input = \(body as any\)\.input \?\? body;/,
    "planSession must preserve the delegation seam for valid bodies"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "planSession must preserve the flattened response contract"
  );
});
