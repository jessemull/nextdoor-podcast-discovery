# Deploying the Web App to Vercel

The Next.js app in `web/` is designed to deploy to Vercel. You can use **Vercel’s Git integration** (recommended) or the **GitHub Action** already in this repo.

**Recommended:** Use **two Vercel projects** — **dev** (auto-deploy on merge to `main`) and **prod** (deploy only when you choose). See [Two environments: dev (auto) and prod (manual)](#two-environments-dev-auto-and-prod-manual).

---

## Two environments: dev (auto) and prod (manual)

We want **dev** to deploy automatically when we merge to GitHub (e.g. `main`), and **prod** to deploy only when we decide (manual or from a release branch).

Use **two separate Vercel projects** from the same repo:

| Project   | Purpose | When it deploys | How |
|-----------|---------|-----------------|-----|
| **Dev**   | Staging / integration | Automatically on every merge to `main` | Git connected, Production branch = `main` (or use the existing GitHub Action pointing at the dev project). |
| **Prod**  | Live app              | Only when you trigger it               | No Git connection (deploy via Vercel UI “Deploy” or CLI), or Git with Production branch = `production` and deploy by merging `main` → `production` when ready. |

### Setup

1. **Dev project** (e.g. `nextdoor-dev`)
   - Import the repo; set **Root Directory** to **`web`**.
   - In **Settings → Git**, set **Production Branch** to **`main`**. Every merge to `main` will deploy to this project’s production URL (e.g. `nextdoor-dev.vercel.app`).
   - Add **Environment Variables** for the dev stack: dev Supabase, dev Auth0 app, `APP_BASE_URL=https://nextdoor-dev.vercel.app` (or your dev domain).

2. **Prod project** (e.g. `nextdoor-prod`)
   - Create a **second** project: “Add New” → “Project” → same repo (or “Import” again). Give it a different name (e.g. `nextdoor-prod`).
   - Set **Root Directory** to **`web`**.
   - **Option A — Manual only:** In **Settings → Git**, **disconnect** the repository (or leave it connected but never use the prod branch). To deploy prod: open the prod project in Vercel → Deployments → “Deploy” (deploy from `main` or a tag via the UI), or use the CLI: `cd web && vercel --prod` and link to the prod project.
   - **Option B — Deploy on merge to `production`:** In **Settings → Git**, set **Production Branch** to **`production`**. Do not merge to `production` in normal workflow. When you want a prod release, merge `main` into `production` (e.g. via PR or tag); that push will deploy the prod project.
   - Add **Environment Variables** for the prod stack: prod Supabase, prod Auth0 app, `APP_BASE_URL=https://your-production-domain.com`.

### GitHub Action (optional)

If you use the **GitHub Action** (`.github/workflows/deploy.yml`) instead of Vercel’s Git integration for dev:

- Store **dev** project credentials in GitHub Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (all from the **dev** Vercel project). The Action then deploys to dev on push to `main`.
- Do **not** add prod project IDs to the Action if you want prod to remain manual.

### Summary

- **Dev:** Merge to `main` → dev deploys automatically (Vercel Git or Action).
- **Prod:** Deploy only when you choose (Vercel UI “Deploy”, CLI `vercel --prod`, or merge to `production` if using Option B).

---

## How it usually works

1. **One-time setup** — Create a Vercel project linked to this repo and set env vars.
2. **Deploys** — Either Vercel deploys automatically when you push (Git), or the GitHub Action deploys on push to `main` (when `web/` or the workflow file changes).
3. **No manual “deploy” step** — You don’t deploy from the UI each time; pushes (and optionally PRs) trigger builds.

---

## Option A: Vercel Git integration (recommended)

Vercel connects to your GitHub repo and deploys on every push. Preview deployments are created for pull requests.

### One-time setup

1. **Sign in** — [vercel.com](https://vercel.com) → Sign in with GitHub.
2. **Import project** — “Add New…” → “Project” → select the `nextdoor` repo (or “Import Git Repository” and paste the repo URL).
3. **Configure project**
   - **Root Directory:** Click “Edit” and set to **`web`**. (Required: the app lives in `web/`, not the repo root.)
   - **Framework Preset:** Next.js (usually auto-detected).
   - **Build Command:** `npm run build` (default).
   - **Output Directory:** leave default (Next.js handles it).
   - **Install Command:** `npm install` (or `npm install --legacy-peer-deps` if you use that locally).
4. **Environment variables** — In Project Settings → Environment Variables, add every variable from `web/.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`
   - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
   - Optional: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - Set **`APP_BASE_URL`** to your production URL (e.g. `https://your-project.vercel.app`) for Production; use the preview URL for Preview if needed.
5. **Deploy** — Click “Deploy”. The first deployment will run; later, every push to `main` (and optionally other branches) and every PR will trigger builds.

### After that

- **Push to `main`** → Production deployment.
- **Open a PR** → Preview deployment (optional; enable in Project Settings → Git).
- No GitHub Secrets required for deployment; Vercel uses its own connection to GitHub.

You can **turn off** the GitHub Action deploy (`.github/workflows/deploy.yml`) if you use this option so you don’t deploy twice. Or leave it as a fallback and use the same Vercel project (deploy will be idempotent).

---

## Option B: GitHub Action only

The repo already has `.github/workflows/deploy.yml`: it runs on push to `main` when `web/` or the workflow file changes and uses `amondnet/vercel-action` to deploy.

### One-time setup

1. **Create the project on Vercel (once)**
   - Sign in at [vercel.com](https://vercel.com).
   - “Add New…” → “Project” → “Import Third-Party Git Repository” (or create an empty project).
   - If you create from Git, set **Root Directory** to **`web`** and deploy once so the project exists. Then you can use the Action for subsequent deploys, or disconnect the repo and rely only on the Action.

2. **Get IDs and token**
   - **Org ID & Project ID:** Project Settings → General. At the bottom, “Project ID” is visible; for “Team ID” / Org ID, go to Team Settings (or your account) and copy the ID from the URL or the “General” tab.
   - **Token:** [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token (e.g. “GitHub Actions deploy”) → copy it.

3. **GitHub Secrets** (repo Settings → Secrets and variables → Actions)
   - `VERCEL_TOKEN` — the token from step 2.
   - `VERCEL_ORG_ID` — your team/account ID.
   - `VERCEL_PROJECT_ID` — the project ID from Project Settings.

4. **Environment variables** — Same as Option A: set all vars from `web/.env.example` in the Vercel project (Project Settings → Environment Variables). The Action does not inject env vars; Vercel uses the ones configured in the project.

### After that

- Pushing to `main` with changes under `web/` or in `deploy.yml` triggers the workflow and deploys to Vercel.
- No need to deploy from the Vercel UI.

---

## Monorepo: root directory

The app lives in **`web/`**. Vercel must use `web` as the root for this project:

- **Option A (Git):** Set “Root Directory” to `web` in the Vercel project settings.
- **Option B (Action):** The workflow already sets `working-directory: ./web`; the Vercel project should still be created with Root Directory `web` in the UI so builds and env match.

---

## Environment variables per environment

- **Local:** Use `web/.env.local` with your dev Supabase and Auth0 app (e.g. `APP_BASE_URL=http://localhost:3000`).
- **Vercel Dev project:** In that project’s Settings → Environment Variables, set vars for the dev stack (dev Supabase, dev Auth0, `APP_BASE_URL` = dev URL). Apply to “Production” (Vercel’s term for the production *branch* of that project, which for dev is `main`).
- **Vercel Prod project:** Set vars for the prod stack (prod Supabase, prod Auth0, `APP_BASE_URL` = prod URL).
- **Preview deployments:** Optionally set Preview-specific vars (e.g. Auth0 callback URLs that include the preview URL).

See `web/.env.example` and the README for the full list of variables.

---

## Summary

- **Two environments:** Use two Vercel projects — **dev** (auto on merge to `main`) and **prod** (manual or via `production` branch). See [Two environments](#two-environments-dev-auto-and-prod-manual).
- **Deploy mechanism:**

| Approach              | Who deploys        | Setup                                                                 |
|-----------------------|--------------------|-----------------------------------------------------------------------|
| **Vercel Git (A)**    | Vercel on push/PR  | Connect repo to **dev** project, set Root = `web`, Production branch = `main`, add env vars |
| **GitHub Action (B)** | Action on push     | Dev project only: add dev project IDs to GitHub Secrets; Action deploys to dev on push to `main` |

Prod is always a separate project; deploy it via Vercel UI, CLI, or (optional) a `production` branch.
