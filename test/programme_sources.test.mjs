// Every Kolosseum programme shows what it's based on: a recognised programme
// its original (or a plain statement that none can be traced), Kolosseum's
// own programmes the research and standard texts behind their method.
import assert from "node:assert/strict";
import test from "node:test";

import { PROGRAMMES } from "../product/programmes/kolosseum_programmes_v1.mjs";
import { PROGRAMME_SOURCES } from "../product/programmes/programme_sources.mjs";
import { RECOGNISED_PROGRAMMES } from "../product/programmes/recognised_programmes.mjs";

test("every programme lists at least one source, each a citation with an optional https link", () => {
  assert.ok(PROGRAMMES.length >= 78);
  for (const programme of PROGRAMMES) {
    const sources = programme.listing.sources;
    assert.ok(Array.isArray(sources) && sources.length >= 1, `${programme.key} has no sources`);
    assert.ok(sources.length <= 12, `${programme.key}: at most 12`);
    for (const source of sources) {
      assert.equal(typeof source.cite, "string", programme.key);
      assert.ok(source.cite.length >= 20 && source.cite.length <= 400, `${programme.key}: "${source.cite}"`);
      if (source.url !== undefined) assert.match(source.url, /^https:\/\/\S{4,500}$/u, `${programme.key}: ${source.url}`);
    }
  }
});

test("a recognised programme cites its original by name, and says so when there isn't one", () => {
  for (const programme of RECOGNISED_PROGRAMMES) {
    assert.ok(PROGRAMME_SOURCES[programme.key], `${programme.key} has its own entry, not a borrowed family`);
  }
  const first = (key) => PROGRAMMES.find((p) => p.key === key).listing.sources[0].cite;
  assert.match(first("novice_linear_3x5"), /^Rippetoe M\. Starting Strength/u);
  assert.match(first("texas_method"), /Practical Programming for Strength Training/u);
  assert.match(first("smolov_squat_pro"), /No original publication can be traced/u);
  assert.match(first("bulgarian_daily_max_pro"), /published no programme of his own/u);
});

test("a pro version shows its base programme's sources", () => {
  const sources = (key) => PROGRAMMES.find((p) => p.key === key).listing.sources;
  assert.deepEqual(sources("tennis_off_season_pro"), sources("tennis_off_season"));
});
