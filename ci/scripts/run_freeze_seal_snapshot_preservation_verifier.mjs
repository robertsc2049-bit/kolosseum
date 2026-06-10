import path from "node:path";

import {
  DEFAULT_REQUIRED_COMPONENTS,
  buildFreezeSealSnapshot
} from "./run_freeze_seal_snapshot_builder.mjs";

export const DEFAULT_GENERATED_AT_UTC = "2026-04-03T12:00:00Z";

function fail(token, details, pathValue = null) {
  const failure = { token, details };
  if (pathValue !== null) {
    failure.path = pathValue;
  }
  return {
    ok: false,
    failures: [failure]
  };
}

function validateComponentPaths(componentPaths) {
  const required = ["proof_index", "readiness", "drift", "mainline_guard"];

  for (const key of required) {
    if (!(key in componentPaths)) {
      return fail("CI_MANIFEST_MISMATCH", `Missing required component mapping '${key}'.`);
    }
    if (typeof componentPaths[key] !== "string" || componentPaths[key].trim().length === 0) {
      return fail("CI_MANIFEST_MISMATCH", `Required component mapping '${key}' must be a non-empty string.`);
    }
  }

  return { ok: true };
}

export function verifyFreezeSealSnapshotPreservation({
  componentPaths = DEFAULT_REQUIRED_COMPONENTS,
  generatedAtUtc = DEFAULT_GENERATED_AT_UTC
} = {}) {
  const validation = validateComponentPaths(componentPaths);
  if (!validation.ok) {
    return validation;
  }

  const first = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc,
    outputPath: null
  });

  if (!first.ok) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      "First rebuild failed.",
      "first_rebuild"
    );
  }

  const second = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc,
    outputPath: null
  });

  if (!second.ok) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      "Second rebuild failed.",
      "second_rebuild"
    );
  }

  const bytesEqual = Buffer.compare(first.output_bytes, second.output_bytes) === 0;
  const hashesEqual = first.output_sha256 === second.output_sha256;

  if (!bytesEqual) {
    return fail(
      "nondeterminism_detected",
      `Freeze seal snapshot rebuild bytes drifted: first=${first.output_sha256} second=${second.output_sha256}.`,
      "snapshot_output_bytes"
    );
  }

  if (!hashesEqual) {
    return fail(
      "nondeterminism_detected",
      `Freeze seal snapshot rebuild hash drifted: first=${first.output_sha256} second=${second.output_sha256}.`,
      "snapshot_output_hash"
    );
  }

  return {
    ok: true,
    generated_at_utc: generatedAtUtc,
    output_sha256: first.output_sha256,
    byte_parity: true,
    hash_parity: true
  };
}

function parseArgs(argv) {
  const args = {
    componentPaths: { ...DEFAULT_REQUIRED_COMPONENTS },
    generatedAtUtc: DEFAULT_GENERATED_AT_UTC
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--generated-at") {
      if (typeof next !== "string" || next.length === 0) {
        throw new Error("--generated-at requires a value.");
      }
      args.generatedAtUtc = next;
      index += 1;
      continue;
    }

    if (token === "--proof-index") {
      args.componentPaths.proof_index = next;
      index += 1;
      continue;
    }

    if (token === "--readiness") {
      args.componentPaths.readiness = next;
      index += 1;
      continue;
    }

    if (token === "--drift") {
      args.componentPaths.drift = next;
      index += 1;
      continue;
    }

    if (token === "--mainline-guard") {
      args.componentPaths.mainline_guard = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

export function runCli(argv = process.argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const result = fail("CI_MANIFEST_MISMATCH", error.message, "cli");
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    return 1;
  }

  const result = verifyFreezeSealSnapshotPreservation(args);
  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    return 1;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return 0;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(new URL(import.meta.url).pathname);
if (entrypointPath === modulePath) {
  process.exit(runCli(process.argv));
}
