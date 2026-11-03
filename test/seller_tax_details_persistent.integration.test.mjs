// Coaches' tax details for HMRC platform reporting: a coach who sells
// packages adds their details (checked: NI number, UTR, postcode, 18+);
// each payment they record is kept at the package price; the admin
// downloads the year's details and quarterly totals. Only the coach and the
// admin can read them, and erasing the coach removes them.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { periodsCovered } from "../dist/src/api/package_membership_service.js";
import { validateTaxDetails } from "../dist/src/api/seller_tax_service.js";

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
  assert.equal(result.response.status, status, `${label}: ${result.text.slice(0, 300)}`);
  return result.json;
}

async function scryptHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(Buffer.from(key).toString("base64url"))));
  });
}

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

test("tax details are checked, and a payment counts the whole periods it covers", () => {
  const ok = { seller_type: "individual", legal_name: "Chris Roberts", date_of_birth: "1990-04-02", tax_number_type: "nino", tax_number: "qq 12 34 56 c", address_line1: "1 High St", city: "Leeds", postcode: "ls11ab" };
  const { details } = validateTaxDetails(ok);
  assert.deepEqual([details.tax_number, details.postcode, details.country, details.company_number], ["QQ123456C", "LS1 1AB", "GB", null]);
  assert.deepEqual(Object.keys(validateTaxDetails({ ...ok, tax_number: "12345" }).errors), ["tax_number"]);
  assert.deepEqual(Object.keys(validateTaxDetails({ ...ok, tax_number_type: "utr", tax_number: "12345 67890" }).errors), []);
  assert.deepEqual(Object.keys(validateTaxDetails({ ...ok, date_of_birth: day(-365 * 10) }).errors), ["date_of_birth"], "under 18");
  assert.deepEqual(Object.keys(validateTaxDetails({ ...ok, postcode: "nowhere" }).errors), ["postcode"]);
  assert.deepEqual(Object.keys(validateTaxDetails({ ...ok, vat_number: "123" }).errors), ["vat_number"]);
  assert.deepEqual(Object.keys(validateTaxDetails({ seller_type: "company", legal_name: "Roberts Coaching Ltd", company_number: "1234567", address_line1: "1 High St", city: "Leeds", postcode: "LS1 1AB" }).errors), ["company_number"]);
  assert.deepEqual(validateTaxDetails({ seller_type: "company", legal_name: "Roberts Coaching Ltd", company_number: "01234567", address_line1: "1 High St", city: "Leeds", postcode: "LS1 1AB" }).errors, {}, "a company needs no date of birth or tax number");

  // Monthly from 23 Oct: periods end 22 Nov, 22 Dec...
  assert.equal(periodsCovered("2026-10-23", "monthly", null, "2026-11-22"), 1);
  assert.equal(periodsCovered("2026-10-23", "monthly", "2026-11-22", "2027-01-22"), 2);
  assert.equal(periodsCovered("2026-10-23", "monthly", "2026-11-01", "2026-11-22"), 1, "from part way through: the period it completes");
  assert.equal(periodsCovered("2026-10-23", "monthly", "2026-11-22", "2026-12-10"), 0, "part of a period");
  assert.equal(periodsCovered("2026-10-23", "monthly", "2026-12-22", "2026-11-22"), -1, "moved back");
});

