import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NODE_TEST_CMD_RE = /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertNodeTestCommand(value, messagePrefix = "invalid node test command") {
  if (typeof value !== "string" || value.trim() !== value || value === "" || !NODE_TEST_CMD_RE.test(value)) {
    throw new Error(`${messagePrefix}: ${String(value)}`);
  }
}

export function composeTestCiFromIndex(repo = process.cwd()) {
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const index = readJson(indexPath);

  if (!index || typeof index !== "object" || Array.isArray(index)) {
    throw new Error("expected test_ci_composition.json to contain an object");
  }
  if (!Array.isArray(index.items) || index.items.length === 0) {
    throw new Error("expected test_ci_composition.json items[] to be a non-empty array");
  }

  const commands = [];

  for (const item of index.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("expected each composition item to be an object");
    }

    if (item.kind === "command") {
      assertNodeTestCommand(item.value, "invalid composition command");
      commands.push(item.value);
      continue;
    }

    if (item.kind === "manifest") {
      if (typeof item.path !== "string" || item.path.trim() !== item.path || item.path === "") {
        throw new Error(`invalid manifest path: ${String(item.path)}`);
      }

      const manifestPath = path.join(repo, ...item.path.split("/"));
      const manifest = readJson(manifestPath);

      if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw new Error(`expected manifest object at ${item.path}`);
      }
      if (!Array.isArray(manifest.cluster) || manifest.cluster.length === 0) {
        throw new Error(`expected non-empty manifest.cluster at ${item.path}`);
      }

      for (const cmd of manifest.cluster) {
        assertNodeTestCommand(cmd, `invalid manifest command in ${item.path}`);
        commands.push(cmd);
      }
      continue;
    }

    throw new Error(`unsupported composition item kind: ${String(item.kind)}`);
  }

  const seen = new Set();
  for (const cmd of commands) {
    if (seen.has(cmd)) {
      throw new Error(`duplicate composed command: ${cmd}`);
    }
    seen.add(cmd);
  }

  return {
    indexPath,
    commands,
    script: commands.join(" && ")
  };
}

function main() {
  const repo = process.cwd();
  const out = composeTestCiFromIndex(repo);
  process.stdout.write(`${out.script}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}