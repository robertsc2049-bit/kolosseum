import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  throw err;
}

function ensureArray(value, code, message, details = {}) {
  if (!Array.isArray(value)) {
    fail(code, message, details);
  }
}

function toAbs(repoRoot, repoRelativePath) {
  return path.resolve(repoRoot, repoRelativePath);
}

function loadManifest(repoRoot, manifestPath, expectedSchema, missingCode, invalidCode, label) {
  const abs = toAbs(repoRoot, manifestPath);
  if (!fs.existsSync(abs)) {
    fail(
      missingCode,
      `${label} '${manifestPath}' does not exist.`,
      { path: manifestPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== expectedSchema) {
    fail(
      invalidCode,
      `${label} schema_version must be ${expectedSchema}.`,
      { schema_version: manifest?.schema_version ?? null, path: manifestPath }
    );
  }

  return manifest;
}

function normalizeStringArray(values, code, label) {
  ensureArray(values, code, `${label} must be an array.`);
  const seen = new Set();
  const out = [];

  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(code, `${label} entries must be non-empty strings.`, { value });
    }
    const normalized = value.trim().replace(/\\/g, "/");
    if (seen.has(normalized)) {
      fail(code, `${label} contains duplicate entry '${normalized}'.`, { value: normalized });
    }
    seen.add(normalized);
    out.push(normalized);
  }

  out.sort((a, b) => a.localeCompare(b, "en"));
  return out;
}

function normalizeOrderedStringArray(values, code, label) {
  ensureArray(values, code, `${label} must be an array.`);
  const seen = new Set();
  const out = [];

  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(code, `${label} entries must be non-empty strings.`, { value });
    }
    const normalized = value.trim();
    if (seen.has(normalized)) {
      fail(code, `${label} contains duplicate entry '${normalized}'.`, { value: normalized });
    }
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function normalizeCommandArray(values, code, label) {
  ensureArray(values, code, `${label} must be an array.`);
  const seen = new Set();

  return values.map((value, index) => {
    if (!value || typeof value !== "object") {
      fail(code, `${label} entry at index ${index} must be an object.`, { index });
    }
    if (typeof value.command_id !== "string" || value.command_id.trim().length === 0) {
      fail(code, `${label} entry at index ${index} must include non-empty command_id.`, { index });
    }

    const commandId = value.command_id.trim();
    if (seen.has(commandId)) {
      fail(code, `${label} contains duplicate command_id '${commandId}'.`, { command_id: commandId, index });
    }
    seen.add(commandId);

    return {
      command_id: commandId,
      order: index
    };
  });
}

function loadRollbackPacketSet(repoRoot, packetSetPath) {
  const manifest = loadManifest(
    repoRoot,
    packetSetPath,
    "kolosseum.freeze.rollback_packet_set.v1",
    "FREEZE_ROLLBACK_PACKET_COMPAT_PACKET_SET_MISSING",
    "FREEZE_ROLLBACK_PACKET_COMPAT_PACKET_SET_SCHEMA_INVALID",
    "Rollback packet set manifest"
  );

  const rollbackFiles = normalizeStringArray(
    manifest.rollback_files?.map((item) => item?.source_path),
    "FREEZE_ROLLBACK_PACKET_COMPAT_PACKET_SET_INVALID",
    "rollback_files.source_path"
  );

  return {
    manifest,
    rollback_surface_paths: rollbackFiles
  };
}

function loadRollbackRunbook(repoRoot, rollbackRunbookPath) {
  const manifest = loadManifest(
    repoRoot,
    rollbackRunbookPath,
    "kolosseum.freeze.rollback_runbook.v1",
    "FREEZE_ROLLBACK_PACKET_COMPAT_RUNBOOK_MISSING",
    "FREEZE_ROLLBACK_PACKET_COMPAT_RUNBOOK_SCHEMA_INVALID",
    "Rollback runbook manifest"
  );

  const rollbackSurfacePaths = normalizeStringArray(
    manifest.rollback_surface_paths,
    "FREEZE_ROLLBACK_PACKET_COMPAT_RUNBOOK_SURFACES_INVALID",
    "rollback_surface_paths"
  );

  const rollbackCommands = normalizeCommandArray(
    manifest.rollback_commands,
    "FREEZE_ROLLBACK_PACKET_COMPAT_RUNBOOK_COMMANDS_INVALID",
    "rollback_commands"
  );

  return {
    manifest,
    rollback_surface_paths: rollbackSurfacePaths,
    rollback_commands: rollbackCommands
  };
}

function loadFreezeState(repoRoot, freezeStatePath) {
  const manifest = loadManifest(
    repoRoot,
    freezeStatePath,
    "kolosseum.freeze.state.v1",
    "FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_MISSING",
    "FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_SCHEMA_INVALID",
    "Freeze state manifest"
  );

  const sealedRollbackSurfacePaths = normalizeStringArray(
    manifest.rollback_surface_paths,
    "FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_SURFACES_INVALID",
    "freeze_state.rollback_surface_paths"
  );

  const sealedRollbackCommandIds = normalizeOrderedStringArray(
    manifest.rollback_command_ids,
    "FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_COMMANDS_INVALID",
    "freeze_state.rollback_command_ids"
  );

  return {
    manifest,
    rollback_surface_paths: sealedRollbackSurfacePaths,
    rollback_command_ids: sealedRollbackCommandIds
  };
}

