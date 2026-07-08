const refs = process.argv.slice(2);

for (const ref of refs) {
  if (!ref.startsWith("ci/guards/") || !ref.endsWith(".mjs")) {
    console.error("guard_reference_anchor: invalid guard reference: " + ref);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode !== 1) {
  console.log("guard_reference_anchor: referenced " + refs.length + " guard file(s).");
}
