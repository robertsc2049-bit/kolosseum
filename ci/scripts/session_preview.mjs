import { execFileSync } from "node:child_process";

function usage() {
  console.log("usage: npm run session:preview -- <fixture.json>");
  console.log("example: npm run session:preview -- test/fixtures/phase1_to_phase6.valid.general_strength.individual.json");
}

function printHeader(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

function isScalar(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function safeString(value, fallback = "?") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function pathToString(parts) {
  return parts
    .map((part) => {
      if (typeof part === "number") {
        return `[${part}]`;
      }
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? `.${part}` : `["${String(part)}"]`;
    })
    .join("")
    .replace(/^\./, "");
}

function appendPath(parts, next) {
  return [...parts, next];
}

function collectNoteLines(node, parts = ["notes"], acc = []) {
  if (node === undefined) {
    return acc;
  }

  if (isScalar(node)) {
    acc.push(`- ${pathToString(parts)}: ${safeString(node)}`);
    return acc;
  }

  if (Array.isArray(node)) {
    if (node.length === 0) {
      acc.push(`- ${pathToString(parts)}: []`);
      return acc;
    }
    node.forEach((item, index) => collectNoteLines(item, appendPath(parts, index), acc));
    return acc;
  }

  const keys = Object.keys(node).sort();
  if (keys.length === 0) {
    acc.push(`- ${pathToString(parts)}: {}`);
    return acc;
  }

  for (const key of keys) {
    collectNoteLines(node[key], appendPath(parts, key), acc);
  }

  return acc;
}

function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function looksLikeRenderableSessionLine(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }

  const label = firstDefined(node, [
    "exercise_name",
    "exercise",
    "name",
    "title",
    "label",
    "movement",
    "exercise_id",
    "id"
  ]);

  const metricsPresent = [
    "sets",
    "reps",
    "load",
    "load_kg",
    "weight",
    "weight_kg",
    "intensity",
    "rpe",
    "seconds",
    "duration_seconds",
    "distance_m"
  ].some((key) => node[key] !== undefined && node[key] !== null && node[key] !== "");

  return label !== undefined && metricsPresent;
}

function renderSessionLine(node, parts, index) {
  const label = safeString(
    firstDefined(node, [
      "exercise_name",
      "exercise",
      "name",
      "title",
      "label",
      "movement",
      "exercise_id",
      "id"
    ]),
    "unknown"
  );

  const metrics = [];
  const orderedMetricKeys = [
    ["sets", "sets"],
    ["reps", "reps"],
    ["load", "load"],
    ["load_kg", "load_kg"],
    ["weight", "weight"],
    ["weight_kg", "weight_kg"],
    ["intensity", "intensity"],
    ["rpe", "rpe"],
    ["seconds", "seconds"],
    ["duration_seconds", "duration_seconds"],
    ["distance_m", "distance_m"]
  ];

  for (const [key, labelKey] of orderedMetricKeys) {
    if (node[key] !== undefined && node[key] !== null && node[key] !== "") {
      metrics.push(`${labelKey}=${safeString(node[key])}`);
    }
  }

  const pathLabel = pathToString(parts);
  return `${index + 1}. ${label} — ${metrics.join(" | ")} (${pathLabel})`;
}

function collectSessionRenderableLines(node, parts = ["session"], acc = []) {
  if (node === undefined || node === null) {
    return acc;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => collectSessionRenderableLines(item, appendPath(parts, index), acc));
    return acc;
  }

  if (typeof node !== "object") {
    return acc;
  }

  if (looksLikeRenderableSessionLine(node)) {
    acc.push(renderSessionLine(node, parts, acc.length));
  }

  for (const key of Object.keys(node).sort()) {
    collectSessionRenderableLines(node[key], appendPath(parts, key), acc);
  }

  return acc;
}

function collectSessionLeafLines(node, parts = ["session"], acc = []) {
  if (node === undefined) {
    return acc;
  }

  if (isScalar(node)) {
    acc.push(`- ${pathToString(parts)}: ${safeString(node)}`);
    return acc;
  }

  if (Array.isArray(node)) {
    if (node.length === 0) {
      acc.push(`- ${pathToString(parts)}: []`);
      return acc;
    }
    node.forEach((item, index) => collectSessionLeafLines(item, appendPath(parts, index), acc));
    return acc;
  }

  const keys = Object.keys(node).sort();
  if (keys.length === 0) {
    acc.push(`- ${pathToString(parts)}: {}`);
    return acc;
  }

  for (const key of keys) {
    collectSessionLeafLines(node[key], appendPath(parts, key), acc);
  }

  return acc;
}

function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    usage();
    process.exit(1);
  }

  let rawStdout;
  try {
    rawStdout = execFileSync(
      process.execPath,
      ["dist/src/run_pipeline_cli.js", "--in", inputFile],
      { encoding: "utf8" }
    );
  } catch (error) {
    console.error("SESSION PREVIEW ERROR: pipeline CLI execution failed");
    if (error.stdout) {
      console.error(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawStdout);
  } catch {
    console.error("SESSION PREVIEW ERROR: pipeline CLI did not return valid JSON");
    console.error(rawStdout);
    process.exit(1);
  }

  printHeader("SESSION PREVIEW");

  const ok = parsed?.ok !== false;
  console.log(`Status: ${ok ? "OK" : "FAILED"}`);

  if (!ok) {
    console.log(`Failure token: ${safeString(parsed?.failure_token, "unknown")}`);
    if (parsed?.message) {
      console.log(`Message: ${parsed.message}`);
    }
    process.exit(0);
  }

  const result = parsed?.result ?? parsed;

  const noteLines = collectNoteLines(result?.notes);
  if (noteLines.length > 0) {
    printHeader("NOTES");
    for (const line of noteLines) {
      console.log(line);
    }
  }

  printHeader("SESSION");
  if (result?.session === undefined) {
    console.log("(session missing)");
  } else {
    const renderableLines = collectSessionRenderableLines(result.session);
    if (renderableLines.length > 0) {
      for (const line of renderableLines) {
        console.log(line);
      }
    } else {
      const fallbackLines = collectSessionLeafLines(result.session);
      if (fallbackLines.length === 0) {
        console.log("(session empty)");
      } else {
        for (const line of fallbackLines.slice(0, 80)) {
          console.log(line);
        }
        if (fallbackLines.length > 80) {
          console.log(`... (${fallbackLines.length - 80} more session lines)`);
        }
      }
    }
  }

  printHeader("RAW RESULT KEYS");
  console.log(Object.keys(result).sort().join(", "));
}

main();
