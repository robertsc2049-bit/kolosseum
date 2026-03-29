import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  PARITY_SOURCE_UNPARSEABLE: "parity_source_unparseable",
  PARITY_INVALID_DECLARATION: "parity_invalid_declaration",
  PARITY_DECLARED_PATH_MISSING: "parity_declared_path_missing",
  PARITY_REQUIRED_CHECK_ID_MISSING: "parity_required_check_id_missing",
  PARITY_DOC_SCRIPT_CONTRADICTION: "parity_doc_script_contradiction",
};

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function createFailure(token, filePath, details, checkId = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(checkId ? { check_id: checkId } : {}),
  };
}

function resolveRepoPath(repoRoot, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");
  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw),
  };
}

function loadParityDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Release boundary doc/script parity declaration must be a JSON object.");
  }

  if (typeof declarationJson.parity_id !== "string" || declarationJson.parity_id.trim().length === 0) {
    throw new Error("Release boundary doc/script parity declaration must declare a non-empty parity_id.");
  }

  if (!Array.isArray(declarationJson.doc_paths)) {
    throw new Error("Release boundary doc/script parity declaration must contain a doc_paths array.");
  }

  if (!Array.isArray(declarationJson.script_paths)) {
    throw new Error("Release boundary doc/script parity declaration must contain a script_paths array.");
  }

  if (!Array.isArray(declarationJson.required_check_ids)) {
    throw new Error("Release boundary doc/script parity declaration must contain a required_check_ids array.");
  }

  return {
    parityId: declarationJson.parity_id.trim(),
    docPaths: declarationJson.doc_paths.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`doc_paths[${index}] must be a non-empty string.`);
      }
      return resolveRepoPath(repoRoot, item.trim());
    }),
    scriptPaths: declarationJson.script_paths.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`script_paths[${index}] must be a non-empty string.`);
      }
      return resolveRepoPath(repoRoot, item.trim());
    }),
    requiredCheckIds: declarationJson.required_check_ids.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`required_check_ids[${index}] must be a non-empty string.`);
      }
      return item.trim();
    }),
  };
}

function extractDocClaims(filePath) {
  const json = readJson(filePath);
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { checkIds: [], scriptPaths: [] };
  }

  const checkIds = [];
  const scriptPaths = [];

  if (Array.isArray(json.checks)) {
    for (const item of json.checks) {
      if (item && typeof item.check_id === "string" && item.check_id.trim().length > 0) {
        checkIds.push(item.check_id.trim());
      }
      if (item && typeof item.script_path === "string" && item.script_path.trim().length > 0) {
        scriptPaths.push(normalizeRelativePath(item.script_path.trim()));
      }
    }
  }

  if (Array.isArray(json.prerequisites)) {
    for (const item of json.prerequisites) {
      if (item && typeof item.prereq_id === "string" && item.prereq_id.trim().length > 0) {
        checkIds.push(item.prereq_id.trim());
      }
      if (item && typeof item.script_path === "string" && item.script_path.trim().length > 0) {
        scriptPaths.push(normalizeRelativePath(item.script_path.trim()));
      }
    }
  }

  if (Array.isArray(json.post_merge_checks)) {
    for (const item of json.post_merge_checks) {
      if (item && typeof item.check_id === "string" && item.check_id.trim().length > 0) {
        checkIds.push(item.check_id.trim());
      }
      if (item && typeof item.script_path === "string" && item.script_path.trim().length > 0) {
        scriptPaths.push(normalizeRelativePath(item.script_path.trim()));
      }
    }
  }

  return { checkIds, scriptPaths };
}

function verifyParity({ repoRoot, declarationPath }) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadParityDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.PARITY_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  const failures = [];

  for (const docPath of declaration.docPaths) {
    if (!fs.existsSync(docPath.absolute)) {
      failures.push(
        createFailure(
          FAILURE.PARITY_DECLARED_PATH_MISSING,
          docPath.repoRelative,
          `Declared doc path '${docPath.repoRelative}' does not exist.`
        )
      );
    }
  }

  for (const scriptPath of declaration.scriptPaths) {
    if (!fs.existsSync(scriptPath.absolute)) {
      failures.push(
        createFailure(
          FAILURE.PARITY_DECLARED_PATH_MISSING,
          scriptPath.repoRelative,
          `Declared script path '${scriptPath.repoRelative}' does not exist.`
        )
      );
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      parity_id: declaration.parityId,
      failures,
    };
  }

  const declaredScriptSet = new Set(declaration.scriptPaths.map((item) => item.repoRelative));
  const docCheckIds = new Set();
  const docScriptPaths = new Set();

  for (const docPath of declaration.docPaths) {
    const claims = extractDocClaims(docPath.absolute);
    for (const checkId of claims.checkIds) {
      docCheckIds.add(checkId);
    }
    for (const scriptPath of claims.scriptPaths) {
      docScriptPaths.add(scriptPath);
    }
  }

  for (const checkId of declaration.requiredCheckIds) {
    if (!docCheckIds.has(checkId)) {
      failures.push(
        createFailure(
          FAILURE.PARITY_REQUIRED_CHECK_ID_MISSING,
          declarationRepoRelative,
          `Required check id '${checkId}' is not declared by the doc boundary set.`,
          checkId
        )
      );
    }
  }

  for (const scriptPath of docScriptPaths) {
    if (!declaredScriptSet.has(scriptPath)) {
      failures.push(
        createFailure(
          FAILURE.PARITY_DOC_SCRIPT_CONTRADICTION,
          declarationRepoRelative,
          `Doc boundary references script '${scriptPath}' that is absent from declared script_paths.`
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    parity_id: declaration.parityId,
    verified_doc_paths: declaration.docPaths.map((item) => item.repoRelative),
    verified_script_paths: declaration.scriptPaths.map((item) => item.repoRelative),
    verified_check_ids: declaration.requiredCheckIds,
    failures,
  };
}

function main() {
  const repoRoot = process.cwd();
  const declarationPath = process.argv[2] ?? "docs/releases/V1_RELEASE_BOUNDARY_DOC_SCRIPT_PARITY.json";
  const report = verifyParity({ repoRoot, declarationPath });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

main();