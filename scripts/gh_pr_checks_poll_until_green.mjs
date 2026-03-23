import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function toNormalizedText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sleep(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error("sleep requires a non-negative finite millisecond value.");
  }

  const shared = new SharedArrayBuffer(4);
  const view = new Int32Array(shared);
  Atomics.wait(view, 0, 0, ms);
}

function toInt(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

export function parseArgs(argv) {
  const args = {
    repo: null,
    pr: null,
    attempts: 20,
    delaySeconds: 15,
    json: false,
    quiet: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--repo") {
      args.repo = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (token === "--pr") {
      args.pr = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (token === "--attempts") {
      args.attempts = toInt(argv[i + 1], "attempts");
      i += 1;
      continue;
    }

    if (token === "--delay-seconds") {
      args.delaySeconds = toInt(argv[i + 1], "delaySeconds");
      i += 1;
      continue;
    }

    if (token === "--json") {
      args.json = true;
      continue;
    }

    if (token === "--quiet") {
      args.quiet = true;
      continue;
    }
  }

  if (!args.repo) {
    throw new Error("--repo is required.");
  }

  if (!args.pr) {
    throw new Error("--pr is required.");
  }

  if (args.attempts <= 0) {
    throw new Error("--attempts must be >= 1.");
  }

  if (args.delaySeconds < 0) {
    throw new Error("--delay-seconds must be >= 0.");
  }

  return args;
}

export function interpretPollResult(parsed, attempt, attempts) {
  if (parsed?.isGreen) {
    return {
      done: true,
      ok: true,
      reason: "green"
    };
  }

  if (parsed?.hasFailing) {
    return {
      done: true,
      ok: false,
      reason: "failing"
    };
  }

  if (attempt >= attempts) {
    return {
      done: true,
      ok: false,
      reason: "timeout"
    };
  }

  return {
    done: false,
    ok: false,
    reason: parsed?.hasPending ? "pending" : "unknown"
  };
}

export function parseStatusHelperProcessResult(result) {
  const stdout = toNormalizedText(result?.stdout ?? "").trim();
  const stderr = toNormalizedText(result?.stderr ?? "").trim();

  if (!stdout) {
    const detail = stderr || "gh_pr_checks_status returned no stdout.";
    throw new Error(detail);
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`gh_pr_checks_status emitted non-JSON output: ${stdout}`);
  }

  return {
    parsed,
    stdout,
    stderr,
    exitCode: Number.isInteger(result?.status) ? result.status : null
  };
}

export function pollUntilGreen({
  repo,
  pr,
  attempts = 20,
  delaySeconds = 15,
  runStatus = defaultRunStatus,
  sleepFn = sleep
}) {
  const history = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const parsed = runStatus({ repo, pr });
    history.push({
      attempt,
      parsed
    });

    const verdict = interpretPollResult(parsed, attempt, attempts);

    if (verdict.done) {
      return {
        ok: verdict.ok,
        reason: verdict.reason,
        attemptsUsed: attempt,
        repo,
        pr: String(pr),
        final: parsed,
        history
      };
    }

    sleepFn(delaySeconds * 1000);
  }

  throw new Error("pollUntilGreen reached an unreachable state.");
}

export function defaultRunStatus({ repo, pr }) {
  const result = spawnSync(
    process.execPath,
    ["scripts/gh_pr_checks_status.mjs", "--repo", String(repo), "--pr", String(pr), "--json"],
    { encoding: "utf8" }
  );

  const interpreted = parseStatusHelperProcessResult(result);
  return interpreted.parsed;
}

function emit(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  process.stdout.write(
    `${result.ok ? "GREEN" : result.reason.toUpperCase()} after ${result.attemptsUsed} attempt(s)\n`
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = pollUntilGreen({
    repo: args.repo,
    pr: args.pr,
    attempts: args.attempts,
    delaySeconds: args.delaySeconds
  });

  emit(result, args.json);
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
