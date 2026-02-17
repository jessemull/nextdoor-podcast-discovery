# Three improvements: explanation and plan

This doc explains **§13 New dimension backfill**, **§14 Embedder chunked processing**, and **§14 Post storage batch neighborhood lookups**—how they work today, why they’re improvements, and how to implement them together.

---

## New dimension backfill (reference)

**Default 5.0:** When a new key is added to `SCORING_DIMENSIONS` and the prompt, existing `llm_scores` rows do not have that key. The scorer and worker use `scores.get(dim, 5.0)` — missing dimension defaults to **5.0** (neutral) until the post is re-scored.

**Backfill procedure:** To backfill a new dimension, run a full re-score: trigger a recompute job from Settings ("Save & Recompute Scores"), or re-run the scorer over all posts. No dedicated backfill job required. See `scores.get(dim, 5.0)` call sites in `worker.py` and `llm_scorer.py`.

---

## 1. §13 — New dimension backfill

### What it is

When you add a **new scoring dimension** (e.g. a new key in `SCORING_DIMENSIONS` and in the LLM prompt), only **newly scored** posts get that dimension in `llm_scores.scores` (JSONB). Existing rows were produced by an older prompt and don’t have that key.

### How it works today

- **Scorer / worker:** When computing a weighted score they use `scores.get(dim, 5.0)`. So if a dimension is missing, they treat it as **5.0** (neutral). No error; old posts just contribute a neutral value for the new dimension.
- **Result:** Existing posts effectively have “neutral” for the new dimension until they are re-scored. Rankings and tuning are still consistent, but the new dimension doesn’t reflect real LLM output for old data.

### Why improve

1. **Document** that missing dimensions default to 5.0 so future changes (and backfill) are predictable.
2. **Optional backfill:** Either re-score only for the new dimension (if we support partial updates) or run a full re-score job so all posts have real values for the new dimension. That gives consistent rankings and better tuning.

### Improvement in practice

- **Document:** In code and/or `docs/` state: “New dimensions default to 5.0 for existing posts until re-scored.”
- **Optional backfill:** A job or script that, when a new dimension is introduced, either:
  - Runs full re-score for all posts (reuse existing recompute/score pipeline), or
  - In the future, supports “re-score only this dimension” (would require prompt/API that returns a single dimension and an update path for `llm_scores.scores`).

---

## 2. §14 — Embedder: chunked processing

### What it is

The embedder generates OpenAI embeddings for posts that don’t have one yet and stores them in `post_embeddings`. Today it decides “which posts need embeddings?” by loading **all** posts and **all** existing embedding post_ids into memory.

### How it works today

In `generate_and_store_embeddings()` (scraper):

1. **Load all posts:** `posts` table, `select id, text` where `text` is not null → entire result set in memory.
2. **Load all embeddings:** `post_embeddings` table, `select post_id` → entire set in memory.
3. **Filter in Python:** Keep posts whose `id` is not in the embedding set and whose text is non-empty.
4. **Process in batches:** For each batch of size `EMBEDDING_BATCH_SIZE`, call OpenAI and upsert into `post_embeddings`.

So memory use scales with **total posts + total post_embeddings**, not with batch size. With tens or hundreds of thousands of posts this can cause high memory usage or OOM in constrained environments (e.g. GitHub Actions, small VMs).

### Why improve

- **Bounded memory:** Only ever load a small window of “posts without embeddings” (e.g. 500–1000 at a time). Memory stays roughly constant as the table grows.
- **Same behavior:** Still process in API-sized batches; only the **selection** of posts becomes chunked (DB-side), not the OpenAI batch size.

### Improvement in practice

- Add a **DB-side way** to get “posts that don’t have an embedding yet” in chunks:
  - Option A: **RPC** e.g. `get_posts_without_embeddings(limit N)` that returns up to N `(id, text)` rows (e.g. ordered by `id` or `created_at`) with no corresponding `post_embeddings` row.
  - Option B: **Paginated query** in Python: e.g. `posts` ordered by `id`, then `LEFT JOIN post_embeddings` and `WHERE post_embeddings.post_id IS NULL`, with `LIMIT N OFFSET M` (or keyset pagination for stability).
- **Embedder:** Loop: fetch one chunk via RPC or query → process that chunk in existing batch logic (OpenAI + upsert) → repeat until a chunk returns no rows (or fewer than N). No full-table load of `posts` or `post_embeddings`.

---

## 3. §14 — Post storage: batch neighborhood lookups

### What it is

When storing scraped posts, each post has a neighborhood **name**. We need a **neighborhood UUID** for `posts.neighborhood_id`. Today we resolve “name → id” and create missing neighborhoods **one at a time** while building the list of post rows.

### How it works today

In `post_storage.store_posts()` (and in `store_post_or_update()` for a single post):

- For **each** post we call `_get_or_create_neighborhood(post.neighborhood)`.
- That method: check in-memory cache → if miss, **select** from `neighborhoods` by slug → if not found, **insert** one row and return id (with a race-condition retry). So for a batch of 50 posts with 20 distinct neighborhood names we do **up to 20 selects** and **up to 20 inserts**, one per distinct neighborhood, but each is its own round-trip and we interleave them with building `posts_data`.

We do have a **cache** so repeated names in the same run don’t repeat the DB work, but the first occurrence of each name still causes a separate select (and possibly insert). So DB round-trips scale with **number of distinct new neighborhoods per batch**, not with batch size in a single call.

### Why improve

