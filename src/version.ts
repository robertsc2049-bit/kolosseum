
// DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic
// engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or
// outputs unless routed through an explicit validated contract.

import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

// dist-safe: when running "node dist/src/server.js" from repo root,
// process.cwd() points at the repo root.
export const VERSION: string = require(join(process.cwd(), "package.json")).version;
