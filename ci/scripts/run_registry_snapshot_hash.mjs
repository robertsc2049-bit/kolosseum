import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function candidateRegistryFiles() {
  return [
    "registries/registry_bundle.json",
    "registries/activity/activity.registry.json",
    "registries/sport_subdivision/sport_subdivision.registry.json",
    "registries/physical_requirements/physical_requirements.registry.json",
    "registries/sport_metric/sport_metric.registry.json",
    "registries/metric_exercise_link/metric_exercise_link.registry.json",
    "registries/sport_role/sport_role.registry.json",
    "registries/movement/movement.registry.json",
    "registries/exercise/exercise.registry.json",
    "registries/exercise_token/exercise_token.registry.json",
    "registries/exercise_alias/exercise_alias.registry.json",
    "registries/exercise_variant_applicability/exercise_variant_applicability.registry.json",
    "registries/equipment_environment/equipment_environment.registry.json",
    "registries/biomechanics/biomechanics.registry.json",
    "registries/training_structure/training_structure.registry.json",
    "registries/structure_governance/structure_governance.registry.json",
    "registries/sport_domain_structure_profiles/sport_domain_structure_profiles.registry.json",
    "registries/explicit_override_accountability/explicit_override_accountability.registry.json",
    "registries/sport_program_profile/sport_program_profile.registry.json",
    "registries/exercise_sport_applicability/exercise_sport_applicability.registry.json",
    "registries/event_metric/event_metric.registry.json"
  ];
}

function existingRegistryFiles() {
  const files = candidateRegistryFiles()
    .map((rel) => toPosix(rel))
    .filter((rel) => fs.existsSync(path.resolve(ROOT, rel)))
    .sort();

  if (files.length === 0) {
    throw new Error("No registry files found from canonical registry surface");
  }

  return files;
}

function main() {
  let files;
  try {
    files = existingRegistryFiles();
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }

  const entries = files.map((relPath) => {
    const full = path.resolve(ROOT, relPath);
    const bytes = fs.readFileSync(full);
    return {
      file: relPath,
      sha256: sha256(bytes)
    };
  });

  const manifestText = entries
    .map((entry) => `${entry.file}:${entry.sha256}`)
    .join("\n");

  const output = {
    ok: true,
    registry_count: entries.length,
    bundle_hash: sha256(Buffer.from(manifestText, "utf8")),
    entries
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

main();