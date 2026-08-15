# Deployment

ETS deploys to **Netlify**, with **Neon** providing the Postgres database. The architecture maps cleanly onto Netlify's three deploy contexts.

## Environments at a glance

| Environment | Netlify context | Triggered by | Database |
|---|---|---|---|
| **Local dev** | n/a — `npm run dev` | running on your machine | Neon dev branch (or your own local Postgres) |
| **Deploy Preview** | `deploy-preview` | every PR opened against `main` | Neon dev branch (or auto-branch — see below) |
| **Branch Deploy** | `branch-deploy` | push to `develop`, `staging`, etc. | Neon dev branch |
| **Production** | `production` | push to `main` | Neon prod branch |

## 1. Neon database branching

Neon supports cheap, near-instant database branches. One project, multiple branches.

Recommended setup:

- **`main` branch** — production database. Holds real broadcast data.
- **`dev` branch** — development database. Reset freely.

Optional: enable the **Neon ↔ Netlify integration**, which automatically creates an ephemeral Neon branch per Netlify Deploy Preview and tears it down when the PR closes. Each PR then gets its own isolated database — no cross-contamination between concurrent reviews.

Connection strings (copy from the Neon dashboard):

```
prod:   postgresql://user:pass@ep-prod-xxx.neon.tech/main?sslmode=require
dev:    postgresql://user:pass@ep-dev-xxx.neon.tech/main?sslmode=require
```

## 2. Netlify environment variables

In **Site settings → Environment variables** on Netlify, set variables per context:

| Variable | Production | Deploy Preview | Branch Deploys |
|---|---|---|---|
| `DATABASE_URL` | prod Neon URL | dev Neon URL | dev Neon URL |
| `BETTER_AUTH_SECRET` | a stable 32-byte hex value (different from dev) | a separate 32-byte hex | same as deploy preview |
| `BETTER_AUTH_URL` | `https://yourapp.netlify.app` | `$DEPLOY_PRIME_URL` (Netlify variable) | `$DEPLOY_PRIME_URL` |
| `NODE_ENV` | `production` (Netlify sets this automatically) | `production` | `production` |

Notes:

- `BETTER_AUTH_URL` for previews uses `$DEPLOY_PRIME_URL`, which Netlify expands to the deploy's unique URL (e.g., `https://deploy-preview-42--yourapp.netlify.app`).
- Don't reuse `BETTER_AUTH_SECRET` between prod and dev. Rotating prod's secret would otherwise invalidate every dev session too.
- Local dev reads from `.env.local` (git-ignored), which Netlify never sees.

## 3. `netlify.toml`

Commit this at the repo root:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[context.production.environment]
  NODE_ENV = "production"

[context.deploy-preview.environment]
  NODE_ENV = "production"

[context.branch-deploy.environment]
  NODE_ENV = "production"
```

`@netlify/plugin-nextjs` is the official adapter. It:

- Routes Next.js API routes and Server Components to **Netlify Functions** (Node runtime).
- Serves static files from `.next/static` and `public/` via the CDN.

No extra configuration needed — the plugin detects the App Router automatically.

## 4. SSE runs on Node (not Edge)

**This is the most important deployment-specific detail.**

The SSE stream route runs on the **default Node runtime**, the same runtime as the publisher routes (`take`/`preview`/`hide`), so they share the **in-process broadcast bus**. An Edge SSE route can't see a Node `publish()` — Edge and Node compile to separate bundles with separate module state — which breaks the bus even in `next dev`. See [preview-air.md](./preview-air.md#caveat-the-edgenode-runtime-split).

The trade-off is Netlify's Node-function timeout (**~10s**, 26s on Pro): a long SSE stream is truncated and the client reconnects. This is acceptable because the client **holds its rendered set across `EventSource` auto-reconnects** and the reconnect re-hydrates from the current snapshot, so it's visually seamless. A always-on deployment (a single Node server) or a cross-instance broker removes the churn — see the single-server caveat.

Node routes also need Node APIs anyway:
- `better-auth` session helpers (Node-only in some flows).
- `@neondatabase/serverless` (HTTP driver; runs on Node).

## 5. Build pipeline

`npm run build` on Netlify executes (in order):

1. `prebuild` script:
   - `npm run titles:generate` — regenerates the overlay registry (static imports).
2. `next build` — produces `.next/`.
3. `@netlify/plugin-nextjs` packages the output for Netlify Functions.

The `predev` hook runs the same registry codegen for local development. Overlays are global (organized by discipline/category — see [projects-system.md](./projects-system.md)); there is no per-tournament package to sync.

## 6. Migrations workflow

Migrations are **never** run as part of `next build`. They run out-of-band against the appropriate `DATABASE_URL`.

### Dev migrations

```bash
# 1. Edit db/schema.ts
# 2. Generate the migration
npm run db:generate

