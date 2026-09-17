
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

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
  //
  // DEV NOTE: lint:fast's own command string is long enough (8000+ chars) to hit
  // cmd.exe's command-line-length limit ("The command line is too long.") when
  // run via a plain "npm run lint:fast" execSync on Windows - route both through
  // run_long_npm_script.mjs, which splits a package.json script's "&&"-joined
  // commands and runs each one separately instead of as one long command line.
  sh("node ci/scripts/run_long_npm_script.mjs lint:fast");
  sh("node ci/scripts/run_long_npm_script.mjs test:unit");

  log("");
  log("GREEN_FAST_OK: lint:fast + test:unit passed.");
}

main();
