import crypto from "node:crypto";
function sortKeysDeep(value) {
    if (Array.isArray(value))
        return value.map(sortKeysDeep);
    if (value && typeof value === "object") {
        const obj = value;
        const out = {};
        for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
            out[key] = sortKeysDeep(obj[key]);
        }
        return out;
    }
    return value;
}
export function phase2CanonicaliseAndHash(canonicalInput) {
    const sorted = sortKeysDeep(canonicalInput);
    const json = JSON.stringify(sorted);
    const bytes = new TextEncoder().encode(json);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    return { canonical_input_json: bytes, canonical_input_hash: hash };
}
