# Nextdoor Podcast Discovery Platform

Automatically discover, analyze, and curate interesting Nextdoor posts for podcast content. This monorepo contains the **scraper** (Python), **web dashboard** (Next.js), **database migrations**, and **scripts**—all designed to run on free tiers and minimal API cost (~$2–4/month).

## Table of Contents

- [Project goal & podcast](#project-goal--podcast-context)
- [Features](#features)
  - [Scraper](#scraper)
  - [Web UI](#web-ui)
  - [Worker](#worker)
- [Technologies](#technologies-used)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Scripts](#scripts)
- [Makefile](#makefile)
  - [Setup](#makefile--setup)
  - [Database](#makefile--database)
  - [Development](#makefile--development)
  - [Quality](#makefile--quality)
  - [Security](#makefile--security)
  - [Testing](#makefile--testing)
  - [Utilities](#makefile--utilities)
- [Environment variables](#environment-variables)
- [Setup & quick start](#setup--quick-start)
- [Database](#database)
- [Scraper (Python)](#scraper-python)
- [Web UI (Next.js)](#web-ui-nextjs)
- [Worker (background jobs)](#worker-background-jobs)
- [Testing & linting](#testing--linting)
- [Security](#security)
- [CI/CD & deployment](#cicd--deployment)
- [Cost](#cost)
- [Design decisions](#design-decisions)
- [Scraping policy](#scraping-policy)
- [Related documentation](#related-documentation)

## Project goal & podcast context

The platform exists to **find podcast-worthy Nextdoor posts**: absurd, dramatic, newsworthy, or discussion-sparking content for use on a podcast. It is cost-optimized for a small team or solo use.

- **Scrape** — Nextdoor Recent and Trending feeds via a mobile-style browser.
- **Score** — Claude Haiku scores posts (absurdity, drama, humor, relatability) with novelty-adjusted topic frequency.
- **Store** — Supabase (PostgreSQL + pgvector); optional embeddings for semantic search.
- **Curate** — Private web dashboard: filter, search, mark “used on episode,” avoid duplicates.
- **Pittsburgh sports facts** — Random fact shown to all logged-in users on the home page, powered by Claude Haiku.

The **podcast** consumes this data: hosts pick posts from the dashboard to discuss on air; the system tracks which posts were used and on which episode date.

## Features

### Scraper

| Feature | Description |
| :------ | :----------- |
| Automated scraping | Playwright (Chromium), mobile viewport; scroll-based extraction from Recent or Trending feed |
| Session persistence | Encrypted Nextdoor cookies in Supabase; reuse login across runs (fewer CAPTCHAs) |
| Deduplication | Content hash + `(neighborhood_id, hash)`; duplicates skipped at insert |
| LLM scoring | Claude Haiku: ensemble (3 runs, median aggregation) for absurdity, drama, humor, relatability; tags, summary; configurable weights; ~3x API cost |
| Novelty adjustment | 30-day topic frequency boosts rare topics, dampens over-posted ones (e.g. coyote #47) |
| Embeddings | Standalone `embed` script: OpenAI embeddings for unscored posts (no browser); powers semantic search |
| Topic recount | `recount_topics` updates 30-day topic counts for novelty |
| robots.txt check | `--check-robots` verifies allowed paths before scraping |
| Dry run & inspect | `--dry-run` skips DB writes; `--inspect` opens browser and pauses for manual inspection |

### Web UI

| Feature | Description |
| :------ | :----------- |
| Authentication | Auth0; access controlled by Auth0 (no server-side email whitelist) |
| Post feed | Paginated, filterable; sort by score or “podcast worthy”; filter by neighborhood, min reactions, episode date; “why podcast worthy” and tags |
| Search | Keyword (full-text) + semantic (embedding) search; configurable similarity threshold; defaults from settings |
| Post detail | Single post + related posts (semantic similarity) |
| Saved posts | Mark saved; filter feed by saved |
| Episode tracking | Mark “used on episode” with date; filter by episode date; avoid reuse |
| Settings | Weight sliders; “Save & Recompute Scores” (new config + background job); view/activate configs; cancel/retry jobs; search defaults |
| Admin access | Admin routes are protected by Auth0 only; any logged-in user can access them. A separate admin role may be added later if needed. |
| Admin / jobs | List jobs, stats, cancel job, activate weight config |
| Pittsburgh sports fact | Shown to all logged-in users on home page; Claude Haiku; error message if API fails |
| Stats panel | Post counts, embedding backlog, etc. |

### Worker

- **Role** — Polls Supabase for `recompute_final_scores` jobs; processes one at a time; writes `post_scores` for that weight config; cancel/retry and progress updates.
- **Run** — Same machine as scraper (or any with Supabase access): `python -m src.worker --job-type recompute_final_scores` or `--once`.

## Technologies used

Conventions (from `.cursorrules`): PEP 8 and type hints (Python); alphabetized imports and object keys; eslint-plugin-perfectionist (TypeScript); comment spacing; no secrets in code.

**Scraper:** Python 3.11+, Playwright, Anthropic (Claude Haiku), OpenAI, Supabase Python client, Cryptography (Fernet), Tenacity.

**Web:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, React Query (TanStack), Auth0, Zod, Vitest + Testing Library.

**Database & deploy:** Supabase (PostgreSQL + pgvector), Vercel (Next.js Hobby), GitHub Actions.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Actions │     │    Supabase     │     │     Vercel      │
│  or local cron  │────▶│  (PostgreSQL +  │◀────│   (Next.js)     │
│  - Scraper      │     │   pgvector)     │     │   Web UI        │
│  - Score        │     │  - posts        │     │   API routes    │
│  - Embed        │     │  - llm_scores   │     │                 │
│  - Worker       │     │  - post_scores  │     │                 │
└─────────────────┘     │  - sessions    │     └─────────────────┘
        │                │  - jobs, etc.  │
        ▼                └─────────────────┘
┌─────────────────┐
│  Claude Haiku   │  Scoring + sports facts
│  OpenAI         │  Embeddings
└─────────────────┘
```

- **Scraper** — Writes `posts`; optionally scoring + topic recount. Reads/writes `sessions` for cookies. Uses Supabase **service key** (same as web server-side).
- **Embedder** (`src.embed`) — Reads `posts` and `llm_scores`; writes `post_embeddings`. No browser.
- **Worker** — Reads `background_jobs`, `weight_configs`, `llm_scores`/topic data; writes `post_scores` and job status. Triggered by “Save & Recompute” in the UI.
- **Web app** — Supabase **anon key** (client) and **service key** (server). All mutation/admin routes require Auth0 session; access is controlled solely by Auth0 (no server-side email whitelist).
- **Vercel** — Hosts Next.js only. Scraper and worker run in GitHub Actions and/or your own machine.

## Repository structure

```
nextdoor/
├── .cursorrules           # Conventions (alphabetization, comments, style)
├── .github/workflows/     # ci.yml, deploy.yml, scrape.yml, scrape-trending.yml
├── database/
│   ├── migrations/        # 001–036 SQL (run in numeric order in Supabase)
│   └── seeds/             # seed_neighborhoods.sql
├── scraper/               # Python scraper + workers
│   ├── src/
│   │   ├── main.py         # CLI: scrape, score, embed, worker
│   │   ├── scraper.py     # Playwright scraper
│   │   ├── post_extractor.py, post_storage.py, session_manager.py
│   │   ├── llm_scorer.py, llm_prompts.py, embedder.py, embed.py
│   │   ├── recount_topics.py, worker.py, novelty.py
│   │   ├── config.py, exceptions.py, robots.py
│   ├── tests/
│   ├── pyproject.toml, requirements.txt
├── scripts/
│   ├── run-scrape.sh      # Scrape + recount + healthcheck
│   ├── run-embeddings.sh  # Embed + healthcheck
│   ├── generate-encryption-key.py
│   └── test-supabase-connection.py
├── web/                   # Next.js app
│   ├── app/               # App Router: page, layout, api/*, posts, search, settings
│   ├── components/, lib/, tests/
│   ├── package.json, next.config.js
├── docker-compose.yml     # Local Postgres + pgvector (dev only)
├── Makefile
├── DOM.html               # Optional: mobile DOM snapshot for scraper debugging
└── README.md
```

## Scripts

| Script | Purpose |
| :----- | :------ |
| `scripts/run-scrape.sh` | Scrape `recent` or `trending` with score and embed (default), plus `--check-robots`, then `recount_topics`. Pings `HEALTHCHECK_URL` on success or `/fail` on failure. Needs repo `.venv` and `scraper/.env`. |
| `scripts/run-embeddings.sh` | Runs `python -m src.embed`; pings `HEALTHCHECK_EMBED_URL` or `HEALTHCHECK_URL`. |
| `scripts/generate-encryption-key.py` | Prints a Fernet key for `SESSION_ENCRYPTION_KEY`. |
| `scripts/test-supabase-connection.py` | Connects to Supabase, lists settings and neighborhoods. Run with scraper env and `supabase` installed. |

## Makefile

Run **`make help`** for the short list. Targets by section:

### Makefile — Setup

| Target | Description |
| :----- | :----------- |
| `venv` | Create `.venv` in repo root |
| `install` | Install scraper + web deps (expects venv active) |
| `install-scraper` | pip install + `playwright install chromium` |
| `install-web` | `npm install --legacy-peer-deps` in web |

### Makefile — Database

| Target | Description |
| :----- | :----------- |
| `db-up` | Start local Postgres (docker-compose) |
| `db-down` | Stop local DB |
| `db-reset` | Wipe local DB (down + remove volume + up) |
| `db-migrate-local` | Run all migrations + seeds into local Postgres |
| `db-migrate-prod` | Print instructions for Supabase SQL Editor |

### Makefile — Development

| Target | Description |
| :----- | :----------- |
| `build` | `npm run build` in web |
| `dev-scraper` | `python -m src.main --dry-run` in scraper |
| `dev-web` | `npm run dev` in web |

### Makefile — Quality

| Target | Description |
| :----- | :----------- |
| `lint` | lint-scraper + lint-web |
| `lint-scraper` | ruff format check, ruff check, mypy |
| `lint-web` | `npm run lint` |
| `format` | ruff format + fix in scraper |

### Makefile — Security

| Target | Description |
| :----- | :----------- |
| `security` | security-scraper + security-web |
| `security-scraper` | bandit + pip-audit |
| `security-web` | npm audit |

### Makefile — Testing

| Target | Description |
| :----- | :----------- |
| `test` | test-scraper + test-web |
| `test-scraper` | pytest in scraper |
| `test-web` | `npm test` (Vitest) in web |

### Makefile — Utilities

| Target | Description |
| :----- | :----------- |
| `gen-key` | Run `scripts/generate-encryption-key.py` |
| `clean` | Remove `__pycache__`, `.pytest_cache`, `node_modules`, `.next`, `*.pyc` |

The Makefile assumes a **single venv at repo root** (`.venv`); `install-scraper` warns if `VIRTUAL_ENV` is not set.

## Environment variables

Use the **same** `SUPABASE_SERVICE_KEY` for both scraper and web server-side so sessions and data live in one project.

### Scraper

- **Config file:** `scraper/.env` (copy from `.env.example`)
- **Required:** `NEXTDOOR_EMAIL`, `NEXTDOOR_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **Optional:** `APP_URL`, `HEALTHCHECK_EMBED_URL`, `HEALTHCHECK_URL`, `INTERNAL_API_SECRET` (worker: cache invalidation after activate cutover), `UNSCORED_BATCH_LIMIT`

### Web

- **Config file:** `web/.env.local` (copy from `.env.example`)
- **Required:** Supabase URL/keys (public + service), Auth0 domain/client/secret, `APP_BASE_URL`
- **Optional:** `ANTHROPIC_API_KEY` (sports fact on home page), `INTERNAL_API_SECRET` (for worker-triggered cache invalidation after activate cutover), `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (shared caching; when unset, in-memory fallback)

## Setup & quick start

1. **Clone & install**
   ```bash
   make venv
   source .venv/bin/activate
   make install
   ```

2. **Env files** — Create `scraper/.env` and `web/.env.local` from the example files; fill in all required variables.

3. **Database**
   - **Production:** Create a Supabase project and run all migrations 001–036 in numeric order in the SQL Editor (see [Database](#database)).
   - **Local:** `make db-up` then `make db-migrate-local`.

4. **Scraper (one-off)**
   ```bash
   set -a && source scraper/.env && set +a
   cd scraper && python -m src.main --feed-type recent --max-posts 5
   ```

5. **Web** — Run `make dev-web`, open http://localhost:3000, and sign in with Auth0.

6. **Worker (optional)** — With scraper env loaded: `cd scraper && python -m src.worker --job-type recompute_final_scores` (or `--once`).

## Database

**Production:** Supabase. Run all files in `database/migrations/` in numeric order (001_initial_schema.sql through 036_backfill_dimension.sql) in the SQL Editor. Optionally run `database/seeds/seed_neighborhoods.sql`. For two projects (dev + prod), see [docs/SUPABASE_MIGRATIONS.md](docs/SUPABASE_MIGRATIONS.md).

**Local dev:** `docker-compose up -d db` (pgvector/pg16), then `make db-migrate-local` to pipe migrations and seeds into the container.

**Main tables:** `neighborhoods`, `sessions` (encrypted cookies), `posts`, `llm_scores`, `post_embeddings`, `post_scores`, `weight_configs`, `background_jobs`, `topic_frequencies`, `settings`.

**Key RPCs:** `get_posts_with_scores`, `get_posts_by_date`, `search_posts_by_embedding`, `get_unscored_posts`, `recount_topic_frequencies`, `get_embedding_backlog_count`, and others used by web and scraper. See `database/migrations/` for full schema and RPC definitions.

## Scraper (Python)

**Entry:** `python -m src.main` with optional args: `--feed-type recent|trending`, `--max-posts N`, `--dry-run`, `--check-robots`, `--visible`, `--inspect`. Scoring and embedding run by default; use `--no-score` or `--no-embed` to skip.

**Flow:** Load or create session (cookies) → navigate to feed → (mobile feed selection) → scroll and extract posts → upsert to `posts` → optionally run scoring and/or embed.

**Scoring:** `LLMScorer` fetches unscored posts, batches them, runs each batch 3 times (temperature 0.3) for ensemble variance, aggregates with median per dimension, computes final score (weights + novelty), and upserts `llm_scores` and topic frequencies.

**Embeddings:** `python -m src.embed` (no browser) reads posts with scores but no embedding, batches to OpenAI, and writes `post_embeddings`.

**Worker:** `python -m src.worker` polls `background_jobs` and processes `recompute_final_scores` jobs (writes `post_scores` for a weight config).

**Long runs and debugging:** For large runs use `make scrape-trending-300` (or `python -m src.main --feed-type trending --max-posts 300`). The Make target runs under **caffeinate** (`-dis`: display and system stay awake) so the Mac does not sleep or show the screensaver and freeze the browser. The pipeline may stop before `max_posts` if the feed runs out of new content: after **5 consecutive scrolls** with 0 new posts it logs "No new posts after 5 scrolls, stopping" (e.g. 200 posts instead of 300). The pipeline logs PID and start time, and a **heartbeat every 60s** so you can tell if it’s still running or stuck. If heartbeats continue but no new “Scroll N” or “Scrolling down” logs, the main thread is stuck in a Playwright call (often due to display/sleep having fired before caffeinate). Granular logs (“Extracting from page (scroll N…)”, “Scrolling down (about to run scroll N)”, “Scroll down done”) show where it stalled. To capture logs: `PYTHONUNBUFFERED=1 make scrape-trending-300 2>&1 | tee scrape.log`. Every exit logs `Exiting with code 0` or `Exiting with code 1`.

Use repo root `.venv` or `scraper/.venv`; run `playwright install chromium` at least once.

## Web UI (Next.js)

**Pages:** `/` (feed), `/posts/[id]` (post detail), `/search`, `/settings`, `/login`.

**API routes:** `GET/POST /api/posts`, `GET/POST /api/posts/[id]`, `POST /api/posts/[id]/saved`, `POST /api/posts/[id]/used`, `GET /api/search`, `GET/PUT /api/settings`, `GET /api/neighborhoods`, `GET /api/episodes`, `GET /api/stats`, `GET /api/sports-fact`, plus admin: jobs, recompute-scores, weight-configs.

**Auth:** Auth0; middleware and API routes use `auth0.getSession()`; access controlled by Auth0 only.

**Data:** Server components and API routes use the Supabase server client; the client uses React Query against the API. Helpers and embedding cache live in `lib/`.

## Worker (background jobs)

Processes `recompute_final_scores` jobs. Created when a user clicks “Save & Recompute” (new config) or “Activate” (switch to a config). Each job has a `weight_config_id`; the worker recomputes final scores (weights + novelty) for all posts and writes `post_scores`. **Activate** uses compute-then-cutover: the config becomes active only after the job completes. Jobs created from Activate include `activate_on_completion: true`; when the job finishes, the worker sets that config as active and optionally pings the app to invalidate the active-config cache.

**Run:** `python -m src.worker --job-type recompute_final_scores` (continuous) or `--once`. Same env as scraper (Supabase only). Jobs support cancel and retry; the worker processes one job at a time.

**Optional (worker):** `APP_URL` (e.g. `https://yourapp.vercel.app`) and `INTERNAL_API_SECRET` — when set, the worker POSTs to `APP_URL/api/admin/invalidate-active-config` after an activate cutover so the app sees the new active config immediately; otherwise the cache refreshes within its TTL.

## Testing & linting

- **Lint** — `make lint` (scraper: ruff + mypy; web: eslint). `make format` formats scraper code.
- **Test** — `make test` runs pytest in scraper and Vitest in web. Scraper tests mock Playwright, Anthropic, Supabase; web tests mock Supabase and NextAuth.
- **E2E / manual** — Use the UI and Supabase to verify: create weight config → run worker → activate → check feed; run scraper → check posts; run embed → check search. Web tests mock Auth0.

## Security

- **Secrets** — Environment variables and GitHub Secrets only; never committed.
- **Scraper** — `make security-scraper` runs bandit and pip-audit.
- **Web** — `make security-web` runs npm audit.
- **Auth** — Auth0; server-side session checks on all mutation and admin API routes; no server-side email whitelist.

## CI/CD & deployment

| Workflow | Trigger / schedule | What it does |
| :------- | :----------------- | :----------- |
| **CI** | Pull request and push to `main` | Lint (scraper + web), test (scraper + web), security (bandit, pip-audit, npm audit), build web. |
| **Deploy (web)** | Push to `main` (changes under `web/` or workflow file) | Vercel deploy. Uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. |
| **scrape.yml** | Daily 2:00 AM UTC (or manual) | Recent feed → score → recount → embed. On failure: create/update issue with label `scraper-failure`. |
| **scrape-trending.yml** | Daily 6:00 PM UTC (or manual) | Trending feed → same pipeline; same failure handling. |

Both scrape workflows use GitHub Secrets (Nextdoor, Supabase, Anthropic, OpenAI, session encryption). **No worker in Actions**—recompute jobs run when you run the worker locally (or on a machine you control).

## Cost

Target **~$2–4/month**:

| Service | Cost |
| :------ | :--- |
| Supabase | Free (500MB) |
| Vercel | Free (Hobby) |
| GitHub Actions | Free (2,000 min/month; scrape uses a few min/day) |
| Claude Haiku | ~$1.50–3.00 (ensemble scoring 3x + sports facts) |
| OpenAI embeddings | ~$0.10–0.50 |
| **Total** | **~$2–4/month** |

More posts → more tokens; stay within Supabase 500MB (roughly tens of thousands of posts with embeddings).

## Design decisions

| Decision | Rationale |
| :------- | :--------- |
| **Monorepo** | One PR can touch full pipeline; single set of secrets for CI |
| **Claude Haiku (not Sonnet)** | Cost; Haiku sufficient for scoring and short sports facts |
| **Supabase** | PostgreSQL + pgvector; free tier; simple server-side key usage |
| **Materialized final scores + background jobs** | On-request computation doesn’t scale; precomputed `post_scores` + job keeps reads fast and allows atomic config switch |
| **Weight config versioning** | Multiple configs; one “active”; recompute fills one config; activation switches feed without recomputing |
| **Session cookies in Supabase** | Reuse login across runs → fewer CAPTCHAs; Fernet encryption at rest |
| **Mobile viewport for scraper** | Nextdoor mobile UI; feed selection and selectors differ from desktop |

## Scraping policy

- **Rate limiting** — Configurable scroll and typing delays in `scraper/src/config.py`; no aggressive throttling by default.
- **robots.txt** — Not enforced by default. Use `--check-robots` to exit with an error if our paths are disallowed (`src/robots.py`, config URLs).
- **Data use** — For personal/podcast curation only; comply with Nextdoor’s terms and your own ethics.

## Related documentation

| Doc | Purpose |
| :-- | :------ |
| **DOM.html** | Optional mobile feed DOM snapshot for debugging selectors. |
| **.cursorrules** | Project conventions: alphabetization, comments, Python/TypeScript style, testing philosophy. |
| **database/migrations/** | Source of truth for schema and RPCs; run in order in Supabase. |
