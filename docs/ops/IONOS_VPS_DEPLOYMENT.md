# Deploying to an IONOS VPS

This guide runs Kolosseum on one IONOS Linux VPS. It uses `docker-compose.prod.yml`, which runs four containers:

- **Caddy:** HTTPS, with a Let's Encrypt certificate that renews itself.
- **app:** the Kolosseum server, which is not exposed to the internet.
- **db:** PostgreSQL 16, which is not exposed to the internet.
- **backup:** a nightly database dump plus a copy of uploaded files.
- **offsite:** copies those backups to IONOS S3 Object Storage, once you've set it up (see Backups).

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
- **`KOLOSSEUM_ADMIN_TWO_STEP_KEY`:** generate one with `openssl rand -base64 32`. It encrypts the admin console's two-step sign-in secrets. Once it's set, every admin must set up two-step sign-in (an authenticator app code after the password) before the console does anything else. Don't change it later: that makes every admin's authenticator stop working until reset (see "Day to day").
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
- `https://<your-domain>/admin/` lets you sign in with the admin account from step 5. It then asks you to set up two-step sign-in: scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy and so on), enter its code, and keep the 8 backup codes somewhere safe, away from your password.

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

The `backup` container runs once at start-up and then every 24 hours. Each run writes `db_<time>.dump` and `uploads_<time>.tar.gz` to the `kolosseum-backups` volume, and keeps the last `BACKUP_KEEP_DAYS` days of them (14 by default). A run that fails (for example while the database is restarting) leaves no file behind, logs `backup … FAILED` (`docker compose -f docker-compose.prod.yml logs backup`) and tries again 10 minutes later.

To take a backup immediately:

```bash
docker compose -f docker-compose.prod.yml exec backup sh /backup.sh once
```

### Off the server: IONOS S3 Object Storage

The backups above sit on the same server, so losing the server would lose them too. The `offsite` container copies each new backup to IONOS S3 Object Storage every hour, and deletes copies there older than `BACKUP_KEEP_DAYS`. It does nothing until you set it up:

1. In the IONOS console, open **S3 Object Storage** and create a bucket, e.g. `kolosseum-backups-<something-unique>`. Choose the region **Frankfurt (de)** unless you have a reason not to. Keep it private.
2. Under **Access keys**, create a key. Copy the access key and the secret key - the secret is shown once.
3. On the server, add them to `.env` (type them in yourself; never paste them anywhere else):

   ```bash
   OFFSITE_BACKUP_BUCKET=<bucket name>
   OFFSITE_BACKUP_ACCESS_KEY=<access key>
   OFFSITE_BACKUP_SECRET_KEY=<secret key>
   ```

   If the bucket isn't in Frankfurt, also set `OFFSITE_BACKUP_ENDPOINT` and `OFFSITE_BACKUP_REGION` to the endpoint and region the IONOS console shows for it (Berlin is `s3-eu-central-2.ionoscloud.com` and `eu-central-2`).

   **Encrypt the backups before they leave the server.** Add a passphrase of at least 20 characters (a few random words) - type it in yourself:

   ```bash
   OFFSITE_BACKUP_PASSPHRASE=<passphrase>
   ```

   Each backup is then encrypted on the server (contents and file name) and stored under `kolosseum-encrypted/` in the bucket, so IONOS only ever holds ciphertext. **Save the passphrase in a password manager as well** - if the server is lost, it is the only way to read the backups. Copies made before you set it (under `kolosseum/`) are deleted after `BACKUP_KEEP_DAYS` days like any other. Without a passphrase the copies are not encrypted, and the offsite log says so on every start.
4. Restart it, copy now, and check the files arrived:

   ```bash
   docker compose -f docker-compose.prod.yml up -d offsite
   docker compose -f docker-compose.prod.yml exec offsite sh /offsite.sh once
   docker compose -f docker-compose.prod.yml exec offsite sh /offsite.sh list
   ```

   `once` waits for files to be at least 10 minutes old, so straight after a fresh backup it may copy nothing yet - run it again shortly. `docker compose -f docker-compose.prod.yml logs offsite` shows each hourly copy, or why one failed.

### Check that a backup restores

