import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { accountRateLimitKey } = await import(new URL("../dist/src/api/rate_limit_key.js", import.meta.url).href);

const request = (cookie, ip = "203.0.113.7") => ({ headers: cookie ? { cookie } : {}, ip });

test("athletes on one gym wifi each get their own rate-limit allowance", () => {
  const alex = accountRateLimitKey(request("theme=dark; kolosseum_session=alex-token"));
  const jordan = accountRateLimitKey(request("kolosseum_session=jordan-token"));
  assert.notEqual(alex, jordan);
  assert.equal(alex, accountRateLimitKey(request("kolosseum_session=alex-token", "198.51.100.4")), "same account, different network: one allowance");
});

test("org owner and admin sessions are counted per account too", () => {
  assert.match(accountRateLimitKey(request("kolosseum_org_owner_session=owner-token")), /^session:/u);
  assert.match(accountRateLimitKey(request("kolosseum_admin_session=admin-token")), /^session:/u);
});

test("a request with no session falls back to its IP", () => {
  assert.equal(accountRateLimitKey(request("theme=dark")), accountRateLimitKey(request(undefined)));
  assert.match(accountRateLimitKey(request(undefined)), /^ip:/u);
});

test("the key never contains the session token itself", () => {
  assert.ok(!accountRateLimitKey(request("kolosseum_session=secret-token-value")).includes("secret-token-value"));
});

test("every product rate limit counts per account", () => {
  const dir = new URL("../src/api/", import.meta.url);
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
    const source = fs.readFileSync(new URL(file, dir), "utf8");
    const limiters = source.match(/rateLimit\(\{/gu)?.length ?? 0;
    const keyed = source.match(/rateLimit\(\{\s*keyGenerator: accountRateLimitKey,/gu)?.length ?? 0;
    assert.equal(keyed, limiters, `${file}: every rateLimit({...}) passes keyGenerator: accountRateLimitKey`);
  }
});
