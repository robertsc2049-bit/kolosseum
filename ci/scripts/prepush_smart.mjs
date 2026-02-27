import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import process from "node:process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "ignore"] });
}

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8")
    .trim();
}

function safeOut(cmd) {
  try {
    return { ok: true, text: out(cmd) };
  } catch {
    return { ok: false, text: "" };
  }
}

function tryOut(cmd) {
  try {
    return out(cmd);
  } catch {
    return "";
  }
}

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function isAllZeroSha(s) {
  const x = String(s || "").trim();
  return x.length === 40 && /^0{40}$/.test(x);
}

function readStdinUtf8() {
  // Never block on a console TTY.
  if (process.stdin && process.stdin.isTTY) return "";
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePushTargetsFromStdin() {
  const text = readStdinUtf8();
  const lines = String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const updates = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const [localRef, localSha, remoteRef, remoteSha] = parts;
    updates.push({ localRef, localSha, remoteRef, remoteSha });
  }
  return updates;
}

function sortUpdatesCanonical(updates) {
  const arr = Array.isArray(updates) ? updates.slice() : [];
  arr.sort((a, b) => {
    const ar = String(a?.remoteRef || "");
    const br = String(b?.remoteRef || "");
    const c1 = ar.localeCompare(br);
    if (c1 !== 0) return c1;

    const al = String(a?.localRef || "");
    const bl = String(b?.localRef || "");
    const c2 = al.localeCompare(bl);
    if (c2 !== 0) return c2;

    const als = String(a?.localSha || "");
    const bls = String(b?.localSha || "");
    const c3 = als.localeCompare(bls);
    if (c3 !== 0) return c3;

    const ars = String(a?.remoteSha || "");
    const brs = String(b?.remoteSha || "");
    return ars.localeCompare(brs);
  });
  return arr;
}

function sortFilesLex(files) {
  const arr = Array.isArray(files) ? files.slice() : [];
  arr.sort((a, b) => String(a).localeCompare(String(b)));
  return arr;
}

function getUpstreamRef() {
  // Safe from Node (no PowerShell @{u} mangling).
  return tryOut("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
}

function getOutgoingCommitCount(upstream) {
  if (!upstream) return null;
  const s = tryOut(`git rev-list --count ${upstream}..HEAD`);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function computePushingMain(updates) {
  if (updates.length) {
    return updates.some((u) => u.remoteRef === "refs/heads/main");
  }
  const branch = tryOut("git rev-parse --abbrev-ref HEAD");
  const upstream = getUpstreamRef();
  const isMainBranch = branch === "main";
  const isUpstreamMain = upstream.endsWith("/main") || upstream === "origin/main";
  return isMainBranch && isUpstreamMain;
}

function requireMainPushOverrideOrDie(pushingMain) {
  if (!pushingMain) return;

  const allowed = process.env.KOLOSSEUM_ALLOW_PUSH_MAIN === "1";
  if (!allowed) {
    console.error("[pre-push] BLOCKED: direct push to main is disabled.");
    console.error("[pre-push] Use a ticket branch + PR.");
    console.error("[pre-push] Override once (PowerShell):");
    console.error(
      '[pre-push]   $env:KOLOSSEUM_ALLOW_PUSH_MAIN="1"; git push origin main; Remove-Item Env:KOLOSSEUM_ALLOW_PUSH_MAIN'
    );
    process.exit(1);
  }
}

function runPushChangesetGuardOrDie() {
  const script = "scripts/guard-push-changeset.ps1";
  const exists = fs.existsSync(path.resolve(process.cwd(), script));
  if (!exists) die(`[pre-push] missing push changeset guard: ${script}`, 2);

  console.log("[pre-push] push changeset guard");
  sh(`pwsh -NoProfile -ExecutionPolicy Bypass -File ${script}`);
}

function runStandardChecksOrDie() {
  const script = "scripts/standard-checks.ps1";
  const exists = fs.existsSync(path.resolve(process.cwd(), script));
  if (!exists) die(`[pre-push] standard checks missing: ${script}`, 2);

  console.log("[pre-push] standard checks (origin canonical + gh visibility)");
  sh(`pwsh -NoProfile -ExecutionPolicy Bypass -File ${script} -SkipGreenFast`);
}

function tryForkPointBase(localSha) {
  const sha = String(localSha || "").trim();
  if (!sha) return "";
  const fp = tryOut(`git merge-base --fork-point origin/main ${sha}`);
  if (fp) return fp;
  const mb = tryOut(`git merge-base origin/main ${sha}`);
  if (mb) return mb;
  return "";
}

function listPushedFilesFromUpdates(updates) {
  const files = new Set();
  let diffFailed = false;

  const meaningful = updates.filter(
    (u) => !isAllZeroSha(u.localSha) && u.localRef && u.remoteRef
  );
  if (!meaningful.length) return [];

  for (const u of meaningful) {
    const localSha = String(u.localSha || "").trim();
    const remoteSha = String(u.remoteSha || "").trim();

    if (localSha && remoteSha && !isAllZeroSha(remoteSha)) {
      const r = safeOut(`git diff --name-only ${remoteSha}..${localSha}`);
      if (!r.ok) {
        diffFailed = true;
        continue;
      }
      const names = r.text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const f of names) files.add(f);
      continue;
    }

    const base =
      tryForkPointBase(localSha) ||
      (tryOut("git rev-parse --verify HEAD~1") ? "HEAD~1" : "");

    if (!base || !localSha) continue;

    const r = safeOut(`git diff --name-only ${base}..${localSha}`);
    if (!r.ok) {
      diffFailed = true;
      continue;
    }
    const names = r.text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const f of names) files.add(f);
  }

  // Conservative: if any diff failed for a meaningful update, refuse to classify.
  if (diffFailed) return null;

  return sortFilesLex(Array.from(files));
}

