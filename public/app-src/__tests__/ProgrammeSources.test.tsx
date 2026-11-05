// A Kolosseum programme shows what it's based on, folded under its summary,
// with a link where the source has one; nothing shows without sources.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render } from "@testing-library/react";

import { ProgrammeSources } from "../components/ProgrammeSources";

test.afterEach(() => cleanup());

test("the sources list under 'Based on', each linked where it has an https link", () => {
  const { container } = render(<ProgrammeSources sources={[
    { cite: "Rippetoe M. Starting Strength: Basic Barbell Training. 3rd ed. The Aasgaard Company; 2011." },
    { cite: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016.", url: "https://doi.org/10.1007/s40279-016-0486-0" },
    { cite: "A link that isn't https.", url: "javascript:alert(1)" }
  ]} />);
  assert.equal(container.querySelector("summary")?.textContent, "Based on (3)");
  const items = [...container.querySelectorAll("li")];
  assert.equal(items.length, 3);
  assert.equal(items[0].querySelector("a"), null);
  assert.equal(items[1].querySelector("a")?.getAttribute("href"), "https://doi.org/10.1007/s40279-016-0486-0");
  assert.equal(items[2].querySelector("a"), null, "only https links are made into links");
});

test("no sources, nothing shown", () => {
  const { container } = render(<ProgrammeSources sources={undefined} />);
  assert.equal(container.innerHTML, "");
});
