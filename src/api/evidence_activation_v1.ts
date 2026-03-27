export type ReplayAcceptanceLike = {
  accepted: boolean;
  replay_hash: string;
  accepted_at: string;
  scope: string;
};

export type EvidenceEnvelopeV1 = {
  version: "v1";
  replay_hash: string;
  accepted_at: string;
  scope: string;
  evidence_status: "active";
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function normalizeReplayAcceptance(input: unknown): ReplayAcceptanceLike | null {
  if (!isPlainObject(input)) return null;
  if (input.accepted !== true) return null;
  if (!isNonEmptyString(input.replay_hash)) return null;
  if (!isNonEmptyString(input.accepted_at)) return null;
  if (!isNonEmptyString(input.scope)) return null;

  return {
    accepted: true,
    replay_hash: input.replay_hash,
    accepted_at: input.accepted_at,
    scope: input.scope
  };
}

export function buildEvidenceEnvelopeV1(source: {
  replay_acceptance?: unknown;
}): EvidenceEnvelopeV1 | null {
  const acceptance = normalizeReplayAcceptance(source?.replay_acceptance);
  if (!acceptance) return null;

  return {
    version: "v1",
    replay_hash: acceptance.replay_hash,
    accepted_at: acceptance.accepted_at,
    scope: acceptance.scope,
    evidence_status: "active"
  };
}
