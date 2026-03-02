# Environments and deployment steps

There are two environments: **dev** (integration / preview) and **production**. This doc is the single source of truth for what each environment is and how to deploy to it.

## Environments overview

| | Dev | Production |
|--|-----|------------|
| **Web** | Local (`make dev-web`) or Vercel **Preview** (deploys from `main`) | Vercel **Production** (deploys from `release` branch) |
| **Supabase** | Dev project (URL/keys in Preview env or `web/.env.local`) | Prod project (URL/keys in Production env or server `scraper/.env`) |
| **Scraper / worker** | Run locally; `scraper/.env` points at **dev** Supabase | Run on server; `scraper/.env` points at **prod** Supabase |

**Branch strategy:** `main` is the default branch for development. A long-lived branch `release` is used for production. In Vercel, set **Production Branch** to `release` so that pushes to `main` create Preview deployments and pushes to `release` create Production deployments.

---

## One-time setup

### Create the `release` branch (once)

From your local machine, with `main` up to date:

```bash
git checkout main
git pull origin main
git checkout -b release
git push -u origin release
```

In Vercel: **Project Settings → Git → Production Branch** → select `release`. Ensure **Root Directory** is `web`.

### Vercel environment variables

In the Vercel project (**Settings → Environment Variables**), set variables per environment:

- **Preview** (used for `main` and other non-release branches): Dev Supabase URL, anon key, service key; dev Auth0 app (domain, client ID, secret, etc.); `APP_BASE_URL` set to your preview URL or leave default. In Auth0, add the Preview callback and logout URLs (e.g. `https://your-project-*.vercel.app` or the specific preview URL).
- **Production** (used for `release` branch): Prod Supabase URL, anon key, service key; prod Auth0 app; `APP_BASE_URL` set to your production domain (e.g. `https://yourdomain.com`).

### Auth0

Preview and Production need valid callback and logout URLs. Use either:

- Two Auth0 applications (one for dev, one for prod), or  
- One Auth0 application with both Preview and Production URLs added to the allowed callback/logout lists.

---

## Web — Deploy to dev (preview)

1. Push to `main`: `git push origin main`.
2. CI runs (lint, test, build) on push/PR.
3. Vercel deploys the commit as a **Preview** deployment (if the repo is connected to Vercel). Use the deployment URL from the Vercel dashboard or the GitHub commit checks.
4. Test the preview URL; it uses **Preview** env vars (dev Supabase, dev Auth0).

---

## Web — Deploy to production

1. Validate the app on a Preview deployment (from `main`).
2. Merge `main` into `release` and push:
   ```bash
   git checkout release
   git pull origin release
   git merge main
   git push origin release
   ```
3. Vercel deploys **Production** from the `release` branch. The production URL uses **Production** env vars (prod Supabase, prod Auth0).

---

## Scraper / worker — Dev

- Run the scraper or worker **locally** (e.g. from your machine). Use a `scraper/.env` (or a copy like `scraper/.env.dev`) that points at **dev** Supabase (URL, service key, and any other dev credentials).
- No server deploy. Dev is for testing scraper/worker logic against dev data.

---

## Scraper / worker — Production

- The **server** has a single `scraper/.env` with **prod** Supabase (and prod API keys). Cron (or systemd) runs `run-scrape.sh` and the worker there.
- To deploy scraper/worker code to production after you’ve merged to `main` (or `release`, if you prefer to deploy scraper only after a production web release):

  1. From your local machine, run the deploy script:  
     `DEPLOY_HOST=nextdoor@your-server ./scripts/deploy-to-server.sh`  
     or SSH and pull:  
     `ssh nextdoor@your-server "cd ~/nextdoor && git pull"`.
  2. The next cron run (or a manual run of `run-scrape.sh` / the worker) uses the updated code.

---

## Summary

| Action | Result |
|--------|--------|
| Push to `main` | CI runs; Vercel deploys **Preview** (dev Supabase). Test there. |
| Merge `main` into `release` and push | Vercel deploys **Production** (prod Supabase). |
| Run scraper/worker locally with dev `.env` | **Dev** scraper/worker (dev Supabase). |
| Run `deploy-to-server.sh` or `git pull` on server | **Production** scraper/worker code updated; server uses prod Supabase. |

For server setup and security, see [DEPLOYMENT.md](DEPLOYMENT.md). For running migrations in both Supabase projects, see [SUPABASE_MIGRATIONS.md](SUPABASE_MIGRATIONS.md).
