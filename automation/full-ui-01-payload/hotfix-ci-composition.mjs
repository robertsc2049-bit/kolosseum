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

const forbiddenCommand = "node ci/guards/full_ui_completion_guard.mjs";
const matchingIndexes = composition.items
  .map((item, index) => item?.kind === "command" && item?.value === forbiddenCommand ? index : -1)
  .filter((index) => index >= 0);

if (matchingIndexes.length !== 1) {
  throw new Error(
    `FULL_UI_01_DIRECT_GUARD_COMMAND_COUNT_INVALID:${matchingIndexes.length}`
  );
}

composition.items = composition.items.filter(
  (item) => !(item?.kind === "command" && item?.value === forbiddenCommand)
);

const requiredTestCommand =
  "node test/full_ui_01_completion_guard.test.mjs";

if (!composition.items.some(
  (item) => item?.kind === "command" && item?.value === requiredTestCommand
)) {
  throw new Error("FULL_UI_01_GUARD_TEST_COMMAND_MISSING");
}

fs.writeFileSync(
  compositionPath,
  `${JSON.stringify(composition, null, 2)}\n`,
  "utf8"
);

console.log(
  "OK: FULL-UI-01 guard remains CI-enforced through its registered node test"
);
