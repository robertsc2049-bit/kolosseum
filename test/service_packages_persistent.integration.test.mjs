// Coaching packages: a coach or a gym lists what they offer - price, how
// often it's paid, what's included - and athletes see the coach's on the
// share page and their coach's card, and a gym's under the gym when they
// look for one. A gym's packages name its confirmed coaches.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function request(base, method, route, body, options = {}) {
  const headers = { origin: base };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json, buffer };
}

function cookieOf(result, name) {
  const found = result.response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `expected ${name} cookie`);
  return found.split(";")[0];
}

function expect(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${result.text.slice(0, 300)}`);
  return result.json;
}

test("coaches and gyms build packages; athletes see them on the share page, their coach's card and under a gym", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  const ownerIds = [];
  let ownerId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (ownerId) ownerIds.push(ownerId);
    await pool.query("DELETE FROM product_service_packages WHERE coach_user_id = ANY($1::text[]) OR org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($2::text[]))", [userIds, ownerIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_share_links WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[]) OR recipient_user_id = ANY($2::text[])", [userIds, ownerIds]).catch(() => {});
    for (const id of ownerIds) {
      await pool.query("DELETE FROM product_gym_listings WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [id]).catch(() => {});
      await pool.query("DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [id]).catch(() => {});
      await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [id]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [id]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [id]).catch(() => {});
    }
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name) => {
    const email = `pkg_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `Packages${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1991-03-03"
    });
    expect(reg, 201, `${label} registers`);
    userIds.push(reg.json.account.user_id);
    return { userId: reg.json.account.user_id, email, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token };
  };
  const finishCoachSetup = async (who, name) => {
    for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: name, email: who.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
      const result = await request(base, method, path, body, who);
      assert.ok(result.response.status < 300, `${path}: ${result.text}`);
    }
  };

  const coach = await register("coach", "coach", "Chris Roberts");
  await finishCoachSetup(coach, "Chris Roberts");
  const other = await register("coach", "other", "Pat Other");
  await finishCoachSetup(other, "Pat Other");
  const athlete = await register("athlete", "athlete", "Sam Lifter");

  // A coach's packages: checked, listed cheapest first, edited, removed.
  const online = { name: "Online coaching", price: 80, billing: "monthly", description: "A programme written for you", includes: { programming: true, checkin_calls: 2, session_reviews: "weekly", messaging: true } };
  for (const [change, field] of [[{ name: "" }, "name"], [{ price: -1 }, "price"], [{ price: 12.345 }, "price"], [{ billing: "daily" }, "billing"], [{ currency: "JPY" }, "currency"], [{ includes: { checkin_calls: 31 } }, "checkin_calls"], [{ includes: {} }, "includes"]]) {
    assert.ok(expect(await request(base, "POST", "/coach-branding/packages", { ...online, ...change }, coach), 422, JSON.stringify(change)).field_errors[field], `${field} explained`);
  }
  expect(await request(base, "POST", "/coach-branding/packages", online, { cookie: coach.cookie }), 403, "needs CSRF");
  expect(await request(base, "POST", "/coach-branding/packages", online, athlete), 403, "athletes can't");
  let mine = expect(await request(base, "POST", "/coach-branding/packages", online, coach), 201, "add").packages;
  mine = expect(await request(base, "POST", "/coach-branding/packages", { name: "Programme only", price: 45.5, billing: "monthly", includes: { programming: true } }, coach), 201, "add 2").packages;
  mine = expect(await request(base, "POST", "/coach-branding/packages", { name: "1-1 session", price: 40, billing: "one_off", includes: { in_person_sessions: 1 } }, coach), 201, "add 3").packages;
  assert.deepEqual(mine.map((p) => [p.name, p.price_label]), [["1-1 session", "£40"], ["Programme only", "£45.50 a month"], ["Online coaching", "£80 a month"]]);
  assert.deepEqual(mine[2].includes_summary, ["Programming", "2 check-in calls a month", "Weekly session review", "Messaging with your coach"]);
  assert.deepEqual(mine[0].includes_summary, ["1 in-person session"]);
  const onlineId = mine[2].package_id;
  mine = expect(await request(base, "PUT", `/coach-branding/packages/${onlineId}`, { ...online, price: 90, includes: { ...online.includes, in_person_sessions: 1 } }, coach), 200, "edit").packages;
  assert.equal(mine.find((p) => p.package_id === onlineId).price_label, "£90 a month");
  expect(await request(base, "PUT", `/coach-branding/packages/${onlineId}`, online, other), 404, "another coach's");
  mine = expect(await request(base, "POST", `/coach-branding/packages/${mine[0].package_id}/archive`, {}, coach), 200, "remove").packages;
  assert.deepEqual(mine.map((p) => p.name), ["Programme only", "Online coaching"]);

  // Athletes see them on the share page and on their coach's card.
  expect(await request(base, "PUT", "/coach-branding/share-link", { slug: `pkg-${nonce}`, enabled: true }, coach), 200, "share link on");
  const page = await request(base, "GET", `/c/pkg-${nonce}`);
  for (const shown of ["Online coaching", "£90 a month", "2 check-in calls a month", "1 in-person session a month", "Programme only", "You pay them directly"]) assert.ok(page.text.includes(shown), `share page shows ${shown}`);
  assert.ok(!page.text.includes("1-1 session"), "removed packages don't show");
  assert.equal(expect(await request(base, "GET", `/c/pkg-${nonce}/card`), 200, "card").coach.packages.length, 2);
  const invite = await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: athlete.email }, coach);
  assert.ok(invite.response.status < 300);
  const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
  assert.deepEqual(invitation.coach_packages.map((p) => p.name), ["Programme only", "Online coaching"]);
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");
  const relationships = expect(await request(base, "GET", "/coach-workspace/relationships/mine", undefined, athlete), 200, "mine");
  const mineRel = (relationships.relationships ?? []).find((r) => r.coach_user_id === coach.userId);
  assert.equal(mineRel.coach_packages[1].price_label, "£90 a month");

  // A gym's packages, delivered by its confirmed coaches.
  const ownerReg = await request(base, "POST", "/org/register", { email: `pkg_owner_${nonce}@example.com`, display_name: "Gym Owner", password: `GymOwner${nonce}!2026` });
  ownerId = expect(ownerReg, 201, "owner").org_owner.user_id;
  const owner = { cookie: cookieOf(ownerReg, "kolosseum_org_owner_session"), csrf: ownerReg.json.csrf_token };
  const gymName = `Forge ${nonce}`;
  const orgId = expect(await request(base, "POST", "/org/organisations", { org_name: gymName, activity_id: "powerlifting", visibility_mode: "individual" }, owner), 201, "gym").organisation.org_id;
  expect(await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: gymName, area: "York", equipment: ["barbell", "rack"] }, owner), 200, "listing");
  await pool.query("UPDATE product_gym_listings SET listing_status = 'approved', reviewed_at = now() WHERE org_id = $1", [orgId]);
  expect(await request(base, "POST", "/coach-branding/gyms", { org_id: orgId }, coach), 201, "coach adds gym");
  expect(await request(base, "POST", "/coach-branding/gyms", { org_id: orgId }, other), 201, "other coach adds gym");
  const chris = expect(await request(base, "GET", `/org/organisations/${orgId}/gym-coaches`, undefined, owner), 200, "gym coaches").coaches.find((c) => c.display_name === "Chris Roberts");
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${chris.coach_gym_id}/decision`, { decision: "confirm" }, owner), 200, "confirm Chris");

  const gymList = expect(await request(base, "GET", `/org/organisations/${orgId}/packages`, undefined, owner), 200, "gym packages");
  assert.deepEqual([gymList.packages, gymList.coaches.map((c) => c.display_name)], [[], ["Chris Roberts"]], "only confirmed coaches can deliver");
  const pt = { name: "PT block", price: 120, billing: "one_off", includes: { in_person_sessions: 4, programming: true } };
  assert.ok(expect(await request(base, "POST", `/org/organisations/${orgId}/packages`, { ...pt, delivered_by: [other.userId] }, owner), 422, "unconfirmed coach").field_errors.delivered_by);
  const gymPackages = expect(await request(base, "POST", `/org/organisations/${orgId}/packages`, { ...pt, delivered_by: [coach.userId] }, owner), 201, "gym package").packages;
  assert.deepEqual([gymPackages[0].price_label, gymPackages[0].includes_summary, gymPackages[0].delivered_by.map((c) => c.display_name)], ["£120", ["Programming", "4 in-person sessions"], ["Chris Roberts"]]);
  const strangerOwner = await request(base, "POST", "/org/register", { email: `pkg_owner2_${nonce}@example.com`, display_name: "Other Owner", password: `GymOwner${nonce}!2026` });
  ownerIds.push(strangerOwner.json.org_owner.user_id);
  expect(await request(base, "GET", `/org/organisations/${orgId}/packages`, undefined, { cookie: cookieOf(strangerOwner, "kolosseum_org_owner_session") }), 403, "another owner");

  // Athletes see the gym's packages when they look for a gym.
  const found = expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${encodeURIComponent(nonce)}`, undefined, athlete), 200, "search").gyms;
  assert.deepEqual(found[0].packages.map((p) => [p.name, p.price_label, p.delivered_by.map((c) => c.display_name)]), [["PT block", "£120", ["Chris Roberts"]]]);
  assert.ok(!JSON.stringify(found).includes(coach.email), "no coach email");

  // When the gym stops confirming a coach, they drop off its packages.
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${chris.coach_gym_id}/decision`, { decision: "remove" }, owner), 200, "remove Chris");
  assert.deepEqual(expect(await request(base, "GET", `/org/organisations/${orgId}/packages`, undefined, owner), 200, "after").packages[0].delivered_by, []);
  expect(await request(base, "POST", `/org/organisations/${orgId}/packages/${gymPackages[0].package_id}/archive`, {}, owner), 200, "archive gym package");
  assert.deepEqual(expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${encodeURIComponent(nonce)}`, undefined, athlete), 200, "search 2").gyms[0].packages, []);
});
