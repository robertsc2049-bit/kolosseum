const commands = process.argv.slice(2);

for (const command of commands) {
  if (typeof command !== "string" || command.trim().length === 0) {
    console.error("command_reference_anchor: empty command reference.");
    process.exitCode = 1;
    break;
  }

  if (!command.startsWith("node ")) {
    console.error("command_reference_anchor: command reference must begin with node: " + command);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode !== 1) {
  console.log("command_reference_anchor: referenced " + commands.length + " command(s).");
}