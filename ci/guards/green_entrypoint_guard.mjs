import process from "node:process";

function die(msg) {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

const isCi =
  String(process.env.CI || "").toLowerCase() === "true" ||
  String(process.env.CI || "") === "1" ||
  !!process.env.GITHUB_ACTIONS ||
  !!process.env.BUILDKITE ||
  !!process.env.GITLAB_CI ||
  !!process.env.TF_BUILD;

const allowed = isCi || String(process.env.KOLOSSEUM_GREEN || "") === "1";

if (!allowed) {
  die(
    [
      "CI_GREEN_ENTRYPOINT_REQUIRED",
      "Use the single canonical entry point:",
      "  npm run green",
      "",
      "This command is guarded to prevent ad-hoc partial runs and implicit writes."
    ].join("\n")
  );
}