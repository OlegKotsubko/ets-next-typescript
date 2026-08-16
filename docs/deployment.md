# Deployment

ETS deploys as a **single always-on Node server** on a **Hetzner** VPS, behind **Caddy** (TLS + reverse proxy), with Postgres (**Neon**, or self-hosted) and **object storage** for uploaded media.

> **Why an always-on server, not serverless?** The broadcast bus is **in-process pub/sub** — the `take`/`publish` route and the SSE `/air` stream must run in the **same process** to share memory. Serverless (Netlify/Vercel) splits them across invocations/instances, so published events never reach the stream, and the ~10s function cap truncates SSE. One persistent Node process is the happy path. See [preview-air.md](./preview-air.md#the-in-process-bus).

## Topology

```
        OBS / vMix ──HTTPS/SSE──┐
        operator browser ───────┤
                                ▼
                      ┌───────────────────┐   :443
                      │   Caddy (TLS +     │
                      │   reverse proxy)   │
                      └─────────┬─────────┘   127.0.0.1:3000
                                ▼
                      ┌───────────────────┐
                      │  Node: next start │  ← one process; in-process bus
                      │  (systemd service)│
                      └───┬───────────┬───┘
                          │           │
                   Postgres          Object storage
                (Neon / local)     (R2 / Hetzner OS)  ← images & stinger videos
```

Single instance is deliberate — the bus is single-process (see [§10](#10-single-instance-caveat)).

## 1. Provision the server

- **Hetzner Cloud**, Ubuntu 24.04 LTS. A **CPX21/CPX31** (2–4 vCPU, 4–8 GB) is a sane start; broadcast serves video, so give it headroom (and put media behind a CDN — [§6](#6-media-storage)).
- Create a non-root sudo user, add your SSH key, disable password login.
- Firewall (Hetzner Cloud Firewall or `ufw`): allow **22, 80, 443** only.
- Install **Node 20+** (`nodesource` or `nvm`), `git`, and Caddy.

## 2. Environment variables

Keep these in `/etc/ets/ets.env` (root-owned, `chmod 600`, **never committed**) so systemd can load them:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/main?sslmode=require"
BETTER_AUTH_URL="https://ets.your-domain.tv"
BETTER_AUTH_SECRET="<32-byte hex — openssl rand -hex 32>"
# object storage (if using R2/S3 for media)
S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
S3_BUCKET="ets-media"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
NODE_ENV="production"
```

- `BETTER_AUTH_URL` **must** match the public origin the browser sees, or login cookies are dropped.
- Use a different `BETTER_AUTH_SECRET` from dev.

## 3. Build & run under systemd

```bash
sudo mkdir -p /srv/ets && sudo chown $USER /srv/ets
git clone <repo-url> /srv/ets && cd /srv/ets
npm ci
npm run build            # prebuild runs titles:generate (overlay registry)
```

`/etc/systemd/system/ets.service`:

```ini
[Unit]
Description=ETS (Next.js)
After=network.target

[Service]
Type=simple
User=ets
WorkingDirectory=/srv/ets
EnvironmentFile=/etc/ets/ets.env
# bind to loopback; Caddy terminates TLS and proxies in
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now ets
journalctl -u ets -f      # follow logs
```

## 4. Reverse proxy + TLS (Caddy)

Caddy gives automatic HTTPS and streams SSE correctly. `/etc/caddy/Caddyfile`:

```caddyfile
ets.your-domain.tv {
    encode zstd gzip
    # Do NOT buffer/compress the SSE stream — OBS would freeze on a "connected" but silent feed
    @sse path /api/broadcast/*
    reverse_proxy @sse 127.0.0.1:3000 {
        flush_interval -1          # stream immediately, no buffering
    }
    reverse_proxy 127.0.0.1:3000
}
```

The critical detail is **`flush_interval -1` on `/api/broadcast/*`** (and keeping compression off it). On **nginx** the equivalents are `proxy_buffering off; proxy_cache off; gzip off;` plus `proxy_http_version 1.1;` and a long `proxy_read_timeout` on that location.

The SSE route also sends a **15s heartbeat**, which keeps any idle-timeout from closing the stream.

## 5. Database

**Recommended: keep Neon.** The Neon HTTP driver works fine from a normal server (it's just HTTPS) and you keep Neon's branching/PITR. Point `DATABASE_URL` at your Neon prod branch.

> **If you self-host Postgres** (on the box or another Hetzner server): the app uses **`@neondatabase/serverless`**, which speaks Neon's HTTP protocol — it will **not** connect to a stock Postgres. To self-host you must either switch the driver to `drizzle-orm/node-postgres` + `pg` (a small `db/index.ts` change), or run a Neon-compatible proxy. Easiest is to stay on Neon.

## 6. Media storage

The DB stores only **URLs**; the binaries (player photos, team/sponsor logos, tournament art, and the large overlay **stinger/mixer/background videos**) need a home. Two good options:

- **Object storage (recommended)** — an S3-compatible bucket: **Cloudflare R2** (zero egress + built-in CDN, great for videos OBS pulls) or **Hetzner Object Storage** (same-DC, no cross-provider egress). Upload via the API / a signed PUT; store the object URL in the row.
- **Local disk on a Hetzner Volume (simplest)** — attach a **Volume** (durable, survives rebuilds), mount at `/srv/ets-media`, write uploads there, and serve it from Caddy:
  ```caddyfile
  handle_path /media/* {
      root * /srv/ets-media
      file_server
      header Cache-Control "public, max-age=31536000, immutable"
  }
  ```
  Works because the server is persistent (unlike serverless FS). Single-instance only; back it up.

Either way: the `/air` and `/preview` pages (loaded by OBS) fetch these URLs, so media must be **publicly readable**, and if it's on a different origin than the app, set **CORS** (`Access-Control-Allow-Origin`). Put a **CDN** in front of the videos if OBS runs remotely — a large stinger pulled live over a slow link stutters on air.

## 7. Migrations

Migrations are **never** part of the build. Run them out-of-band against the prod `DATABASE_URL`, **before** restarting into code that needs the new schema (expand-and-contract: the migration stays backward-compatible with the running old code).

```bash
# dev: edit db/schema.ts, then
npm run db:generate
DATABASE_URL="<dev url>" npm run db:migrate
git add db/schema.ts db/migrations && git commit -m "db: <change>"

# prod: from a dev machine or CI (or on the server before restart)
DATABASE_URL="<prod url>" npm run db:migrate
```

CI example (gate on schema changes to `main`):

```yaml
# .github/workflows/migrate-prod.yml
name: Migrate production database
on:
  push: { branches: [main], paths: ['db/migrations/**', 'db/schema.ts'] }
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run db:migrate
        env: { DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }} }
```

## 8. Deploying a new version

A minimal `deploy.sh` on the server (trigger it over SSH from CI, or a git webhook):

```bash
cd /srv/ets
git pull --ff-only
npm ci
npm run build            # titles:generate + next build
# apply any pending migration here if the schema changed (see §7)
sudo systemctl restart ets
```

`systemctl restart` is a ~1–2s blip; OBS/operator SSE clients auto-reconnect and re-hydrate from the snapshot, so it's seamless **between** shows. Don't redeploy mid-broadcast. True zero-downtime would need two processes + a Caddy swap, but that reintroduces the split-process bus problem during the swap — not worth it for a single-operator tool.

## 9. Local development

Local dev is unchanged and needs no server. `.env.local` (git-ignored):

```env
DATABASE_URL="postgresql://...@ep-dev-xxx.neon.tech/main?sslmode=require"
BETTER_AUTH_SECRET="<dev secret>"
BETTER_AUTH_URL="http://localhost:3000"
```

Run `npm run dev` (one process → the bus works exactly as in prod).

## 10. Single-instance caveat

One Node process = the in-process bus works. **Do not run two app servers behind a load balancer** — a `take` on server A won't reach an OBS source connected to server B. Horizontal scaling would require a cross-instance broker (**Redis pub/sub** or **Postgres `LISTEN/NOTIFY`**) that both the publisher and the SSE route talk to instead of process memory. Out of scope for a single-operator setup; revisit only if you must scale out. See [preview-air.md](./preview-air.md#caveat-single-server-pubsub).

## 11. Observability & backups

- **Logs:** `journalctl -u ets -f` (app) and Caddy's access log. Add **Sentry** later for error tracking.
- **Health:** point an uptime check at `/login` (fast, public) or add a lightweight `/api/health` route.
- **DB backups:** Neon has PITR + branching; self-hosted → a `pg_dump` cron off-box.
- **Media backups:** object storage is already durable; a Hetzner Volume → periodic snapshot.

## Common pitfalls

- **OBS shows "connected" but the overlay never appears / never updates.** The proxy is buffering or compressing the SSE stream. Set `flush_interval -1` (Caddy) / `proxy_buffering off` (nginx) on `/api/broadcast/*` and keep compression off it.
- **Self-hosted Postgres won't connect.** The app ships the Neon **HTTP** driver — it only speaks to Neon. Stay on Neon, or switch `db/index.ts` to `node-postgres`.
- **Login redirect loop after going live.** `BETTER_AUTH_URL` doesn't match the public origin; cookies are dropped. Set it to your real `https://` domain and restart.
- **500s after a deploy.** Code expects a column the DB doesn't have — you skipped the migration. Migrate **before** restarting (§7).
- **`.env`/`ets.env` committed.** Rotate `BETTER_AUTH_SECRET` and DB credentials immediately; keep secrets out of git.
