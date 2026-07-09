// DEV NOTE: Windows-safe npm script splitter.
// Purpose: execute long npm script contracts as ordered short shell commands so
// Windows command-line limits do not block CI guard composition.
// Boundary: this runner only executes committed command lists. It does not add
// product behaviour, alter engine behaviour, infer runtime state, or reinterpret
// guard tokens.
// Failure: exits at the first failing command and preserves the child exit code.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`CI_SPLIT_NPM_SCRIPT_FAILED: ${message}`);
  process.exit(1);
}

function readConfig(configPath) {
  if (!configPath) {
    fail("missing config path argument");
  }

  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    fail(`config file not found: ${configPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("config must be a JSON object");
  }

  if (!Array.isArray(parsed.commands) || parsed.commands.length === 0) {
    fail("config.commands must be a non-empty array");
  }

  for (const [index, command] of parsed.commands.entries()) {
    if (typeof command !== "string" || !command.trim()) {
      fail(`config.commands[${index}] must be a non-empty string`);
    }
  }

  return {
    id: String(parsed.id || path.basename(configPath)),
    commands: parsed.commands
  };
}

function runCommand(command, index, total) {
  console.log("");
  console.log("============================================================");
  console.log(`SPLIT SCRIPT COMMAND ${index + 1}/${total}`);
  console.log("============================================================");
  console.log(command);

  const child =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env
        })
      : spawnSync("/bin/sh", ["-c", command], {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env
        });

  if (child.error) {
    console.error(child.error);
    process.exit(1);
  }

  if (child.status !== 0) {
    process.exit(typeof child.status === "number" ? child.status : 1);
  }
}

const config = readConfig(process.argv[2]);
console.log(`run_split_npm_script: ${config.id}`);

for (const [index, command] of config.commands.entries()) {
  runCommand(command, index, config.commands.length);
}

console.log(`run_split_npm_script: ${config.id}: OK`);
