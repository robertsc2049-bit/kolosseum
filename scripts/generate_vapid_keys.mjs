// Prints a VAPID key pair for phone notifications (Web Push). Put the three
// lines in .env (or the server's environment) and restart:
//   node scripts/generate_vapid_keys.mjs
// Generate once per environment and keep the private key secret - changing
// the keys means every phone has to turn notifications on again.
import crypto from "node:crypto";

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
// getPrivateKey() drops leading zero bytes; Web Push wants the full 32.
const privateKey = Buffer.concat([Buffer.alloc(32), ecdh.getPrivateKey()]).subarray(-32);
console.log(`VAPID_PRIVATE_KEY=${privateKey.toString("base64url")}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
