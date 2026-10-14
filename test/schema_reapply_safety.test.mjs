// schema.sql is re-applied in full on every deploy ("safe to re-run",
// docs/ops/V1_PRODUCTION_SETUP.md). A CHECK constraint widened over time is
// dropped and re-added once per widening, in file order - so an early,
// narrower version used to fail on any database already holding rows the
// later versions allow (it broke `npm run db:schema` on a real database; a
// fresh CI database has no such rows, so nothing caught it). Every version
// but the last must be added NOT VALID (it doesn't re-check existing rows);
// the last, which allows everything, validates every row.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync("schema.sql", "utf8");

function checkConstraintAdds() {
  const re = /ADD CONSTRAINT\s+([a-z0-9_]+)\s+CHECK\s*\(/giu;
  const adds = [];
  let match;
  while ((match = re.exec(schema))) {
    let i = match.index + match[0].length;
    let depth = 1;
    while (depth && i < schema.length) {
      if (schema[i] === "(") depth++;
      else if (schema[i] === ")") depth--;
      i++;
    }
    const tail = schema.slice(i, schema.indexOf(";", i)).trim();
    adds.push({ name: match[1], notValid: /^NOT VALID$/iu.test(tail), tail });
  }
  return adds;
}

test("a CHECK constraint re-added as it widens is NOT VALID in every version but the last, so re-applying schema.sql never fails on existing rows", () => {
  const byName = new Map();
  for (const add of checkConstraintAdds()) byName.set(add.name, [...(byName.get(add.name) ?? []), add]);
  let widened = 0;
  for (const [name, adds] of byName) {
    if (adds.length < 2) continue;
    widened++;
    adds.slice(0, -1).forEach((add, i) => assert.equal(add.notValid, true, `${name}: version ${i + 1} of ${adds.length} must be NOT VALID`));
    assert.equal(adds.at(-1).notValid, false, `${name}: the final version must validate every row`);
  }
  assert.ok(widened >= 5, "the record-type, notification-type, audit and activity checks are all covered");
});
