import assert from "node:assert/strict";

/**
 * stableStringify:
 * - deterministic key order
 * - shared refs are serialized normally (NOT "[Circular]")
 * - only true cycles in the current recursion path become "[Circular]"
 */
function stableStringify(value) {
  const normalize = (v, stack) => {
    if (v === null || typeof v !== "object") return v;

    // Only treat objects as circular if they appear in the *current path*
    if (stack.has(v)) return "[Circular]";

    stack.add(v);
    try {
      if (Array.isArray(v)) {
        return v.map((x) => normalize(x, stack));
      }

      const out = {};
      for (const k of Object.keys(v).sort()) {
        out[k] = normalize(v[k], stack);
      }
      return out;
    } finally {
      // IMPORTANT: remove on unwind so shared refs are not treated as cycles
      stack.delete(v);
    }
  };

  const normalized = normalize(value, new WeakSet());
  return JSON.stringify(normalized, null, 2) + "\n";
}

function test_shared_refs_not_circular() {
  const shared = { x: 1 };
  const obj = { a: shared, b: shared };

  const s = stableStringify(obj);

  assert(!s.includes("[Circular]"), "shared refs should not be labeled circular");
  assert(s.includes('"a": {\n    "x": 1\n  }'), "expected obj.a serialized object");
  assert(s.includes('"b": {\n    "x": 1\n  }'), "expected obj.b serialized object");
}

function test_true_cycle_is_circular() {
  const a = { x: 1 };
  a.self = a;

  const s = stableStringify(a);

  assert(s.includes('"self": "[Circular]"'), "true cycle should be labeled circular");
}

test_shared_refs_not_circular();
test_true_cycle_is_circular();

console.log("PASS test/ci_stable_stringify.test.mjs");
