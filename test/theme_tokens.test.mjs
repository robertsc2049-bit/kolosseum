// Light and dark (theme.css): both define every colour, text and outlines keep
// their contrast, and the script-free fallback matches the light values.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../public/app/theme.css", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const block = (start) => {
  const from = css.indexOf(start);
  assert.ok(from >= 0, start);
  const body = css.slice(css.indexOf("{", from) + 1, css.indexOf("}", from));
  return Object.fromEntries([...body.matchAll(/(--k-[a-z0-9-]+): ([^;]+);/gu)].map((m) => [m[1], m[2]]));
};
const dark = block(":root {");
const light = block(":root[data-theme=\"light\"] {");
const fallback = block(":root:not([data-theme]) {");

const channel = (value) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16))).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("light defines every colour dark does, and the fallback is the same light", () => {
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
  assert.deepEqual(fallback, light);
});

test("text is 4.5:1 or better and control outlines 3:1 or better, in both modes", () => {
  for (const [mode, t] of [["dark", dark], ["light", light]]) {
    const surfaces = ["--k-canvas", "--k-surface-1", "--k-surface-2"];
    for (const text of ["--k-text", "--k-text-secondary", "--k-text-subtle", "--k-link", "--k-accent", "--k-danger", "--k-danger-text", "--k-warning"]) {
      for (const surface of surfaces) assert.ok(contrast(t[text], t[surface]) >= 4.5, `${mode} ${text} on ${surface}: ${contrast(t[text], t[surface]).toFixed(2)}`);
    }
    for (const surface of surfaces) assert.ok(contrast(t["--k-control-border"], t[surface]) >= 3, `${mode} outline on ${surface}: ${contrast(t["--k-control-border"], t[surface]).toFixed(2)}`);
    for (const surface of surfaces) assert.ok(contrast(t["--k-focus"], t[surface]) >= 3, `${mode} focus on ${surface}`);
    for (const [on, fill] of [["--k-on-primary", "--k-primary"], ["--k-on-accent", "--k-accent"], ["--k-on-accent-deep", "--k-accent-deep"], ["--k-on-warning-deep", "--k-warning-deep"], ["--k-on-danger-fill", "--k-danger-fill"], ["--k-danger-text", "--k-danger-deep"], ["--k-text", "--k-accent-tint"]]) {
      assert.ok(contrast(t[on], t[fill]) >= 4.5, `${mode} ${on} on ${fill}: ${contrast(t[on], t[fill]).toFixed(2)}`);
    }
  }
});

test("every page loads the colours, and only the legal pages go without the choice", () => {
  const read = (path) => fs.readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");
  for (const page of ["app/index.html", "org/index.html", "admin/index.html"]) {
    assert.match(read(page), /src="\/app\/theme\.js"[\s\S]*href="\/app\/theme\.css"/u, page);
    assert.match(read(page), /data-theme-choice/u, page);
  }
  for (const page of ["app/legal/terms.html", "app/legal/privacy.html"]) {
    assert.match(read(page), /href="\/app\/theme\.css"/u, page);
    assert.doesNotMatch(read(page), /<script/u, page);
  }
});
