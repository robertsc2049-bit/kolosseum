import "dotenv/config";
import express from "express";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { sessionsRouter } from "./api/sessions.routes.js";
import { blocksRouter } from "./api/blocks.routes.js";
import { VERSION } from "./version.js";

export const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", version: VERSION }));

app.use("/sessions", sessionsRouter);
app.use("/blocks", blocksRouter);

export function startServer(port?: number) {
  const p = port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  return app.listen(p, "0.0.0.0", () =>
    console.log(`Kolosseum API listening on :${p}`)
  );
}

/**
 * Robust ESM "main module" detection.
 * Works cross-platform (Windows/Linux) and with relative or absolute argv paths.
 */
function isExecutedDirectly(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;

  const argvHref = pathToFileURL(resolve(argv1)).href;
  return import.meta.url === argvHref;
}

// Only auto-start when executed directly (not when imported by tests)
if (isExecutedDirectly()) {
  startServer();
}
