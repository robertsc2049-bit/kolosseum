
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const copyPath = path.join(repoRoot, "ui/copy/history_counts.copy.json");

const forbiddenProductionPatterns = [
  /\btrend\b/i,
  /\btrends\b/i,
  /\bdashboard\b/i,
  /\bgraph\b/i,
  /\bperformance analysis\b/i,
  /\breadiness\b/i,
  /\branking\b/i,
  /\bscore\b/i,
  /\bcompliance\b/i,
  /\badherence\b/i,
  /\bimprovement\b/i,
  /\bprediction\b/i,
  /\brecommendation\b/i,
  /\bsafety\b/i,
  /\bmedical\b/i,
  /\boptimisation\b/i,
  /\boptimization\b/i
];

function assertNoForbiddenProductionCopy(value: unknown, pathParts: string[] = []): void {
  if (typeof value === "string") {
    for (const pattern of forbiddenProductionPatterns) {
      expect(value, `Forbidden production copy at ${pathParts.join(".")}: ${value}`).not.toMatch(pattern);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenProductionCopy(item, [...pathParts, String(index)]));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key === "ui_rules" || key === "allowed_response_fields") continue;
      assertNoForbiddenProductionCopy(nested, [...pathParts, key]);
    }
  }
}

describe("S40 history copy surface", () => {
  it("contains only registered neutral copy strings", () => {
    const copy = JSON.parse(fs.readFileSync(copyPath, "utf8"));

    expect(copy.schema_version).toBe("kolosseum.copy_surface.history_counts.v0.1");
    expect(copy.surface_id).toBe("history_counts_only");
    expect(copy.ui_rules.inline_copy_allowed).toBe(false);
    expect(copy.ui_rules.graphs_allowed).toBe(false);
    expect(copy.ui_rules.analytics_language_allowed).toBe(false);
    expect(copy.ui_rules.valenced_labels_allowed).toBe(false);
    expect(copy.ui_rules.coach_recommendation_prompts_allowed).toBe(false);

    assertNoForbiddenProductionCopy(copy.copy);
  });

  it("does not use blocked surface wording in allowed copy", () => {
    const copy = JSON.parse(fs.readFileSync(copyPath, "utf8"));
    const renderedCopy = Object.values(copy.copy).join("\n");

    expect(renderedCopy).not.toMatch(/\bgraph\b/i);
    expect(renderedCopy).not.toMatch(/\bdashboard\b/i);
    expect(renderedCopy).not.toMatch(/\btrend\b/i);
  });
});
