import fs from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";

function usage(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(
    "Usage:\n" +
    "  node scripts/gh_pr_checks_status.mjs --file <path> [--json]\n" +
    "  node scripts/gh_pr_checks_status.mjs --repo <owner/name> --pr <number> [--json]\n"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    file: null,
    repo: null,
    pr: null,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case "--file": {
        index += 1;
        if (index >= argv.length) usage("Missing value for --file.");
        args.file = argv[index];
        break;
      }
      case "--repo": {
        index += 1;
        if (index >= argv.length) usage("Missing value for --repo.");
        args.repo = argv[index];
        break;
      }
      case "--pr": {
        index += 1;
        if (index >= argv.length) usage("Missing value for --pr.");
        const parsed = Number.parseInt(argv[index], 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          usage(`Invalid --pr value '${argv[index]}'.`);
        }
        args.pr = parsed;
        break;
      }
      case "--json": {
        args.json = true;
        break;
      }
      default: {
        usage(`Unknown argument '${token}'.`);
      }
    }
  }

  const hasFileMode = Boolean(args.file);
  const hasRepoPrMode = Boolean(args.repo) || args.pr !== null;

  if (hasFileMode && hasRepoPrMode) {
    usage("Use either --file or --repo/--pr, not both.");
  }

  if (!hasFileMode && !hasRepoPrMode) {
    usage("You must provide either --file or --repo/--pr.");
  }

  if (hasRepoPrMode && (!args.repo || args.pr === null)) {
    usage("Both --repo and --pr are required for live mode.");
  }

  return args;
}

function readTextFromFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function resolveGhCommand() {
  const override = process.env.KOLOSSEUM_GH_BIN;
  if (override && override.trim() !== "") {
    return override.trim();
  }
  return "gh";
}

function readTextFromGh(repo, pr) {
  const ghCommand = resolveGhCommand();
  const ghArgs = process.env.KOLOSSEUM_GH_BIN_ARGV1 && process.env.KOLOSSEUM_GH_BIN_ARGV1.trim() !== ""
    ? [process.env.KOLOSSEUM_GH_BIN_ARGV1.trim()]
    : ["pr", "checks", String(pr), "--repo", String(repo)];

  const ghResult = spawnSync(ghCommand, ghArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32" && ghCommand.toLowerCase().endsWith(".cmd")
  });

  if (ghResult.error) {
    throw ghResult.error;
  }

  const rawText = String(ghResult.stdout ?? "");
  if (rawText.trim() === "") {
    const stderrText = String(ghResult.stderr ?? "").trim();
    const exitCode = typeof ghResult.status === "number" ? ghResult.status : "null";
    throw new Error(
      stderrText === ""
        ? `gh pr checks produced no stdout (exit=${exitCode}).`
        : `gh pr checks produced no stdout (exit=${exitCode}): ${stderrText}`
    );
  }

  return rawText;
}

function parseSummary(text) {
  const raw = String(text ?? "");
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (normalized === "") {
    throw new Error("Unable to parse gh pr checks output: empty text.");
  }

  const countsMatch = normalized.match(
    /(\d+)\s+cancelled,\s+(\d+)\s+failing,\s+(\d+)\s+successful,\s+(\d+)\s+skipped,\s+and\s+(\d+)\s+pending checks/i
  );

  if (!countsMatch) {
    throw new Error(`Unable to parse gh pr checks summary counts from: ${normalized}`);
  }

  const cancelledCount = Number.parseInt(countsMatch[1], 10);
  const failingCount = Number.parseInt(countsMatch[2], 10);
  const successfulCount = Number.parseInt(countsMatch[3], 10);
  const skippedCount = Number.parseInt(countsMatch[4], 10);
  const pendingCount = Number.parseInt(countsMatch[5], 10);

  return {
    ok: true,
    isGreen: failingCount === 0 && pendingCount === 0,
    hasPending: pendingCount > 0,
    hasFailing: failingCount > 0,
    successfulCount,
    pendingCount,
    failingCount,
    cancelledCount,
    skippedCount,
    source: "summary"
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawText = args.file
    ? readTextFromFile(args.file)
    : readTextFromGh(args.repo, args.pr);

  const parsed = parseSummary(rawText);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(parsed)}\n`);
    process.exit(parsed.isGreen ? 0 : 1);
  }

  process.stdout.write(rawText);
  if (!String(rawText).endsWith("\n")) {
    process.stdout.write("\n");
  }
  process.exit(parsed.isGreen ? 0 : 1);
}

main();
