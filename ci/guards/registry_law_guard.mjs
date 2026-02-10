// @law: Registry Law
// @severity: high
// @scope: registry
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (e) {
    die(`registry_law_guard: failed to read/parse JSON: ${absPath}\n${String(e)}`);
  }
}

function absFromRoot(rel) {
  return path.resolve(process.cwd(), rel);
}

function loadSchemaOrDie(rel) {
  const p = absFromRoot(rel);
  if (!exists(p)) die(`registry_law_guard: missing schema: ${p}`);
  return readJson(p);
}

function assertIndexOrder(idxPathAbs, idxDoc) {
  if (!isPlainObject(idxDoc)) die(`registry_law_guard: registry_index.json must be an object`);
  if (!Array.isArray(idxDoc.order)) die(`registry_law_guard: ${idxPathAbs} missing/invalid 'order' array`);
  if (idxDoc.order.length < 1) die(`registry_law_guard: ${idxPathAbs} order[] must not be empty`);
}

function findCollection(doc, absPath) {
  if (!isPlainObject(doc)) {
    return { ok: false, kind: null, map: null, array: null, key: null, errors: [`${absPath}: must be an object`] };
  }

  const errors = [];
  if (typeof doc.registry_id !== "string" || !doc.registry_id) errors.push(`${absPath}: missing/invalid registry_id`);
  if (typeof doc.version !== "string" || !doc.version) errors.push(`${absPath}: missing/invalid version`);

  if (Object.prototype.hasOwnProperty.call(doc, "entries")) {
    const ent = doc.entries;
    if (Array.isArray(ent)) return { ok: errors.length === 0, kind: "array", array: ent, map: null, key: "entries", errors };
    if (isPlainObject(ent)) return { ok: errors.length === 0, kind: "map", map: ent, array: null, key: "entries", errors };
    errors.push(`${absPath}: entries must be an array or object map`);
    return { ok: false, kind: null, map: null, array: null, key: "entries", errors };
  }

  const keys = Object.keys(doc).filter((k) => k !== "registry_id" && k !== "version");
  if (keys.length === 1) {
    const k = keys[0];
    const v = doc[k];
    if (Array.isArray(v)) return { ok: errors.length === 0, kind: "array", array: v, map: null, key: k, errors };
    if (isPlainObject(v)) return { ok: errors.length === 0, kind: "map", map: v, array: null, key: k, errors };
    errors.push(`${absPath}: '${k}' must be an array or object map`);
    return { ok: false, kind: null, map: null, array: null, key: k, errors };
  }

  errors.push(`${absPath}: no entries key and cannot infer collection key (found keys: ${keys.join(", ") || "(none)"})`);
  return { ok: false, kind: null, map: null, array: null, key: null, errors };
}

function buildIdSet(registryName, absPath, coll) {
  const errors = [...coll.errors];
  const ids = new Set();

  const candidates = {
    activity: ["activity_id", "id", "activity"],
    movement: ["movement_id", "pattern", "id", "movement"],
    exercise: ["exercise_id", "id", "exercise"]
  }[registryName] || ["id"];

  if (coll.kind === "map" && coll.map) {
    const keys = Object.keys(coll.map);
    if (keys.length < 1) errors.push(`${absPath}: ${coll.key}{} must contain at least 1 entry`);

    for (const [key, entry] of Object.entries(coll.map)) {
      if (!key) continue;
      if (ids.has(key)) errors.push(`${absPath}: duplicate id '${key}'`);
      ids.add(key);

      if (isPlainObject(entry)) {
        const idField = candidates.find((f) => Object.prototype.hasOwnProperty.call(entry, f));
        if (idField) {
          const v = entry[idField];
          if (typeof v !== "string" || !v) errors.push(`${absPath} ${coll.key}.${key}: ${idField} must be a non-empty string`);
          else if (v !== key) errors.push(`${absPath} ${coll.key}.${key}: key must equal ${idField} (got ${idField}='${v}')`);
        }
      }
    }
  }

  if (coll.kind === "array" && coll.array) {
    if (coll.array.length < 1) errors.push(`${absPath}: ${coll.key}[] must contain at least 1 entry`);

    for (let i = 0; i < coll.array.length; i++) {
      const entry = coll.array[i];
      if (!isPlainObject(entry)) {
        errors.push(`${absPath} ${coll.key}[${i}]: must be an object`);
        continue;
      }

      const idField = candidates.find((f) => Object.prototype.hasOwnProperty.call(entry, f));
      if (!idField) {
        errors.push(`${absPath} ${coll.key}[${i}]: missing id field (expected one of: ${candidates.join(", ")})`);
        continue;
      }

      const id = entry[idField];
      if (typeof id !== "string" || !id) {
        errors.push(`${absPath} ${coll.key}[${i}]: ${idField} must be a non-empty string`);
        continue;
      }

      if (ids.has(id)) errors.push(`${absPath}: duplicate id '${id}'`);
      ids.add(id);
    }
  }

  return {
    ids,
    errors,
    count: coll.kind === "map" && coll.map ? Object.keys(coll.map).length : (coll.array ? coll.array.length : 0)
  };
}

