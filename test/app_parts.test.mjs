// public/app/app.js is made of parts (core/, and coach/ for coaches only):
// each stays small, every import is there, the page asks for core/ up front
// and opening.js for coach/, and nothing an athlete loads pulls in coach/.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { appFiles } from "./helpers/app_source.mjs";

const read = (name) => fs.readFileSync(path.join("public/app", name), "utf8");
const parts = appFiles();
const importsOf = (name) => [...read(name).matchAll(/^import\s+(?:\{([^}]*)\}\s+from\s+)?"([^"]+)";/gmu)]
  .map(([, names, from]) => ({ names: (names ?? "").split(",").map((n) => n.trim().split(/\s+as\s+/u)[0]).filter(Boolean), file: path.posix.join(path.posix.dirname(name), from) }));

test("app.js only starts the app, and no part is the whole app again", () => {
  assert.ok(read("app.js").split("\n").length < 40);
  for (const name of parts) assert.ok(read(name).split("\n").length < 1300, name);
});

test("everything imported is exported by the file it's imported from", () => {
  for (const name of parts) {
    for (const { names, file } of importsOf(name)) {
      const source = read(file);
      const exported = new Set([...source.matchAll(/^export (?:async )?(?:function|const|let) ([A-Za-z_$]+)/gmu)].map((match) => match[1]));
      for (const wanted of names) assert.ok(exported.has(wanted), `${name} imports ${wanted} from ${file}`);
    }
  }
});

test("a coach's part is only reached through coachPart.js", () => {
  const seen = new Set();
  const visit = (name) => { if (!seen.has(name) && parts.includes(name)) { seen.add(name); importsOf(name).forEach(({ file }) => visit(file)); } };
  visit("app.js");
  assert.equal([...seen].some((name) => name.startsWith("coach/")), false);
  assert.match(read("core/coachPart.js"), /import\("\.\.\/coach\/index\.js"\)/u);
});

test("what's needed starts downloading straight away", () => {
  const page = read("index.html");
  const opening = read("opening.js");
  for (const name of parts) {
    if (name.startsWith("core/")) assert.ok(page.includes(`<link rel="modulepreload" href="/app/${name}" />`), name);
    if (name.startsWith("coach/")) assert.ok(opening.includes(`"${name}"`), name);
  }
});
