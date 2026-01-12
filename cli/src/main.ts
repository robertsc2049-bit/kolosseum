import fs from "node:fs";
import { runEngine } from "../../engine/src/index.js";

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function readJson(path: string): unknown {
  const raw = stripBom(fs.readFileSync(path, "utf8"));
  return JSON.parse(raw);
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("usage: npm run run:cli -- <input.json> [--demo-substitution]");
  process.exit(2);
}

const inputPath = args[0];
const demoSub = args.includes("--demo-substitution");

const input = readJson(inputPath);

// Run normal engine
const res: any = runEngine(input);

// Optional demo: execute Phase 5 substitution using a demo program payload.
// This does NOT touch Phase 1 schema and is CLI-only.
if (demoSub && res?.ok === true) {
  const demoProgram = {
    exercises: [
      {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        stimulus_intent: "strength",
        rom: "full",
        stability: "stable",
        equipment: ["barbell", "bench", "rack"],
        equipment_tier: "TIER_1",
        joint_stress_tags: ["shoulder_high"]
      },
      {
        exercise_id: "dumbbell_bench_press",
        pattern: "horizontal_push",
        stimulus_intent: "strength",
        rom: "full",
        stability: "semi_stable",
        equipment: ["dumbbells", "bench"],
        equipment_tier: "TIER_2",
        joint_stress_tags: ["shoulder_medium"]
      }
    ],
    target_exercise_id: "bench_press",
    constraints: { avoid_joint_stress_tags: ["shoulder_high"] }
  };

  // Import compiled Phase 5 from dist at runtime (path is correct from dist/cli/src/main.js)
  const mod = await import("../../engine/src/phases/phase5.js");
  const p5 = mod.phase5ApplySubstitutionAndAdjustment(demoProgram, {});

  res.phase4 = {
    program_id: "PROGRAM_DEMO_SUB",
    version: "1.0.0",
    blocks: [],
    notes: ["CLI_DEMO: injected substitutable program payload for Phase 5 demo"]
  };

  res.demo_program_for_phase5 = demoProgram;

  if (p5 && p5.ok === true) {
    res.phase5 = {
      adjustments: p5.adjustments,
      notes: p5.notes
    };
  } else {
    res.phase5 = {
      adjustments: [],
      notes: ["CLI_DEMO: Phase 5 returned failure", String(p5?.failure_token ?? "unknown")]
    };
  }

  res.note = "CLI_DEMO_ONLY: Phase 5 executed against injected demo program payload.";
}

console.log(JSON.stringify(res, null, 2));
