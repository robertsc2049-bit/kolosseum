import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

export const TEST_CI_INTEGRATION_COMPOSITION_PATH = "ci/contracts/test_ci_integration_composition.json";

function readJson(relativePath) {
  const fullPath = path.resolve(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function assertNodeTestOnly(command, context) {
  if (typeof command !== "string" || !command.startsWith("node test/") || !command.endsWith(".test.mjs")) {
    throw new Error(`${context}: expected node-test-only command, got ${JSON.stringify(command)}`);
  }
}

export function composeTestCiIntegrationCommands() {
  const index = readJson(TEST_CI_INTEGRATION_COMPOSITION_PATH);
  if (!index || typeof index !== "object" || Array.isArray(index)) {
    throw new Error("expected composition object");
  }
  if (!Array.isArray(index.items) || index.items.length === 0) {
    throw new Error("expected non-empty composition.items");
  }

  const commands = [];
  const seen = new Set();

  for (const [itemIndex, item] of index.items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`composition.items[${itemIndex}]: expected object`);
    }
    if (typeof item.id !== "string" || item.id.length === 0) {
      throw new Error(`composition.items[${itemIndex}]: expected non-empty id`);
    }
    if (typeof item.manifest !== "string" || item.manifest.length === 0) {
      throw new Error(`composition.items[${itemIndex}]: expected non-empty manifest`);
    }
    if (!Array.isArray(item.guards) || item.guards.length !== 2) {
      throw new Error(`composition.items[${itemIndex}]: expected exactly 2 guard commands`);
    }

    for (const [guardIndex, guardCommand] of item.guards.entries()) {
      assertNodeTestOnly(guardCommand, `composition.items[${itemIndex}].guards[${guardIndex}]`);
      if (seen.has(guardCommand)) {
        throw new Error(`duplicate command detected: ${guardCommand}`);
      }
      seen.add(guardCommand);
      commands.push(guardCommand);
    }

    const manifest = readJson(item.manifest);
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error(`manifest ${item.manifest}: expected object`);
    }
    if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
      throw new Error(`manifest ${item.manifest}: expected non-empty commands array`);
    }

    for (const [commandIndex, command] of manifest.commands.entries()) {
      assertNodeTestOnly(command, `${item.manifest}.commands[${commandIndex}]`);
      if (seen.has(command)) {
        throw new Error(`duplicate command detected: ${command}`);
      }
      seen.add(command);
      commands.push(command);
    }
  }

  return commands;
}

export function composeTestCiIntegrationCommandString() {
  return composeTestCiIntegrationCommands().join(" && ");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(composeTestCiIntegrationCommandString());
}