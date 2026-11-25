// The page names its scripts and styles under the version of the files, so a
// browser keeps them until an update (src/api/product_assets.ts).
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import express from "express";

import { assetVersion, productAssets, productPage, versionedPage } from "../dist/src/api/product_assets.js";

function site() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assets-"));
  fs.mkdirSync(path.join(dir, "react-dist"));
  fs.writeFileSync(path.join(dir, "index.html"), '<link rel="stylesheet" href="/app/styles.css" /><link rel="icon" href="/app/icons/a.png" /><script src="/app/react-dist/x.js"></script>');
  fs.writeFileSync(path.join(dir, "styles.css"), "a{}");
  fs.writeFileSync(path.join(dir, "react-dist", "x.js"), "1");
  return dir;
}
async function get(dir, paths) {
  const app = express();
  app.get(["/app/", "/app/index.html"], productPage(dir));
  app.use("/app/v/:version", productAssets(dir));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const answers = [];
  try {
    for (const one of paths) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${one}`);
      answers.push({ status: response.status, cache: response.headers.get("cache-control"), text: await response.text() });
    }
  }
  finally { server.close(); }
  return answers;
}

test("only scripts and styles are versioned; the page itself is always rechecked", async () => {
  const dir = site();
  const version = assetVersion(dir);
  const [page] = await get(dir, ["/app/"]);
  assert.equal(page.cache, "no-cache");
  assert.match(page.text, new RegExp(`href="/app/v/${version}/styles.css"`, "u"));
  assert.match(page.text, new RegExp(`src="/app/v/${version}/react-dist/x.js"`, "u"));
  assert.match(page.text, /href="\/app\/icons\/a\.png"/u);
  assert.equal(versionedPage('<script src="https://x.test/app/a.js">', "v"), '<script src="https://x.test/app/a.js">');
});

test("the current version is kept for good; an old page gets today's files and keeps none", async () => {
  const dir = site();
  const version = assetVersion(dir);
  const [current, old, html, missing, outside] = await get(dir, [`/app/v/${version}/react-dist/x.js`, "/app/v/0000/styles.css", `/app/v/${version}/index.html`, `/app/v/${version}/none.js`, `/app/v/${version}/..%2f..%2fsecret.js`]);
  assert.deepEqual([current.status, current.cache, current.text], [200, "public, max-age=31536000, immutable", "1"]);
  assert.deepEqual([old.status, old.cache, old.text], [200, "no-store", "a{}"]);
  assert.equal(html.status, 404);
  assert.equal(missing.status, 404);
  assert.notEqual(outside.status, 200);
});

test("any change to any file changes the version", () => {
  const dir = site();
  const before = assetVersion(dir);
  fs.writeFileSync(path.join(dir, "react-dist", "x.js"), "22");
  assert.notEqual(assetVersion(dir), before);
});

test("what a style or script points at doesn't move with it", () => {
  const root = path.resolve(import.meta.dirname, "..", "public", "app");
  for (const name of ["theme.css", "styles.css"]) {
    for (const [, url] of fs.readFileSync(path.join(root, name), "utf8").matchAll(/url\("?([^")]+)/gu)) assert.match(url, /^(?:\/app\/|data:)/u, `${name}: ${url.slice(0, 60)}`);
  }
});