function listPushedFilesFallback(upstream) {
  if (upstream) {
    const r = safeOut(`git diff --name-only ${upstream}..HEAD`);
    if (!r.ok) return null;
    return sortFilesLex(
      r.text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  const hasHead1 = !!tryOut("git rev-parse --verify HEAD~1");
  if (hasHead1) {
    const r = safeOut("git diff --name-only HEAD~1..HEAD");
    if (!r.ok) return null;
    return sortFilesLex(
      r.text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  return null;
}

// -----------------------------
// Artefact map (data-driven)
// -----------------------------
function loadArtefactsOrDie() {
  const rel = "ci/artefacts/artefacts.json";
  const abs = path.resolve(process.cwd(), rel);

  // Must work before commit: check disk, not git index.
  if (!fs.existsSync(abs)) die(`[pre-push] missing artefact map on disk: ${rel}`, 2);

  let raw = "";
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (e) {
    die(`[pre-push] failed to read artefact map: ${rel} :: ${String(e)}`, 2);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    die(`[pre-push] invalid JSON in artefact map: ${rel} :: ${String(e)}`, 2);
  }

  if (!json || json.version !== 1) die(`[pre-push] artefact map version mismatch (expected 1): ${rel}`, 2);
  if (!Array.isArray(json.groups) || json.groups.length === 0) die(`[pre-push] artefact map has no groups: ${rel}`, 2);
  if (!json.decision) die(`[pre-push] artefact map missing decision table: ${rel}`, 2);

  const groups = json.groups.map((g) => ({
    id: String(g.id || "").trim(),
    kind: String(g.kind || "").trim(),
    patterns: Array.isArray(g.patterns)
      ? g.patterns.map((p) => String(p || "").trim()).filter(Boolean)
      : []
  }));

  for (const g of groups) {
    if (!g.id) die(`[pre-push] artefact group missing id: ${rel}`, 2);
    if (!g.kind) die(`[pre-push] artefact group missing kind: ${g.id}`, 2);
    if (!g.patterns.length) die(`[pre-push] artefact group has no patterns: ${g.id}`, 2);
  }

  return { groups, decision: json.decision };
}

function globToRegex(glob) {
  const g = String(glob || "").replace(/\\/g, "/");
  let re = "^";
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    const next = g[i + 1];

    if (ch === "*" && next === "*") {
      re += ".*";
      i++;
      continue;
    }
    if (ch === "*") {
      re += "[^/]*";
      continue;
    }
    if (ch === "?") {
      re += "[^/]";
      continue;
    }

    if (/[\.\+\^\$\{\}\(\)\|\[\]\\]/.test(ch)) re += "\\" + ch;
    else re += ch;
  }
  re += "$";
  return new RegExp(re, "i");
}

function compileArtefactMatchers(artefacts) {
  const compiled = artefacts.groups.map((g) => {
    const patterns = g.patterns.map((p) => ({ raw: p, re: globToRegex(p) }));
    return { id: g.id, kind: g.kind, patterns };
  });

  compiled.sort((a, b) => a.id.localeCompare(b.id));
  return compiled;
}

function matchKindHits(files, compiledGroups) {
  const hits = new Map(); // kind -> Set(file)

  for (const f0 of files) {
    const f = String(f0 || "").replace(/\\/g, "/");
    for (const g of compiledGroups) {
      let matched = false;
      for (const p of g.patterns) {
        if (p.re.test(f)) { matched = true; break; }
      }
      if (!matched) continue;

      if (!hits.has(g.kind)) hits.set(g.kind, new Set());
      hits.get(g.kind).add(f);
    }
  }

  return hits;
}

function classifyByArtefacts(files, artefacts) {
  const compiled = compileArtefactMatchers(artefacts);
  const hits = matchKindHits(files, compiled);

  const isKindOnly = (kind) =>
    files.length > 0 &&
    files.every((f) => {
      const set = hits.get(kind);
      return set && set.has(String(f).replace(/\\/g, "/"));
    });

  const DOC_ONLY = isKindOnly("DOC");
  const WORKFLOW_ONLY = isKindOnly("WORKFLOW");

  const ENGINE_RISK = !WORKFLOW_ONLY && (hits.get("ENGINE_RISK")?.size || 0) > 0;
  const APP_RISK = !ENGINE_RISK && !WORKFLOW_ONLY && (hits.get("APP_RISK")?.size || 0) > 0;

  return { DOC_ONLY, WORKFLOW_ONLY, ENGINE_RISK, APP_RISK };
}

function decideRoute(files, artefacts) {
  if (files === null) return { route: "dev:fast", reason: "cannot-determine-files" };
  if (!files.length) return { route: "lint:fast", reason: "empty-file-list" };

  const { DOC_ONLY, WORKFLOW_ONLY, ENGINE_RISK, APP_RISK } = classifyByArtefacts(files, artefacts);
  const d = artefacts.decision;

  if (DOC_ONLY) return { route: d.when_docs_only.route, reason: d.when_docs_only.reason };
  if (WORKFLOW_ONLY) return { route: d.when_workflow_only.route, reason: d.when_workflow_only.reason };
  if (ENGINE_RISK) return { route: d.when_engine_risk.route, reason: d.when_engine_risk.reason };
  if (APP_RISK) return { route: d.when_app_risk.route, reason: d.when_app_risk.reason };
  return { route: d.default.route, reason: d.default.reason };
}

function dryRunPayload(state) {
  const { updates, stdinMissing, upstream, outgoing, pushingMain, allowMain, files, decision } = state;
  const wouldBlockMain = pushingMain && !allowMain;

  const sortedUpdates = sortUpdatesCanonical(updates);
  const sortedFiles = files === null ? null : sortFilesLex(files);

  return {
    mode: "dry-run",
    stdin: { present: !stdinMissing, updates_count: sortedUpdates.length, updates: sortedUpdates },
    git: { upstream: upstream || null, outgoing: outgoing === null ? null : outgoing },
    main: { pushing: !!pushingMain, allow_override: !!allowMain, would_block: !!wouldBlockMain },
    files: sortedFiles,
    decision
  };
}

function printDryRun(payload) {
  const fmt = String(process.env.KOLOSSEUM_PREPUSH_DRYRUN_FORMAT || "").trim().toLowerCase();
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(payload) + "\n");
    return;
  }

  const stdinMissing = !payload.stdin.present;
  console.log("[pre-push][dry-run] enabled (no guards, no npm, no pwsh)");
  console.log(`[pre-push][dry-run] stdin: ${stdinMissing ? "missing" : "present"} (${payload.stdin.updates_count} update(s))`);
  console.log(`[pre-push][dry-run] upstream: ${payload.git.upstream || "(none)"}`);
  console.log(`[pre-push][dry-run] outgoing: ${payload.git.outgoing === null ? "(unknown)" : String(payload.git.outgoing)}`);
  console.log(`[pre-push][dry-run] pushingMain: ${payload.main.pushing ? "yes" : "no"}`);
  console.log(`[pre-push][dry-run] allowMain: ${payload.main.allow_override ? "yes" : "no"}`);
  if (payload.files === null) console.log("[pre-push][dry-run] files: (null) cannot determine");
  else {
    console.log(`[pre-push][dry-run] files: ${payload.files.length}`);
    for (const f of payload.files) console.log(`[pre-push][dry-run]   ${f}`);
  }
  console.log(`[pre-push][dry-run] decision: ${payload.decision.route} (${payload.decision.reason})`);
  if (payload.main.would_block) console.log("[pre-push][dry-run] NOTE: would BLOCK main push (override not set).");
}

// -----------------------------
// Main
// -----------------------------
const artefacts = loadArtefactsOrDie();

const updates = parsePushTargetsFromStdin();
const upstream = getUpstreamRef();
const outgoing = getOutgoingCommitCount(upstream);

const stdinMissing = updates.length === 0;
const force = process.env.KOLOSSEUM_PREPUSH_FORCE === "1";
const dryRun = process.env.KOLOSSEUM_PREPUSH_DRYRUN === "1";

const pushingMain = computePushingMain(updates);
const allowMain = process.env.KOLOSSEUM_ALLOW_PUSH_MAIN === "1";

let files = null;
if (updates.length) files = listPushedFilesFromUpdates(updates);
else files = listPushedFilesFallback(upstream);

let decision = decideRoute(files, artefacts);

if (stdinMissing && upstream && outgoing === 0) {
  decision = { route: "lint:fast", reason: "no-push-context" };
}

if (dryRun) {
  printDryRun(dryRunPayload({ updates, stdinMissing, upstream, outgoing, pushingMain, allowMain, files, decision }));
  process.exit(0);
}

if (!force && stdinMissing && upstream && outgoing === 0) {
  console.log("[pre-push] no-op (0 outgoing commits; stdin missing) -> exit 0");
  process.exit(0);
}

requireMainPushOverrideOrDie(pushingMain);

if (!force && upstream && outgoing === 0) {
  console.log("[pre-push] no-op (0 outgoing commits) -> exit 0");
  process.exit(0);
}

runPushChangesetGuardOrDie();
runStandardChecksOrDie();

if (pushingMain && process.env.KOLOSSEUM_ALLOW_PUSH_MAIN === "1") {
  console.log("[pre-push] main push override detected -> forcing green:ci");
  sh("npm run green:ci");
  process.exit(0);
}

if (files === null) {
  console.log("[pre-push] cannot determine pushed files -> dev:fast (conservative)");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log(`[pre-push] pushed files: ${files.length}`);

if (!files.length) {
  console.log("[pre-push] pushed file list empty -> lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

const { DOC_ONLY, WORKFLOW_ONLY, ENGINE_RISK, APP_RISK } = classifyByArtefacts(files, artefacts);

if (DOC_ONLY) { console.log("[pre-push] docs-only -> lint:fast"); sh("npm run lint:fast"); process.exit(0); }
if (WORKFLOW_ONLY) { console.log("[pre-push] workflow-only -> green:fast"); sh("npm run green:fast"); process.exit(0); }
if (ENGINE_RISK) { console.log("[pre-push] engine-risk change -> green:ci"); sh("npm run green:ci"); process.exit(0); }
if (APP_RISK) { console.log("[pre-push] app-risk change -> dev:fast"); sh("npm run dev:fast"); process.exit(0); }

console.log("[pre-push] non-risk change -> lint:fast");
sh("npm run lint:fast");
