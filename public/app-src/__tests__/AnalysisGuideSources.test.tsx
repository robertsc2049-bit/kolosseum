// "What this means" explains how to read each number and cites its sources;
// it doesn't tell the coach what to do. Every author-year citation in an
// entry must be one of that entry's listed sources, and every listed source
// is shown.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render } from "@testing-library/react";

import { Explain, GUIDE, SOURCES } from "../screens/coach/analysisGuide";

const ADVICE = [
  /\bconsider\b/i, /\bshould\b/i, /\bnext step\b/i, /\bact on it\b/i, /\btalk to\b/i, /\bhave a conversation\b/i, /\blighten it\b/i,
  /\bworth (?:a conversation|correcting|avoiding|watching|asking|progressing)\b/i, /\bneeds a look\b/i, /\bkeep an eye on\b/i,
  /\btime to (?:change|retest)\b/i, /\bbefore pushing on\b/i, /\bcandidate to adjust\b/i, /\brisk for staleness\b/i, /\bcombination to avoid\b/i
];

test.afterEach(() => cleanup());

test("no explanation tells the coach what to do", () => {
  for (const [id, entry] of Object.entries(GUIDE)) {
    for (const line of [entry.title, entry.shows, ...entry.read, ...entry.how, ...(entry.mind ?? [])]) {
      for (const pattern of ADVICE) assert.doesNotMatch(line, pattern, `${id}: "${line}"`);
    }
  }
});

test("every citation in an explanation is one of that section's listed sources", () => {
  let cited = 0;
  for (const [id, entry] of Object.entries(GUIDE)) {
    const listed = new Set((entry.sources ?? []).map(String));
    for (const line of [...entry.read, ...entry.how, ...(entry.mind ?? [])]) {
      for (const group of line.matchAll(/\(([A-Z][^()]*\d{4})\)/g)) {
        for (const ref of group[1].split(/;\s*/)) {
          const m = ref.match(/^([A-Z][A-Za-z-]+)(?: & [A-Z][A-Za-z]+)? (\d{4})$/);
          if (!m) continue;
          cited += 1;
          const key = `${m[1].toLowerCase().replace(/-.*/, "")}${m[2]}`;
          assert.ok(listed.has(key), `${id}: "${ref}" isn't in this section's sources`);
          assert.ok(key in SOURCES, `${key} is a known source`);
        }
      }
    }
  }
  assert.ok(cited >= 10, `citations were found (${cited})`);
});

test("the sources show under What this means, with a link where there is one", () => {
  const { container } = render(<Explain id="load" />);
  const items = [...container.querySelectorAll(".analysis-sources li")];
  assert.equal(items.length, GUIDE.load.sources?.length);
  assert.match(items[2].textContent ?? "", /^Gabbett TJ\. The training-injury prevention paradox/);
  assert.equal(items[2].querySelector("a")?.getAttribute("href"), "https://doi.org/10.1136/bjsports-2015-095788");
});
