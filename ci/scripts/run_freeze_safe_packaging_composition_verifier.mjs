import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_FREEZE_PACKAGING_COMPOSITION_INVALID";
const DEFAULT_EXPECTED_PATH = "docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json";
const DEFAULT_ACTUAL_PATH = "docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json";

function fail(details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token: TOKEN,
        details,
        ...extra,
      },
    ],
  };
}

function ok(meta = {}) {
  return { ok: true, ...meta };
}

function normalizePath(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function uniqueSortedPaths(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => normalizePath(item)).filter(Boolean))].sort();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to read JSON at ${filePath}: ${message}` };
  }
}

function readExpectedSurfaces(doc) {
  return uniqueSortedPaths(
    doc.freeze_packaging_required_surfaces ??
    doc.required_freeze_artefacts ??
    doc.required_surfaces ??
    doc.surfaces
  );
}

function readActualSurfaces(doc) {
  return uniqueSortedPaths(
    doc.freeze_packaging_surfaces ??
    doc.packaged_surfaces ??
    doc.artefacts ??
    doc.surfaces
  );
}

function verifyFreezeSafePackagingComposition({
  expectedPath,
  actualPath,
}) {
  const expectedDoc = readJson(expectedPath);
  if (expectedDoc.__read_error__) {
    return fail(expectedDoc.__read_error__, { path: normalizePath(expectedPath) });
  }

  const actualDoc = readJson(actualPath);
  if (actualDoc.__read_error__) {
    return fail(actualDoc.__read_error__, { path: normalizePath(actualPath) });
  }

  const expectedSurfaces = readExpectedSurfaces(expectedDoc);
  const actualSurfaces = readActualSurfaces(actualDoc);

  if (expectedSurfaces.length === 0) {
    return fail(
      "Freeze packaging artefact set must declare at least one required freeze artefact.",
      { path: normalizePath(expectedPath) }
    );
  }

  if (actualSurfaces.length === 0) {
    return fail(
      "Packaging evidence manifest must declare packaged freeze surfaces.",
      { path: normalizePath(actualPath) }
    );
  }

  const missing = expectedSurfaces.filter((surface) => !actualSurfaces.includes(surface));
  if (missing.length > 0) {
    return fail(
      `Packaging output is missing required freeze artefact(s): ${missing.join(", ")}`,
      {
        path: normalizePath(actualPath),
        missing_freeze_artefacts: missing,
      }
    );
  }

  const extras = actualSurfaces.filter((surface) => !expectedSurfaces.includes(surface));
  if (extras.length > 0) {
    return fail(
      `Packaging output contains illegal extra freeze artefact(s): ${extras.join(", ")}`,
      {
        path: normalizePath(actualPath),
        extra_freeze_artefacts: extras,
      }
    );
  }

  return ok({
    expected_path: normalizePath(expectedPath),
    actual_path: normalizePath(actualPath),
    freeze_packaging_surfaces: actualSurfaces,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 2) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_freeze_safe_packaging_composition_verifier.mjs [expectedArtefactSetPath] [actualPackagingManifestPath]"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const expectedPath = path.resolve(args[0] ?? DEFAULT_EXPECTED_PATH);
  const actualPath = path.resolve(args[1] ?? DEFAULT_ACTUAL_PATH);

  const result = verifyFreezeSafePackagingComposition({
    expectedPath,
    actualPath,
  });

  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  DEFAULT_ACTUAL_PATH,
  DEFAULT_EXPECTED_PATH,
  verifyFreezeSafePackagingComposition,
};