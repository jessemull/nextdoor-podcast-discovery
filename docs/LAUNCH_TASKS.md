# Launch tasks

Single list of remaining work, bucketed by before vs after go-live. After go-live includes items that need cousin input or are intentionally deferred.

---

## Before go live

- [x] **Scraper: fix programmatic scroll to trigger infinite-load** — Fixed for recent feed: scroll to bottom of document so infinite-scroll loads more; wait for DOM to grow; only stop on repeat threshold when 0 new posts. See `post_extractor._scroll_down()` and repeat-threshold logic.

- [ ] **Dedicated backfill job for new dimension** — When a new scoring dimension is added, support “backfill only missing dimension X”: prompt that returns only that dimension and an update path that merges into existing `llm_scores.scores`. See docs/IMPROVEMENTS_BACKFILL_EMBEDDER_STORAGE.md.

- [ ] Create two Supabase projects (dev, prod) and run migrations on both.

- [ ] Configure two Vercel projects or environments (dev, prod) with correct env vars.

- [x] Add `POST /api/admin/jobs/[id]/retry` to create a new job with the same params (audit trail).

- [x] Add **Retry** button in Jobs UI for jobs in `error` and `cancelled`.

- [x] **Scraper runs section on Jobs page** — Scraper self-reports each run (success/error) to `scraper_runs`; Jobs page shows last 7 days, Retry for failed runs (creates `run_scraper` with `scraper_run_id`), and Queued state from DB per run.

- [ ] Document prod env vars for laptop (see [Deployment](DEPLOYMENT.md#prod-env-vars-laptop-scraperworker)).

- [ ] Write and test `scripts/setup-laptop-server.sh` (or equivalent) for your OS.

- [ ] Document backup export (e.g. which tables, pg_dump command) and restore steps for your setup.

---

## After go live (deferred / need cousin)

These need cousin to save and mark-used posts first, or are intentionally deferred until we have enough labeled data.

- [ ] **Structured scoring log and feedback loop** — Persist post id, prompt hash, model output summary, final_score, used_on_episode; use for tuning prompts/weights.

- [ ] **Human calibration** — Use saved + used_on_episode as labels to compare system scores vs human behavior and tune prompts/weights; optional hand-labeled set (50–200 posts).

- [ ] **Cousin workflow / in-app doc note** — Short note: "Save posts you're considering; after the episode, mark the ones you used." Cousin needs to use Save and Mark as used consistently so we get signals for the above.

- [ ] **Few-shot examples in scoring prompt** — Add 1–2 few-shot examples (short post → full JSON) to improve consistency; optional for token cost. Best examples come from cousin’s labeled data (saved / used_on_episode).

- [ ] **Two-pass scoring** — Pass 1: cheap keep/drop; Pass 2: full LLM scoring on survivors. Do as a follow-up so we don’t drop posts that would have scored well in full scoring.

- [ ] (Optional) Add Slack/Discord webhook for scraper or job failure.

- [ ] (Optional) Self-host Next.js or Postgres (see [Deployment](DEPLOYMENT.md#5-self-hosting-optional)).
