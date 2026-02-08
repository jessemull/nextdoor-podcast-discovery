# Nextdoor Podcast Discovery Platform

Automatically discover, analyze, and curate interesting Nextdoor posts for podcast content. This monorepo contains the scraper (Python), web dashboard (Next.js), database migrations, and scripts—all designed to run on free tiers and minimal API cost (~$1–2/month).

---

## Table of Contents

- [Project goal and podcast context](#project-goal-and-podcast-context)
- [Features](#features)
- [Technologies used](#technologies-used)
- [Architecture and how components interconnect](#architecture-and-how-components-interconnect)
- [Repository structure](#repository-structure)
- [Scripts](#scripts)
- [Makefile](#makefile)
- [Environment variables](#environment-variables)
- [Setup and quick start](#setup-and-quick-start)
- [Database](#database)
- [Scraper (Python)](#scraper-python)
- [Web UI (Next.js)](#web-ui-nextjs)
- [Worker (background jobs)](#worker-background-jobs)
- [Testing and linting](#testing-and-linting)
- [Security](#security)
- [CI/CD and deployment](#cicd-and-deployment)
- [Cost](#cost)
- [Design decisions and rationale](#design-decisions-and-rationale)
- [Scraping policy](#scraping-policy)
- [Related documentation](#related-documentation)

---

## Project goal and podcast context

The platform exists to **find podcast-worthy Nextdoor posts**: absurd, dramatic, newsworthy, or discussion-sparking content that can be used on a podcast. It is cost-optimized for a small team or solo use:

- **Scrape** Nextdoor feeds (Recent and Trending) with a mobile-style browser.
- **Score** posts with Claude Haiku on dimensions like absurdity, drama, humor, relatability, and novelty-adjusted topic frequency.
- **Store** everything in Supabase (PostgreSQL + pgvector) and optionally generate embeddings for semantic search.
- **Curate** via a private web dashboard: filter, search, mark posts as used on an episode, and avoid duplicates.
- **Pittsburgh sports facts** are a special feature: a random fact for a specific user (Matt) on each login, powered by Claude Haiku.

The “podcast” is the consumer of this data: hosts pick posts from the dashboard to discuss on air; the system tracks which posts were used and on which episode date.

---

## Features

### Scraper

- **Automated scraping** — Playwright (Chromium) with mobile viewport and user agent; scroll-based extraction from Recent or Trending feed.
- **Session persistence** — Encrypted Nextdoor cookies stored in Supabase so runs can reuse login (fewer logins = fewer CAPTCHAs).
- **Deduplication** — Posts keyed by content hash and `(neighborhood_id, hash)`; duplicates are skipped at insert.
- **LLM scoring** — Claude Haiku scores posts on absurdity, drama, humor, relatability; assigns tags and summary; supports configurable dimension weights.
- **Novelty adjustment** — Topic frequency over last 30 days is used to boost rare topics and dampen over-posted ones (e.g. coyote #47 gets a lower multiplier).
- **Embeddings** — Standalone `embed` script generates OpenAI embeddings for unscored posts (no browser); used for semantic search in the web app.
- **Topic recount** — `recount_topics` (or run after scrape) updates 30-day topic counts for novelty.
- **Optional robots.txt check** — `--check-robots` verifies allowed paths before scraping.
- **Dry run and inspect** — `--dry-run` avoids DB writes; `--inspect` opens browser and pauses for manual inspection.

### Web UI

- **Authentication** — NextAuth.js with Google OAuth; access restricted by email whitelist (`ALLOWED_EMAILS`).
- **Post feed** — Paginated, filterable list of posts with scores; sort by score or “podcast worthy”; filter by neighborhood, min reaction count, episode date; show “why podcast worthy” and tags.
- **Search** — Keyword (full-text) and semantic (embedding) search with configurable similarity threshold; defaults loaded from settings.
- **Post detail** — Single post view with related posts (semantic similarity).
- **Saved posts** — Mark posts as saved; filter feed by saved.
- **Episode tracking** — Mark posts as “used on episode” with date; filter by episode date; prevents reusing the same post.
- **Settings** — Ranking weight sliders (absurdity, drama, etc.); “Save & Recompute Scores” creates a new weight config and a background job to recompute final scores; view and activate weight configs; cancel/retry jobs; search defaults (e.g. similarity threshold).
- **Admin / jobs** — List recompute jobs, job stats, cancel job, activate a weight config.
- **Pittsburgh sports fact** — Shown on login for the configured user (e.g. Matt); uses Claude Haiku; fallback fact if API fails.
- **Stats panel** — Post counts, embedding backlog, etc.

### Worker

- **Background jobs** — Polls Supabase for `recompute_final_scores` jobs; processes one at a time; updates `post_scores` for the job’s weight config; supports cancel and retry; updates job progress and status.
- **Run locally** — Same machine as scraper (or any machine with Supabase access); `python -m src.worker --job-type recompute_final_scores` (or `--once` for a single poll).

---

## Technologies used

| Layer        | Technology              | Purpose |
|-------------|-------------------------|--------|
| **Scraper** | Python 3.11+            | Runtime |
|             | Playwright              | Browser automation (headless Chromium) |
|             | Anthropic (Claude Haiku) | LLM scoring + sports facts |
|             | OpenAI                   | Embeddings (`text-embedding-3-small`) |
|             | Supabase Python client  | DB and session storage |
|             | Cryptography (Fernet)   | Encrypt session cookies |
|             | Tenacity                | Retries for login and API calls |
| **Web**     | Next.js 14+ (App Router)| SSR, API routes, React |
|             | TypeScript               | Type safety |
|             | Tailwind CSS             | Styling |
|             | React Query (TanStack)   | Server state |
|             | NextAuth.js              | Google OAuth |
|             | Zod                      | Request/response validation |
|             | Vitest + Testing Library | Tests |
| **Database**| Supabase                 | PostgreSQL + pgvector |
| **Deploy**  | Vercel                   | Next.js (Hobby) |
|             | GitHub Actions           | Scrape workflows, deploy on push |

Conventions (from `.cursorrules`): PEP 8 and type hints for Python; alphabetized imports and object keys; eslint-plugin-perfectionist for TypeScript; comment spacing rules; no secrets in code.

---

## Architecture and how components interconnect

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Actions │     │    Supabase     │     │     Vercel      │
│  or local cron  │────▶│  (PostgreSQL +  │◀────│   (Next.js)     │
│  - Scraper      │     │   pgvector)     │     │   Web UI        │
│  - Score        │     │  - posts        │     │   API routes    │
│  - Embed        │     │  - llm_scores   │     │                 │
│  - Worker       │     │  - post_scores  │     │                 │
└─────────────────┘     │  - sessions     │     └─────────────────┘
        │               │  - jobs, etc.   │
        ▼               └─────────────────┘
┌─────────────────┐
│  Claude Haiku   │  Scoring + sports facts
│  OpenAI         │  Embeddings
└─────────────────┘
```

- **Scraper** writes to `posts` (and optionally runs scoring and topic recount). It reads/writes `sessions` for cookies. It uses the same Supabase URL and **service key** as the web app server-side.
- **Embedder** (`src.embed`) reads `posts` and `llm_scores`, writes `post_embeddings`; no browser.
- **Worker** reads `background_jobs`, reads `weight_configs` and `llm_scores`/topic data, writes `post_scores` and job status. Triggered by “Save & Recompute” from the web UI.
- **Web app** uses Supabase **anon key** (client) and **service key** (server) for API routes. All mutation and admin routes require an authenticated session (NextAuth); allowed emails are configured in env.
- **Vercel** only hosts the Next.js app; no scraper or worker runs on Vercel. Scraping and worker run on GitHub Actions and/or your own machine.

---

## Repository structure

```
nextdoor/
├── .cursorrules           # Cursor/convention rules (alphabetization, comments, etc.)
├── .github/workflows/     # deploy.yml, scrape.yml, scrape-trending.yml
├── database/
│   ├── migrations/       # 001–020 SQL migrations (run in order in Supabase)
│   └── seeds/            # seed_neighborhoods.sql
├── scraper/               # Python scraper + workers
│   ├── src/
│   │   ├── main.py        # CLI entry (scrape, score, embed, worker)
│   │   ├── scraper.py     # Playwright scraper
│   │   ├── post_extractor.py
│   │   ├── post_storage.py
│   │   ├── session_manager.py
│   │   ├── llm_scorer.py
│   │   ├── llm_prompts.py
│   │   ├── embedder.py
│   │   ├── embed.py       # Standalone embed script
│   │   ├── recount_topics.py
│   │   ├── worker.py      # Background job processor
│   │   ├── novelty.py
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── robots.py
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
├── scripts/
│   ├── run-scrape.sh      # Scrape + recount + healthcheck ping
│   ├── run-embeddings.sh  # Embed + healthcheck ping
│   ├── generate-encryption-key.py
│   └── test-supabase-connection.py
├── web/                   # Next.js app
│   ├── app/               # App Router: page, layout, api/*, posts, search, settings
│   ├── components/
│   ├── lib/               # auth, supabase, hooks, posts.server, types, validators
│   ├── tests/
│   ├── package.json
│   └── next.config.js
├── docker-compose.yml     # Local Postgres + pgvector (dev only)
├── Makefile
├── DOM.html               # Optional: captured mobile DOM for scraper debugging
├── FIX_SCRAPER.md         # Known scraper gaps (URL, posted_at, feed selection, comments)
└── README.md              # This file
```

---

## Scripts

| Script | Purpose |
|--------|--------|
| **scripts/run-scrape.sh** | Runs scraper for a feed type (`recent` or `trending`), with `--score` and `--check-robots`, then `recount_topics`. Pings `HEALTHCHECK_URL` on success or `/fail` on failure. Requires repo `.venv` and `scraper/.env`. |
| **scripts/run-embeddings.sh** | Runs `python -m src.embed`; pings `HEALTHCHECK_EMBED_URL` or `HEALTHCHECK_URL`. |
| **scripts/generate-encryption-key.py** | Prints a Fernet key for `SESSION_ENCRYPTION_KEY` (session cookie encryption). |
| **scripts/test-supabase-connection.py** | Connects to Supabase using `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, lists settings and neighborhoods. Run with scraper env loaded and `supabase` installed. |

---

## Makefile

Run `make help` for a short list. Summary:

| Target | Description |
|--------|-------------|
| **venv** | Create `.venv` in repo root. |
| **install** | Install scraper + web deps (expects venv active for scraper). |
| **install-scraper** | `pip install` in scraper + `playwright install chromium`. |
| **install-web** | `npm install --legacy-peer-deps` in web. |
| **db-up** | Start local Postgres (docker-compose). |
| **db-down** | Stop local DB. |
| **db-reset** | Down + remove volume + up (wipe local DB). |
| **db-migrate-local** | Pipe all migrations + seeds into local Postgres. |
| **db-migrate-prod** | Prints instructions to run migrations in Supabase SQL Editor. |
| **build** | `npm run build` in web. |
| **dev-scraper** | `python -m src.main --dry-run` in scraper. |
| **dev-web** | `npm run dev` in web. |
| **lint** | lint-scraper + lint-web. |
| **lint-scraper** | ruff format check, ruff check, mypy in scraper. |
| **lint-web** | `npm run lint` in web. |
| **format** | ruff format + fix in scraper. |
| **security** | security-scraper + security-web. |
| **security-scraper** | bandit + pip-audit. |
| **security-web** | npm audit. |
| **test** | test-scraper + test-web. |
| **test-scraper** | pytest in scraper. |
| **test-web** | `npm test` (Vitest) in web. |
| **gen-key** | Run `scripts/generate-encryption-key.py`. |
| **clean** | Remove `__pycache__`, `.pytest_cache`, `node_modules`, `.next`, `*.pyc`. |

The Makefile assumes a **single venv at repo root** (`.venv`) for scraper; `install-scraper` will warn if `VIRTUAL_ENV` is not set.

---

## Environment variables

- **Scraper** — Copy `scraper/.env.example` to `scraper/.env`. Required: `NEXTDOOR_EMAIL`, `NEXTDOOR_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Optional: `HEALTHCHECK_URL`, `HEALTHCHECK_EMBED_URL`, `UNSCORED_BATCH_LIMIT`.
- **Web** — Copy `web/.env.example` to `web/.env.local`. Required: Supabase URL/keys (public and service), NextAuth secret/URL, Google OAuth client id/secret, `ALLOWED_EMAILS`. Optional: `USER_EMAIL` / `NEXT_PUBLIC_USER_EMAIL` and `ANTHROPIC_API_KEY` for Pittsburgh sports facts.

Use the **same** `SUPABASE_SERVICE_KEY` for both scraper and web server-side so sessions and data are in one project.

---

## Setup and quick start

1. Clone the repo; from repo root:
   ```bash
   make venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   make install
   ```
2. Create `scraper/.env` and `web/.env.local` from the example files; fill in all required variables.
3. **Database:** For production use Supabase. Create a project, run migrations in order in the SQL Editor (see [Database](#database)). For local dev only: `make db-up` then `make db-migrate-local`.
4. **Scraper (one-off):**
   ```bash
   set -a && source scraper/.env && set +a
   cd scraper && python -m src.main --feed-type recent --max-posts 5 --score
   ```
5. **Web:**
   ```bash
   make dev-web
   ```
   Open http://localhost:3000; sign in with a whitelisted Google account.
6. **Worker (if using recompute):** In another terminal, with scraper env loaded:
   ```bash
   cd scraper && python -m src.worker --job-type recompute_final_scores
   ```
   Or use `--once` for a single poll.

---

## Database

- **Production:** Supabase (PostgreSQL + pgvector). Run migrations in `database/migrations/` in numeric order (001 through 020) in the Supabase SQL Editor. Optionally run `database/seeds/seed_neighborhoods.sql`.
- **Local dev:** `docker-compose up -d db` (pgvector/pg16). Then run migrations and seeds via `make db-migrate-local` (pipes SQL into the container).

**Main tables:** `neighborhoods`, `sessions` (encrypted cookies), `posts`, `llm_scores`, `post_embeddings`, `post_scores`, `weight_configs`, `background_jobs`, `topic_frequencies`, `settings`. **RPCs** include `get_posts_with_scores`, `get_posts_by_date`, `search_posts_by_embedding`, `get_unscored_posts`, `recount_topic_frequencies`, `get_embedding_backlog_count`, and others used by the web app and scraper. See the migration files in `database/migrations/` for full schema and RPC definitions.

---

## Scraper (Python)

- **Entry:** `python -m src.main` with optional args: `--feed-type recent|trending`, `--max-posts N`, `--score`, `--embed`, `--dry-run`, `--check-robots`, `--extract-permalinks`, `--visible`, `--inspect`, etc.
- **Flow:** Load or create session (cookies) → navigate to feed URL → (on mobile, feed selection must be fixed per FIX_SCRAPER.md) → scroll and extract posts → upsert to `posts` → optionally run scoring and/or embed.
- **Scoring:** `LLMScorer` fetches unscored posts, batches them, calls Claude Haiku, computes final score with weights and novelty, upserts `llm_scores` and updates topic frequencies.
- **Embeddings:** `python -m src.embed` (no browser); reads posts with scores but no embedding, batches to OpenAI, writes `post_embeddings`.
- **Worker:** `python -m src.worker` polls `background_jobs`, processes `recompute_final_scores` jobs (compute `post_scores` for a weight config).

Virtual env can be at repo root `.venv` (Makefile) or inside `scraper/.venv`; ensure `playwright install chromium` has been run.

---

## Web UI (Next.js)

- **Pages:** `/` (feed), `/posts/[id]` (post detail), `/search`, `/settings`, `/login`.
- **API routes (main):** `GET/POST /api/posts`, `GET/POST /api/posts/[id]`, `POST /api/posts/[id]/saved`, `POST /api/posts/[id]/used`, `GET /api/search`, `GET/PUT /api/settings`, `GET /api/neighborhoods`, `GET /api/episodes`, `GET /api/stats`, `GET /api/sports-fact`, plus admin: jobs, recompute-scores, weight-configs.
- **Auth:** NextAuth with Google; middleware or `getServerSession` protect routes; `ALLOWED_EMAILS` restricts who can sign in.
- **Data:** Server components and API routes use Supabase server client; client components use React Query against the API. Embedding cache and post-fetching helpers live in `lib/`.

---

## Worker (background jobs)

- **Role:** Process `recompute_final_scores` jobs created when a user clicks “Save & Recompute Scores” in Settings. Each job has a `weight_config_id`. The worker loads that config, recomputes final scores (weights + novelty) for all posts with LLM scores, and writes `post_scores`. When the job completes, the user can “Activate” that config so the feed uses the new rankings.
- **Run:** `python -m src.worker --job-type recompute_final_scores` (continuous poll), or `--once` for one poll. Same env as scraper (Supabase, no Nextdoor/Playwright needed). Jobs support cancel and retry; worker processes one job at a time.

---

## Testing and linting

- **Lint:** `make lint` (scraper: ruff + mypy; web: eslint). `make format` formats scraper code.
- **Test:** `make test` runs `pytest` in scraper and `npm test` (Vitest) in web. Scraper tests mock Playwright, Anthropic, Supabase. Web tests mock Supabase and NextAuth where needed; API tests use Vitest.
- **E2E / manual:** Use the web UI and Supabase to verify: create weight config → run worker → activate config → check feed order; run scraper → check posts in DB; run embed → check search. See `FIX_SCRAPER.md` for current data gaps to fix before relying on full E2E.

---

## Security

- **Secrets:** Only in environment variables (and GitHub Secrets for Actions); never committed.
- **Scraper:** Bandit and pip-audit via `make security-scraper`.
- **Web:** `npm audit` via `make security-web`.
- **Auth:** Email whitelist; server-side session checks on all mutating and admin API routes.

---

## CI/CD and deployment

- **Deploy (web):** Push to `main` with changes under `web/` or the deploy workflow file triggers Vercel deploy (`.github/workflows/deploy.yml`). Uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- **Scrape (GitHub Actions):**  
  - `scrape.yml`: daily at 2:00 AM UTC — recent feed, score, recount, embed; on failure creates/updates an issue with label `scraper-failure`.  
  - `scrape-trending.yml`: daily at 6:00 PM UTC — trending feed, same pipeline.  
  Both use GitHub Secrets for Nextdoor, Supabase, Anthropic, OpenAI, and session encryption key. No worker runs in Actions; recompute jobs are processed when you run the worker locally (or on a machine you control).

---

## Cost

Target **~$1–2/month**:

| Service | Cost |
|--------|------|
| Supabase | Free (500MB) |
| Vercel | Free (Hobby) |
| GitHub Actions | Free (2,000 min/month; scrape uses a few min/day) |
| Claude Haiku | ~$0.50–1.00 (scoring + sports facts) |
| OpenAI embeddings | ~$0.10–0.50 |
| **Total** | **~$1–2/month** |

Scaling: more posts → more scoring and embedding tokens; stay within Supabase 500MB (roughly tens of thousands of posts with embeddings).

---

## Design decisions and rationale

- **Monorepo:** One repo for scraper, web, DB migrations, and scripts so one PR can touch the full pipeline and CI uses one set of secrets.
- **Claude Haiku (not Sonnet):** Cost optimization; Haiku is sufficient for scoring and short sports facts.
- **Supabase:** PostgreSQL + pgvector in one place; free tier and simple auth model for server-side key.
- **Materialized final scores + background jobs:** Computing scores on every request does not scale; storing `post_scores` per weight config and recomputing in a job keeps reads fast and allows atomic switch of “active” config.
- **Weight config versioning:** Multiple configs can exist; only one is “active.” Recompute fills scores for a config; activating it switches the feed without recomputing again.
- **Session cookies in Supabase:** Reusing login across runs reduces CAPTCHA risk; encryption (Fernet) keeps cookies safe at rest.
- **Mobile viewport for scraper:** Nextdoor’s mobile UI is used for scraping; feed selection and some selectors differ from desktop (see FIX_SCRAPER.md).

---

## Scraping policy

- **Rate limiting:** Configurable scroll and typing delays in `scraper/src/config.py`. No aggressive throttling by default.
- **robots.txt:** Not enforced by default. Use `--check-robots` to exit with an error if our paths are disallowed (see `src/robots.py` and config URLs).
- **Data use:** For personal/podcast curation only. Comply with Nextdoor’s terms and your own ethics.

---

## Related documentation

- **FIX_SCRAPER.md** — Known issues: `posts.url` / `posted_at` / `episode_date` often NULL, mobile feed selection (Filter by → Recent/Trending), and desired comment scraping. Use it to verify fixes in Supabase.
- **DOM.html** — Optional snapshot of the mobile feed DOM for debugging selectors.
- **.cursorrules** — Project conventions (alphabetization, comments, Python/TypeScript style, testing philosophy).
- **database/migrations/** — Source of truth for schema and RPCs; run in order in Supabase.
