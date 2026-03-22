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

function formatIntensity(value) {
  if (value === undefined || value === null) {
    return "?";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  if (typeof value === "object") {
    if (value.type === "percent_1rm" && value.value !== undefined) {
      return `${value.value}% 1RM`;
    }
    if (value.type === "rpe" && value.value !== undefined) {
      return `RPE ${value.value}`;
    }
    if (value.type && value.value !== undefined) {
      return `${value.type}:${value.value}`;
    }
  }

  return JSON.stringify(value);
}

function collectNotes(node, acc = []) {
  if (!node || typeof node !== "object") {
    return acc;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectNotes(item, acc);
    }
    return acc;
  }

  if (Array.isArray(node.notes)) {
    for (const item of node.notes) {
      acc.push(item);
    }
  }

  for (const value of Object.values(node)) {
    collectNotes(value, acc);
  }

  return acc;
}

function collectExercisesFromSession(session) {
  if (!session || typeof session !== "object") {
    return [];
  }

  if (Array.isArray(session.exercises)) {
    return session.exercises.map((exercise, index) => ({
      exercise,
      path: `session.exercises[${index}]`
    }));
  }

  if (Array.isArray(session.blocks)) {
    const acc = [];
    session.blocks.forEach((block, blockIndex) => {
      if (Array.isArray(block?.exercises)) {
        block.exercises.forEach((exercise, exerciseIndex) => {
          acc.push({
            exercise,
            path: `session.blocks[${blockIndex}].exercises[${exerciseIndex}]`
          });
        });
      }
    });
    return acc;
  }

  return [];
}

function renderExerciseLine(exercise, index, pathLabel) {
  const name =
    exercise.exercise_name ??
    exercise.name ??
    exercise.exercise_id ??
    exercise.id ??
    "unknown";

  const sets = safeString(exercise.sets);
  const reps = safeString(exercise.reps);
  const intensity = formatIntensity(
    exercise.intensity ??
    exercise.load ??
    exercise.load_kg ??
    exercise.weight ??
    exercise.weight_kg
  );

  return `${index + 1}. ${name} — sets=${sets} | reps=${reps} | intensity=${intensity} (${pathLabel})`;
}

function sumWorkSets(exercises) {
  return exercises.reduce((sum, item) => {
    const raw = item?.exercise?.sets;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return sum + parsed;
    }
    return sum;
  }, 0);
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
  const notes = collectNotes(result);
  const exercises = collectExercisesFromSession(result?.session);

  printHeader("SUMMARY");
  console.log(`Exercise count: ${exercises.length}`);
  console.log(`Total work sets: ${sumWorkSets(exercises)}`);

  printHeader("NOTES");
  if (notes.length === 0) {
    console.log("(none)");
  } else {
    notes.forEach((note, index) => {
      console.log(`- notes[${index}]: ${safeString(note)}`);
    });
  }

  printHeader("SESSION");
  if (exercises.length === 0) {
    console.log("(no visible session lines found)");
  } else {
    exercises.forEach(({ exercise, path }, index) => {
      console.log(renderExerciseLine(exercise, index, path));
    });
  }

  printHeader("RAW RESULT KEYS");
  console.log(Object.keys(result).sort().join(", "));
}

main();
