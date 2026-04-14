import fs from "node:fs";
import path from "node:path";

const DEFAULT_SCAN_PATHS = [
  "app",
  "web",
  "marketing",
  "emails",
  "server",
  "shared",
  "docs"
];

const DEFAULT_EXCLUDE_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  "coverage"
]);

const DEFAULT_TEST_SEGMENTS = new Set([
  "test",
  "tests",
  "__tests__",
  "fixtures",
  "snapshots"
]);

const DEFAULT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".json", ".md", ".mdx", ".txt", ".html", ".css",
  ".yml", ".yaml"
]);

const ROOT = process.cwd();

const DOC_ALLOWLIST_PREFIXES = [];

const DOC_ALLOWLIST_EXACT = new Set([
  "docs/demo/P170_COACH_OBJECTION_HANDLING_PACK.md",
  "docs/demo/P193_COACH_WELCOME_PACK.md",
  "docs/demo/P194_ATHLETE_INVITE_PACK.md",

  "docs/commercial/P181_PILOT_SUCCESS_EVIDENCE_PACK.md",
  "docs/commercial/P183_POST_DEMO_REPLY_TEMPLATES.md",
  "docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md"
]);

const DOC_EXCLUDE_PREFIXES = [
  "docs/v1/",
  "docs/product/",
  "docs/V1_",
  "docs/V0_G03_G04_PROOF_AUDIT.md",
  "docs/v0_",
  "docs/v0/",
  "docs/commercial/P180_",
  "docs/commercial/P181_PILOT_SUCCESS_CLAIM_BLACKLIST.json",
  "docs/commercial/P182_",
  "docs/commercial/P183_POST_DEMO_REPLY_CLAIM_GUARDRAILS.json",
  "docs/commercial/P185_",
  "docs/commercial/P186_",
  "docs/commercial/P187_",
  "docs/commercial/P189_",
  "docs/commercial/COACH_TIER_PRICING_CLAIM_REGISTRY.json",
  "docs/commercial/COACH_SESSION_STATE_DEMO_CONTRACT.md",
  "docs/commercial/COACH_SUMMARY_EXPORT_BAN_REINFORCEMENT.md",
  "docs/commercial/COACH_TIER_PRICING_BOUNDARY_LOCK.md",
  "docs/commercial/MINIMAL_COACH_ONBOARDING_STEP_REGISTRY.json",
  "docs/commercial/V0_COACH_",
  "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md",
  "docs/demo/P169_",
  "docs/demo/P192_",
  "docs/demo/P195_"
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function compileRegexLine(source) {
  let flags = "g";
  let pattern = source.trim();

  const inlineFlagMatch = pattern.match(/^\(\?([a-z]+)\)/i);
  if (inlineFlagMatch) {
    const inlineFlags = inlineFlagMatch[1].toLowerCase();
    pattern = pattern.slice(inlineFlagMatch[0].length);

    if (inlineFlags.includes("i") && !flags.includes("i")) flags += "i";
    if (inlineFlags.includes("m") && !flags.includes("m")) flags += "m";
    if (inlineFlags.includes("s") && !flags.includes("s")) flags += "s";
  }

  return {
    pattern,
    flags,
    regex: new RegExp(pattern, flags)
  };
}

function loadRegexFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("#"));

  return lines.map((source, index) => {
    const compiled = compileRegexLine(source);
    return {
      rule_id: `BLK${String(index + 1).padStart(3, "0")}`,
      source,
      pattern: compiled.pattern,
      flags: compiled.flags,
      regex: compiled.regex
    };
  });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isExcluded(relPath) {
  const parts = toPosix(relPath).split("/");
  return parts.some(part => DEFAULT_EXCLUDE_SEGMENTS.has(part));
}

function isTestLike(relPath) {
  const parts = toPosix(relPath).split("/");
  return parts.some(part => DEFAULT_TEST_SEGMENTS.has(part));
}

function isUnderDocs(relPath) {
  return toPosix(relPath).startsWith("docs/");
}

function matchesAnyPrefix(relPath, prefixes) {
  const posix = toPosix(relPath);
  return prefixes.some(prefix => posix.startsWith(prefix));
}

function isAllowedDoc(relPath) {
  const posix = toPosix(relPath);

  if (!isUnderDocs(posix)) return true;
  if (matchesAnyPrefix(posix, DOC_EXCLUDE_PREFIXES)) return false;
  return DOC_ALLOWLIST_EXACT.has(posix);
}

