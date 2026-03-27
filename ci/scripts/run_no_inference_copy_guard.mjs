import fs from "node:fs";

const banned = [
  "recommend",
  "recommended",
  "optimise",
  "optimize",
  "improve",
  "should",
  "better",
  "safer",
  "risk",
  "injury",
  "fatigue",
  "readiness"
];

const files = [
  "src/contracts/org_data_product.ts",
  "src/products/build_org_data_product.ts"
];

const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8").toLowerCase();
  for (const word of banned) {
    if (text.includes(word)) {
      violations.push({ file, word });
    }
  }
}

if (violations.length > 0) {
  console.error("COPY LAW VIOLATION:");
  for (const v of violations) {
    console.error(v.file + " -> " + v.word);
  }
  process.exit(1);
}