# Deploying to an IONOS VPS

This guide runs Kolosseum on one IONOS Linux VPS. It uses `docker-compose.prod.yml`, which runs four containers:

- **Caddy:** HTTPS, with a Let's Encrypt certificate that renews itself.
- **app:** the Kolosseum server, which is not exposed to the internet.
- **db:** PostgreSQL 16, which is not exposed to the internet.
- **backup:** a nightly database dump plus a copy of uploaded files.

Push notifications, installing the app on a phone, and keeping the screen awake during a session all need HTTPS on a real domain. Before this guide, none of them could work for beta users.

The whole stack has been built and run locally: HTTPS, the HTTP→HTTPS redirect, the app port staying private, per-user rate limits behind the proxy, and a backup restored into a fresh database with every table intact.

## 1. Buy the server and a domain

- **VPS:** choose an IONOS **VPS Linux** plan with **at least 2 GB RAM**. Building the app runs the TypeScript compiler and Vite, which can run out of memory with 1 GB. Choose the **Ubuntu 24.04** image and a UK or EU data centre, so user data stays in the UK/EU.
- **Domain:** buy one, from IONOS or anywhere else, or use a subdomain of one you have. Create an **A record**, for example `app.yourdomain.com`, pointing at the VPS's IPv4 address. If the VPS has an IPv6 address, add an **AAAA record** too.
- **Firewall:** in the IONOS Cloud Panel, go to **Network → Firewall Policies**. Allow inbound **TCP 22** (SSH), **TCP 80**, **TCP 443** and **UDP 443**. Caddy can't get a certificate if 80/443 are closed.

## 2. Prepare the server

SSH in as root, using the password or SSH key from the Cloud Panel:

```bash
ssh root@<server-ip>
```

Update the system, turn on automatic security updates, and add 2 GB of swap as headroom for builds:

```bash
apt update && apt -y upgrade && apt -y install unattended-upgrades git
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Install Docker Engine and the Compose plugin from Docker's own apt repository. Follow the steps at https://docs.docker.com/engine/install/ubuntu/ ("Install using the apt repository"). Then check both:

```bash
docker --version && docker compose version
```

## 3. Get the code

The repository is private. Give the server read-only access with a **deploy key**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kolosseum_deploy -N ""
cat ~/.ssh/kolosseum_deploy.pub
```

Add that public key on GitHub: open the repository, then **Settings → Deploy keys → Add deploy key**, and leave write access off. Then clone:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/kolosseum_deploy" git clone git@github.com:robertsc2049-bit/kolosseum.git /opt/kolosseum
cd /opt/kolosseum
git config core.sshCommand "ssh -i ~/.ssh/kolosseum_deploy"
```

## 4. Configure

```bash
cp deploy/env.production.example .env
chmod 600 .env
nano .env
```

Fill in:

- **`KOLOSSEUM_DOMAIN` and `KOLOSSEUM_PUBLIC_APP_URL`:** your domain, without and with `https://`.
- **`POSTGRES_PASSWORD`:** generate one with `openssl rand -hex 24`. Never reuse a password.
- **`VAPID_*`:** run `node scripts/generate_vapid_keys.mjs` on your own computer, in the repo. Use a new pair for production, not your local development keys. `VAPID_SUBJECT` is `mailto:` followed by your email.
- **`RESEND_API_KEY` and `KOLOSSEUM_EMAIL_FROM`:** needed for real users. They email the sign-up verification and password-reset codes; without them nobody can reset a forgotten password. In Resend, add and verify a sending domain (a subdomain such as `mail.<your-domain>` keeps your main domain's email untouched), then create a key with Sending access. `KOLOSSEUM_EMAIL_FROM` is an address on that domain, e.g. `Kolosseum <no-reply@mail.<your-domain>>`. Outgoing port 25 being blocked on the VPS doesn't matter: Resend is called over HTTPS.
- **Optional:**
  - the two support-alert addresses, if you want an email when a user reports a problem;
  - Stripe, if the beta is paid;
  - `KOLOSSEUM_PROGRAMME_AUTHORS`.

`.env` holds secrets. It is never committed: `.gitignore` and `.dockerignore` both exclude it.

## 5. Start it

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app node scripts/apply-schema.mjs
```

The first build takes a few minutes. Then create your founder/admin account. There is deliberately no web route for this:

```bash
docker compose -f docker-compose.prod.yml exec -e ADMIN_BOOTSTRAP_TOKEN=<any-value-you-choose> app \
  node scripts/bootstrap_admin_account.mjs --email you@example.com --name "Your Name" --password "<16+ characters>"
```

## 6. Check it

- `https://<your-domain>/health` returns `{"status":"ok",...}`.
- `https://<your-domain>/app/` loads with a padlock. Register a test athlete.
- On your phone, open the site and install it with **Add to Home Screen**. Turn on notifications from the account screen.
- `https://<your-domain>/admin/` lets you sign in with the admin account from step 5.

If HTTPS fails, check that DNS points at the server (`dig +short <your-domain>`) and that ports 80/443 are open. Then read Caddy's logs:

```bash
docker compose -f docker-compose.prod.yml logs caddy
```

## Updating to a new version

```bash
cd /opt/kolosseum
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app node scripts/apply-schema.mjs
```

Re-applying the schema is always safe (see `test/schema_reapply_safety.test.mjs`).

## Backups

The `backup` container runs once at start-up and then every 24 hours. Each run writes `db_<time>.dump` and `uploads_<time>.tar.gz` to the `kolosseum-backups` volume, and keeps the last `BACKUP_KEEP_DAYS` days of them (14 by default).

To take a backup immediately:

```bash
docker compose -f docker-compose.prod.yml exec backup sh /backup.sh once
```

**These backups live on the same server, so losing the server loses them too.** Copy them off regularly. Either turn on IONOS's backup add-on for the VPS, or pull copies to your own computer:

```bash
# on the server
docker compose -f docker-compose.prod.yml cp backup:/backups /root/kolosseum-backups
# on your computer
scp -r root@<server-ip>:/root/kolosseum-backups ./kolosseum-backups
```

**Restoring the database** into a fresh, empty database:

```bash
docker compose -f docker-compose.prod.yml exec backup sh -c \
  'createdb -h db -U postgres kolosseum_restored && pg_restore -h db -U postgres -d kolosseum_restored /backups/db_<time>.dump'
```

When asked, give the `POSTGRES_PASSWORD` from `.env`. Check the restored copy, then point the app at it or rename the databases.

**Restoring uploads:** extract the matching `uploads_<time>.tar.gz` into the `kolosseum-uploads` volume.

## Day to day

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f app`
- **Restart:** `docker compose -f docker-compose.prod.yml restart app`
- **Daily operating checklist:** `docs/ops/V1_RUNBOOK.md`.
