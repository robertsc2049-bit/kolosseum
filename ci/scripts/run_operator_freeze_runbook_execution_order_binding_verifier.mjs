import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const RUNBOOK_RELATIVE_PATH = "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md";
const EXECUTION_ORDER_RELATIVE_PATH = "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md";
const RUNBOOK_PATH = path.join(REPO_ROOT, ...RUNBOOK_RELATIVE_PATH.split("/"));
const EXECUTION_ORDER_PATH = path.join(REPO_ROOT, ...EXECUTION_ORDER_RELATIVE_PATH.split("/"));

const RUNBOOK_START_MARKER = "<!-- OPERATOR_FREEZE_COMMAND_ORDER_START -->";
const RUNBOOK_END_MARKER = "<!-- OPERATOR_FREEZE_COMMAND_ORDER_END -->";

function fail(token, details, extra = {}) {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        token,
        details,
        ...extra
      },
      null,
      2
    ) + "\n"
  );
  process.exit(1);
}

function ok(payload = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }, null, 2) + "\n");
  process.exit(0);
}

function normalizeCommand(command) {
  return String(command ?? "").trim().replace(/\s+/g, " ");
}

function extractMarkedBlock(markdown, startMarker, endMarker) {
  const startIndex = markdown.indexOf(startMarker);
  const endIndex = markdown.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }
  return markdown.slice(startIndex + startMarker.length, endIndex);
}

function extractCommandsFromMarkedBlock(block) {
  return block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => normalizeCommand(line))
    .filter((line) => line.length > 0 && line !== "```text" && line !== "```");
}

function extractSealCommands(markdown) {
  const commandRegex = /^\s*node\s+\.\\ci\\scripts\\run_registry_seal_[A-Za-z0-9._-]+\.mjs\s*$/gm;
  const matches = [];
  for (const match of markdown.matchAll(commandRegex)) {
    matches.push(normalizeCommand(match[0]));
  }
  return matches;
}

function arraysEqual(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

function firstDifference(actual, expected) {
  const maxLength = Math.max(actual.length, expected.length);
  for (let i = 0; i < maxLength; i += 1) {
    if (actual[i] !== expected[i]) {
      return {
        index: i,
        runbook_command: actual[i] ?? null,
        execution_order_command: expected[i] ?? null
      };
    }
  }
  return null;
}

function main() {
  if (!fs.existsSync(RUNBOOK_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_MISSING",
      "Operator freeze runbook is missing.",
      { runbook_path: RUNBOOK_RELATIVE_PATH }
    );
  }

  if (!fs.existsSync(EXECUTION_ORDER_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_EXECUTION_ORDER_MISSING",
      "Operator execution order document is missing.",
      { execution_order_path: EXECUTION_ORDER_RELATIVE_PATH }
    );
  }

  const runbookMarkdown = fs.readFileSync(RUNBOOK_PATH, "utf8");
  const executionOrderMarkdown = fs.readFileSync(EXECUTION_ORDER_PATH, "utf8");

  const markedBlock = extractMarkedBlock(runbookMarkdown, RUNBOOK_START_MARKER, RUNBOOK_END_MARKER);
  if (markedBlock === null) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_ORDER_MARKERS_MISSING",
      "Operator freeze runbook does not contain the canonical command order markers.",
      {
        runbook_path: RUNBOOK_RELATIVE_PATH,
        start_marker: RUNBOOK_START_MARKER,
        end_marker: RUNBOOK_END_MARKER
      }
    );
  }

  const runbookCommands = extractCommandsFromMarkedBlock(markedBlock);
  if (runbookCommands.length === 0) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_ORDER_EMPTY",
      "Operator freeze runbook marked command block does not contain any commands.",
      { runbook_path: RUNBOOK_RELATIVE_PATH }
    );
  }

  const executionOrderCommands = extractSealCommands(executionOrderMarkdown);
  if (executionOrderCommands.length === 0) {
    fail(
      "CI_OPERATOR_FREEZE_EXECUTION_ORDER_EMPTY",
      "Operator execution order document does not contain any canonical freeze commands.",
      { execution_order_path: EXECUTION_ORDER_RELATIVE_PATH }
    );
  }

  if (!arraysEqual(runbookCommands, executionOrderCommands)) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_EXECUTION_ORDER_MISMATCH",
      "Operator freeze runbook command order does not match canonical execution order.",
      {
        runbook_path: RUNBOOK_RELATIVE_PATH,
        execution_order_path: EXECUTION_ORDER_RELATIVE_PATH,
        runbook_commands: runbookCommands,
        execution_order_commands: executionOrderCommands,
        first_difference: firstDifference(runbookCommands, executionOrderCommands)
      }
    );
  }

  ok({
    runbook_path: RUNBOOK_RELATIVE_PATH,
    execution_order_path: EXECUTION_ORDER_RELATIVE_PATH,
    command_count: runbookCommands.length,
    commands: runbookCommands
  });
}

main();