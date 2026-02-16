# Improvements & tasks

Tracked list of product and system improvements to complete.

---

## 1. Runtime vs stored scores (preview + cutover)

- [ ] **Toggle for runtime calculation versus actual scores saved in DB**
  - Add DB function (or app path) that computes `final_score` from `llm_scores` + weight config (weights + novelty).
  - Feed can use runtime for “preview” (any config, instant) or stored `post_scores` when available (fast).
  - Let user try configs with runtime, then run recompute job to persist; feed uses stored path after job completes.

---

## 2. Recompute job with clean cutover

- [ ] **System for recalculating scores with new weights with clean cutover**
  - During recompute, avoid mixing old and new scores in the feed (no partial state for 2+ hours).
  - Option: staging table — job writes to `post_scores_staging` (by job/config); on job success, one transaction: delete `post_scores` for that config, insert from staging, then clear staging for that job.
  - Feed always reads `post_scores`; cutover happens once when the job completes.

---

## 3. Scoring and worker correctness

- [ ] **Clamp final_score to [0, 10] in scorer and worker**
  - Normalized × novelty can exceed 10 (e.g. 10 × 1.5 = 15). Clamp in `calculate_final_scores` (llm_scorer) and `calculate_final_score` (worker) so feed/UI semantics are consistent.
- [ ] **Add ORDER BY id to worker's llm_scores batch query**
  - Recompute job fetches batches without a stable order; add `.order("id")` (or `created_at`) for deterministic pagination and to avoid skip/duplicate rows.

---

## 4. Stale post data after scrape

- [ ] **Figure out which data might update after we scrape it (e.g. more comments)**
  - Identify fields that can change on Nextdoor after we store the post (comments count, reaction count, etc.).
  - Decide: drop/ignore that data, or define an update strategy (e.g. periodic refresh, or only use immutable fields for ranking and show “may have changed” in UI).

---

## 5. Comments in the UI and scoring

- [ ] **Show comments in the UI**
  - Surface comment count and/or comment content where it makes sense (e.g. post card, post detail).
  - Clarify data source (stored at scrape time vs live) and any limits.
- [ ] **Explore incorporating comments into scoring**
  - Comments are scraped and stored in `posts.comments` but not passed to the LLM scorer. Comments can be funny, add context, or boost podcast-worthiness.
  - Tradeoff: more tokens per post (higher API cost) vs potentially more accurate scoring. Options to explore: include top N comments (truncated), summarize comments, or make it configurable. Document findings and recommend approach.

---

## 6. Loading and error states

- [ ] **Verify loading states and error states for each page in the UI**
  - Audit every page: ensure loading (skeletons/spinners) and error (message + recovery) are implemented and consistent.
  - Fix or add where missing.

---

## 7. Auth and whitelist

- [x] **Replace ENV-based email whitelist with a proper approach**
  - Currently: `ALLOWED_EMAILS` is a single env var (comma-separated emails). No UI to add/remove users; changing access requires editing env and redeploying.
  - **Options (see `docs/AUTH.md`):**
    - **Google Test users:** Keep OAuth app in “Testing,” add allowed emails as Test users in GCP; remove or relax `ALLOWED_EMAILS` in app. (Max 100 users; testing warning.)
    - **Okta:** Switch to Okta provider; manage allowed users in Okta (assign users/groups to the app). No env whitelist in our app.
    - **DB-backed list:** Store allowed emails (or user ids) in DB; check in `signIn` callback; add admin UI to manage. No redeploy to add/remove users.

---

## 8. Structured scoring log and feedback loop

- [ ] **Log (or store) scoring inputs/outputs and tie to outcomes**
  - Persist for analysis: post id, prompt (or hash), model output (or summary), final_score, and whether the post later “made the show” (`used_on_episode`).
  - Periodically review: “What did we include that scored low?” and “What did we miss that scored high?” Use to adjust prompts and weights.
  - Enables a real feedback loop for scoring quality.

---

## 9. Rubric and internal chain-of-thought

- [ ] **Add explicit rubric text and “think step-by-step” to scoring prompts**
  - Per dimension, add explicit scale text (e.g. “0 = …, 3 = …, 5 = …”) so the model has a clear rubric.
  - Instruct the model to reason internally and return only valid JSON (no visible CoT needed; improves consistency).

---

## 10. Human calibration and permalink queue

- [ ] **Use saved + used_on_episode as human signal for calibration**
  - Saved = “interesting for podcast”; used_on_episode = “actually made the show.” Use these as labels to compare system scores vs human behavior and tune prompts/weights. Optional: add a small hand-labeled set (50–200 posts) for stricter calibration.
