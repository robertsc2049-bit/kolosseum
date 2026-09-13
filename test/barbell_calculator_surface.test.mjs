// DEV NOTE: standalone barbell/plate calculator tool - a purely
// client-side utility (no server route, no persistence, no product-area
// entry in product/ui/function_manifest.json - the FULL-UI completion-
// tracking system covers server-backed product surfaces, not convenience
// tools with nothing to persist or prove against a real backend). This
// static surface test instead verifies the nav/view wiring and reuse of
// the already-tested plate-math utility (see plateCalculator.test.mjs)
// and component (BarbellCalculatorPanel.test.tsx / PlateWarmupCalculator.
// test.tsx cover the actual rendering/behavior).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const js = read("public/app/app.js");
const mainTsx = read("public/app-src/main.tsx");
const panel = read("public/app-src/screens/tools/BarbellCalculatorPanel.tsx");
const plateWarmupCalculator = read("public/app-src/components/PlateWarmupCalculator.tsx");

test("the calculator nav item is a bare .nav-item, visible to both roles like Account", () => {
  assert.match(html, /<button class="nav-item" data-view="calculator">/u);
  assert.match(html, /<button class="nav-item" data-view="account">/u);
});

test("the calculator view section exists and mounts a React root", () => {
  assert.match(html, /<section id="view-calculator" class="view" hidden>/u);
  assert.match(html, /<div id="barbell-calculator-root"><\/div>/u);
});

test("app.js knows the view's title and permits it for both athlete and coach roles", () => {
  assert.match(js, /calculator: "Barbell calculator"/u);

  const permittedBlockMatch = js.match(/const permittedViews = athlete\s*\n?\s*\? new Set\(\[([^\]]*)\]\)\s*\n?\s*: new Set\(\[([^\]]*)\]\)/u);
  assert.ok(permittedBlockMatch, "expected to find the permittedViews athlete/coach ternary");
  assert.match(permittedBlockMatch[1], /"calculator"/u);
  assert.match(permittedBlockMatch[2], /"calculator"/u);
});

test("main.tsx mounts BarbellCalculatorPanel at the calculator root", () => {
  assert.match(mainTsx, /import \{ BarbellCalculatorPanel \} from "\.\/screens\/tools\/BarbellCalculatorPanel";/u);
  assert.match(mainTsx, /mount\("barbell-calculator-root", <BarbellCalculatorPanel \/>\);/u);
});

test("the standalone panel reuses the same PlateWarmupCalculatorFields body the session-embedded disclosure uses, with no exercise pre-fill", () => {
  assert.match(panel, /import \{ PlateWarmupCalculatorFields \} from "\.\.\/\.\.\/components\/PlateWarmupCalculator";/u);
  assert.match(panel, /<PlateWarmupCalculatorFields initialTarget="" initialUnit="kg" \/>/u);
  assert.match(plateWarmupCalculator, /export function PlateWarmupCalculatorFields/u);
  assert.match(plateWarmupCalculator, /export function PlateWarmupCalculator\(/u);
});
