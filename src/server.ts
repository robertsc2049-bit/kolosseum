import "dotenv/config";
import express from "express";
import { sessionsRouter } from "./api/sessions.routes.js";
import { blocksRouter } from "./api/blocks.routes.js";
import { VERSION } from "./version.js";

export const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) =>
  res.json({ status: "ok", version: VERSION })
);

app.use("/sessions", sessionsRouter);
app.use("/blocks", blocksRouter);

export function startServer(port?: number) {
  const p = port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  return app.listen(p, () =>
    console.log(`Kolosseum API listening on :${p}`)
  );
}

// Only auto-start when executed directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  startServer();
}

