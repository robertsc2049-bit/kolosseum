// The coach's programme library groups Kolosseum programmes saved with the
// general activity by the sports their catalogue listing names
// (public/app-src/screens/coach/kolosseumProgrammeGroups.ts). The map must
// match the programme content exactly, or a renamed or re-targeted
// programme would land under the wrong heading.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { PROGRAMMES } from "../product/programmes/kolosseum_programmes_v1.mjs";

const source = fs.readFileSync("public/app-src/screens/coach/kolosseumProgrammeGroups.ts", "utf8");
const mapLiteral = source.match(/KOLOSSEUM_GENERAL_PROGRAMME_SPORTS: Record<string, string\[\]> = (\{[\s\S]*?\n\});/u)[1];
const mapped = JSON.parse(mapLiteral.replace(/,\n\}$/u, "\n}"));

test("every general-activity Kolosseum programme is mapped to exactly the sports its listing names", () => {
  const expected = Object.fromEntries(
    PROGRAMMES.filter((p) => p.activity_id === "general_strength").map((p) => [p.template_name, [...(p.listing.activity_ids ?? [])]])
  );
  assert.deepEqual(mapped, expected);
});

test("every multi-sport set those programmes use has a named group", () => {
  const sets = new Set(Object.values(mapped).filter((ids) => ids.length > 1).map((ids) => [...ids].sort().join(",")));
  const named = [...source.matchAll(/\[\[([^\]]*)\], "([^"]+)"\]/gu)].map((m) => JSON.parse(`[${m[1]}]`).sort().join(","));
  for (const set of sets) assert.ok(named.includes(set), `no group name for ${set}`);
});