- [ ] **Permalink queue and scraper job for high-value posts**
  - Allow adding Nextdoor permalinks to a queue (e.g. cousin finds posts we don’t scrape). Job runs x times per day: fetch each permalink page, scrape the single post, store and score it. Ensures high-value posts from outside the main feed get into the system.

---

## 11. Two-pass scoring

- [ ] **Pass 1: cheap keep/drop; Pass 2: full scoring on survivors**
  - Pass 1: fast/cheap binary (or light) filter to drop clearly irrelevant posts.
  - Pass 2: full multi-dimension LLM scoring only on survivors. Reduces cost and can improve average quality.

---

## 12. Ensemble scoring (3 runs, median)

- [ ] **Score each post 3 times; store median (or average) of dimension scores**
  - Run the same batch 3 times (e.g. same prompt, slight temperature or phrasing variation); aggregate per dimension (e.g. median) then compute final_score from aggregated dimensions. Reduces LLM noise.
  - Cost: ~3× current scoring API cost for the same set of posts. Batching is unchanged (still batches of 5 posts per call; do 3 calls per logical batch). Implementation is straightforward.

---

## 13. Scoring accuracy and tunability

- [ ] **Store prompt_version or prompt_hash in llm_scores (or run metadata)**
  - So we know which prompt produced which scores; supports feedback loop and A/B tests.
- [ ] **Reproducibility (temperature / seed)**
  - Consider temperature=0 for scoring if supported by the API for more deterministic scores; or document that 0.3 causes variance. If the API gains a seed parameter, use it for reproducibility.
- [ ] **Score distribution visibility**
  - Add simple score stats (min, max, mean, p50, p90) per dimension and for final_score, e.g. on Settings or Admin, so we can see distribution and tune prompts/weights.
- [ ] **Truncation signal in scoring prompt**
  - When post text is truncated, add a line to the prompt (e.g. “[Text truncated at 2000 characters]”) or a field in the expected JSON so the model and downstream logic can account for partial content.
- [ ] **Few-shot examples in scoring prompt**
  - Add 1–2 few-shot examples (short post → full JSON) to improve consistency; optional and tunable for token cost.
- [ ] **New dimension backfill**
  - When adding a new scoring dimension: document that existing posts get default (5.0) for that dimension unless re-scored; optionally support a backfill job to re-score only for the new dimension (or full re-score) for consistency.
- [x] **Cold-start novelty behavior**
  - When topic_frequencies is empty or total scored posts < N, use novelty multiplier 1.0 (neutral) instead of max boost to avoid boosting all early posts.
- [ ] **Validate weight config keys against known SCORING_DIMENSIONS**
  - When saving (API/Settings), warn or reject unknown dimensions to avoid silent 5.0 fallbacks.

---

## 14. Performance and latency

- [ ] **Parallelize independent DB round-trips in API**
  - **Posts feed:** After `get_posts_with_scores` or `get_posts_by_date` returns, run count RPC and fetch posts by IDs in parallel (e.g. `Promise.all`) instead of sequentially. Saves one round-trip per request.
  - **Single post (GET /api/posts/[id] and getPostById):** Fetch post+neighborhood and `llm_scores` in parallel with `Promise.all`.
  - **Search (POST /api/search):** After vector search, fetch `llm_scores` and `neighborhoods` in parallel with `Promise.all`.
- [ ] **Cache active weight config id**
  - Posts feed, bulk resolve, and related flows each do 1–2 DB calls to resolve `active_weight_config_id`. Add short-TTL in-memory cache (e.g. 30–60s) so repeated requests avoid repeated lookups; keep TTL short so config changes are seen quickly.
- [ ] **Feed data caching and deduplication (frontend)**
  - Feed uses raw `fetch` with no client cache; every filter change or remount refetches. Consider React Query (TanStack Query): cache by query key (filters + pagination), deduplicate in-flight requests, optional prefetch on “load more” or hover to reduce perceived latency.
- [ ] **Batch DB writes in LLM scorer**
  - **llm_scores:** Currently upserted one row per result in a loop. Build full list and call a single `.upsert(...).execute()` for the batch.
  - **Topic frequencies:** One RPC or select+upsert per category per batch. Add or use a batch RPC that accepts multiple (category, increment) pairs (or single transaction) instead of one round-trip per category.
- [ ] **Embedder: process in chunks instead of full-table load**
  - `generate_and_store_embeddings()` loads all `posts` (id, text) and all `post_embeddings` (post_id) into memory. Use an RPC like `get_posts_without_embeddings(limit N)` or paginated/cursor query; process N posts at a time, then fetch next chunk. Avoid loading full tables into memory.
- [ ] **Worker: throttle cancel checks and progress updates**
  - Recompute job does a DB round-trip to check cancellation and one to update progress every batch. Check cancellation every N batches (e.g. 5); throttle progress updates (e.g. every N batches or every M seconds); still set final progress on completion.
