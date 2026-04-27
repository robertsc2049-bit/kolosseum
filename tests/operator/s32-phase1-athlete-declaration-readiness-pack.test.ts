import fs from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/operator/S32_PHASE1_ATHLETE_DECLARATION_READINESS_PACK.md";

describe("S32 Phase 1 athlete declaration readiness pack", () => {
  const doc = fs.readFileSync(docPath, "utf8");

  it("defines declaration status model", () => {
    expect(doc).toContain("## NOT_STARTED");
    expect(doc).toContain("## IN_PROGRESS");
    expect(doc).toContain("## INVALID");
    expect(doc).toContain("## ACCEPTED");
    expect(doc).toContain("## NOT_ACCEPTED");
  });

  it("lists required field groups", () => {
    expect(doc).toContain("## Legal Prerequisites");
    expect(doc).toContain("## Version Pins");
    expect(doc).toContain("## Actor and Scope");
    expect(doc).toContain("## Activity");
    expect(doc).toContain("## Environment");
    expect(doc).toContain("## Presentation Flags");
  });

  it("keeps blocked reasons closed", () => {
    expect(doc).toContain("phase1_not_started");
    expect(doc).toContain("phase1_incomplete");
    expect(doc).toContain("phase1_invalid");
    expect(doc).toContain("phase1_not_accepted");
    expect(doc).toContain("phase1_revoked");
  });

  it("enforces accepted/not accepted gate", () => {
    expect(doc).toContain("## Accepted");
    expect(doc).toContain("## Not Accepted");
    expect(doc).toContain("compile may proceed");
    expect(doc).toContain("compile must not proceed");
  });

  it("blocks coach override and org paths", () => {
    expect(doc).toContain("Coach must not:");
    expect(doc).toContain("complete Phase 1 for the athlete");
    expect(doc).toContain("override blocked state");
    expect(doc).toContain("no org/team/unit path exists");
  });
});