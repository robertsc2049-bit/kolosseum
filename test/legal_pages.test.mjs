// The Terms of Service and Privacy Notice people agree to at sign-up exist,
// are served from the app, and keep the clauses the product depends on:
// adults only, no medical advice, coaches are independent sellers paid
// directly, consumers' statutory rights, explicit consent for health data,
// a complaints route and the regulator, and England and Wales law. Both carry
// the version id sign-up records.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../public/app/legal/${file}`, import.meta.url), "utf8");
const text = (html) => html.replace(/<[^>]+>/gu, " ").replace(/&[a-z]+;/gu, " ").replace(/\s+/gu, " ");

test("the terms keep the clauses the product depends on", () => {
  const terms = text(read("terms.html"));
  for (const [clause, pattern] of [
    ["version id recorded at sign-up", /terms_v1/u],
    ["adults only", /at least 18 years old/u],
    ["no medical advice", /does not provide medical, physiotherapy, dietary or other healthcare advice/u],
    ["training risk", /inherent risk of injury/u],
    ["emergency", /call 999/u],
    ["coaches independent", /Coaches and Gym Owners are independent of Kolosseum/u],
    ["not the seller", /Kolosseum is not a party to that agreement and is not the seller of those services/u],
    ["fees paid directly, not held", /does not receive, hold or pass on that money/u],
    ["coach decides", /Coach is solely responsible for the programmes/u],
    ["sources, not instructions", /descriptions, not instructions/u],
    ["recognised programmes unaltered", /do not alter it/u],
    ["consumer rights kept", /Consumer Rights Act 2015/u],
    ["death or personal injury never excluded", /death or personal injury caused by our negligence/u],
    ["14-day cancellation", /Consumer Contracts \(Information, Cancellation and Additional Charges\) Regulations 2013/u],
    ["illegal content reporting", /Report a problem/u],
    ["business users: 15 days' notice", /at least 15 days' notice/u],
    ["business users: statement of reasons", /statement of reasons/u],
    ["governing law", /law of England and Wales/u],
    ["Scottish and NI consumers", /Scotland or Northern Ireland/u],
    ["marked as a draft for legal review", /Draft for legal review/u]
  ]) assert.match(terms, pattern, clause);
});

test("the privacy notice keeps the clauses the product depends on", () => {
  const privacy = text(read("privacy.html"));
  for (const [clause, pattern] of [
    ["version id recorded at sign-up", /consent_v1/u],
    ["health data on explicit consent", /Article 9\(2\)\(a\)/u],
    ["withdrawing consent", /withdraw your consent at any time/u],
    ["coach visibility", /While you are connected to a coach, that coach can see/u],
    ["gym owners see counts only", /Gym owners see only the number/u],
    ["no selling or advertising", /we do not sell it/u],
    ["processors named", /IONOS[\s\S]*Resend[\s\S]*Stripe/u],
    ["transfers safeguarded", /International Data Transfer Addendum/u],
    ["backups deleted within 14 days", /within 14 days/u],
    ["complain to us first (DPA 2018 s164A)", /acknowledge your complaint within 30 days/u],
    ["the regulator", /Information Commission/u],
    ["strictly necessary cookies only", /strictly necessary/u],
    ["no analytics", /We do not use analytics, advertising or tracking cookies/u],
    ["adults only", /aged 18 and over/u]
  ]) assert.match(privacy, pattern, clause);
});

test("the pages are self-contained: no scripts, no third-party requests", () => {
  for (const file of ["terms.html", "privacy.html"]) {
    const html = read(file);
    assert.doesNotMatch(html, /<script/iu, `${file} runs no scripts`);
    assert.doesNotMatch(html, /<(?:link|img|iframe)[^>]+(?:href|src)="https?:/iu, `${file} loads nothing from elsewhere`);
    assert.match(html, /<link rel="stylesheet" href="legal\.css">/u);
  }
});

test("sign-up records the same versions the pages show", () => {
  const service = fs.readFileSync(new URL("../src/api/product_account_service.ts", import.meta.url), "utf8");
  assert.match(service, /CURRENT_TERMS_VERSION = "terms_v1"/u, "bump the version in terms.html with CURRENT_TERMS_VERSION");
  assert.match(service, /CURRENT_CONSENT_VERSION = "consent_v1"/u, "bump the version in privacy.html with CURRENT_CONSENT_VERSION");
});
