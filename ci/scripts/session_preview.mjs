import { execFileSync } from "node:child_process";

function usage() {
  console.log("usage: npm run session:preview -- <fixture.json>");
  console.log("example: npm run session:preview -- test/fixtures/phase1_to_phase6.valid.general_strength.individual.json");
}

function printHeader(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

function safeString(value, fallback = "?") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function renderExerciseLike(item, index) {
  const name =
    item.exercise_name ??
    item.name ??
    item.exercise_id ??
    item.id ??
    "unknown";

  const sets =
    item.sets ??
    item.prescribed_sets ??
    item.target_sets ??
    "?";

  const reps =
    item.reps ??
    item.prescribed_reps ??
    item.target_reps ??
    "?";

  const load =
    item.load ??
    item.load_kg ??
    item.weight ??
    item.weight_kg ??
    item.intensity ??
    item.percent_1rm ??
    "?";

  return `${index + 1}. ${name} — ${safeString(sets)}x${safeString(reps)} @ ${safeString(load)}`;
}

function collectVisibleSessionLines(result) {
  const session = result?.session;
  if (!session || typeof session !== "object") {
    return [];
  }

  const lines = [];

  if (Array.isArray(session.blocks)) {
    session.blocks.forEach((block, blockIndex) => {
      const blockName = block?.name ?? `Block ${blockIndex + 1}`;
      lines.push(`Block ${blockIndex + 1}: ${blockName}`);

      const candidates = []
        .concat(Array.isArray(block?.exercises) ? block.exercises : [])
        .concat(Array.isArray(block?.planned_items) ? block.planned_items : []);

      if (candidates.length === 0) {
        lines.push("(no visible exercises)");
      } else {
        candidates.forEach((item, itemIndex) => {
          lines.push(renderExerciseLike(item, itemIndex));
        });
      }
    });
  }

  if (lines.length === 0 && Array.isArray(session.planned_items)) {
    session.planned_items.forEach((item, index) => {
      lines.push(renderExerciseLike(item, index));
    });
  }

  return lines;
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

  if (Array.isArray(result?.notes) && result.notes.length > 0) {
    printHeader("NOTES");
    result.notes.forEach((note, index) => {
      console.log(`${index + 1}. ${safeString(note)}`);
    });
  }

  const sessionLines = collectVisibleSessionLines(result);
  printHeader("SESSION");
  if (sessionLines.length === 0) {
    console.log("(no visible session lines found)");
  } else {
    sessionLines.forEach(line => console.log(line));
  }

  if (result?.flags) {
    printHeader("FLAGS");
    console.log(JSON.stringify(result.flags, null, 2));
  }

  printHeader("RAW RESULT KEYS");
  console.log(Object.keys(result).sort().join(", "));
}

main();
