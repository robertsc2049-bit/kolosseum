import { describe, expect, it } from "vitest";
import {
  FirstCompileGateInput,
  canStartFirstCompile,
  projectEngineCompileAdmissionInput,
} from "./firstCompileGate";

function validIndividualInput(): FirstCompileGateInput {
  return {
    paymentAccess: "active",
    workspace: "active",
    coachAccount: "not_required",
    athleteAccount: "active",
    coachAthleteLink: "not_required",
    scopeLock: "locked",
    phase1Declaration: {
      status: "accepted",
      schemaVersion: "kolosseum.master.phase1.input.schema.v1_0_1",
      schemaVersionPinned: true,
      declarationVersionPinned: true,
      engineCompatibility: "EB2-1.0.0",
      executionScope: "individual",
      activityId: "powerlifting",
    },
    activity: {
      activityId: "powerlifting",
      registryResolved: true,
    },
    engineCompatibility: {
      engineCompatibility: "EB2-1.0.0",
      enumBundleVersion: "EB2-1.0.0",
      registryBundleVersion: "EB2-1.0.0",
    },
    compileStatus: "not_started",
  };
}

function validCoachManagedInput(): FirstCompileGateInput {
  const base = validIndividualInput();

  return {
    ...base,
    coachAccount: "active",
    coachAthleteLink: "accepted",
    phase1Declaration: {
      ...base.phase1Declaration,
      executionScope: "coach_managed",
      activityId: "rugby_union",
    },
    activity: {
      activityId: "rugby_union",
      registryResolved: true,
    },
  };
}

