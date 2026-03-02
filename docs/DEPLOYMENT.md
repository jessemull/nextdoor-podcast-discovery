# Deployment: web (Vercel) and scraper/worker (server)

**Environments:** Dev = `main` + Vercel Preview + dev Supabase; Production = `release` branch + Vercel Production + prod Supabase; scraper dev = local with dev Supabase, scraper prod = server with prod Supabase. For step-by-step deployment to each environment, see [ENVIRONMENTS.md](ENVIRONMENTS.md).

- **Web UI** deploys via Vercel’s Git connection: push to `main` → Preview (dev); push to `release` → Production (prod). No GitHub Action required.
- **Scraper and worker** run on a server you control. This doc covers one-time server setup and deploying code changes from your local machine.

## One-time setup on the server

1. **Tailscale (recommended)**  
   Install [Tailscale](https://tailscale.com) on the server and on your local machine. Use the server’s Tailscale name for SSH so you never open SSH to the public internet.

2. **OS and dependencies**  
   Install updates, Python 3.11+, Git, and Playwright system deps. Create a dedicated user (e.g. `nextdoor`) to run the scraper.

3. **Repo and venv**  
   Clone the repo (e.g. `~/nextdoor`). From repo root: `make venv`, `source .venv/bin/activate`, `make install-scraper`, `playwright install chromium` (from `scraper/` or with `PATH` set). Create `scraper/.env` from `scraper/.env.example` and fill all required variables (Nextdoor, Supabase, session encryption, Anthropic, OpenAI). Never commit `.env`.

4. **Logging (optional)**  
   In `scraper/.env` set `SCRAPER_LOG_DIR=~/nextdoor-logs` so scraper and worker write rotating logs. Create the directory if needed: `mkdir -p ~/nextdoor-logs`. To inspect: `tail -n 500 ~/nextdoor-logs/scraper.log` or `grep -i error ~/nextdoor-logs/scraper.log`.

5. **Cron (or systemd)**  
   Schedule `scripts/run-scrape.sh` and `scripts/run-embeddings.sh` (e.g. daily). Example crontab (run from repo root with venv active):
   ```text
   0 2 * * * cd /home/nextdoor/nextdoor && . .venv/bin/activate && ./scripts/run-scrape.sh recent >> /home/nextdoor/nextdoor-logs/cron.log 2>&1
   0 18 * * * cd /home/nextdoor/nextdoor && . .venv/bin/activate && ./scripts/run-scrape.sh trending >> /home/nextdoor/nextdoor-logs/cron.log 2>&1
   ```
   Adjust paths and times to match your timezone and preferences.

6. **Worker (optional)**  
   Run the worker so “Save & Recompute” and “Activate” in the UI complete. Either a long-lived process (`python -m src.worker --job-type recompute_final_scores`) or a systemd service that runs it.

## Deploying scraper changes from your local machine

After you push code to GitHub, update the server so the next cron run (or manual run) uses the new code:

- **Option A — SSH and pull**  
  From your local machine:  
  `ssh nextdoor@<server-host> "cd ~/nextdoor && git pull"`  
  Optionally run a scrape once:  
  `ssh nextdoor@<server-host> "cd ~/nextdoor && . .venv/bin/activate && ./scripts/run-scrape.sh recent"`

- **Option B — Deploy script**  
  Use `scripts/deploy-to-server.sh`. Set `DEPLOY_HOST` (e.g. `nextdoor@scraper-server`) in the environment, then run `./scripts/deploy-to-server.sh` from your local machine.

- **Option C — Server polls GitHub**  
  On the server, add a cron job that runs every few minutes: `git -C ~/nextdoor pull`. Then you only push from your local machine; the server auto-updates. You still need SSH for initial setup and for viewing logs.

## Security

- Do **not** expose the server’s SSH (or any port) to the public internet. Use Tailscale (or a similar VPN) so SSH is only over the private network.
- Use SSH key-based auth; disable password and root login.
- Keep secrets only in `scraper/.env` on the server (and in GitHub Secrets for CI/Vercel if needed). Never commit secrets.

## Supabase (dev vs prod)

For local or dev runs use a dev Supabase project; for production scraping use prod URL and service key in `scraper/.env` on the server. See [SUPABASE_MIGRATIONS.md](SUPABASE_MIGRATIONS.md) if you maintain separate dev and prod projects and run migrations in both.