function compareSets(actual, expected, codePrefix, subjectLabel) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  const missing = expected.filter((item) => !actualSet.has(item));
  const extra = actual.filter((item) => !expectedSet.has(item));

  const failures = [];

  if (missing.length > 0) {
    failures.push({
      code: `${codePrefix}_MISSING`,
      message: `${subjectLabel} is missing required entries.`,
      missing
    });
  }

  if (extra.length > 0) {
    failures.push({
      code: `${codePrefix}_EXTRA`,
      message: `${subjectLabel} contains undeclared entries.`,
      extra
    });
  }

  return failures;
}

export function verifyFreezeRollbackPacketCompatibility({
  repoRoot = process.cwd(),
  packetSetPath = "docs/releases/V1_FREEZE_ROLLBACK_PACKET_SET.json",
  rollbackRunbookPath = "docs/releases/V1_FREEZE_ROLLBACK_RUNBOOK.json",
  freezeStatePath = "docs/releases/V1_FREEZE_STATE.json"
} = {}) {
  const packetSet = loadRollbackPacketSet(repoRoot, packetSetPath);
  const rollbackRunbook = loadRollbackRunbook(repoRoot, rollbackRunbookPath);
  const freezeState = loadFreezeState(repoRoot, freezeStatePath);

  const failures = [];

  failures.push(
    ...compareSets(
      packetSet.rollback_surface_paths,
      rollbackRunbook.rollback_surface_paths,
      "FREEZE_ROLLBACK_PACKET_COMPAT_RUNBOOK_SURFACE",
      "Rollback packet surfaces vs rollback runbook"
    )
  );

  failures.push(
    ...compareSets(
      packetSet.rollback_surface_paths,
      freezeState.rollback_surface_paths,
      "FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_SURFACE",
      "Rollback packet surfaces vs sealed freeze state"
    )
  );

  const runbookCommandIds = rollbackRunbook.rollback_commands.map((item) => item.command_id);
  failures.push(
    ...compareSets(
      runbookCommandIds,
      freezeState.rollback_command_ids,
      "FREEZE_ROLLBACK_PACKET_COMPAT_COMMAND_SET",
      "Rollback command ids vs sealed freeze state"
    )
  );

  if (runbookCommandIds.length !== freezeState.rollback_command_ids.length) {
    failures.push({
      code: "FREEZE_ROLLBACK_PACKET_COMPAT_COMMAND_ORDER_LENGTH_MISMATCH",
      message: "Rollback command order length differs from sealed freeze state.",
      runbook_command_ids: runbookCommandIds,
      freeze_state_command_ids: freezeState.rollback_command_ids
    });
  } else {
    for (let i = 0; i < runbookCommandIds.length; i += 1) {
      if (runbookCommandIds[i] !== freezeState.rollback_command_ids[i]) {
        failures.push({
          code: "FREEZE_ROLLBACK_PACKET_COMPAT_COMMAND_ORDER_MISMATCH",
          message: "Rollback command order differs from sealed freeze state.",
          index: i,
          runbook_command_id: runbookCommandIds[i],
          freeze_state_command_id: freezeState.rollback_command_ids[i]
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    schema_version: "kolosseum.freeze.rollback_packet_compatibility_report.v1",
    packet_set_path: packetSetPath,
    rollback_runbook_path: rollbackRunbookPath,
    freeze_state_path: freezeStatePath,
    rollback_packet_surface_count: packetSet.rollback_surface_paths.length,
    rollback_runbook_surface_count: rollbackRunbook.rollback_surface_paths.length,
    rollback_command_count: runbookCommandIds.length,
    failures
  };
}

function main() {
  const packetSetPath = process.argv[2] ?? "docs/releases/V1_FREEZE_ROLLBACK_PACKET_SET.json";
  const rollbackRunbookPath = process.argv[3] ?? "docs/releases/V1_FREEZE_ROLLBACK_RUNBOOK.json";
  const freezeStatePath = process.argv[4] ?? "docs/releases/V1_FREEZE_STATE.json";
  const outputPath = process.argv[5] ?? null;

  let report;
  try {
    report = verifyFreezeRollbackPacketCompatibility({
      repoRoot: process.cwd(),
      packetSetPath,
      rollbackRunbookPath,
      freezeStatePath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.rollback_packet_compatibility_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_ROLLBACK_PACKET_COMPAT_FATAL",
        message: error?.message ?? String(error),
        details: error?.details ?? {}
      }
    };
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (outputPath) {
    const outputAbs = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
    fs.writeFileSync(outputAbs, json, "utf8");
  }

  process.stdout.write(json);
  process.exit(report.ok ? 0 : 1);
}

const entryHref = process.argv[1] ? new URL(`file://${path.resolve(process.argv[1])}`).href : null;
if (entryHref && import.meta.url === entryHref) {
  main();
}