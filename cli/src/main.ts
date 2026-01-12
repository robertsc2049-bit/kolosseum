import fs from "node:fs";
import { runEngine } from "../../engine/src/index.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run run:cli -- <phase1.json>");
  process.exit(1);
}

const raw = fs.readFileSync(file, "utf8");
const input = JSON.parse(raw);

const res = runEngine(input);
console.log(JSON.stringify(res, null, 2));
process.exit(res.ok ? 0 : 1);
