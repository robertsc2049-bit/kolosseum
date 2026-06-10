import fs from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/operator/S31_PILOT_USER_PROVISIONING_PACK.md";

describe("S31 pilot user provisioning pack", () => {
  const doc = fs.readFileSync(docPath, "utf8");

  it("contains provisioning sequence", () => {
    expect(doc).toContain("Step 1 — Create Coach Account");
    expect(doc).toContain("Step 2 — Create Athlete Account");
    expect(doc).toContain("Step 3 — Initiate Coach→Athlete Link");
    expect(doc).toContain("Step 4 — Athlete Accepts Link");
  });

  it("enforces accepted link invariant", () => {
    expect(doc).toContain("link state = accepted");
    expect(doc).toContain("No link = no coach-managed execution.");
  });

  it("blocks org/team paths", () => {
    expect(doc).toContain("org creation");
    expect(doc).toContain("team creation");
    expect(doc).toContain("unit creation");
  });

  it("defines blocked reasons", () => {
    expect(doc).toContain("coach_account_invalid");
    expect(doc).toContain("link_not_accepted");
    expect(doc).toContain("non_v0_path_detected");
  });
});