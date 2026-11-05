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

test("a pro version shows its base programme's sources, plus the methods it adds", () => {
  const sources = (key) => PROGRAMMES.find((p) => p.key === key).listing.sources;
  const base = sources("tennis_off_season");
  const pro = sources("tennis_off_season_pro");
  assert.deepEqual(pro.slice(0, base.length), base);
  assert.ok(pro.some((source) => /^Seitz LB, Haff GG/u.test(source.cite)), "the pro version's contrast pairs are cited");
});

test("a programme cites the named methods it uses", () => {
  const cites = (programme) => programme.listing.sources.map((source) => source.cite).join(" | ");
  const uses = (pattern) => PROGRAMMES.filter((programme) => pattern.test(JSON.stringify(programme.blocks ?? [])));
  const checks = [
    [/copenhagen/iu, /^Har\u00f8y J/u, "Copenhagen adductions cite Har\u00f8y 2019"],
    [/nordic/iu, /van der Horst/u, "Nordics cite van der Horst 2015"],
    [/contrast/iu, /^Seitz LB, Haff GG/u, "contrast pairs cite Seitz & Haff 2016"],
    [/"type":"(?:amrap|emom|for_time)"/u, /^Glassman G/u, "AMRAP/EMOM/for-time cite Glassman 2002"],
    [/conjugate|max effort|dynamic effort/iu, /^Zatsiorsky VM/u, "the conjugate method cites Zatsiorsky & Kraemer 2006"]
  ];
  for (const [uses_it, cited, label] of checks) {
    for (const programme of uses(uses_it)) {
      assert.ok(programme.listing.sources.some((source) => cited.test(source.cite)), `${programme.key}: ${label} (has ${cites(programme)})`);
    }
  }
  assert.ok(uses(/copenhagen/iu).length >= 1, "at least one programme uses Copenhagen adductions");
});

test("sourcesFor dedupes and stays within 12", async () => {
  const { sourcesFor } = await import("../product/programmes/programme_sources.mjs");
  const programme = { key: "novice_linear_3x5", blocks: [{ note: "copenhagen nordic contrast tabata conjugate" }] };
  const sources = sourcesFor(programme);
  assert.equal(new Set(sources).size, sources.length);
  assert.ok(sources.length <= 12);
  assert.ok(sources.some((source) => /^Tabata I/u.test(source.cite)));
  assert.deepEqual(sourcesFor("novice_linear_3x5"), sources.slice(0, sourcesFor("novice_linear_3x5").length));
});
