// src/main.ts
import { app } from "./server.js";

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