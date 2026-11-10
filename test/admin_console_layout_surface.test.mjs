// Admin console layout (public/admin): a second heading in a card starts its
// own block, typing fields are wide enough for their placeholders, and the
// long exercise demo list is folded away with a count.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync("public/admin/index.html", "utf8");
const js = readFileSync("public/admin/admin.js", "utf8");

test("a second heading inside a card is separated from the table above it", () => {
  assert.match(html, /section h2:not\(:first-child\) \{ margin-top: 1\.6rem; padding-top: 1\.2rem; border-top: 1px solid var\(--k-border\); \}/u);
  for (const heading of ["Deletion-request review", "Org owner deletion-request review"]) {
    const index = html.indexOf(`<h2>${heading}</h2>`);
    assert.ok(index > 0, heading);
    const sectionStart = html.lastIndexOf("<section", index);
    assert.ok(html.slice(sectionStart, index).includes("<h2>"), `${heading} is a second heading in its card`);
  }
});

test("search boxes and typing fields are wide enough to read their placeholders", () => {
  assert.match(html, /input\[type="search"\] \{ width: min\(100%, 34rem\); \}/u);
  assert.match(html, /input\[type="text"\], input\[type="email"\], input\[type="password"\], input\[type="url"\] \{ width: min\(100%, 26rem\); \}/u);
});

test("the exercise demo list is folded away, and the summary says how many", () => {
  assert.match(html, /<details id="exerciseDemoVideoFold" class="fold">\s*<summary id="exerciseDemoVideoSummary">/u);
  const fold = html.slice(html.indexOf('<details id="exerciseDemoVideoFold"'), html.indexOf("</details>", html.indexOf('<details id="exerciseDemoVideoFold"')));
  assert.ok(fold.includes('<tbody id="exerciseDemoVideoList">'), "the list is inside the fold");
  assert.ok(!fold.includes("exerciseDemoVideoForm"), "the add form stays open");
  assert.match(js, /`Show all default demos \(\$\{demos\.length\}\)`/u);
});
