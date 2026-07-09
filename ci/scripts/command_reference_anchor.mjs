// DEV NOTE: Command reference anchor.
// Purpose: provide a compact lint/package marker proving that command strings
// remain discoverable without executing those referenced commands.
// Boundary: this script validates command references only. It must not run the
// referenced commands, mutate product state, weaken guard meaning, or infer
// runtime behaviour.
// BETA-04 note: lint:fast may be executed through a Windows-safe split runner.
// Some split-runner paths preserve quote characters in command arguments that
// a shell would normally remove. The parser below validates node command
// references whether those references arrive as one quoted argument, as quote
// fragments, or as a chained command string.

import fs from "node:fs";
import process from "node:process";

function fail(message) {
  console.error(`command_reference_anchor: ${message}`);
  process.exit(1);
}

function normalisePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^["']+/, "")
    .replace(/["']+$/, "")
    .replace(/^\.\//, "")
    .trim();
}

function normaliseCommand(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function stripOuterQuotes(value) {
  let out = String(value ?? "").trim();

  while (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1).trim();
  }

  return out;
}

function candidateCommandText(argv) {
  const strippedArgs = argv.map(stripOuterQuotes).filter(Boolean);

  if (strippedArgs.length === 0) {
    fail("no command references supplied");
  }

  return strippedArgs.join(" ");
}

function extractNodeTargets(commandText) {
  const targets = [];
  const pattern = /(?:^|[\s"'(&|;])node(?:\s+--test)?\s+([^"'&|;\s]+\.mjs)\b/g;
  let match;

  while ((match = pattern.exec(commandText)) !== null) {
    targets.push(normalisePath(match[1]));
  }

  return targets;
}

const commandText = normaliseCommand(candidateCommandText(process.argv.slice(2)));
const targets = extractNodeTargets(commandText);

if (targets.length === 0) {
  fail(`command reference does not contain a node .mjs target: ${JSON.stringify(commandText)}`);
}

let referencedTargetCount = 0;

for (const target of targets) {
  if (!fs.existsSync(target)) {
    fail(`referenced command target does not exist: ${target}`);
  }

  referencedTargetCount += 1;
}

console.log(`command_reference_anchor: referenced ${referencedTargetCount} command target(s).`);