function validateNonEmptyStringArray(value) {
  if (!Array.isArray(value) || value.length < 1) return { ok: false, why: "must be a non-empty array" };
  for (const v of value) {
    if (typeof v !== "string" || !v) return { ok: false, why: "must contain only non-empty strings" };
  }
  return { ok: true, why: "" };
}

function validateUniqueNonEmptyStringArray(value) {
  const base = validateNonEmptyStringArray(value);
  if (!base.ok) return base;
  const seen = new Set();
  for (const v of value) {
    if (seen.has(v)) return { ok: false, why: "must not contain duplicates" };
    seen.add(v);
  }
  return { ok: true, why: "" };
}

/**
 * Canonicalization/normalization:
 * - Equipment: force singular tokens (dumbbells->dumbbell), collapse bench variants.
 * - Joint tags: choose ONE scheme in canonical output:
 *   - we canonicalize graded variants down to their base (shoulder_high -> shoulder).
 *
 * NOTE on spine:
 * - 'lumbar_*' is L-spine only. Thoracic/cervical are distinct.
 * - If your exercises contain 'upper_back_*' / 'mid_back_*' / 'lower_back_*' we translate those
 *   to thoracic_* / thoracic_* / lumbar_* respectively.
 * - Legacy 'back_*' tokens are ambiguous. We treat them as TEMP legacy aliases to lumbar_* to keep
 *   the repo green, but you should migrate them to explicit regions ASAP.
 */
const TOKEN_ALIASES = {
  equipment: {
    dumbbells: "dumbbell",
    plates: "plate",
    weight_plates: "plate",
    weight_plate: "plate",
    kettlebells: "kettlebell",
    incline_bench: "bench",
    flat_bench: "bench",
    decline_bench: "bench"
  },
  joint: {
    // graded -> base (canonical scheme)
    shoulder_low: "shoulder",
    shoulder_medium: "shoulder",
    shoulder_high: "shoulder",
    elbow_low: "elbow",
    elbow_medium: "elbow",
    elbow_high: "elbow",
    wrist_low: "wrist",
    wrist_medium: "wrist",
    wrist_high: "wrist",
    hip_low: "hip",
    hip_medium: "hip",
    hip_high: "hip",
    knee_low: "knee",
    knee_medium: "knee",
    knee_high: "knee",
    ankle_low: "ankle",
    ankle_medium: "ankle",
    ankle_high: "ankle",

    // human-friendly back regions -> anatomical regions
    neck_low: "cervical_low",
    neck_medium: "cervical_medium",
    neck_high: "cervical_high",

    upper_back_low: "thoracic_low",
    upper_back_medium: "thoracic_medium",
    upper_back_high: "thoracic_high",

    mid_back_low: "thoracic_low",
    mid_back_medium: "thoracic_medium",
    mid_back_high: "thoracic_high",

    lower_back_low: "lumbar_low",
    lower_back_medium: "lumbar_medium",
    lower_back_high: "lumbar_high",

    // SI is a joint family
    si_low: "sacroiliac_low",
    si_medium: "sacroiliac_medium",
    si_high: "sacroiliac_high",

    // TEMP legacy: ambiguous back_* -> lumbar_* (compat shim)
    back_low: "lumbar_low",
    back_medium: "lumbar_medium",
    back_high: "lumbar_high"
  }
};

function normalizeTokenArray(raw, { label, ctxPath, aliasMap, canonicalSet }) {
  if (!Array.isArray(raw)) {
    return { ok: false, tokens: raw, changed: false, errors: [`${ctxPath}: ${label} must be an array`] };
  }

  const out = [];
  const seen = new Set();
  const errors = [];
  let changed = false;

  for (const t of raw) {
    if (typeof t !== "string" || !t) {
      errors.push(`${ctxPath}: ${label} must contain only non-empty strings`);
      continue;
    }

    let canon = t;
    if (aliasMap && Object.prototype.hasOwnProperty.call(aliasMap, t)) {
      canon = aliasMap[t];
      changed = true;
    }

    if (canonicalSet && !canonicalSet.has(canon)) {
      errors.push(`${ctxPath}: ${label} token '${t}' canonicalizes to '${canon}' which is not in vocab`);
      continue;
    }

    if (seen.has(canon)) {
      changed = true;
      continue;
    }

    seen.add(canon);
    out.push(canon);
  }

  return { ok: errors.length === 0, tokens: out, changed, errors };
}