describe("S31 canStartFirstCompile", () => {
  it("allows a valid individual first compile", () => {
    expect(canStartFirstCompile(validIndividualInput())).toEqual({
      allowed: true,
      blockedReason: null,
    });
  });

  it("allows a valid coach-managed first compile", () => {
    expect(canStartFirstCompile(validCoachManagedInput())).toEqual({
      allowed: true,
      blockedReason: null,
    });
  });

  it.each(["missing", "inactive", "suspended", "expired", "unknown"] as const)(
    "blocks %s payment/access",
    (paymentAccess) => {
      expect(
        canStartFirstCompile({
          ...validIndividualInput(),
          paymentAccess,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "payment_missing",
      });
    },
  );

  it.each(["missing", "inactive", "unknown"] as const)(
    "blocks %s workspace",
    (workspace) => {
      expect(
        canStartFirstCompile({
          ...validIndividualInput(),
          workspace,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "workspace_missing",
      });
    },
  );

  it("blocks missing Phase 1 declaration", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          status: "missing",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "phase1_missing",
    });
  });

  it("blocks draft Phase 1 declaration as missing", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          status: "draft",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "phase1_missing",
    });
  });

  it("blocks invalid Phase 1 declaration", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          status: "invalid",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "phase1_invalid",
    });
  });

  it("blocks unknown Phase 1 declaration status", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          status: "unknown",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "phase1_invalid",
    });
  });

  it("blocks refused Phase 1 declaration", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          status: "refused",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "phase1_refused",
    });
  });

  it("blocks unpinned Phase 1 schema version", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          schemaVersionPinned: false,
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it("blocks unpinned Phase 1 declaration version", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          declarationVersionPinned: false,
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it("blocks Phase 1 schema version mismatch", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          schemaVersion: "kolosseum.master.phase1.input.schema.latest",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it("blocks Phase 1 engine compatibility mismatch", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          engineCompatibility: "EB2",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it("blocks unsupported execution scope", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          executionScope: "org_managed",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "unsupported_scope",
    });
  });

  it("blocks unsupported activity in Phase 1 declaration", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        phase1Declaration: {
          ...validIndividualInput().phase1Declaration,
          activityId: "football_soccer",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "unsupported_activity",
    });
  });

  it("blocks unsupported activity in activity admission", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        activity: {
          activityId: "football_soccer",
          registryResolved: true,
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "unsupported_activity",
    });
  });

  it("blocks unresolved activity registry admission", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        activity: {
          activityId: "powerlifting",
          registryResolved: false,
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "unsupported_activity",
    });
  });

  it("blocks activity mismatch between Phase 1 and activity admission", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        activity: {
          activityId: "rugby_union",
          registryResolved: true,
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "unsupported_activity",
    });
  });

  it("blocks engine compatibility mismatch", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        engineCompatibility: {
          ...validIndividualInput().engineCompatibility,
          engineCompatibility: "latest",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it("blocks enum bundle mismatch", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        engineCompatibility: {
          ...validIndividualInput().engineCompatibility,
          enumBundleVersion: "EB2",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it("blocks registry bundle mismatch", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        engineCompatibility: {
          ...validIndividualInput().engineCompatibility,
          registryBundleVersion: "EB2",
        },
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "version_mismatch",
    });
  });

  it.each(["missing", "inactive", "suspended", "unknown"] as const)(
    "blocks %s athlete account",
    (athleteAccount) => {
      expect(
        canStartFirstCompile({
          ...validIndividualInput(),
          athleteAccount,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "athlete_missing",
      });
    },
  );

  it.each(["missing", "inactive", "suspended", "unknown", "not_required"] as const)(
    "blocks %s coach account for coach-managed execution",
    (coachAccount) => {
      expect(
        canStartFirstCompile({
          ...validCoachManagedInput(),
          coachAccount,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "coach_missing",
      });
    },
  );

  it.each(["invited", "revoked", "expired", "rejected", "missing", "unknown", "not_required"] as const)(
    "blocks %s coach-athlete link for coach-managed execution",
    (coachAthleteLink) => {
      expect(
        canStartFirstCompile({
          ...validCoachManagedInput(),
          coachAthleteLink,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "link_not_accepted",
      });
    },
  );

  it("does not require coach account for individual execution", () => {
    expect(canStartFirstCompile(validIndividualInput())).toEqual({
      allowed: true,
      blockedReason: null,
    });
  });

  it("does not require coach-athlete link for individual execution", () => {
    expect(canStartFirstCompile(validIndividualInput())).toEqual({
      allowed: true,
      blockedReason: null,
    });
  });

  it("blocks coach account metadata on individual execution", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        coachAccount: "active",
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "unsupported_scope",
    });
  });

  it("blocks coach-athlete link metadata on individual execution", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        coachAthleteLink: "accepted",
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "link_not_accepted",
    });
  });

  it.each(["unlocked", "missing", "unknown"] as const)(
    "blocks %s scope lock",
    (scopeLock) => {
      expect(
        canStartFirstCompile({
          ...validIndividualInput(),
          scopeLock,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "scope_not_locked",
      });
    },
  );

  it.each(["failed", "running", "succeeded", "unknown"] as const)(
    "blocks %s compile status",
    (compileStatus) => {
      expect(
        canStartFirstCompile({
          ...validIndividualInput(),
          compileStatus,
        }),
      ).toEqual({
        allowed: false,
        blockedReason: "compile_failed",
      });
    },
  );

  it("uses fixed first-failure evaluation order", () => {
    expect(
      canStartFirstCompile({
        ...validIndividualInput(),
        paymentAccess: "missing",
        workspace: "missing",
        athleteAccount: "missing",
        scopeLock: "missing",
        compileStatus: "failed",
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "payment_missing",
    });
  });

  it("does not mutate input", () => {
    const input = validCoachManagedInput();
    const before = JSON.stringify(input);

    canStartFirstCompile(input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it("keeps payment state out of engine compile projection", () => {
    const input = validIndividualInput();

    const projection = projectEngineCompileAdmissionInput(input);

    expect(JSON.stringify(projection)).not.toContain("payment");
    expect(JSON.stringify(projection)).not.toContain("paymentAccess");
    expect(projection).toEqual({
      phase1Declaration: {
        schemaVersion: "kolosseum.master.phase1.input.schema.v1_0_1",
        engineCompatibility: "EB2-1.0.0",
        executionScope: "individual",
        activityId: "powerlifting",
      },
    });
  });

  it("keeps coach platform metadata out of engine compile projection", () => {
    const input = validCoachManagedInput();

    const projection = projectEngineCompileAdmissionInput(input);
    const serializedProjection = JSON.stringify(projection);

    expect(serializedProjection).not.toContain("coachAccount");
    expect(serializedProjection).not.toContain("coachAthleteLink");
    expect(serializedProjection).not.toContain("paymentAccess");
    expect(serializedProjection).not.toContain("workspace");
    expect(projection).toEqual({
      phase1Declaration: {
        schemaVersion: "kolosseum.master.phase1.input.schema.v1_0_1",
        engineCompatibility: "EB2-1.0.0",
        executionScope: "coach_managed",
        activityId: "rugby_union",
      },
    });
  });

  it("does not allow projection while blocked", () => {
    expect(() =>
      projectEngineCompileAdmissionInput({
        ...validIndividualInput(),
        paymentAccess: "missing",
      }),
    ).toThrow("Cannot project engine compile input while blocked: payment_missing");
  });

  it("coach metadata never changes projected engine input when link status remains accepted", () => {
    const coachManagedA = validCoachManagedInput();
    const coachManagedB = {
      ...validCoachManagedInput(),
      coachAccount: "active" as const,
      coachAthleteLink: "accepted" as const,
    };

    expect(projectEngineCompileAdmissionInput(coachManagedA)).toEqual(
      projectEngineCompileAdmissionInput(coachManagedB),
    );
  });

  it("supports general_strength as a valid v0 activity", () => {
    const input: FirstCompileGateInput = {
      ...validIndividualInput(),
      phase1Declaration: {
        ...validIndividualInput().phase1Declaration,
        activityId: "general_strength",
      },
      activity: {
        activityId: "general_strength",
        registryResolved: true,
      },
    };

    expect(canStartFirstCompile(input)).toEqual({
      allowed: true,
      blockedReason: null,
    });
  });
});