function shouldScanFile(relPath) {
  if (isExcluded(relPath)) return false;
  if (isTestLike(relPath)) return false;

  const ext = path.extname(relPath).toLowerCase();
  if (!DEFAULT_EXTENSIONS.has(ext)) return false;

  if (isUnderDocs(relPath) && !isAllowedDoc(relPath)) return false;

  return true;
}

function listFiles(startDir) {
  const out = [];
  if (!fs.existsSync(startDir)) return out;

  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = toPosix(path.relative(ROOT, abs));
      if (entry.isDirectory()) {
        if (!isExcluded(rel)) stack.push(abs);
        continue;
      }
      if (entry.isFile() && shouldScanFile(rel)) {
        out.push(abs);
      }
    }
  }

  out.sort((a, b) => toPosix(path.relative(ROOT, a)).localeCompare(toPosix(path.relative(ROOT, b))));
  return out;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function excerptAt(text, index, length) {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + Math.max(length, 1) + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function collectBlacklistHits(text, relPath, blacklist) {
  const hits = [];
  for (const rule of blacklist) {
    const regex = new RegExp(rule.pattern, rule.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      hits.push({
        token: "CI_LINT_FORBIDDEN_LANGUAGE_FOUND",
        rule_id: rule.rule_id,
        rule_name: "sales_claim_blacklist",
        path: relPath,
        line: lineNumberAt(text, match.index),
        excerpt: excerptAt(text, match.index, match[0].length),
        details: `Matched blacklist pattern: ${rule.source}`
      });

      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
  }
  return hits;
}

function findOccurrences(text, phrases, caseInsensitive) {
  const haystack = caseInsensitive ? text.toLowerCase() : text;
  const out = [];
  for (const phrase of phrases) {
    const needle = caseInsensitive ? phrase.toLowerCase() : phrase;
    let fromIndex = 0;
    while (true) {
      const idx = haystack.indexOf(needle, fromIndex);
      if (idx === -1) break;
      out.push({ phrase, index: idx, length: needle.length });
      fromIndex = idx + Math.max(needle.length, 1);
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function collectContextualHits(text, relPath, contextualConfig) {
  const hits = [];
  const caseInsensitive = contextualConfig.case_insensitive !== false;
  const windowChars = Number(contextualConfig.window_chars ?? 80);

  for (const rule of contextualConfig.rules ?? []) {
    const verbs = findOccurrences(text, rule.verbs ?? [], caseInsensitive);
    const targets = findOccurrences(text, rule.targets ?? [], caseInsensitive);

    for (const verb of verbs) {
      for (const target of targets) {
        if (Math.abs(verb.index - target.index) <= windowChars) {
          const start = Math.min(verb.index, target.index);
          const end = Math.max(verb.index + verb.length, target.index + target.length);
          hits.push({
            token: "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC",
            rule_id: rule.id,
            rule_name: rule.name,
            path: relPath,
            line: lineNumberAt(text, start),
            excerpt: excerptAt(text, start, end - start),
            details: `Matched contextual rule '${rule.id}' with verb '${verb.phrase}' near target '${target.phrase}'`
          });
        }
      }
    }
  }

  return hits;
}

function dedupeHits(hits) {
  const seen = new Set();
  const out = [];
  for (const hit of hits) {
    const key = [
      hit.token,
      hit.rule_id,
      hit.path,
      hit.line,
      hit.details
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function loadAllFiles() {
  const files = [];
  for (const rel of DEFAULT_SCAN_PATHS) {
    const abs = path.join(ROOT, rel);
    files.push(...listFiles(abs));
  }
  return files;
}

function main() {
  const blacklist = loadRegexFile(path.join(ROOT, "ci", "lint", "sales_claim_blacklist.regex"));
  const contextualConfig = loadJson(path.join(ROOT, "ci", "lint", "sales_claim_contextual_rules.json"));

  const files = loadAllFiles();
  const hits = [];

  for (const abs of files) {
    const rel = toPosix(path.relative(ROOT, abs));
    const text = fs.readFileSync(abs, "utf8");

    hits.push(...collectBlacklistHits(text, rel, blacklist));
    hits.push(...collectContextualHits(text, rel, contextualConfig));
  }

  const failures = dedupeHits(hits);
  const result = {
    ok: failures.length === 0,
    failures
  };

  const json = JSON.stringify(result, null, 2);

  if (result.ok) {
    process.stdout.write(json + "\n");
    process.exit(0);
  }

  process.stderr.write(json + "\n");
  process.exit(1);
}

main();