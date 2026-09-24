import fs from "node:fs";
import path from "node:path";

import {
  REGISTRY_EXPECTED_COUNT_KEYS,
  REGISTRY_EXPECTED_COUNTS_PATH,
  buildRegistryExpectedCountsSnapshot,
  serializeRegistryExpectedCountsSnapshot
} from "../ci/registry/registry_expected_counts.mjs";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const check = args.has("--check");

if (write && check) {
  console.error("CI_REGISTRY_EXPECTED_COUNTS_MODE_INVALID: --write and --check are mutually exclusive");
  process.exit(1);
}

const root = process.cwd();
const snapshot = buildRegistryExpectedCountsSnapshot(root);
const expectedText = serializeRegistryExpectedCountsSnapshot(snapshot);
const outputPath = path.join(root, ...REGISTRY_EXPECTED_COUNTS_PATH.split("/"));

if (write) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, expectedText, "utf8");
  console.log(`REGISTRY_EXPECTED_COUNTS: materialized ${REGISTRY_EXPECTED_COUNT_KEYS.length} acceptance counts`);
  process.exit(0);
}

if (check) {
  if (!fs.existsSync(outputPath)) {
    console.error(`CI_REGISTRY_EXPECTED_COUNTS_STALE: missing ${REGISTRY_EXPECTED_COUNTS_PATH}`);
    process.exit(1);
  }
  const actualText = fs.readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n");
  if (actualText !== expectedText) {
    console.error(`CI_REGISTRY_EXPECTED_COUNTS_STALE: ${REGISTRY_EXPECTED_COUNTS_PATH} does not match canonical materialization`);
    process.exit(1);
  }
  console.log(`REGISTRY_EXPECTED_COUNTS: PASS ${REGISTRY_EXPECTED_COUNT_KEYS.length} acceptance counts`);
  process.exit(0);
}

process.stdout.write(expectedText);
