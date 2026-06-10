// src/api/session_state_cache.ts
type CacheEntry = {
  expires_at_ms: number;
  payload_json: string; // store serialized JSON for immutability
};

export type SessionStateCache = {
  get: (session_id: string) => any | null;
  set: (session_id: string, payload: unknown, ttl_ms: number) => void;
  del: (session_id: string) => void;
  clear: () => void;
  stats: () => { size: number; hits: number; misses: number };
};

function nowMs(): number {
  return Date.now();
}

export function createSessionStateCache(opts?: { max_entries?: number }): SessionStateCache {
  const max = Number(opts?.max_entries ?? 10_000);
  const m = new Map<string, CacheEntry>();

  let hits = 0;
  let misses = 0;

  function sweepExpired(limit: number): number {
    const n = nowMs();
    let removed = 0;
    for (const [k, v] of m) {
      if (v.expires_at_ms <= n) {
        m.delete(k);
        removed += 1;
        if (removed >= limit) break;
      }
    }
    return removed;
  }

  function enforceMax(): void {
    if (m.size <= max) return;

    // First try clearing expired entries (cheap win)
    sweepExpired(Math.min(512, m.size));

    // Still too big? Hard-evict oldest-ish by iterating insertion order.
    while (m.size > max) {
      const firstKey = m.keys().next().value as string | undefined;
      if (!firstKey) break;
      m.delete(firstKey);
    }
  }

  function get(session_id: string) {
    const v = m.get(session_id);
    if (!v) {
      misses += 1;
      return null;
    }

    if (v.expires_at_ms <= nowMs()) {
      m.delete(session_id);
      misses += 1;
      return null;
    }

    hits += 1;

    // defensive parse; if corrupted, drop
    try {
      return JSON.parse(v.payload_json);
    } catch {
      m.delete(session_id);
      misses += 1;
      return null;
    }
  }

  function set(session_id: string, payload: unknown, ttl_ms: number) {
    const ttl = Number(ttl_ms);
    if (!Number.isFinite(ttl) || ttl <= 0) return;

    // do not cache null/undefined
    if (payload === null || typeof payload === "undefined") return;

    // serialize once
    let payload_json: string;
    try {
      payload_json = JSON.stringify(payload);
    } catch {
      return; // non-serializable => don't cache
    }

    m.set(session_id, {
      expires_at_ms: nowMs() + ttl,
      payload_json
    });

    enforceMax();
  }

  function del(session_id: string) {
    m.delete(session_id);
  }

  function clear() {
    m.clear();
    hits = 0;
    misses = 0;
  }

  function stats() {
    // opportunistic cleanup so size reflects reality
    sweepExpired(Math.min(512, m.size));
    return { size: m.size, hits, misses };
  }

  return { get, set, del, clear, stats };
}

// Default cache instance used by sessions.handlers.ts
export const sessionStateCache = createSessionStateCache({ max_entries: 10_000 });