- [ ] **Post storage: batch neighborhood lookups**
  - For each batch, collect unique neighborhood names; batch-fetch existing by slug (e.g. `in("slug", slugs)`); batch-insert missing; fill cache and use when building `posts_data`. Reduces round-trips when many distinct neighborhoods appear in one scrape batch.
- [ ] **Scraper: Fix programmatic scroll to trigger infinite-load**
  - Manual scrolling loads new posts indefinitely; programmatic `window.scrollBy()` does not trigger Nextdoor's infinite scroll. Try wheel/touch simulation, Playwright native scroll, or scroll-into-view on sentinel elements so more posts load during extraction.
- [ ] **Scraper: tune scroll delay for speed vs reliability**
  - Current `scroll_delay_ms` (2000, 5000) increases total scrape time. Consider lower range (e.g. 1–3s); document or monitor for rate limits/CAPTCHA; make range configurable via env if needed.
- [ ] **(Optional) Shared embedding cache for search**
  - In-memory cache is per serverless instance; repeated identical searches on other instances miss cache. If search traffic justifies it, consider shared cache (e.g. Vercel KV or Redis) for query embeddings. Document cost/benefit.
- [ ] **(Optional) Cacheable responses for stable data**
  - For read-heavy, relatively stable endpoints (e.g. GET /api/neighborhoods), add short-lived `Cache-Control` headers (e.g. `max-age=60`) so browsers/CDN can cache and reduce latency for repeat visits.

| Area | Current behavior | Improvement |
|------|------------------|-------------|
| Posts feed API | Count then posts fetch (sequential) | Run count + posts fetch in parallel |
| Post detail API / getPostById | Post+neighborhood then llm_scores (sequential) | Fetch both in parallel |
| Search API | Scores then neighborhoods (sequential) | Fetch both in parallel |
| active_weight_config_id | 1–2 DB calls per feed/bulk request | Short-TTL in-memory cache |
| Feed frontend | No client cache, refetch on every change | React Query: cache, dedupe, optional prefetch |
| LLM scorer save_scores | One upsert per llm_score row; one RPC per category | Batch upsert; batch topic-frequency update |
| Embedder | Load all posts and all embedding post_ids | Chunked RPC or paginated query |
| Worker recompute | Cancel + progress DB call every batch | Check cancel every N batches; throttle progress writes |
| Post storage | One get/create per distinct new neighborhood | Batch resolve + batch create neighborhoods |
| Scraper scroll | 2–5s random delay | Tune range (e.g. 1–3s); make configurable |
| Embedding cache (optional) | In-memory per instance | Shared KV/Redis for cross-instance hits |
| Neighborhoods API (optional) | No caching | Cache-Control for 60s or similar |

---

## Future / backlog

- [ ] **Optional: support negative dimension weights for penalization**
  - Define how final_score is bounded (e.g. clamp after weighted sum) and document in UI.
- (Add more items here as we go.)

---

## Ranked checklist (high value, low effort first)

Order: **security/auth first**, then **must-fix (correctness)**, then **high value / low effort**, then by increasing effort or lower value. Section numbers refer to sections above.

**Security / auth (first)**

- [x] **§7 — Switch to Okta for auth:** Replace ENV-based email whitelist with Okta provider; manage allowed users in Okta (assign users/groups to the app). No env whitelist in our app. See docs/AUTH.md.

**Must-fix (correctness)**

- [x] **§3 — Clamp final_score to [0, 10]** in `calculate_final_scores` (llm_scorer) and `calculate_final_score` (worker) so feed/UI semantics are consistent.
- [x] **§3 — Add ORDER BY id** to worker's llm_scores batch query for deterministic pagination and to avoid skip/duplicate rows during recompute.

**High value, low effort**

- [x] **§13 — Cold-start novelty:** When `topic_frequencies` is empty or total scored posts \< N, use novelty multiplier 1.0 in scorer and worker instead of max boost.
- [x] **§13 — Validate weight config keys** against known SCORING_DIMENSIONS when saving (API/Settings); warn or reject unknown dimensions to avoid silent 5.0 fallbacks.
- [x] **§13 — Truncation signal in scoring prompt:** When post text is truncated, add a line (e.g. "[Text truncated at 2000 characters]") so the model and downstream logic can account for partial content.
- [x] **§14 — Parallelize posts feed API:** After `get_posts_with_scores` / `get_posts_by_date` returns, run count RPC and fetch posts by IDs in parallel (`Promise.all`). Same for getPostsByDate.
- [x] **§14 — Parallelize single post API:** In GET /api/posts/[id] and `getPostById`, fetch post+neighborhood and llm_scores in parallel with `Promise.all`.
- [x] **§14 — Parallelize search API:** After vector search, fetch llm_scores and neighborhoods in parallel with `Promise.all`.
- [x] **§14 — Worker: throttle cancel checks and progress updates:** Check cancellation every N batches (e.g. 5); throttle progress DB writes (e.g. every N batches or M seconds); still set final progress on completion.
- [x] **§13 — Reproducibility (temperature/seed):** Use temperature=0 for scoring if supported by the API, or document that 0.3 causes variance; use seed parameter if the API gains one.

