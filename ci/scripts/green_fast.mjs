
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import { execSync } from "node:child_process";
import { resolveBaseHead } from "./base_head_resolver.mjs";

function log(s) {
  process.stdout.write(String(s) + "\n");
}

function sh(cmd, extraEnv = {}) {
  return execSync(cmd, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
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
  // A plain "npm run lint:fast" would have set npm_lifecycle_event=lint:fast for
  // green_entrypoint_guard.mjs's own allowlist check; a direct node invocation
  // does not, so it leaks whatever lifecycle event this script's own parent had
  // instead. green_fast.mjs already IS the canonical green runner, so mark these
  // as green-runner-owned via KOLOSSEUM_GREEN_ENTRYPOINT=1 - the guard's own
  // documented mechanism for exactly this case - rather than spoofing a lifecycle
  // event name.
  sh("node ci/scripts/run_long_npm_script.mjs lint:fast", { KOLOSSEUM_GREEN_ENTRYPOINT: "1" });
  sh("node ci/scripts/run_long_npm_script.mjs test:unit", { KOLOSSEUM_GREEN_ENTRYPOINT: "1" });

  log("");
  log("GREEN_FAST_OK: lint:fast + test:unit passed.");
}

main();
