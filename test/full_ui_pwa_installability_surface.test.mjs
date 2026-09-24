// DEV NOTE: PWA installability surface contract. Pure infrastructure - not
// a new user-facing capability area, so it does not claim a FULL-UI slice
// number or a product/ui/function_manifest.json delivery_slices entry (see
// the plan's Context section). Deliberately covers installability only, not
// offline support or caching - sw.js has no cache logic to test.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const bootstrap = read("public/app/pwa_bootstrap.js");
const sw = read("public/app/sw.js");
const manifestPath = path.join(root, "public", "app", "manifest.json");

test("index.html declares the manifest, icons and apple installability meta tags", () => {
  assert.match(html, /<link rel="manifest" href="\/app\/manifest\.json" \/>/u);
  assert.match(html, /<link rel="icon" href="\/app\/icons\/icon-192\.png" \/>/u);
  assert.match(html, /<link rel="apple-touch-icon" href="\/app\/icons\/apple-touch-icon\.png" \/>/u);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/u);
  assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" \/>/u);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Kolosseum" \/>/u);
});

test("index.html loads the PWA bootstrap module alongside the existing app scripts", () => {
  assert.match(html, /<script type="module" src="\/app\/app\.js"><\/script>/u);
  assert.match(html, /<script type="module" src="\/app\/pwa_bootstrap\.js"><\/script>/u);
});

test("manifest.json is valid and declares a standalone, installable app", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.name, "Kolosseum");
  assert.equal(manifest.start_url, "/app/");
  assert.equal(manifest.scope, "/app/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#0A0C0A");
  assert.equal(manifest.theme_color, "#0A0C0A");

  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length === 3);

  const bySizeAndPurpose = (sizes, purpose) =>
    manifest.icons.find((icon) => icon.sizes === sizes && icon.purpose === purpose);

  assert.ok(bySizeAndPurpose("192x192", "any"), "expected a 192x192 any-purpose icon");
  assert.ok(bySizeAndPurpose("512x512", "any"), "expected a 512x512 any-purpose icon");
  assert.ok(bySizeAndPurpose("512x512", "maskable"), "expected a 512x512 maskable icon");

  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    assert.match(icon.src, /^\/app\/icons\//u);
  }
});

test("sw.js is an installability-only service worker with no caching", () => {
  assert.match(sw, /addEventListener\("install"/u);
  assert.match(sw, /addEventListener\("activate"/u);
  assert.match(sw, /addEventListener\("fetch"/u);
  assert.match(sw, /event\.respondWith\(fetch\(event\.request\)\)/u);

  // The whole point of this slice is installability without the staleness
  // risk of caching - fail loudly if a future edit sneaks in the Cache API.
  assert.doesNotMatch(sw, /caches\.(open|match|addAll)/u);
});

test("pwa_bootstrap.js registers the service worker at the app scope", () => {
  assert.match(bootstrap, /"serviceWorker" in navigator/u);
  assert.match(bootstrap, /navigator\.serviceWorker\.register\("\/app\/sw\.js"\)/u);
});

test("every declared icon file exists and is a valid PNG of the declared size", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const declared = [
    ...manifest.icons.map((icon) => ({ file: icon.src.replace(/^\/app\//u, ""), size: Number(icon.sizes.split("x")[0]) })),
    { file: "icons/apple-touch-icon.png", size: 180 }
  ];

  for (const { file, size } of declared) {
    const filePath = path.join(root, "public", "app", file);
    assert.ok(fs.existsSync(filePath), `expected ${file} to exist`);

    const buf = fs.readFileSync(filePath);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(buf.subarray(0, 8).equals(pngSignature), `${file} must start with the PNG signature`);

    // IHDR is always the first chunk: length(4) + "IHDR"(4) + width(4) + height(4) + ...
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, size, `${file} width`);
    assert.equal(height, size, `${file} height`);
  }
});
