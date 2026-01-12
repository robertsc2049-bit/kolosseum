import { phase1Validate } from "./phases/phase1.js";
import { phase2CanonicaliseAndHash } from "./phases/phase2.js";
export function runEngine(input) {
    const p1 = phase1Validate(input);
    if (!p1.ok)
        return { ok: false, failure_token: p1.failure_token, details: p1.details };
    const p2 = phase2CanonicaliseAndHash(p1.canonical_input);
    return {
        ok: true,
        phase2_hash: p2.canonical_input_hash,
        phase2_canonical_json: new TextDecoder().decode(p2.canonical_input_json)
    };
}