test("a coach adds tax details, payments are kept, and the admin downloads the year", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  let adminId = "";
  let ownerId = "";
  let otherOwnerId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_package_payments WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_tax_details WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_package_memberships WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_service_packages WHERE coach_user_id = ANY($1::text[]) OR org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $2)", [userIds, ownerId]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    if (otherOwnerId) {
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [otherOwnerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [otherOwnerId]).catch(() => {});
    }
    if (ownerId) {
      await pool.query("DELETE FROM product_gym_tax_details WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_gym_listings WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [ownerId]).catch(() => {});
    }
    for (const id of userIds) for (const table of ["product_notifications", "product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) {
      await pool.query(`DELETE FROM ${table} WHERE ${table === "product_notifications" ? "recipient_user_id" : "user_id"} = $1`, [id]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    if (adminId) {
      await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminId]).catch(() => {});
      await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminId]).catch(() => {});
    }
    await pool.end();
  });

  const register = async (actor, label, name) => {
    const email = `stax_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `TaxDetails${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1991-03-03"
    });
    expect(reg, 201, `${label} registers`);
    userIds.push(reg.json.account.user_id);
    return { userId: reg.json.account.user_id, email, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token };
  };

  const coach = await register("coach", "coach", "Chris Roberts");
  for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: "Chris Roberts", email: coach.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
    const result = await request(base, method, path, body, coach);
    assert.ok(result.response.status < 300, `${path}: ${result.text}`);
  }
  const athlete = await register("athlete", "sam", "Sam Lifter");
  expect(await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: athlete.email }, coach), 201, "invite");
  const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");

  // No details yet; athletes can't read or write any.
  let mine = expect(await request(base, "GET", "/check-ins/tax-details", undefined, coach), 200, "none yet");
  assert.deepEqual([mine.tax_details, mine.sells_packages], [null, false]);
  expect(await request(base, "GET", "/check-ins/tax-details", undefined, athlete), 403, "athletes can't");

  // A package, paid for the first month; then another month.
  const online = expect(await request(base, "POST", "/coach-branding/packages", { name: "Online coaching", price: 80, billing: "monthly", includes: { programming: true } }, coach), 201, "package").packages[0];
  const pkg = `/check-ins/athletes/${athlete.userId}/package`;
  const started = expect(await request(base, "PUT", pkg, { package_id: online.package_id, started_on: day(-5), paid_now: true }, coach), 200, "start").membership;
  const paid = expect(await request(base, "POST", `${pkg}/payment`, {}, coach), 200, "pay a month").membership;
  const payments = (await pool.query("SELECT paid_until_from::text AS f, paid_until_to::text AS t, periods, amount_minor, currency FROM product_package_payments WHERE coach_user_id = $1 ORDER BY recorded_at", [coach.userId])).rows;
  assert.deepEqual(payments, [
    { f: null, t: started.paid_until, periods: 1, amount_minor: 8000, currency: "GBP" },
    { f: started.paid_until, t: paid.paid_until, periods: 1, amount_minor: 8000, currency: "GBP" }
  ]);
  assert.equal(expect(await request(base, "GET", "/check-ins/tax-details", undefined, coach), 200, "sells").sells_packages, true);

  // Details are checked, then saved.
  const bad = expect(await request(base, "PUT", "/check-ins/tax-details", { seller_type: "individual", legal_name: "", tax_number_type: "nino", tax_number: "nope" }, coach), 422, "bad details");
  assert.ok(bad.field_errors.legal_name && bad.field_errors.tax_number && bad.field_errors.date_of_birth && bad.field_errors.postcode);
  mine = expect(await request(base, "PUT", "/check-ins/tax-details", {
    seller_type: "individual", legal_name: "Christopher Roberts", date_of_birth: "1988-06-15", tax_number_type: "nino", tax_number: "QQ123456C",
    vat_number: "", address_line1: "1 High Street", city: "Leeds", postcode: "ls1 1ab", country: "GB"
  }, coach), 200, "save");
  assert.deepEqual([mine.tax_details.legal_name, mine.tax_details.tax_number, mine.tax_details.postcode], ["Christopher Roberts", "QQ123456C", "LS1 1AB"]);
  expect(await request(base, "PUT", "/check-ins/tax-details", { seller_type: "individual" }, athlete), 403, "athletes can't write");

  // Sam moves to a gym's PT block, which Chris delivers, paid in full: that money is the gym's.
  const ownerEmail = `stax_owner_${nonce}@example.com`;
  const ownerReg = await request(base, "POST", "/org/register", { email: ownerEmail, display_name: "Gym Owner", password: `GymOwner${nonce}!2026` });
  ownerId = expect(ownerReg, 201, "owner").org_owner.user_id;
  const owner = { cookie: cookieOf(ownerReg, "kolosseum_org_owner_session"), csrf: ownerReg.json.csrf_token };
  const gymName = `Forge ${nonce}`;
  const orgId = expect(await request(base, "POST", "/org/organisations", { org_name: gymName, activity_id: "powerlifting", visibility_mode: "individual" }, owner), 201, "gym").organisation.org_id;
  expect(await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: gymName, area: "York", equipment: ["barbell", "rack"] }, owner), 200, "listing");
  await pool.query("UPDATE product_gym_listings SET listing_status = 'approved', reviewed_at = now() WHERE org_id = $1", [orgId]);
  expect(await request(base, "POST", "/coach-branding/gyms", { org_id: orgId }, coach), 201, "coach adds gym");
  const link = expect(await request(base, "GET", `/org/organisations/${orgId}/gym-coaches`, undefined, owner), 200, "gym coaches").coaches[0];
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${link.coach_gym_id}/decision`, { decision: "confirm" }, owner), 200, "confirm");
  const ptBlock = expect(await request(base, "POST", `/org/organisations/${orgId}/packages`, { name: "PT block", price: 120, billing: "one_off", includes: { in_person_sessions: 4 }, delivered_by: [coach.userId] }, owner), 201, "gym package").packages[0];
  assert.equal(expect(await request(base, "PUT", pkg, { package_id: ptBlock.package_id, paid_now: true }, coach), 200, "gym package").membership.paid_in_full, true);

  // The gym's owner is asked for the gym's tax details, and adds them (a company: no date of birth).
  const gymTax = `/org/organisations/${orgId}/tax-details`;
  let gymDetails = expect(await request(base, "GET", gymTax, undefined, owner), 200, "gym: none yet");
  assert.deepEqual([gymDetails.tax_details, gymDetails.sells_packages], [null, true]);
  expect(await request(base, "GET", gymTax, undefined, coach), 401, "a coach can't");
  const otherOwnerReg = await request(base, "POST", "/org/register", { email: `stax_owner2_${nonce}@example.com`, display_name: "Other Owner", password: `GymOwner${nonce}!2026` });
  otherOwnerId = expect(otherOwnerReg, 201, "other owner").org_owner.user_id;
  const otherOwner = { cookie: cookieOf(otherOwnerReg, "kolosseum_org_owner_session"), csrf: otherOwnerReg.json.csrf_token };
  expect(await request(base, "GET", gymTax, undefined, otherOwner), 403, "not their gym");
  expect(await request(base, "PUT", gymTax, { seller_type: "company" }, otherOwner), 403, "not their gym to change");
  assert.ok(expect(await request(base, "PUT", gymTax, { seller_type: "company", legal_name: "Forge Gyms Ltd" }, owner), 422, "incomplete").field_errors.company_number);
  gymDetails = expect(await request(base, "PUT", gymTax, {
    seller_type: "company", legal_name: "Forge Gyms Ltd", company_number: "01234567", tax_number_type: "utr", tax_number: "1234567890",
    vat_number: "GB123456789", address_line1: "2 Mill Lane", city: "York", postcode: "yo1 7hh", country: "GB"
  }, owner), 200, "gym saves");
  assert.deepEqual([gymDetails.tax_details.legal_name, gymDetails.tax_details.date_of_birth, gymDetails.tax_details.postcode], ["Forge Gyms Ltd", null, "YO1 7HH"]);

  // The admin's report for this year: the coach's details and this quarter's two payments.
  const adminEmail = `stax_admin_${nonce}@example.com`;
  const adminPassword = `TaxAdmin${nonce}!2026`;
  const salt = crypto.randomBytes(24).toString("base64url");
  adminId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query("INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)", [adminId, adminEmail, "Tax Admin", salt, await scryptHash(adminPassword, salt)]);
  const adminIn = expect(await request(base, "POST", "/admin/sign-in", { email: adminEmail, password: adminPassword }), 200, "admin signs in");
  const admin = { cookie: cookieOf(await request(base, "POST", "/admin/sign-in", { email: adminEmail, password: adminPassword }), "kolosseum_admin_session"), csrf: adminIn.csrf_token };
  expect(await request(base, "GET", "/admin/seller-tax-report?year=1999", undefined, admin), 400, "a year we can't have");
  expect(await request(base, "GET", `/admin/seller-tax-report?year=${new Date().getUTCFullYear()}`, undefined, coach), 401, "a coach can't");
  const report = expect(await request(base, "GET", `/admin/seller-tax-report?year=${new Date().getUTCFullYear()}`, undefined, admin), 200, "report").report;
  const quarter = Math.floor(new Date().getUTCMonth() / 3) + 1;
  const row = report.rows.find((r) => r.seller_id === coach.userId);
  assert.deepEqual(
    [row.details_added, row.legal_name, row.date_of_birth, row.tax_number_type, row.tax_number, row.postcode, row.currency, row[`q${quarter}_paid`], row[`q${quarter}_payments`], row.year_paid, row.platform_fees],
    ["yes", "Christopher Roberts", "1988-06-15", "nino", "QQ123456C", "LS1 1AB", "GBP", "160.00", "2", "160.00", "0.00"]
  );
  assert.deepEqual([row.seller_kind, row.seller_name], ["coach", "Chris Roberts"]);
  assert.equal(report.rows.some((r) => r.seller_id === athlete.userId), false, "athletes aren't sellers");
  assert.deepEqual(Object.keys(row), report.columns);
  // The gym's own row: the PT block it sold, not added to the coach who delivers it.
  const gymRow = report.rows.find((r) => r.seller_id === orgId);
  assert.deepEqual(
    [gymRow.seller_kind, gymRow.seller_name, gymRow.account_email, gymRow.details_added, gymRow.legal_name, gymRow.company_number, gymRow.tax_number, gymRow.vat_number,
      gymRow[`q${quarter}_paid`], gymRow[`q${quarter}_payments`], gymRow.year_paid],
    ["gym", gymName, ownerEmail, "yes", "Forge Gyms Ltd", "01234567", "1234567890", "GB123456789", "120.00", "1", "120.00"]
  );
});
