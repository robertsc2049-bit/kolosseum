import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const manifestPath = path.join(repoRoot, "product", "ui", "function_manifest.json");
const reportPath = path.join(repoRoot, "docs", "product", "FULL_UI_GAP_REPORT.md");

function render(manifest) {
  const areas = manifest.product_areas ?? [];
  const functions = areas.flatMap((area) => area.functions ?? []);
  const states = ["implemented", "partial", "missing", "prohibited"];
  const lines = [
    "# Kolosseum Function-Complete UI Gap Report",
    "",
    "Source: FULL-UI-00 / GitHub issue #798",
    "",
    "This report is generated deterministically from `product/ui/function_manifest.json`.",
    "Counts are project-state facts. They are not product, coach, athlete, readiness or quality scores.",
    "",
    "## Overall function state",
    ""
  ];

  for (const state of states) {
    lines.push(`- ${state}: ${functions.filter((item) => item.state === state).length}`);
  }

  lines.push("", "## Product areas", "");

  for (const area of areas) {
    const counts = Object.fromEntries(
      states.map((state) => [
        state,
        (area.functions ?? []).filter((item) => item.state === state).length
      ])
    );

    lines.push(
      `### ${area.title}`,
      "",
      `Slice: ${area.slice_id}`,
      "",
      `Area state: ${area.state}`,
      "",
      `Implemented: ${counts.implemented} · Partial: ${counts.partial} · Missing: ${counts.missing} · Prohibited: ${counts.prohibited}`,
      ""
    );

    for (const state of states) {
      const entries = (area.functions ?? []).filter((item) => item.state === state);
      if (entries.length === 0) continue;
      lines.push(`#### ${state}`, "");
      for (const item of entries) {
        lines.push(`- \`${item.function_id}\` — ${item.label}`);
      }
      lines.push("");
    }
  }

  // "Persistent integration proof" is only a lawful requirement for
  // functions that are actually backed by a persisted server record.
  // navigation_cache (client-only route/UI state) and not_implemented
  // (missing) carry no server record to prove restart-survival for.
  const NON_PERSISTED = new Set(["navigation_cache", "not_implemented"]);
  const withoutIntegration = functions.filter(
    (item) =>
      item.state !== "missing" &&
      !NON_PERSISTED.has(item.persistence) &&
      !item.integration_test
  );

  lines.push("## Functions without persistent integration proof", "");
  if (withoutIntegration.length === 0) {
    lines.push("- None", "");
  }
  else {
    for (const item of withoutIntegration) {
      lines.push(`- \`${item.function_id}\` — ${item.label}`);
    }
    lines.push("");
  }

  lines.push("## Delivery sequence", "");
  for (const slice of manifest.delivery_slices ?? []) {
    lines.push(`- ${slice.slice_id}: ${slice.state}`);
  }

  lines.push("", "## Prohibited capabilities", "");
  for (const capability of manifest.prohibited_capabilities ?? []) {
    lines.push(
      `- \`${capability.capability_id}\` — ${capability.label}. Boundary: ${capability.governing_boundary}`
    );
  }

  return lines.join("\n").replace(/\s+$/u, "") + "\n";
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const expected = render(manifest);
const mode = process.argv[2] ?? "--check";

if (mode === "--write") {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, expected, "utf8");
  console.log("OK: FULL-UI gap report written");
}
else if (mode === "--check") {
  const actual = fs.existsSync(reportPath)
    ? fs.readFileSync(reportPath, "utf8").replace(/\r\n?/gu, "\n")
    : "";
  if (actual !== expected) {
    console.error("FULL_UI_GAP_REPORT_DRIFT");
    process.exitCode = 1;
  }
  else {
    console.log("OK: FULL-UI gap report is current");
  }
}
else {
  throw new Error("FULL_UI_GAP_REPORT_MODE_INVALID");
}
