import { runEngine } from "../../engine/src/index.js";
import { phase5ApplySubstitutionAndAdjustment } from "../../engine/src/phases/phase5.js";

function banner(s: string) {
  process.stdout.write(`\n=== ${s} ===\n`);
}

function main() {
  banner("ENGINE DEMO");

  const input = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "powerlifting",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none",
    constraints: {
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  };

  const out = runEngine(input);
  console.log(JSON.stringify(out, null, 2));

  banner("PHASE5 DEMO");

  const demoProgram = {
    exercises: [{ exercise_id: "bench_press" }, { exercise_id: "dumbbell_bench_press" }],
    target_exercise_id: "bench_press"
  };

  const p5 = phase5ApplySubstitutionAndAdjustment(demoProgram as any, input as any);
  console.log(JSON.stringify(p5, null, 2));
}

main();
