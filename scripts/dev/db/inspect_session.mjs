import process from "node:process";

function usage(msg = "") {
  if (msg) console.error(msg);
  console.error("");
  console.error("Usage:");
  console.error("  npm run db:inspect-session -- <session_id> [--pretty|--json] [--planned] [--events-limit N]");
  console.error("");
  console.error("Notes:");
  console.error("  - Requires DATABASE_URL (or libpq env vars) to connect.");
  console.error("  - Requires built dist pool (run: npm run build:fast) if dist/ is missing.");
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length === 0) usage("Missing <session_id>.");

const sid = args[0];
if (!sid || typeof sid !== "string") usage("Invalid <session_id>.");

const wantJson = args.includes("--json");
const wantPretty = args.includes("--pretty") || !wantJson;
const includePlanned = args.includes("--planned");

const idxEventsLimit = args.indexOf("--events-limit");
let eventsLimit = 50;
if (idxEventsLimit !== -1) {
  const v = args[idxEventsLimit + 1];
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 5000) usage("Invalid --events-limit (0..5000).");
  eventsLimit = Math.floor(n);
}

let poolMod;
try {
  // IMPORTANT: we intentionally import from dist to avoid TS runtime requirements.
  poolMod = await import("../../../dist/src/db/pool.js");
} catch (e) {
  console.error("Failed to import dist pool. Did you build?");
  console.error("Run: npm run build:fast");
  console.error("");
  throw e;
}

const pool = poolMod?.pool;
if (!pool) {
  throw new Error("dist/src/db/pool.js did not export { pool } as expected.");
}

const client = await pool.connect();
try {
  const r = await client.query(
    "select session_id, planned_session, session_state_summary from sessions where session_id = $1",
    [sid]
  );

  const row = r.rows?.[0] ?? null;
  if (!row) {
    console.error("Session not found: " + sid);
    process.exit(1);
  }

  const s = row.session_state_summary ?? null;
  const rt = s?.runtime ?? null;

  const has = (o, k) => !!(o && Object.prototype.hasOwnProperty.call(o, k));
  const head = (a, n = 8) => Array.isArray(a) ? a.slice(0, n) : null;

  const out = {
    sid,
    session_state_summary_top: {
      version: s?.version ?? null,
      started: s?.started ?? null,
      last_seq: s?.last_seq ?? null
    },
    runtime_split_surface: {
      split_active: rt?.split_active ?? null,
      remaining_at_split_ids: rt?.remaining_at_split_ids ?? null,
      has_split: has(rt, "split"),
      split_type: typeof rt?.split,
      split_is_null: rt?.split === null,
      split_keys: (rt?.split && typeof rt.split === "object") ? Object.keys(rt.split) : null,
      split_preview: rt?.split ?? null
    },
    runtime_id_counts: {
      remaining: Array.isArray(rt?.remaining_ids) ? rt.remaining_ids.length : null,
      completed: Array.isArray(rt?.completed_ids) ? rt.completed_ids.length : null,
      skipped: Array.isArray(rt?.skipped_ids) ? rt.skipped_ids.length : null
    },
    runtime_id_heads: {
      remaining_ids: head(rt?.remaining_ids),
      completed_ids: head(rt?.completed_ids),
      skipped_ids: head(rt?.skipped_ids)
    }
  };

  if (includePlanned) {
    out.planned_session = row.planned_session ?? null;
  }

  // Optional: print last N events if schema has them (best-effort, no hard dependency).
  if (eventsLimit > 0) {
    try {
      const ev = await client.query(
        "select seq, at, type from session_events where session_id = $1 order by seq desc limit $2",
        [sid, eventsLimit]
      );
      out.events_tail = (ev.rows ?? []).map(x => ({
        seq: x.seq ?? null,
        at: x.at ?? null,
        type: x.type ?? null
      }));
    } catch {
      // ignore (table may not exist yet / different schema)
      out.events_tail = null;
    }
  } else {
    out.events_tail = null;
  }

  if (wantPretty) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(JSON.stringify(out));
  }

} finally {
  client.release();
  await pool.end();
}
