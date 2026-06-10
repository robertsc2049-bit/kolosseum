import fs from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/operator/S30_PILOT_LAUNCH_CONTROL_CHECKLIST.md";

describe("S30 pilot launch control checklist", () => {
  const doc = fs.readFileSync(docPath, "utf8");

  it("contains required proof sections", () => {
    expect(doc).toContain("## 1. Start / Hold Checklist");
    expect(doc).toContain("## 2. Green Proof Check");
    expect(doc).toContain("## 3. Pilot Cap Check");
    expect(doc).toContain("## 4. Rollback Triggers");
    expect(doc).toContain("## 5. Launch Decision");
  });

  it("keeps launch decisions closed", () => {
    expect(doc).toContain("### GO");
    expect(doc).toContain("### HOLD");
    expect(doc).toContain("### STOP");
  });

  it("keeps v0 exclusions explicit", () => {
    expect(doc).toContain("No analytics.");
    expect(doc).toContain("No advisory language.");
    expect(doc).toContain("No org/team/unit runtime.");
    expect(doc).toContain("No evidence/export claims.");
  });

  it("contains required blocked reasons", () => {
    expect(doc).toContain("phase1_missing");
    expect(doc).toContain("compile_failed");
    expect(doc).toContain("pilot_cap_breached");
    expect(doc).toContain("rollback_trigger_fired");
  });
});