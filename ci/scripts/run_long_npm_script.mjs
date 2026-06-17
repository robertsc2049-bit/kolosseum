import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const packagePath = path.join(repoRoot, "package.json");
const scriptName = process.argv[2];

if (!scriptName) {
  console.error("run_long_npm_script: missing script name argument.");
  process.exitCode = 1;
} else if (!fs.existsSync(packagePath)) {
  console.error("run_long_npm_script: package.json not found.");
  process.exitCode = 1;
} else {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const script = pkg?.scripts?.[scriptName];

  if (typeof script !== "string" || script.trim().length === 0) {
    console.error(`run_long_npm_script: package script '${scriptName}' is missing or empty.`);
    process.exitCode = 1;
  } else {
    const commands = script
      .split(/\s+&&\s+/u)
      .map((item) => item.trim())
      .filter(Boolean);

    if (commands.length === 0) {
      console.error(`run_long_npm_script: package script '${scriptName}' produced no commands.`);
      process.exitCode = 1;
    } else {
      console.log(`run_long_npm_script: running ${commands.length} command(s) from ${scriptName}`);

      for (let index = 0; index < commands.length; index += 1) {
        const command = commands[index];
        console.log("");
        console.log(`run_long_npm_script: [${index + 1}/${commands.length}] ${command}`);

        const result = childProcess.spawnSync(command, {
          cwd: repoRoot,
          env: process.env,
          shell: true,
          stdio: "inherit"
        });

        const status = typeof result.status === "number" ? result.status : 1;

        if (status !== 0) {
          console.error(`run_long_npm_script: command failed with exit code ${status}`);
          process.exitCode = status;
          break;
        }
      }
    }
  }
}