function buildStimulusSetFromActivity(regs, errors) {
  const act = regs.get("activity");
  const actPath = act?.path || "registries/activity/activity.registry.json";
  const doc = act?.doc;

  const set = new Set();

  if (!isPlainObject(doc) || !isPlainObject(doc.entries)) {
    errors.push(`${actPath}: entries map missing/invalid (expected object map)`);
    return set;
  }

  const entries = doc.entries;
  const keys = Object.keys(entries);
  if (keys.length < 1) {
    errors.push(`${actPath}: entries{} must contain at least 1 entry`);
    return set;
  }

  for (const [k, v] of Object.entries(entries)) {
    if (!isPlainObject(v)) {
      errors.push(`${actPath} entries.${k}: must be an object`);
      continue;
    }

    if (typeof v.activity_id !== "string" || !v.activity_id) {
      errors.push(`${actPath} entries.${k}: missing/invalid activity_id`);
      continue;
    }
    if (v.activity_id !== k) {
      errors.push(`${actPath} entries.${k}: key must equal activity_id (got '${v.activity_id}')`);
    }

    const chk = validateUniqueNonEmptyStringArray(v.stimulus_intents);
    if (!chk.ok) {
      errors.push(`${actPath} entries.${k}: stimulus_intents[] ${chk.why}`);
      continue;
    }

    for (const s of v.stimulus_intents) set.add(s);
  }

  return set;
}

function buildMovementVocabById(regs, errors) {
  const mov = regs.get("movement");
  const movPath = mov?.path || "registries/movement/movement.registry.json";
  const doc = mov?.doc;

  const map = new Map(); // movement_id -> { equipment:Set, joint:Set }

  if (!isPlainObject(doc) || !isPlainObject(doc.entries)) {
    errors.push(`${movPath}: entries map missing/invalid (expected object map)`);
    return map;
  }

  const entries = doc.entries;
  const keys = Object.keys(entries);
  if (keys.length < 1) {
    errors.push(`${movPath}: entries{} must contain at least 1 entry`);
    return map;
  }

  for (const [k, v] of Object.entries(entries)) {
    if (!isPlainObject(v)) {
      errors.push(`${movPath} entries.${k}: must be an object`);
      continue;
    }

    if (typeof v.movement_id !== "string" || !v.movement_id) {
      errors.push(`${movPath} entries.${k}: missing/invalid movement_id`);
      continue;
    }
    if (v.movement_id !== k) {
      errors.push(`${movPath} entries.${k}: key must equal movement_id (got '${v.movement_id}')`);
    }

    const eqChk = validateUniqueNonEmptyStringArray(v.equipment_vocab);
    if (!eqChk.ok) errors.push(`${movPath} entries.${k}: equipment_vocab[] ${eqChk.why}`);

    const jtChk = validateUniqueNonEmptyStringArray(v.joint_stress_tags_vocab);
    if (!jtChk.ok) errors.push(`${movPath} entries.${k}: joint_stress_tags_vocab[] ${jtChk.why}`);

    if (eqChk.ok && jtChk.ok) {
      const eq = new Set(v.equipment_vocab);
      const jt = new Set(v.joint_stress_tags_vocab);
      map.set(k, { equipment: eq, joint: jt });
    }
  }

  return map;
}

