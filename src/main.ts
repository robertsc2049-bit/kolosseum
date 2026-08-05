
// DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic
// engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or
// outputs unless routed through an explicit validated contract.

// src/main.ts
import { app } from "./server.js";
import { attachRealtimeWebSocketServer } from "./api/realtime_hub.js";

function getPort(): number {
  const raw = process.env.PORT;
  if (!raw) return 3000;

  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) return 3000;
  return n;
}

const port = getPort();

const server = app.listen(port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`OK: server listening on http://127.0.0.1:${port}`);
});

server.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("FATAL: server listen error", err);
  process.exitCode = 1;
});

// Part E - live delivery for messaging.
attachRealtimeWebSocketServer(server);
