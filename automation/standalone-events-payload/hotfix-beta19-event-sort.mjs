import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetPath = path.join(
  repoRoot,
  "src",
  "api",
  "beta19_coach_event_service.ts"
);

const source = fs.readFileSync(targetPath, "utf8");

const pattern = /\.sort\(\(left,\s*right\)\s*=>\s*\{\s*const leftPlan = isRecord\(left\.event_plan\)/u;

if (!pattern.test(source)) {
  throw new Error("BETA19_EVENT_SORT_TARGET_NOT_FOUND");
}

const updated = source.replace(
  pattern,
  `.sort((left: JsonRecord, right: JsonRecord) => {\n      const leftPlan = isRecord(left.event_plan)`
);

fs.writeFileSync(targetPath, updated, "utf8");
console.log("OK: beta19 event sort typing corrected");
