// A gym lists its equipment for free; athletes can choose it once an admin
// approves it, and their main gym's equipment counts as theirs alongside
// their home kit. The gym sees a count of the athletes who chose it -
// "fewer than 3" below 3 - and never who they are.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { getAthleteEquipment } from "../dist/src/api/athlete_equipment_service.js";

async function request(base, method, route, body, options = {}) {
  const headers = { origin: base };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function cookieOf(result, name) {
  const found = result.response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `expected ${name} cookie`);
  return found.split(";")[0];
}

function expect(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${result.text}`);
  return result.json;
}

async function scryptHash(password, salt) {
  return await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(Buffer.from(key).toString("base64url"))));
  });
}

test("a gym lists its equipment, an admin approves it, and an athlete trains with it", { timeout: 120000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const athleteIds = [];
  let ownerId = "";
  let adminId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (ownerId) {
      await pool.query("DELETE FROM product_gym_listings WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [ownerId]).catch(() => {});
    }
    if (adminId) {
      await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminId]).catch(() => {});
      await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminId]).catch(() => {});
    }
    for (const id of athleteIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.end();
  });

  // The gym owner signs up, creates the gym and lists it.
  const ownerReg = await request(base, "POST", "/org/register", { email: `gym_owner_${nonce}@example.com`, display_name: "Ironworks Owner", password: `GymOwner${nonce}!2026` });
  expect(ownerReg, 201, "owner registers");
  ownerId = ownerReg.json.org_owner.user_id;
  const owner = { cookie: cookieOf(ownerReg, "kolosseum_org_owner_session"), csrf: ownerReg.json.csrf_token };
  const gymName = `Ironworks ${nonce}`;
  const gym = expect(await request(base, "POST", "/org/organisations", { org_name: gymName, activity_id: "powerlifting", visibility_mode: "individual" }, owner), 201, "create gym");
  const orgId = gym.organisation.org_id;
  const team = expect(await request(base, "POST", "/org/organisations", { org_name: `Team ${nonce}`, activity_id: "rugby_union", visibility_mode: "shared" }, owner), 201, "create team");

  const empty = expect(await request(base, "GET", `/org/organisations/${orgId}/gym-listing`, undefined, owner), 200, "empty listing");
  assert.equal(empty.listing, null);
  assert.ok(empty.options.some((option) => option.equipment_id === "barbell"), "the owner chooses from the equipment registry");
  assert.ok(!empty.options.some((option) => option.equipment_id === "bodyweight"), "bodyweight goes without saying");

  expect(await request(base, "PUT", `/org/organisations/${team.organisation.org_id}/gym-listing`, { display_name: "Team", area: "Leeds", equipment: [] }, owner), 409, "a team can't list");
  const bad = await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: "", area: "Leeds", equipment: ["laser_cannon"] }, owner);
  expect(bad, 422, "invalid listing");
  assert.ok(bad.json.field_errors.display_name && bad.json.field_errors.equipment);

  const saved = expect(await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: gymName, area: "Leeds", equipment: ["barbell", "rack", "bench"] }, owner), 200, "save listing");
  assert.equal(saved.listing.listing_status, "pending", "waits for an admin");
  assert.equal(saved.athletes_label, "Fewer than 3 athletes chose this gym");
  assert.equal(saved.athlete_count, null);

  // An athlete can't find it yet.
  const athletes = [];
  for (const n of [1, 2, 3]) {
    const reg = await request(base, "POST", "/account/register", {
      actor_type: "athlete", display_name: `Gym Athlete ${n}`, email: `gym_athlete_${n}_${nonce}@example.com`, password: `GymAthlete${n}${nonce}!2026`,
      date_of_birth: "1994-06-06", accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", activity_id: "powerlifting"
    });
    expect(reg, 201, `athlete ${n} registers`);
    athleteIds.push(reg.json.account.user_id);
    athletes.push({ userId: reg.json.account.user_id, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token });
  }
  const [sam] = athletes;
  const q = encodeURIComponent(nonce);
  assert.deepEqual(expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${q}`, undefined, sam), 200, "search pending").gyms, []);
  expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [orgId] }, sam), 422, "can't choose an unlisted gym");

  // The admin approves it.
  const adminEmail = `gym_admin_${nonce}@example.com`;
  const adminPassword = `GymAdmin${nonce}!2026`;
  const salt = crypto.randomBytes(24).toString("base64url");
  adminId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query("INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)", [adminId, adminEmail, "Gym Admin", salt, await scryptHash(adminPassword, salt)]);
  const adminIn = await request(base, "POST", "/admin/sign-in", { email: adminEmail, password: adminPassword });
  expect(adminIn, 200, "admin signs in");
  const admin = { cookie: cookieOf(adminIn, "kolosseum_admin_session"), csrf: adminIn.json.csrf_token };
  const queue = expect(await request(base, "GET", "/admin/gym-listings?status=pending", undefined, admin), 200, "admin queue");
  const queued = queue.gym_listings.find((listing) => listing.org_id === orgId);
  assert.ok(queued, "the new listing is in the queue");
  assert.equal(queued.owner_email, `gym_owner_${nonce}@example.com`);
  expect(await request(base, "POST", `/admin/gym-listings/${orgId}/review`, { decision: "maybe" }, admin), 400, "unknown decision");
  expect(await request(base, "POST", `/admin/gym-listings/${orgId}/review`, { decision: "approve" }, admin), 200, "approve");
  expect(await request(base, "GET", "/admin/gym-listings", undefined, owner), 401, "an owner can't open the admin queue");

  // Athletes find it by name or area and choose it as their main gym.
  const found = expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${q}`, undefined, sam), 200, "search approved").gyms;
  assert.deepEqual(found.map((g) => g.org_id), [orgId]);
  assert.equal(found[0].equipment_count, 3);
  expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [orgId], main_org_id: "elsewhere" }, sam), 422, "main gym must be one of theirs");
  expect(await request(base, "PUT", "/account/onboarding/equipment", { available_equipment: ["kettlebell"] }, sam), 200, "home kit");
  const chosen = expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [orgId] }, sam), 200, "choose gym");
  assert.equal(chosen.main_gym.org_id, orgId, "the only gym is the main gym");
  assert.deepEqual(chosen.available_equipment, ["kettlebell"], "their own list is their home kit");
  assert.deepEqual((await getAthleteEquipment(sam.userId)).sort(), ["barbell", "bench", "kettlebell", "rack"], "main gym + home kit");

  // The gym sees "fewer than 3", then a count - never who.
  let view = expect(await request(base, "GET", `/org/organisations/${orgId}/gym-listing`, undefined, owner), 200, "owner view");
  assert.equal(view.athlete_count, null);
  for (const athlete of athletes.slice(1)) expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [orgId] }, athlete), 200, "another athlete chooses it");
  view = await request(base, "GET", `/org/organisations/${orgId}/gym-listing`, undefined, owner);
  assert.equal(view.json.athlete_count, 3);
  assert.equal(view.json.athletes_label, "3 athletes chose this gym");
  for (const athlete of athletes) {
    assert.ok(!view.text.includes(athlete.userId), "no athlete id reaches the gym");
  }
  assert.ok(!view.text.includes("Gym Athlete"), "no athlete name reaches the gym");

  // An edit keeps it listed; the owner sees the athletes' equipment change.
  expect(await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: gymName, area: "Leeds", equipment: ["barbell", "rack", "bench", "sled"] }, owner), 200, "edit listing");
  assert.ok((await getAthleteEquipment(sam.userId)).includes("sled"));

  // Hidden by an admin: no longer found, lends no equipment; the athlete keeps
  // their home kit.
  expect(await request(base, "POST", `/admin/gym-listings/${orgId}/review`, { decision: "hide", note: "Duplicate" }, admin), 200, "hide");
  assert.deepEqual(expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${q}`, undefined, sam), 200, "search hidden").gyms, []);
  assert.deepEqual(await getAthleteEquipment(sam.userId), ["kettlebell"]);
  const after = expect(await request(base, "GET", "/account/onboarding/equipment", undefined, sam), 200, "athlete view");
  assert.equal(after.main_gym, null);
  assert.equal(after.gyms[0].listed, false, "the gym stays in their list, marked no longer listed");
  expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [orgId] }, sam), 200, "keeping a gym they already had is fine");
  const owned = expect(await request(base, "GET", `/org/organisations/${orgId}/gym-listing`, undefined, owner), 200, "owner sees the note");
  assert.equal(owned.listing.listing_status, "hidden");
  assert.equal(owned.listing.review_note, "Duplicate");

  // Clearing their gyms.
  const cleared = expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [] }, sam), 200, "clear gyms");
  assert.deepEqual(cleared.gyms, []);
});