# 3. Apply against the dev branch
DATABASE_URL="postgresql://...@ep-dev-xxx.neon.tech/main?sslmode=require" \
  npm run db:migrate

# 4. Commit the generated SQL in db/migrations/
git add db/schema.ts db/migrations
git commit -m "db: add commentators table"
```

### Prod migrations

```bash
# After the PR is merged to main:
DATABASE_URL="postgresql://...@ep-prod-xxx.neon.tech/main?sslmode=require" \
  npm run db:migrate
```

Run this from a developer's machine, or — preferably — a GitHub Actions workflow gated on push to `main`. Example workflow:

```yaml
# .github/workflows/migrate-prod.yml
name: Migrate production database
on:
  push:
    branches: [main]
    paths: ['db/migrations/**', 'db/schema.ts']
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run db:migrate
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

> Migrations and Netlify deploys are decoupled. If a migration is required for new code, **apply the migration first** (it should always be backward-compatible with the still-running old code), then merge the PR that ships the new code. See "expand and contract" migration patterns for the general approach.

## 7. Local development

Local dev does not touch Netlify at all. The `.env.local` file in your working directory holds:

```env
DATABASE_URL="postgresql://...@ep-dev-xxx.neon.tech/main?sslmode=require"
BETTER_AUTH_SECRET="<your dev secret>"
BETTER_AUTH_URL="http://localhost:3000"
```

`.env.local` is git-ignored. Don't commit it.

Run with `npm run dev`. The `predev` script syncs projects and starts the asset watcher.

## 8. Custom domain

Netlify's default domain (`yourapp.netlify.app`) works for testing. For production:

1. Site settings → **Domain management** → **Add custom domain**.
2. Set the DNS as Netlify instructs (CNAME or NS records).
3. Update `BETTER_AUTH_URL` for the Production context to the new domain.
4. Redeploy (or trigger a deploy from the Netlify UI).

> If you change `BETTER_AUTH_URL` after users have signed in, those sessions become invalid (cookies are bound to the prior origin). Plan the cutover during a low-traffic window.

## 9. Observability

The MVP relies on Netlify's built-in logs:

- **Functions** tab — invocation count and errors for each Route Handler.
- **Functions** tab — SSE stream and API invocations, warning/error logs.
- **Deploy log** — surfaces `prebuild` failures (most often: `titles:generate` failing to resolve an overlay).

For richer telemetry later (Sentry, OpenTelemetry, Vercel Analytics equivalents), add after MVP.

## 10. Cost notes

- **Netlify Free tier** is generous for an MVP: 125k Function invocations/month. On Node functions, SSE connections are capped (~10s) and reconnect; each reconnect is another short invocation (the client re-hydrates seamlessly).
- **Neon Free tier** includes 0.5 GB storage and one project with multiple branches. For an MVP this is enough; for production budget ~$19/month on Neon's Pro tier.
- The **Neon ↔ Netlify integration** counts auto-branches against your Neon quota — disable if you hit limits.

## Common pitfalls

- **Forgot to set `BETTER_AUTH_URL` for Deploy Previews.** Login on a preview URL succeeds but immediately redirects back to `/login`. Fix: set the variable to `$DEPLOY_PRIME_URL` for the `deploy-preview` context.
- **SSE connection drops after ~10s in production.** Expected on Netlify Node functions — the client auto-reconnects and re-hydrates from the snapshot. For churn-free streaming use an always-on Node host or a cross-instance broker. See [preview-air.md](./preview-air.md#the-in-process-bus).
- **`titles:generate` failed during the build.** An overlay folder is missing one of its required files, or an import doesn't resolve. Check the `prebuild` log.
- **Forgot to migrate the prod DB before merging.** Code expects new columns that don't exist. The site returns 500s. Fix: apply the migration manually, then redeploy. **Always migrate before you ship code that depends on the new schema.**
- **`@netlify/plugin-nextjs` version mismatch.** Upgrade to `^5.0.0`.
