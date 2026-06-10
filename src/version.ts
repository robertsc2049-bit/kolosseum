import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

// dist-safe: when running "node dist/src/server.js" from repo root,
// process.cwd() points at the repo root.
export const VERSION: string = require(join(process.cwd(), "package.json")).version;