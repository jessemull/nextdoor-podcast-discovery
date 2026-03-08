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

Run the one-time setup script on the host. The script installs system dependencies (Python 3.11, git, Chromium libraries), creates a dedicated user (when run as root), clones the repository (when `GIT_REPO` is set or repo is present), creates the virtual environment, installs the scraper and Playwright Chromium, copies `scraper/.env.example` to `scraper/.env`, creates the log directory, and adds cron entries for the scraper.

**Prerequisites:** Ubuntu 22.04, Debian 12, or Amazon Linux 2 (or similar). SSH and key-based access configured. Restrict SSH to a private network (e.g. Tailscale); do not expose it to the public internet.

**Run the script:**

- From the host (repo already cloned, e.g. to `/home/nextdoor/nextdoor`):
  ```bash
  cd /home/nextdoor/nextdoor && sudo ./scripts/setup-server.sh
  ```
- Or from any clone: run `./scripts/bootstrap-host.sh` (prompts for sudo and uses `git remote origin` as `GIT_REPO`), or as root with `GIT_REPO` set (script clones to `/home/nextdoor/nextdoor`):
  ```bash
  sudo GIT_REPO=https://github.com/<org>/<repo>.git ./scripts/setup-server.sh
  ```
- From your local machine via SSH (script must be on the host):
  ```bash
  scp scripts/setup-server.sh <user>@<host>:/tmp/ && ssh <user>@<host> "sudo bash /tmp/setup-server.sh"
  ```
  Or clone the repo on the host first, then `ssh <user>@<host> "cd /path/to/nextdoor && sudo ./scripts/setup-server.sh"`.

**Post-setup:**

1. Edit `scraper/.env` on the host with production values only: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXTDOOR_EMAIL`, `NEXTDOOR_PASSWORD`, `SESSION_ENCRYPTION_KEY` (generate via `make gen-key` from repo root), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. When the worker will call the Production app’s cache-invalidate endpoint, set `APP_URL` (Production origin) and `INTERNAL_API_SECRET` (must match Vercel Production). See [HOST_ENV_CHECKLIST.md](HOST_ENV_CHECKLIST.md). Then run `./scripts/verify-host-env.sh` from the repo root to validate and test Supabase.
2. Start the worker so that “Save & Recompute” and “Activate” in the Production UI complete: run `sudo ./scripts/install-worker-service.sh` from the host repo root. That script installs the systemd unit, enables it (start on boot), and starts it now. For power, cron, and monitoring on a laptop host, see [HOST_POWER_AND_MONITORING.md](HOST_POWER_AND_MONITORING.md).

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
