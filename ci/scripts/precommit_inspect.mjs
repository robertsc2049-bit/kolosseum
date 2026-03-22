import { getPrecommitRoute, normalizeRepoPath } from "./precommit_smart.mjs";

function usage() {
  console.log("usage: npm run precommit:inspect -- <file1> <file2> ...");
  console.log("example: npm run precommit:inspect -- README.md");
}

function formatCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return "(none)";
  }
  return commands.map((cmd) => `- ${cmd}`).join("\n");
}

function main(argv) {
  const files = argv.map(normalizeRepoPath).filter(Boolean);

  if (files.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  const route = getPrecommitRoute(files);

  console.log("== Precommit Route Inspector ==");
  console.log(`Files (${files.length}):`);
  for (const file of files) {
    console.log(`- ${file}`);
  }
  console.log("");
  console.log(`Route kind: ${route.kind}`);
  console.log(`Banner: ${route.banner}`);
  console.log("Commands:");
  console.log(formatCommands(route.commands));
}

main(process.argv.slice(2));