- **Fewer round-trips:** For a batch, collect **all unique neighborhood names** once, then:
  - One **batch select** by slug (e.g. `slug IN (...)`).
  - One **batch insert** for slugs that don’t exist (or minimal inserts if the DB doesn’t support multi-insert returning).
- **Same cache:** Keep an in-memory map (name/slug → id) for the run so building `posts_data` is a simple lookup. No per-post DB call.
- **Result:** Constant (small) number of DB calls per batch instead of one or two per distinct neighborhood.

### Improvement in practice

- **Phase 1 – collect:** From the list of posts to store, build the set of unique neighborhood names (or slugs).
- **Phase 2 – resolve:** Batch-fetch existing neighborhoods by slug (e.g. `select id, slug from neighborhoods where slug in (...)`). For any slug not in the result, insert new neighborhood rows (batch or one-by-one), then add them to the id-by-slug map (and optionally refill cache from the batch result).
- **Phase 3 – build:** Build `posts_data` by looking up `neighborhood_id` from the map (and slug from name) for each post; then run the existing batch upsert for `posts`.

No change to the public API of `store_posts()` or to the shape of `posts`; only the internal resolution of neighborhood id becomes batched.

---

## Implementation plan (all three together)

### Order and dependencies

1. **§14 Post storage: batch neighborhood lookups** – Pure scraper refactor; no DB schema change. Good first step.
2. **§14 Embedder: chunked processing** – Requires one new DB helper (RPC or documented query); then embedder refactor. Independent of the other two.
3. **§13 New dimension backfill** – Documentation + optional backfill path. Can be done after or in parallel; backfill can reuse existing “full re-score” pipeline.

### Step 1: §14 Batch neighborhood lookups (scraper)

- **In `post_storage.py`:**
  - Add a helper that, given a list of neighborhood **names**, returns a dict `name -> neighborhood_id`:
    - Compute unique names (and name → slug).
    - Batch select `neighborhoods` by slug (`in("slug", slugs)`).
    - For missing slugs: insert new rows (batch or loop), then add to result.
    - Use and update `_neighborhood_cache` so later calls in the same run stay fast.
  - In `store_posts()`: first collect unique names from `posts`; call the new helper once; then build `posts_data` using the returned map (and existing logic for the rest of the row).
  - In `store_post_or_update()` for single post: keep using `_get_or_create_neighborhood` (or call the helper with a one-element list) so behavior is unchanged.
- **Tests:** Extend existing post_storage tests to assert batch select/insert behavior (e.g. multiple distinct neighborhoods in one `store_posts` call cause at most one select and one batch of inserts).

### Step 2: §14 Embedder chunked processing (DB + scraper)

- **DB:**
  - Add an RPC, e.g. `get_posts_without_embeddings(lim integer)`:
    - Returns up to `lim` rows from `posts` (e.g. `id, text`) that have non-null/non-empty `text` and **no** row in `post_embeddings` for that `post_id`.
    - Order by `id` (or `created_at`) for stable pagination. Optionally add a second parameter (e.g. `after_id`) for keyset pagination so we don’t skip rows under concurrent inserts.
  - Migration file: e.g. `034_get_posts_without_embeddings.sql`.
- **Embedder:**
  - Replace the “load all posts” + “load all post_embeddings” + Python filter with a loop:
    - Call `get_posts_without_embeddings(N)` (or run the equivalent query with limit/offset or keyset).
    - If no rows, exit.
    - Process that chunk with existing batch logic (OpenAI + upsert).
    - If using offset, next iteration; if using keyset, pass `after_id = last id` for next call.
  - Keep `EMBEDDING_BATCH_SIZE` for API/upsert batch size; use a separate chunk size (e.g. 500 or 1000) for how many posts we fetch per DB call.
- **Tests:** Adjust embedder tests so they don’t rely on “load full table”; mock the RPC or query to return controlled chunks.

### Step 3: §13 New dimension backfill (docs + optional job)

- **Document:**
  - In `docs/` (e.g. in this file or in a “Scoring” doc): state that when a new dimension is added to `SCORING_DIMENSIONS` and the prompt, existing `llm_scores` rows do not have that key and are treated as 5.0 until re-scored.
  - In code: short comment at the call sites of `scores.get(dim, 5.0)` (and in worker/scorer) pointing to that doc.
- **Optional backfill:**
  - **Option A – full re-score:** Document that “to backfill a new dimension, run a full re-score” (e.g. trigger a recompute job or re-run the scorer over all posts). No new job type required; just document the procedure.
  - **Option B – dedicated backfill job (later):** If we want a “backfill only missing dimension X” job, that would require: a prompt that returns only that dimension, and an update path that merges into existing `llm_scores.scores` JSONB. Can be a follow-up.

Recommended for this pass: **Document default 5.0 + document “full re-score = backfill”** (Option A). Option B can be a later improvement.

---

## Summary

| Item | Current behavior | Change |
|------|------------------|--------|
| **§13 New dimension** | Missing dimension = 5.0; undocumented. | Document 5.0; document that full re-score backfills new dimension. |
| **§14 Embedder** | Loads all posts and all post_embeddings into memory. | RPC (or query) for “posts without embeddings” in chunks; loop until done. |
| **§14 Post storage** | One DB round-trip per distinct neighborhood per batch. | Collect unique names → batch select by slug → batch insert missing → one map for building posts_data. |

Implementing in the order above keeps each step self-contained and testable, with the embedder’s DB migration as the only schema change.