Run this after setting up, and again every month or so. It restores the newest backup into a throwaway database beside the live one, shows its row counts next to the live counts for the tables that matter most, checks the uploads file opens, then deletes the throwaway copy. The live database is only read.

```bash
docker compose -f docker-compose.prod.yml exec backup sh /restore-check.sh
```

It ends with `restore check passed`, or says what failed.

### Restoring

**Onto a new server** (the old one is gone):

1. Set up the new server as in sections 1-4, with the same `.env` (including the `OFFSITE_BACKUP_*` lines). Don't do section 5 yet.
2. Start only the database, which starts empty:

   ```bash
   docker compose -f docker-compose.prod.yml up -d db
   ```

3. Pull the backups down from IONOS into the backups volume, decrypting them on the way (the `.env` must have the same `OFFSITE_BACKUP_PASSPHRASE`):

   ```bash
   docker compose -f docker-compose.prod.yml run --rm -v kolosseum_kolosseum-backups:/restore offsite fetch /restore
   ```

   The volume names start with the folder's name (`kolosseum_` for `/opt/kolosseum`); `docker volume ls` shows them.
4. Restore the newest database dump and its uploads:

   ```bash
   docker compose -f docker-compose.prod.yml run --rm --entrypoint sh -v kolosseum_kolosseum-uploads:/restore-uploads backup \
     -c 'd=$(ls -1t /backups/db_*.dump | head -n 1); echo "restoring $d"; pg_restore --no-owner --exit-on-error -d "$DATABASE_URL" "$d" && tar -xzf "/backups/$(basename "$d" .dump | sed s/^db_/uploads_/).tar.gz" -C /restore-uploads'
   ```

5. Start everything and bring the schema up to date (safe on a restored database):

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec app node scripts/apply-schema.mjs
   ```

   Then point the domain's DNS at the new server's IP address.

**Restoring the database** into a fresh, empty database:

```bash
docker compose -f docker-compose.prod.yml exec backup sh -c \
  'createdb -h db -U postgres kolosseum_restored && pg_restore -h db -U postgres -d kolosseum_restored /backups/db_<time>.dump'
```

When asked, give the `POSTGRES_PASSWORD` from `.env`. Check the restored copy, then point the app at it or rename the databases.

**Restoring uploads:** extract the matching `uploads_<time>.tar.gz` into the `kolosseum-uploads` volume.

## Alerts

**Backups.** The backup and offsite containers record how each run went in the `kolosseum-status` volume. Every hour the app checks it. If there's been no database backup for 26 hours, no successful off-server copy for 3 hours, or off-server copies are switched off, it emails `KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO`. It sends that once a day while the problem lasts, and once more when it's fixed. Set `KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO` to your email in `.env`, along with `RESEND_API_KEY`, and run `docker compose -f docker-compose.prod.yml up -d`. The admin console also shows "Backups: last … · copied off the server …" at the top, or what's wrong.

**The site being down.** The app can't report that itself, so use a free outside monitor:

1. Create a free account at [uptimerobot.com](https://uptimerobot.com).
2. **Add New Monitor**: type **HTTP(s)**, URL `https://<your-domain>/health`, interval **5 minutes**.
3. Under alert contacts, tick your email.

It emails you when the site stops answering, and again when it's back.

## Day to day

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f app`
- **Restart:** `docker compose -f docker-compose.prod.yml restart app`
- **Daily operating checklist:** `docs/ops/V1_RUNBOOK.md`.

**Lost the authenticator and the backup codes?** Reset two-step sign-in over SSH. It signs that admin out everywhere, and they set it up again at their next sign-in:

```bash
docker compose -f docker-compose.prod.yml exec -e ADMIN_BOOTSTRAP_TOKEN=<any-value-you-choose> app \
  node scripts/bootstrap_admin_account.mjs --reset-two-step --email you@example.com
```

**Forgot the admin password?** Set a new one over SSH. It asks for the password twice at a hidden prompt (so it never lands in shell history), needs at least 16 characters, clears any lockout and signs that admin out everywhere. Two-step sign-in stays on:

```bash
docker compose -f docker-compose.prod.yml exec -e ADMIN_BOOTSTRAP_TOKEN=<any-value-you-choose> app   node scripts/bootstrap_admin_account.mjs --reset-password --email you@example.com
```
