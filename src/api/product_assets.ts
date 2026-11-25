// DEV NOTE: The product page and its scripts and styles. Every file the page
// loads used to be rechecked with the server on each opening (20 or so round
// trips on a phone). Now the page names them under the version of the files
// themselves, so a browser keeps them for good, and an update changes every
// name at once - no half-old, half-new app.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";

const VERSIONED = /\.(?:js|css)$/u;

function versionedFiles(dir: string, under = ""): string[] {
  return fs.readdirSync(path.join(dir, under), { withFileTypes: true }).flatMap((entry) => {
    const name = under ? `${under}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return versionedFiles(dir, name);
    return entry.isFile() && VERSIONED.test(entry.name) ? [name] : [];
  }).sort();
}

const hashes = new Map<string, string>();
// From what the files say, so every copy of the server agrees; a file already
// read is only read again when it has been written.
export function assetVersion(dir: string): string {
  const whole = createHash("sha256");
  for (const name of versionedFiles(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    const key = `${file}|${stat.size}|${stat.mtimeMs}`;
    let own = hashes.get(key);
    if (!own) {
      own = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
      hashes.set(key, own);
    }
    whole.update(`${name}\n${own}\n`);
  }
  return whole.digest("hex").slice(0, 16);
}

const VERSION_REUSED_MS = 1000;
const versions = new Map<string, { version: string; at: number }>();
function currentVersion(dir: string): string {
  const known = versions.get(dir);
  if (known && Date.now() - known.at < VERSION_REUSED_MS) return known.version;
  const version = assetVersion(dir);
  versions.set(dir, { version, at: Date.now() });
  return version;
}

export function versionedPage(html: string, version: string): string {
  return html.replace(/(\b(?:src|href)=")\/app\/([\w./-]+\.(?:js|css))(")/gu, (_all, before: string, name: string, after: string) => `${before}/app/v/${version}/${name}${after}`);
}

// Generous: a whole gym opens the app from one address.
export const productFilesRateLimit = rateLimit({ windowMs: 60 * 1000, limit: 6000, standardHeaders: true, legacyHeaders: false });

export function productPage(dir: string): RequestHandler {
  return (_request: Request, response: Response) => {
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    response.setHeader("cache-control", "no-cache");
    response.type("html").send(versionedPage(html, currentVersion(dir)));
  };
}

export function productAssets(dir: string): RequestHandler[] {
  const files = express.static(dir, {
    index: false,
    redirect: false,
    cacheControl: false,
    setHeaders: (response) => {
      // A page from before an update gets what's here now, kept by nobody.
      const current = (response as Response).locals.assetVersion === currentVersion(dir);
      response.setHeader("cache-control", current ? "public, max-age=31536000, immutable" : "no-store");
    }
  });
  return [
    (request: Request, response: Response, next: NextFunction) => {
      if (!VERSIONED.test(request.path)) return response.status(404).end();
      response.locals.assetVersion = request.params.version;
      return next();
    },
    files
  ];
}
