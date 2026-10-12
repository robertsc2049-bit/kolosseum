// DEV NOTE: Web Push sender (RFC 8030 delivery, RFC 8291 aes128gcm payload
// encryption, RFC 8292 VAPID) on Node's built-in crypto - no dependency.
// Configured by VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url, from
// `node scripts/generate_vapid_keys.mjs`) and VAPID_SUBJECT (a mailto: or
// https: contact URL); unconfigured, push is simply off.
//
// The server only ever sends to the browser vendors' push services: an
// endpoint is a URL the browser hands the client, so it's checked against
// their hosts before it's stored or used (no request to arbitrary hosts).

import crypto from "node:crypto";

export type PushSubscriptionKeys = Readonly<{ endpoint: string; p256dh: string; auth: string }>;
export type VapidConfig = Readonly<{ publicKey: string; privateKey: string; subject: string }>;

const PUSH_SERVICE_HOSTS: readonly RegExp[] = [
  /^fcm\.googleapis\.com$/u,
  /^android\.googleapis\.com$/u,
  /^updates\.push\.services\.mozilla\.com$/u,
  /^web\.push\.apple\.com$/u,
  /^[a-z0-9-]+\.push\.apple\.com$/u,
  /^[a-z0-9-]+\.notify\.windows\.com$/u
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try { url = new URL(endpoint); }
  catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  return PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
}

const b64url = (buffer: Buffer): string => buffer.toString("base64url");
const fromB64url = (value: string): Buffer => Buffer.from(value, "base64url");

export function vapidConfigFromEnv(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = String(env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = String(env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = String(env.VAPID_SUBJECT ?? "").trim();
  if (!publicKey || !privateKey || !/^(mailto:|https:)/u.test(subject)) return null;
  if (fromB64url(publicKey).length !== 65 || fromB64url(privateKey).length !== 32) return null;
  return Object.freeze({ publicKey, privateKey, subject });
}

// A P-256 key pair as Web Push wants it: the raw uncompressed public point
// and the raw private scalar, base64url.
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  // getPrivateKey() drops leading zero bytes; Web Push wants the full 32.
  const privateKey = Buffer.concat([Buffer.alloc(32), ecdh.getPrivateKey()]).subarray(-32);
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(privateKey) };
}

function vapidPrivateKeyObject(config: VapidConfig): crypto.KeyObject {
  const point = fromB64url(config.publicKey);
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: config.privateKey, x: b64url(point.subarray(1, 33)), y: b64url(point.subarray(33, 65)) },
    format: "jwk"
  });
}

// RFC 8292: a short-lived ES256 JWT naming the push service's origin.
export function vapidAuthorization(endpoint: string, config: VapidConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: config.subject })));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key: vapidPrivateKeyObject(config), dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${config.publicKey}`;
}

// RFC 8291: encrypt the payload to the browser's key, as one aes128gcm record.
export function encryptPushPayload(
  payload: Buffer,
  keys: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  // A fresh key pair and salt per message; tests pass fixed ones.
  ephemeral?: crypto.ECDH,
  salt: Buffer = crypto.randomBytes(16)
): Buffer {
  const userAgentPublic = fromB64url(keys.p256dh);
  const authSecret = fromB64url(keys.auth);
  if (userAgentPublic.length !== 65 || authSecret.length !== 16) throw new Error("push_subscription_keys_invalid");
  if (!ephemeral) {
    ephemeral = crypto.createECDH("prime256v1");
    ephemeral.generateKeys();
  }
  const serverPublic = ephemeral.getPublicKey();
  const shared = ephemeral.computeSecret(userAgentPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), userAgentPublic, serverPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  // A single record: the payload, then the 0x02 last-record delimiter.
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublic.length]), serverPublic, body]);
}

export type PushSendResult = Readonly<{ ok: boolean; status: number; gone: boolean }>;

// Send one notification. `gone` means the subscription no longer exists
// (unsubscribed, app removed) and should be deleted.
export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: Readonly<Record<string, unknown>>,
  config: VapidConfig,
  fetchImpl: typeof fetch = fetch
): Promise<PushSendResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) return Object.freeze({ ok: false, status: 0, gone: true });
  const body = encryptPushPayload(Buffer.from(JSON.stringify(payload)), subscription);
  const response = await fetchImpl(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, config),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(24 * 3600),
      Urgency: "normal"
    },
    body: new Uint8Array(body),
    redirect: "error"
  });
  return Object.freeze({ ok: response.ok, status: response.status, gone: response.status === 404 || response.status === 410 });
}
