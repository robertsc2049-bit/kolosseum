import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { composeTestCiFromIndex } from "./compose_test_ci_from_index.mjs";

const NODE_TEST_CMD_RE = /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/;
const DIRECT_TEST_FILE_RE = /^test\/[A-Za-z0-9._/-]+\.test\.mjs$/;
const CLUSTER_MANIFEST_RE = /^ci\/contracts\/([A-Za-z0-9._/-]+)_ci_cluster\.json$/;

const SOURCE_TO_MANIFEST = new Map([
  ["src/api/sessions.handlers.ts", "ci/contracts/handler_delegation_contracts_ci_cluster.json"],
  ["src/api/blocks.handlers.ts", "ci/contracts/block_handler_delegation_contracts_ci_cluster.json"]
]);

const FULL_FALLBACK_PREFIXES = [
  ".github/workflows/",
  "ci/guards/",
  "ci/scripts/",
  "scripts/",
  "tools/",
  "engine/",
  "cli/",
  "registries/",
  "ci/schemas/"
];

const FULL_FALLBACK_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".npmrc",
  ".nvmrc",
  "ENGINE_CONTRACT.md",
  "schema.sql",
  "ci/contracts/test_ci_composition.json"
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertNodeTestCommand(value, messagePrefix = "invalid node test command") {
  if (typeof value !== "string" || value.trim() !== value || value === "" || !NODE_TEST_CMD_RE.test(value)) {
    throw new Error(`${messagePrefix}: ${String(value)}`);
  }
}

function fileExists(repo, relPath) {
  return fs.existsSync(path.join(repo, ...relPath.split("/")));
}

function normalizeFiles(files) {
  return Array.from(
    new Set(
      (files ?? [])
        .map((value) => String(value ?? "").trim().replace(/\\/g, "/"))
        .filter(Boolean)
    )
  );
}

export function readChangedFilesFromGit() {
  const raw = execSync("git diff --name-only --cached", {
    stdio: ["ignore", "pipe", "ignore"]
  }).toString("utf8");

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function isDocFile(file) {
  return (
    file.startsWith("docs/") ||
    /\.md$/i.test(file) ||
    /\.txt$/i.test(file)
  );
}

function requiresFullFallback(file) {
  if (FULL_FALLBACK_FILES.has(file)) {
    return true;
  }

  if (FULL_FALLBACK_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }

  if (file.startsWith("src/") && !SOURCE_TO_MANIFEST.has(file)) {
    return true;
  }

  return false;
}

function pushCommand(commands, command) {
  assertNodeTestCommand(command, "invalid affected command");
  if (!commands.includes(command)) {
    commands.push(command);
  }
}

function expandManifest(repo, manifestRelPath, commands) {
  const manifestPath = path.join(repo, ...manifestRelPath.split("/"));
  const manifest = readJson(manifestPath);

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`expected manifest object at ${manifestRelPath}`);
  }
  if (!Array.isArray(manifest.cluster) || manifest.cluster.length === 0) {
    throw new Error(`expected non-empty manifest.cluster at ${manifestRelPath}`);
  }

  for (const cmd of manifest.cluster) {
    pushCommand(commands, cmd);
  }

  const match = CLUSTER_MANIFEST_RE.exec(manifestRelPath);
  if (!match) {
    return;
  }

  const stem = match[1];
  const companionTests = [
    `test/ci_${stem}_cluster_manifest_file.test.mjs`,
    `test/ci_${stem}_cluster_manifest.test.mjs`,
    `test/ci_${stem}_manifest_file.test.mjs`,
    `test/ci_${stem}_manifest.test.mjs`
  ];

  for (const relPath of companionTests) {
    if (fileExists(repo, relPath)) {
      pushCommand(commands, `node ${relPath}`);
    }
  }
}

export function composeTestAffectedFromChangedFiles(repo = process.cwd(), changedFiles = readChangedFilesFromGit()) {
  const files = normalizeFiles(changedFiles);

  if (files.length === 0) {
    return {
      mode: "empty",
      changedFiles: files,
      commands: [],
      script: ""
    };
  }

  if (files.every(isDocFile)) {
    return {
      mode: "empty",
      changedFiles: files,
      commands: [],
      script: ""
    };
  }

  if (files.some(requiresFullFallback)) {
    const full = composeTestCiFromIndex(repo);
    return {
      mode: "full",
      changedFiles: files,
      commands: full.commands,
      script: full.script
    };
  }

  const commands = [];

  for (const file of files) {
    if (DIRECT_TEST_FILE_RE.test(file) && fileExists(repo, file)) {
      pushCommand(commands, `node ${file}`);
    }

    const mappedManifest = SOURCE_TO_MANIFEST.get(file);
    if (mappedManifest) {
      expandManifest(repo, mappedManifest, commands);
    }

    if (CLUSTER_MANIFEST_RE.test(file) && fileExists(repo, file)) {
      expandManifest(repo, file, commands);
    }
  }

  if (commands.length === 0) {
    const full = composeTestCiFromIndex(repo);
    return {
      mode: "full",
      changedFiles: files,
      commands: full.commands,
      script: full.script
    };
  }

  return {
    mode: "affected",
    changedFiles: files,
    commands,
    script: commands.join(" && ")
  };
}

function main() {
  const repo = process.cwd();
  const files = normalizeFiles(process.argv.slice(2));
  const out = composeTestAffectedFromChangedFiles(repo, files.length > 0 ? files : undefined);
  process.stdout.write(`${out.script}` + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
