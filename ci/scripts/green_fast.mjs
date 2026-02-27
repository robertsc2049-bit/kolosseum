import { execSync } from "node:child_process";
import { resolveBaseHead } from "./base_head_resolver.mjs";

function log(s) {
  process.stdout.write(String(s) + "\n");
}

function sh(cmd) {
  return execSync(cmd, { stdio: "inherit", env: process.env });
}

function computeAndExportBaseHead() {
  const r = resolveBaseHead();

  // Export to env so all child processes (guards) can see it.
  process.env.BASE_SHA = r.base;
  process.env.HEAD_SHA = r.head;

  if (r.upstream) log(`green:fast upstream=${r.upstream}`);
  else log("green:fast upstream=(none)");

  if (r.baseRef) log(`green:fast baseRef=${r.baseRef}`);

  log(`green:fast BASE_SHA=${r.base}`);
  log(`green:fast HEAD_SHA=${r.head}`);
}

function main() {
  computeAndExportBaseHead();

  // Optional: prove env propagation is present (cheap + deterministic)
  if (!process.env.BASE_SHA || !process.env.HEAD_SHA) {
    throw new Error("green:fast failed to export BASE_SHA/HEAD_SHA to env");
  }

  // Green:fast is the minimal local gate: keep it aligned with what guards expect.
  // Do NOT run build/e2e here; green:ci owns that.
  sh("npm run lint:fast");
  sh("npm run test:unit");

  log("");
  log("GREEN_FAST_OK: lint:fast + test:unit passed.");
}

main();