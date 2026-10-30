// A coach's share link: the coach switches on a public page at /c/<slug>
// with a QR code; it shows only what their athletes already see, and
// nothing at all while it's off. Someone who follows it asks the coach to
// coach them, and the coach invites them from the usual Requests list.
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

test("a coach shares their link; someone who follows it asks them and gets invited", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_coaching_requests WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_share_links WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name = `${label} Person`) => {
    const email = `share_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `ShareLink${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
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
  const business = `Old Tyme Strength ${nonce}`;
  expect(await request(base, "POST", "/coach-branding", { brand_color: "#8a5a2b", business_name: business, brand_tagline: "Barbell strength, the <old> way." }, coach), 201, "branding");
  expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: "Garage Gym", area: "York" }, coach), 201, "typed gym");

  // Off until the coach turns it on, with an address suggested from the business name.
  const fresh = expect(await request(base, "GET", "/coach-branding/share-link", undefined, coach), 200, "share link");
  assert.equal(fresh.share_link, null);
  const slug = `old-tyme-strength-${nonce}`;
  assert.equal(fresh.suggested_slug, slug);
  expect(await request(base, "GET", `/c/${slug}`), 404, "no page before it's on");

  // Addresses are checked.
  for (const [bad, code] of [["ab", "coach_share_link_slug_invalid"], ["Has Spaces", "coach_share_link_slug_invalid"], ["-dash", "coach_share_link_slug_invalid"], ["admin", "coach_share_link_slug_reserved"]]) {
    assert.equal(expect(await request(base, "PUT", "/coach-branding/share-link", { slug: bad, enabled: true }, coach), 422, bad).error, code);
  }
  expect(await request(base, "PUT", "/coach-branding/share-link", { slug, enabled: true }, { cookie: coach.cookie }), 403, "needs the CSRF token");
  const on = expect(await request(base, "PUT", "/coach-branding/share-link", { slug, enabled: true }, coach), 200, "turn on");
  assert.deepEqual(on.share_link, { slug, enabled: true, path: `/c/${slug}` });

  // The public page: name, business, tagline (escaped), gyms - no email, no id.
  const page = await request(base, "GET", `/c/${slug}`);
  expect(page, 200, "public page");
  assert.match(page.response.headers.get("content-type"), /text\/html/);
  for (const shown of ["Chris Roberts", business, "Barbell strength, the &lt;old&gt; way.", "Garage Gym, York", `href="/app/?coach=${slug}"`]) assert.ok(page.text.includes(shown), `page shows ${shown}`);
  assert.ok(!page.text.includes("<old>"), "tagline is escaped");
  assert.ok(!page.text.includes(coach.email) && !page.text.includes(coach.userId), "no email or id on the public page");
  const card = expect(await request(base, "GET", `/c/${slug.toUpperCase()}/card`), 200, "card, any case").coach;
  assert.deepEqual([card.display_name, card.business_name, card.brand_color, card.gyms], ["Chris Roberts", business, "#8a5a2b", ["Garage Gym, York"]]);
  assert.ok(!JSON.stringify(card).includes(coach.userId));

  // The QR codes.
  const png = await request(base, "GET", `/c/${slug}/qr.png`);
  expect(png, 200, "qr png");
  assert.equal(png.response.headers.get("content-type"), "image/png");
  assert.deepEqual([...png.buffer.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const download = await request(base, "GET", `/c/${slug}/qr.png?download`);
  assert.match(download.response.headers.get("content-disposition"), new RegExp(`attachment; filename="${slug}-qr.png"`));
  const svg = await request(base, "GET", `/c/${slug}/qr.svg`);
  expect(svg, 200, "qr svg");
  assert.match(svg.response.headers.get("content-type"), /image\/svg\+xml/);
  assert.ok(svg.text.startsWith("<svg") && svg.text.includes("<path"));

  // No one else can take the address.
  const other = await register("coach", "other", "Pat Other");
  await finishCoachSetup(other, "Pat Other");
  assert.equal(expect(await request(base, "PUT", "/coach-branding/share-link", { slug, enabled: true }, other), 409, "taken").error, "coach_share_link_slug_taken");
  expect(await request(base, "GET", "/coach-branding/share-link", undefined, (await register("athlete", "notcoach"))), 403, "athletes have no share link");

  // Someone follows it, signs up and asks.
  const athlete = await register("athlete", "athlete", "Sam Lifter");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: "no-such-coach" }, athlete), 404, "unknown link");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug, note: "Want to compete next year." }, athlete), 201, "ask through the link");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug }, athlete), 409, "not twice");

  const notes = expect(await request(base, "GET", "/account/notifications", undefined, coach), 200, "coach bell").notifications;
  const asked = notes.filter((n) => n.notification_type === "coaching_requested");
  assert.deepEqual(asked.map((n) => [n.notification_payload.athlete_display_name, n.notification_payload.org_name]), [["Sam Lifter", null]]);
  const list = expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, coach), 200, "requests").requests;
  assert.deepEqual(list.map((r) => [r.athlete_display_name, r.via_share_link, r.gym_name, r.note]), [["Sam Lifter", true, null, "Want to compete next year."]]);
  expect(await request(base, "POST", `/coach-workspace/coaching-requests/${list[0].request_id}/decision`, { decision: "invite" }, coach), 200, "invite");
  const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === coach.userId);
  assert.ok(invitation, "the athlete has the invitation");
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug }, athlete), 409, "already coached");

  // Turned off: the page, card and QR codes are gone, and no one can ask.
  expect(await request(base, "PUT", "/coach-branding/share-link", { slug, enabled: false }, coach), 200, "turn off");
  for (const path of [`/c/${slug}`, `/c/${slug}/card`, `/c/${slug}/qr.png`, `/c/${slug}/qr.svg`]) expect(await request(base, "GET", path), 404, `${path} off`);
  const late = await register("athlete", "late");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug }, late), 404, "can't ask through a link that's off");

  // Kept, switched off, so the coach can turn it back on.
  const exported = await pool.query("SELECT slug, enabled FROM product_coach_share_links WHERE coach_user_id = $1", [coach.userId]);
  assert.deepEqual(exported.rows, [{ slug, enabled: false }]);
});