**Medium effort, good value**

- [x] **§13 — Store prompt_version or prompt_hash** in llm_scores (or run metadata) to support feedback loop and A/B tests.
- [x] **§13 — Score distribution visibility:** Add simple score stats (min, max, mean, p50, p90) per dimension and for final_score (e.g. Settings or Admin).
- [x] **§14 — Cache active weight config id:** Short TTL in-memory cache (e.g. 30–60s) so repeated feed/bulk/settings requests avoid repeated lookups.
- [x] **§14 — Batch DB writes in LLM scorer:** Single batch upsert for llm_scores; batch or single RPC for topic_frequencies instead of one round-trip per category.
- [x] **§6 — Loading and error states:** Audit every UI page for loading (skeletons/spinners) and error (message + recovery); fix or add where missing.
- [x] **§14 — Feed data caching (frontend):** Use React Query (TanStack Query): cache by query key (filters + pagination), dedupe in-flight requests, optional prefetch.
- [x] **§9 — Rubric and internal chain-of-thought:** Add explicit scale text per dimension and "think step-by-step" in scoring prompts; return only valid JSON.

**Larger or product-dependent**

- [ ] **§5 — Comments in the UI:** Surface comment count and/or content (post card/detail); clarify data source (scrape time vs live) and limits.
- [ ] **§5 — Explore incorporating comments into scoring:** Comments are scraped but not used for scoring. Explore options (include top N, truncate, summarize); document tradeoffs (tokens vs accuracy).
- [ ] **§4 — Stale post data:** Identify fields that can change after scrape (e.g. comments, reactions); decide strategy (ignore, refresh, or "may have changed" in UI).
- [ ] **§13 — Few-shot examples:** Add 1–2 few-shot examples to scoring prompt; optional for token cost.
- [ ] **§13 — New dimension backfill:** Document default 5.0 for new dimensions; optional backfill job to re-score for new dimension or full re-score.
- [ ] **§14 — Embedder: chunked processing:** Use RPC like `get_posts_without_embeddings(limit N)` or paginated query; process in chunks to avoid loading full tables.
- [ ] **§14 — Post storage: batch neighborhood lookups:** Per batch, collect unique neighborhood names; batch-fetch by slug, batch-insert missing; use cache when building posts_data.
- [ ] **§14 — Scraper: Fix programmatic scroll to trigger infinite-load:** Use wheel/touch simulation, Playwright native scroll, or sentinel scroll-into-view so Nextdoor loads more posts during extraction.
- [ ] **§14 — Scraper: tune scroll delay:** Lower range (e.g. 1–3s), make configurable via env; document/monitor for rate limits/CAPTCHA.
- [ ] **§8 — Structured scoring log and feedback loop:** Persist post id, prompt hash, model output summary, final_score, used_on_episode; use for tuning prompts/weights.
- [ ] **§10 — Human calibration:** Use saved + used_on_episode as labels; optional hand-labeled set (50–200 posts) for stricter calibration.
- [x] **§7 — Replace ENV-based email whitelist:** Choose and implement one of Google Test users, Okta, or DB-backed list with admin UI (see docs/AUTH.md).
- [ ] **§1 — Runtime vs stored scores:** DB/app path to compute final_score from llm_scores + weights; feed toggle for "preview" (runtime) vs stored (after recompute).
- [ ] **§2 — Recompute job with clean cutover:** Staging table (e.g. post_scores_staging); on success, one transaction to replace post_scores for config and clear staging.
- [ ] **§12 — Ensemble scoring (3 runs, median):** Score each post 3 times; store median (or mean) per dimension then compute final_score; ~3× API cost.
- [ ] **§11 — Two-pass scoring:** Pass 1 cheap keep/drop; Pass 2 full LLM scoring on survivors.
- [ ] **§10 — Permalink queue and scraper job:** Queue for Nextdoor permalinks; job runs x/day to fetch, scrape, store and score single posts.
- [ ] **§14 — (Optional) Shared embedding cache** for search (e.g. Vercel KV/Redis) and **§14 — (Optional) Cacheable responses** (e.g. Cache-Control for GET /api/neighborhoods).
