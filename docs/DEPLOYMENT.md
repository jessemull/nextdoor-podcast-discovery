# Deployment

This document covers deployment of the web application (Vercel) and the scraper/worker (self-hosted server). Environment configuration and variable reference are in [ENVIRONMENTS.md](ENVIRONMENTS.md).

## Scope

| Target | Mechanism | Reference |
|--------|------------|-----------|
| Web (Preview) | Push to `main`; Vercel deploys from Git | [ENVIRONMENTS.md](ENVIRONMENTS.md#web--preview-development) |
| Web (Production) | Merge `main` into `release`, push; Vercel deploys from Git | [ENVIRONMENTS.md](ENVIRONMENTS.md#web--production) |
| Scraper / worker (Production) | SSH + `git pull` or deploy script from local machine | This document |

The production server runs the scraper and worker only. Its `scraper/.env` must contain production credentials only. Do not configure development Supabase or development-only URLs on that host.

---

## Production server setup

Prerequisites: host with Python 3.11+, Git, and Playwright system dependencies; network access restricted (e.g. Tailscale) so SSH is not exposed to the public internet.

### 1. Network and access

Restrict SSH to a private network (e.g. Tailscale). Use the host’s private hostname for SSH. Use key-based authentication; disable password and root login.

### 2. System user and dependencies

Create a dedicated system user for the scraper (e.g. `nextdoor`). Install Python 3.11+, Git, and Playwright system dependencies. Install Chromium for Playwright (e.g. `playwright install chromium` from the scraper directory with venv active).

### 3. Repository and runtime

Clone the repository (e.g. to `~/nextdoor`). From the repository root:

- Create the virtual environment: `make venv`
- Activate it: `source .venv/bin/activate`
- Install scraper dependencies: `make install-scraper`
- Install Playwright Chromium from the `scraper/` directory (or with `PATH` set so the venv’s playwright is used)

### 4. Configuration

Copy `scraper/.env.example` to `scraper/.env`. Populate with production values only:

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — production Supabase project
- `NEXTDOOR_EMAIL`, `NEXTDOOR_PASSWORD`
- `SESSION_ENCRYPTION_KEY` (generate via `make gen-key` from repo root)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- When the worker will call the Production app’s cache-invalidate endpoint: `APP_URL` (Production origin), `INTERNAL_API_SECRET` (must match Vercel Production)

Do not commit `.env`. Do not add development Supabase credentials.

### 5. Logging (optional)

Set `SCRAPER_LOG_DIR` in `scraper/.env` (e.g. `~/nextdoor-logs`). Create that directory. Logs rotate by size (see application logging configuration). To tail logs from a local machine: `DEPLOY_HOST=<user>@<host> ./scripts/tail-logs.sh` or use the Makefile target `make tail-logs DEPLOY_HOST=<user>@<host>`.

### 6. Scheduling

Schedule the scraper via cron (or equivalent). Run from the repository root with the virtual environment activated. Example crontab entries:

```
0 2 * * * cd /home/nextdoor/nextdoor && . .venv/bin/activate && ./scripts/run-scrape.sh recent >> /home/nextdoor/nextdoor-logs/cron.log 2>&1
0 18 * * * cd /home/nextdoor/nextdoor && . .venv/bin/activate && ./scripts/run-scrape.sh trending >> /home/nextdoor/nextdoor-logs/cron.log 2>&1
```

Adjust paths and schedule to match the host and requirements. Optionally schedule `scripts/run-embeddings.sh` similarly.

### 7. Worker process

Run the worker so that “Save & Recompute” and “Activate” in the Production UI complete. Run `python -m src.worker --job-type recompute_final_scores` as a long-lived process (e.g. under systemd or a process manager). Ensure the process uses the same virtual environment and `scraper/.env` as the scraper.

---

## Deploying scraper/worker code changes

After pushing changes to the remote repository, update the production host so the next run uses the new code.

**Option A — Deploy script (from repository root):**

```bash
DEPLOY_HOST=<user>@<host> ./scripts/deploy-to-server.sh
```

Pass `FEED=recent` or `FEED=trending` to run a scrape after pulling (e.g. `DEPLOY_HOST=... FEED=recent ./scripts/deploy-to-server.sh`).

**Option B — Makefile:**

```bash
make deploy-scraper DEPLOY_HOST=<user>@<host>
```

**Option C — SSH and pull:**

```bash
ssh <user>@<host> "cd ~/nextdoor && git pull"
```

The next cron run or manual invocation of the scraper/worker uses the updated code.

---

## Security requirements

- SSH must not be exposed to the public internet. Use a private network (e.g. Tailscale) or equivalent.
- Use SSH key-based authentication. Disable password authentication and direct root login.
- Store secrets in `scraper/.env` on the host and in Vercel/GitHub as appropriate. Do not commit secrets to the repository.

---

## Supabase and migrations

The production server uses a single Supabase project (production). For creating and maintaining dev and prod projects and applying schema changes, see [ENVIRONMENTS.md](ENVIRONMENTS.md) and [SUPABASE_MIGRATIONS.md](SUPABASE_MIGRATIONS.md).
