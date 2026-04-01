import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const RUNBOOK_RELATIVE_PATH = "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md";
const REGISTRY_RELATIVE_PATH = "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json";
const RUNBOOK_PATH = path.join(REPO_ROOT, ...RUNBOOK_RELATIVE_PATH.split("/"));
const REGISTRY_PATH = path.join(REPO_ROOT, ...REGISTRY_RELATIVE_PATH.split("/"));

function fail(token, details, extra = {}) {
  process.stdout.write(JSON.stringify({ ok: false, token, details, ...extra }, null, 2) + "\n");
  process.exit(1);
}

function ok(payload = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }, null, 2) + "\n");
  process.exit(0);
}

function normalizeCommand(command) {
  return String(command ?? "").trim().replace(/\s+/g, " ");
}

function arraysEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

function firstDifference(actual, expected) {
  const maxLength = Math.max(actual.length, expected.length);
  for (let i = 0; i < maxLength; i += 1) {
    if (actual[i] !== expected[i]) {
      return { index: i, expected: expected[i] ?? null, actual: actual[i] ?? null };
    }
  }
  return null;
}

function extractMarkedBlock(markdown, startMarker, endMarker) {
  const startIndex = markdown.indexOf(startMarker);
  const endIndex = markdown.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  return markdown.slice(startIndex + startMarker.length, endIndex);
}

function extractCommandsFromMarkedBlock(block) {
  const fence = String.fromCharCode(96).repeat(3);
  const lines = block.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());
  return lines.filter((line) => line.length > 0 && line !== "text" && line !== fence && line !== (fence + "text"));
}

function main() {
  if (!fs.existsSync(RUNBOOK_PATH)) {
    fail("CI_OPERATOR_FREEZE_RUNBOOK_MISSING", "Operator freeze runbook is missing.", { runbook_path: RUNBOOK_RELATIVE_PATH });
  }

  if (!fs.existsSync(REGISTRY_PATH)) {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_REGISTRY_MISSING", "Operator freeze command order registry is missing.", { registry_path: REGISTRY_RELATIVE_PATH });
  }

  const markdown = fs.readFileSync(RUNBOOK_PATH, "utf8");
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

  if (registry.runbook_path !== RUNBOOK_RELATIVE_PATH) {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_RUNBOOK_PATH_MISMATCH", "Operator freeze command order registry points at the wrong runbook path.", {
      expected_runbook_path: RUNBOOK_RELATIVE_PATH,
      actual_runbook_path: registry.runbook_path ?? null,
      registry_path: REGISTRY_RELATIVE_PATH
    });
  }

  if (typeof registry.start_marker !== "string" || typeof registry.end_marker !== "string") {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_MARKER_CONFIG_INVALID", "Operator freeze command order registry is missing valid markers.", {
      registry_path: REGISTRY_RELATIVE_PATH
    });
  }

  if (!Array.isArray(registry.commands) || registry.commands.length === 0) {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_REGISTRY_EMPTY", "Operator freeze command order registry does not contain any commands.", {
      registry_path: REGISTRY_RELATIVE_PATH
    });
  }

  const markedBlock = extractMarkedBlock(markdown, registry.start_marker, registry.end_marker);
  if (markedBlock === null) {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_MARKERS_MISSING", "Operator freeze runbook does not contain the canonical command order markers.", {
      runbook_path: RUNBOOK_RELATIVE_PATH,
      start_marker: registry.start_marker,
      end_marker: registry.end_marker
    });
  }

  const extractedCommands = extractCommandsFromMarkedBlock(markedBlock).map(normalizeCommand);
  const expectedCommands = registry.commands.map(normalizeCommand);

  if (extractedCommands.length === 0) {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_EMPTY", "Operator freeze runbook marked command block does not contain any commands.", {
      runbook_path: RUNBOOK_RELATIVE_PATH
    });
  }

  if (!arraysEqual(extractedCommands, expectedCommands)) {
    fail("CI_OPERATOR_FREEZE_COMMAND_ORDER_MISMATCH", "Operator freeze command order differs from the pinned canonical order.", {
      runbook_path: RUNBOOK_RELATIVE_PATH,
      registry_path: REGISTRY_RELATIVE_PATH,
      extracted_commands: extractedCommands,
      expected_commands: expectedCommands,
      first_difference: firstDifference(extractedCommands, expectedCommands)
    });
  }

  ok({
    runbook_path: RUNBOOK_RELATIVE_PATH,
    registry_path: REGISTRY_RELATIVE_PATH,
    command_count: extractedCommands.length,
    commands: extractedCommands
  });
}

main();