function main() {
  const idxPath = absFromRoot("registries/registry_index.json");
  if (!exists(idxPath)) die(`registry_law_guard: missing registry index: ${idxPath}`);

  const idxDoc = readJson(idxPath);
  assertIndexOrder(idxPath, idxDoc);

  const order = idxDoc.order.map((x) => String(x));

  const regs = new Map();
  const errors = [];

  for (const name of order) {
    const p = absFromRoot(`registries/${name}/${name}.registry.json`);
    if (!exists(p)) {
      errors.push(`registry_law_guard: missing registry file for '${name}': ${p}`);
      continue;
    }
    const doc = readJson(p);
    const coll = findCollection(doc, p);
    const built = buildIdSet(name, p, coll);

    regs.set(name, { path: p, doc, coll, ids: built.ids, count: built.count });
    errors.push(...built.errors);
  }

  // Exercise schema validation (existing law)
  const exercisePath = absFromRoot("registries/exercise/exercise.registry.json");
  const exerciseDoc = regs.get("exercise")?.doc ?? readJson(exercisePath);

  const entrySchema = loadSchemaOrDie("ci/schemas/registry_entry.schema.json");
  const wrapperSchema = loadSchemaOrDie("ci/schemas/exercise_registry.schema.json");

  const ajv = new Ajv({ allErrors: true, strict: true, validateSchema: false });
  ajv.addSchema(entrySchema, entrySchema.$id);
  ajv.addSchema(wrapperSchema, wrapperSchema.$id);

  const validateWrapper = ajv.getSchema(wrapperSchema.$id);
  if (!validateWrapper) die("registry_law_guard: failed to compile exercise wrapper schema");

  const okEx = validateWrapper(exerciseDoc);
  if (!okEx) {
    for (const e of validateWrapper.errors || []) {
      const at = e.instancePath || "(root)";
      errors.push(`${exercisePath} schema ${at} ${e.message || "invalid"}`);
    }
  }

  const exEntries = isPlainObject(exerciseDoc?.entries) ? exerciseDoc.entries : null;
  if (!exEntries) errors.push(`${exercisePath}: entries map missing/invalid (expected object map)`);

  // FK: exercise.pattern -> movement ids
  const movementIds = regs.get("movement")?.ids ?? new Set();
  if (exEntries) {
    if (movementIds.size < 1) {
      errors.push(`${regs.get("movement")?.path || "movement"}: could not derive any movement ids (FK cannot be validated)`);
    } else {
      for (const [key, e] of Object.entries(exEntries)) {
        if (!isPlainObject(e)) continue;
        if (typeof e.pattern !== "string" || !e.pattern) {
          errors.push(`${exercisePath} entries.${key}: missing/invalid pattern`);
          continue;
        }
        if (!movementIds.has(e.pattern)) {
          errors.push(`${exercisePath} entries.${key}: FK fail pattern='${e.pattern}' (not in movement registry ids)`);
        }
      }
    }
  }

  // FK: exercise.stimulus_intent -> activity stimulus_intents
  const stimulusSet = buildStimulusSetFromActivity(regs, errors);
  if (exEntries) {
    if (stimulusSet.size < 1) {
      errors.push(`${regs.get("activity")?.path || "activity"}: could not derive any stimulus_intents (FK cannot be validated)`);
    } else {
      for (const [key, e] of Object.entries(exEntries)) {
        if (!isPlainObject(e)) continue;
        if (typeof e.stimulus_intent !== "string" || !e.stimulus_intent) {
          errors.push(`${exercisePath} entries.${key}: missing/invalid stimulus_intent`);
          continue;
        }
        if (!stimulusSet.has(e.stimulus_intent)) {
          errors.push(`${exercisePath} entries.${key}: FK fail stimulus_intent='${e.stimulus_intent}' (not in activity stimulus_intents)`);
        }
      }
    }
  }

  // Movement minimal contract + scoped vocab enforcement + normalization
  const movementVocab = buildMovementVocabById(regs, errors);

  if (exEntries) {
    for (const [key, e] of Object.entries(exEntries)) {
      if (!isPlainObject(e)) continue;

      const pattern = typeof e.pattern === "string" ? e.pattern : "";
      const ctx = `${exercisePath} entries.${key}`;

      // REQUIRE: equipment[] non-empty
      const eqChk = validateNonEmptyStringArray(e.equipment);
      if (!eqChk.ok) errors.push(`${ctx}: missing/invalid equipment (${eqChk.why})`);

      // REQUIRE: joint_stress_tags[] non-empty
      const jtChk = validateNonEmptyStringArray(e.joint_stress_tags);
      if (!jtChk.ok) errors.push(`${ctx}: missing/invalid joint_stress_tags (${jtChk.why})`);

      if (!pattern) continue;

      if (!movementVocab.has(pattern)) {
        errors.push(`${ctx}: movement vocab missing for pattern='${pattern}' (cannot validate scoped equipment/joint tags)`);
        continue;
      }

      const vocab = movementVocab.get(pattern);

      // Normalize + scoped FK: equipment tokens
      if (Array.isArray(e.equipment)) {
        const n = normalizeTokenArray(e.equipment, {
          label: "equipment",
          ctxPath: ctx,
          aliasMap: TOKEN_ALIASES.equipment,
          canonicalSet: vocab.equipment
        });
        if (!n.ok) errors.push(...n.errors);

        // NOTE: we validate against canonicalSet inside normalizeTokenArray.
      }

      // Normalize + scoped FK: joint stress tokens
      if (Array.isArray(e.joint_stress_tags)) {
        const n = normalizeTokenArray(e.joint_stress_tags, {
          label: "joint_stress_tags",
          ctxPath: ctx,
          aliasMap: TOKEN_ALIASES.joint,
          canonicalSet: vocab.joint
        });
        if (!n.ok) errors.push(...n.errors);

        // NOTE: we validate against canonicalSet inside normalizeTokenArray.
      }
    }
  }

  if (errors.length) {
    console.error("registry_law_guard: FAIL");
    console.error(errors.join("\n"));
    process.exit(1);
  }

  const summary = order.map((n) => `${n}=${regs.get(n)?.count ?? 0}`).join(", ");
  console.log(`registry_law_guard: OK (${summary})`);
}

main();