// Behind a reverse proxy (Caddy in docker-compose.prod.yml) every request
// arrives from the proxy, so without trusting it req.ip is one address for
// every user and the per-IP rate limits throttle all users as one.
// KOLOSSEUM_TRUST_PROXY is the number of proxy hops in front of the app;
// unset (bare metal, local dev) trusts none, so X-Forwarded-For can't be
// spoofed where nothing sets it.
export function trustProxySetting(raw: string | undefined): number | false {
  const hops = Number(String(raw ?? "").trim());
  return Number.isInteger(hops) && hops > 0 && hops <= 10 ? hops : false;
}
