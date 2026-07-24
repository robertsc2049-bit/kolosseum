import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
const compositionPath = path.join(
  repoRoot,
  "ci",
  "contracts",
  "test_ci_composition.json"
);

const composition = JSON.parse(fs.readFileSync(compositionPath, "utf8"));

if (!composition || typeof composition !== "object" || !Array.isArray(composition.items)) {
  throw new Error("FULL_UI_01_CI_COMPOSITION_INVALID");
}

const directCommands = [
  "node ci/guards/full_ui_completion_guard.mjs",
  "node scripts/full_ui_gap_report.mjs --check"
];

for (const command of directCommands) {
  const count = composition.items.filter(
    (item) => item?.kind === "command" && item?.value === command
  ).length;

  if (count !== 1) {
    throw new Error(
      `FULL_UI_01_DIRECT_COMMAND_COUNT_INVALID:${command}:${count}`
    );
  }
}

composition.items = composition.items.filter(
  (item) => !(
    item?.kind === "command" &&
    directCommands.includes(item?.value)
  )
);

const requiredTestCommands = [
  "node test/full_ui_01_completion_guard.test.mjs",
  "node test/full_ui_01_function_manifest.test.mjs",
  "node test/full_ui_01_route_map.test.mjs"
];

for (const command of requiredTestCommands) {
  if (!composition.items.some(
    (item) => item?.kind === "command" && item?.value === command
  )) {
    throw new Error(`FULL_UI_01_REQUIRED_TEST_COMMAND_MISSING:${command}`);
  }
}

const nodeTestCommandPattern =
  /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/;

const invalidCommand = composition.items.find(
  (item) =>
    item?.kind === "command" &&
    !nodeTestCommandPattern.test(String(item?.value ?? ""))
);

if (invalidCommand) {
  throw new Error(
    `FULL_UI_01_UNEXPECTED_NON_TEST_COMMAND:${String(invalidCommand.value)}`
  );
}

fs.writeFileSync(
  compositionPath,
  `${JSON.stringify(composition, null, 2)}\n`,
  "utf8"
);

console.log(
  "OK: FULL-UI-01 commands remain CI-enforced through registered node tests"
);
