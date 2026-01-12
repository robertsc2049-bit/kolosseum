import { phase1Validate } from "./phases/phase1.js";
import { phase2CanonicaliseAndHash } from "./phases/phase2.js";
import { phase3ResolveConstraints } from "./phases/phase3.js";

export type EngineResult =
  | {
      ok: true;
      phase2_hash: string;
      phase2_canonical_json: string;
      phase3: { constraints_resolved: true; notes: string[]; registry_version: string };
    }
  | { ok: false; failure_token: string; details?: unknown };

export function runEngine(input: unknown): EngineResult {
  const p1 = phase1Validate(input);
  if (!p1.ok) return { ok: false, failure_token: p1.failure_token, details: p1.details };

  const p2 = phase2CanonicaliseAndHash(p1.canonical_input);

  const p3 = phase3ResolveConstraints(p1.canonical_input);
  if (!p3.ok) return { ok: false, failure_token: p3.failure_token, details: p3.details };

  return {
    ok: true,
    phase2_hash: p2.canonical_input_hash,
    phase2_canonical_json: new TextDecoder().decode(p2.canonical_input_json),
    phase3: {
      constraints_resolved: true,
      notes: p3.notes,
      registry_version: p3.registry_version
    }
  };
}
