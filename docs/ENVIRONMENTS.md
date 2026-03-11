# Environments

This document defines the development and production environments, their configuration, and deployment procedures.

## Overview

The system has two environments. Isolation is enforced by separate Supabase projects, separate Vercel deployment targets, and environment-specific configuration.

| Component | Development | Production |
|-----------|-------------|------------|
| Web | Vercel Preview (branch `main`) or local | Vercel Production (branch `release`) |
| Database | Supabase project (dev) | Supabase project (prod) |
| Scraper / worker | Local execution; dev Supabase | Server execution; prod Supabase only |
| Auth | Supabase Auth (email/password); signup disabled; users created in Dashboard | Same |
| Cache | Upstash Redis (keys namespaced by env) | Same Redis or separate instance |

**Branch convention:** `main` triggers Preview deployments. `release` triggers Production deployments. Configure Vercel Production Branch to `release`.

**Vercel behavior:** Environment variables are not shared between Preview and Production. Configure both targets explicitly.

**Production server constraint:** The host running the scraper and worker in production uses a single `scraper/.env` containing only production credentials. Development Supabase credentials must not be present on that host.

---

## Configuration reference

### Vercel (web)

**Location:** Project → Settings → Environment Variables. Assign each variable to Preview, Production, or both.

| Variable | Preview | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dev project URL | Prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon key | Prod anon key |
| `SUPABASE_URL` | Dev project URL | Prod project URL |
| `SUPABASE_SERVICE_KEY` | Dev service key | Prod service key |
| `ANTHROPIC_API_KEY` | API key | Same or separate |
| `OPENAI_API_KEY` | API key | Same or separate |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL | Same or separate |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST token | Same or separate |
| `INTERNAL_API_SECRET` | Not required | Required when production worker calls cache-invalidate; must match server `scraper/.env` |

Redis keys are prefixed by `VERCEL_ENV` (production, preview, or development). A single Upstash database can serve both deployment targets.

### Scraper and worker

**Location:** `scraper/.env`. Use one file per environment (e.g. `.env` for current context; do not mix dev and prod on the same host).

| Variable | Development (local) | Production (server) |
|----------|---------------------|----------------------|
| `SUPABASE_URL` | Dev project URL | Prod project URL only |
| `SUPABASE_SERVICE_KEY` | Dev service key | Prod service key only |
| `SESSION_ENCRYPTION_KEY` | Dev key | Prod key (distinct from dev) |
| `NEXTDOOR_EMAIL`, `NEXTDOOR_PASSWORD` | Credentials | Same credentials |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | API keys | API keys |
| `APP_URL` | Unset or Preview origin | Production origin (when using cache invalidation) |
| `INTERNAL_API_SECRET` | Unset | Must match Vercel Production when `APP_URL` is set |

---

## Supabase Auth configuration

1. In Supabase Dashboard → Authentication → Providers → Email: disable **Enable email signups** so only manually created users can sign in.
2. Create users in Authentication → Users → Add user (email + password) for each allowed user.
3. No callback or logout URLs to configure; login and logout are handled in-app.

---

## Deployment procedures

### Web — Preview (development)

1. Push to `main`: `git push origin main`.
2. CI runs; Vercel builds and deploys to Preview. The Preview URL for `main` is stable (e.g. `https://<project>-git-main-<scope>.vercel.app`).
3. The deployment uses variables configured for Preview.

### Web — Production

1. Verify behavior on a Preview deployment.
2. Merge `main` into `release` and push:
   ```bash
   git checkout release && git pull origin release && git merge main --no-edit && git push origin release && git checkout main
   ```
   Alternatively: `make deploy-web-prod` (validates clean working tree, then performs the same sequence).
3. Vercel builds and deploys from `release`. The deployment uses variables configured for Production.

### Scraper and worker — Development

Run the scraper or worker locally. Use a `scraper/.env` that references the dev Supabase project and dev credentials. Jobs and scraper runs created via the Preview UI are stored in the dev database; the production worker does not consume them.

### Scraper and worker — Production

The production host runs the scraper and two workers (recompute + permalink) with a `scraper/.env` that references only the prod Supabase project. To ship code changes: run `DEPLOY_HOST=<user>@<host> ./scripts/deploy-to-server.sh` from the repo root, or SSH to the host and run `git pull`. See [DEPLOYMENT.md](DEPLOYMENT.md) for host setup.

---

## Verification

- **Preview vs Production:** Create a test resource (e.g. post or weight config) in the Preview UI. Confirm it does not appear in the Production UI (distinct Supabase projects).
- **Redis:** Using a shared Redis instance, perform an action in Preview that updates cached state. Confirm Production cached state is unchanged (key namespacing).
- **Workers:** Enqueue a job from the Production UI (recompute or permalink). Confirm only the workers on the production host (prod Supabase) process it.

---

## Setup checklist

Execute in order. Dependencies are implied by the sequence.

1. **Supabase:** Create two projects (dev, prod). For each new project, run `database/bootstrap.sql` once in the SQL Editor (see [SUPABASE_MIGRATIONS.md](SUPABASE_MIGRATIONS.md)). Record project URLs and anon/service keys for both.
2. **Supabase Auth:** Disable signups in Dashboard; create users manually.
3. **Upstash:** Create a Redis database. Record REST URL and token. One database suffices; keys are namespaced by environment.
4. **Vercel:** Connect the repository. Set Root Directory to `web`. Set Production Branch to `release`. Create and push branch `release` if it does not exist.
5. **Vercel — Preview:** In Settings → Environment Variables, configure for Preview: dev Supabase (all four vars), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
6. **Vercel — Production:** Configure for Production: prod Supabase (all four vars), API keys, Redis vars. Add `INTERNAL_API_SECRET` when the production worker will call the cache-invalidate endpoint.
7. **Local development:** Create `web/.env.local` and `scraper/.env` from the corresponding `.env.example` files. Populate with dev Supabase and dev credentials. Apply migrations to the dev project as needed.
8. **Production server:** Run `scripts/setup-server.sh` on the host (see [DEPLOYMENT.md](DEPLOYMENT.md)). Edit `scraper/.env` with production credentials. Start the workers with `sudo ./scripts/install-worker-service.sh` (recompute + permalink).

---

## Related documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Production server setup and scraper/worker deployment.
- [SUPABASE_MIGRATIONS.md](SUPABASE_MIGRATIONS.md) — Applying migrations to both Supabase projects.
