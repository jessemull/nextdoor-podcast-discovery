# Production host: scraper/.env checklist

Use this checklist when configuring `scraper/.env` on the production host (e.g. `/home/nextdoor/nextdoor/scraper/.env`). The file must contain **production-only** credentials; do not use development Supabase or dev-only values. See [ENVIRONMENTS.md](ENVIRONMENTS.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Required variables

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL (production project) |
| `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API → service_role key (production; keep secret) |
| `NEXTDOOR_EMAIL` | Nextdoor account email used for scraping |
| `NEXTDOOR_PASSWORD` | Nextdoor account password |
| `SESSION_ENCRYPTION_KEY` | Generate: from repo root run `make gen-key` or `python scripts/generate-encryption-key.py`; paste the Fernet key |
| `ANTHROPIC_API_KEY` | Anthropic console (for Claude Haiku scoring) |
| `OPENAI_API_KEY` | OpenAI console (for embeddings) |

## Optional (recommended for production)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Production web app URL (e.g. `https://your-app.vercel.app`). Required if the worker should invalidate caches when activating a config. |
| `INTERNAL_API_SECRET` | Must match the Production value in Vercel env; used by worker to call `APP_URL/api/admin/invalidate-active-config`. |
| `SCRAPER_LOG_DIR` | Set by `setup-server.sh` to e.g. `/home/nextdoor/nextdoor-logs`. Leave as set. |
| `HEALTHCHECK_URL` | Healthchecks.io (or similar) URL; `run-scrape.sh` pings this on success/fail for monitoring. |
| `HEALTHCHECK_EMBED_URL` | Separate healthcheck URL for `run-embeddings.sh` (optional; falls back to `HEALTHCHECK_URL`). |
| `UNSCORED_BATCH_LIMIT` | Batch size for scoring (default 100). |

## Validation

After editing `scraper/.env` on the host, run (from repo root, with venv activated):

```bash
cd /home/nextdoor/nextdoor && . .venv/bin/activate && ./scripts/verify-host-env.sh
```

This runs `validate-scraper-env.py` (required vars) and `test-supabase-connection.py` (Supabase connectivity).
