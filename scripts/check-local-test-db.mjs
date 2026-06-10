import net from "node:net";

const host = process.env.PGHOST || "127.0.0.1";
const portRaw = process.env.PGPORT || "5432";
const port = Number.parseInt(portRaw, 10);
const timeoutMs = 750;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PostgreSQL port for local test preflight: ${portRaw}`);
  process.exit(1);
}

function checkTcp() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    let settled = false;

    function done(ok) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    }

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

const ok = await checkTcp();

if (!ok) {
  if (host === "127.0.0.1" && port === 5432) {
    console.error("PostgreSQL not running on 127.0.0.1:5432");
  } else {
    console.error(`PostgreSQL not running on ${host}:${port}`);
  }

  console.error("Start the local test database before running npm test.");
  process.exit(1);
}

console.log(`OK: local PostgreSQL preflight (${host}:${port})`);