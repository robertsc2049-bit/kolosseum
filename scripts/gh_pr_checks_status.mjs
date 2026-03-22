import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

function toNormalizedText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseGhPrChecksText(text) {
  const normalized = toNormalizedText(text).trim();

  if (!normalized) {
    return {
      ok: false,
      isGreen: false,
      hasPending: false,
      hasFailing: false,
      successfulCount: 0,
      pendingCount: 0,
      failingCount: 0,
      cancelledCount: 0,
      skippedCount: 0,
      source: "empty"
    };
  }

  const summaryMatch = normalized.match(
    /(\d+)\s+cancelled,\s+(\d+)\s+failing,\s+(\d+)\s+successful,\s+(\d+)\s+skipped,\s+and\s+(\d+)\s+pending\s+checks/i
  );

  if (summaryMatch) {
    const cancelledCount = Number(summaryMatch[1]);
    const failingCount = Number(summaryMatch[2]);
    const successfulCount = Number(summaryMatch[3]);
    const skippedCount = Number(summaryMatch[4]);
    const pendingCount = Number(summaryMatch[5]);

    return {
      ok: true,
      isGreen: failingCount === 0 && pendingCount === 0 && successfulCount > 0,
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

  const rowMatches = Array.from(
    normalized.matchAll(/^\S+\s+(pass|pending|fail|error|cancel|skipping)\b/gim)
  );

  if (rowMatches.length > 0) {
    const states = rowMatches.map((match) => match[1].toLowerCase());

    const successfulCount = states.filter((state) => state === "pass").length;
    const pendingCount = states.filter((state) => state === "pending").length;
    const failingCount = states.filter((state) => state === "fail" || state === "error").length;
    const cancelledCount = states.filter((state) => state === "cancel").length;
    const skippedCount = states.filter((state) => state === "skipping").length;

    return {
      ok: true,
      isGreen: failingCount === 0 && pendingCount === 0 && successfulCount > 0,
      hasPending: pendingCount > 0,
      hasFailing: failingCount > 0,
      successfulCount,
      pendingCount,
      failingCount,
      cancelledCount,
      skippedCount,
      source: "rows"
    };
  }

  const lower = normalized.toLowerCase();
  const mentionsSuccess = lower.includes("all checks were successful");
  const mentionsPending = lower.includes("pending");
  const mentionsFailing = lower.includes("failing") || lower.includes("some checks failed");

  return {
    ok: mentionsSuccess || mentionsPending || mentionsFailing,
    isGreen: mentionsSuccess && !mentionsPending && !mentionsFailing,
    hasPending: mentionsPending && !mentionsSuccess,
    hasFailing: mentionsFailing,
    successfulCount: mentionsSuccess ? 1 : 0,
    pendingCount: mentionsPending && !mentionsSuccess ? 1 : 0,
    failingCount: mentionsFailing ? 1 : 0,
    cancelledCount: 0,
    skippedCount: 0,
    source: "fallback"
  };
}

export function parseGhPrChecksProcessResult(result) {
  const stdout = toNormalizedText(result?.stdout ?? "");
  const stderr = toNormalizedText(result?.stderr ?? "");
  const combined = `${stdout}${stderr}`.trim();

  if (!combined) {
    return {
      parsed: parseGhPrChecksText(""),
      text: "",
      fatal: true,
      fatalMessage: "gh pr checks returned no output."
    };
  }

  const parsed = parseGhPrChecksText(combined);

  if (parsed.ok) {
    return {
      parsed,
      text: combined,
      fatal: false,
      fatalMessage: null
    };
  }

  return {
    parsed,
    text: combined,
    fatal: true,
    fatalMessage: combined
  };
}

function parseArgs(argv) {
  const args = {
    stdin: false,
    json: false,
    file: null,
    repo: null,
    pr: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--stdin") {
      args.stdin = true;
      continue;
    }

    if (token === "--json") {
      args.json = true;
      continue;
    }

    if (token === "--file") {
      args.file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

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
  }

  return args;
}

function readInputText(args) {
  if (args.stdin) {
    return fs.readFileSync(0, "utf8");
  }

  if (args.file) {
    return fs.readFileSync(args.file, "utf8");
  }

  if (args.repo && args.pr) {
    const gh = spawnSync(
      "gh",
      ["pr", "checks", String(args.pr), "--repo", String(args.repo)],
      { encoding: "utf8" }
    );

    const interpreted = parseGhPrChecksProcessResult(gh);

    if (interpreted.fatal) {
      throw new Error(interpreted.fatalMessage);
    }

    return interpreted.text;
  }

  throw new Error("Provide one of: --stdin, --file <path>, or --repo <repo> --pr <number>.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = readInputText(args);
  const parsed = parseGhPrChecksText(text);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(parsed)}\n`);
  } else {
    process.stdout.write(`${parsed.isGreen ? "GREEN" : parsed.hasPending ? "PENDING" : parsed.hasFailing ? "FAILING" : "UNKNOWN"}\n`);
  }

  process.exit(parsed.isGreen ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
