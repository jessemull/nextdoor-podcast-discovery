# Scraper fixes and gaps

Documented issues and desired improvements. Verify by inspecting posts in Supabase after changes.

---

## Data gaps (currently wrong or missing)

### 1. `posts.url` is always NULL

- **Observed:** URL column is NULL for all rows in Supabase.
- **Cause:** `post_url` is only set when permalink extraction runs (clicking Share on each post). Currently this is gated by the `--extract-permalinks` flag; when the flag is not passed, extraction is skipped and storage maps `post.post_url` → `posts.url`, so it stays NULL.
- **Fix:** We always want permalinks. Remove the `--extract-permalinks` flag and make permalink extraction the default (and only) behavior: always click Share on each post to get the permalink and persist it in `posts.url`. Remove the parameter from `main()`, `extract_posts()`, and `PostExtractor`; always extract permalinks.

### 2. `posts.posted_at` is always NULL

- **Observed:** `posted_at` is NULL for all rows.
- **Cause:** Extractor can get `timestamp_relative` (e.g. “2h”, “Yesterday”) but we never parse it into an absolute timestamp or pass it to storage. `post_storage` does not include `posted_at` in the upsert payload.
- **Fix:** Parse relative timestamps (and any absolute date we can find in the DOM) into a `posted_at` TIMESTAMPTZ and add it to the posts upsert in `post_storage.py`.

### 3. `posts.episode_date` and “mark as used” — remove entirely

- **Decision:** Remove the `episode_date` field and all related functionality (see [Remove episode_date and related functionality](#remove-episode_date-and-related-functionality) below). No scraper change for this field; it is app/schema work.

---

## Scraper flags and data omission

Current CLI flags for `python -m src.main`:

| Flag | Purpose | Omits data? |
|------|---------|-------------|
| `--extract-permalinks` | Click Share on each post to get permalink URL | **Yes when not used** — `posts.url` stays NULL. We want permalinks always; remove this flag and always extract. |
| `--check-robots` | Fetch robots.txt and exit if paths disallowed | No |
| `--dry-run` | No DB writes | No (extraction is unchanged; we just don’t store) |
| `--embed` | Run embedding generation after scrape/score | No |
| `--feed-type` | Which feed (recent / trending) | No |
| `--max-posts` | Cap number of posts to scrape | No |
| `--score` | Run LLM scoring after scraping | No |
| `--unscored-limit` | Max unscored posts to score per run | No |
| `--visible` | Run browser visible (not headless) | No |

**Summary:** The only flag that causes us to omit stored data is `--extract-permalinks` when it is *not* passed. Remove the flag and always extract permalinks.

---

## Remove episode_date and related functionality

**Goal:** Remove the `episode_date` field and all “mark as used” / “episodes” functionality from the app and database.

**In scope:**

- **Database:** Remove or stop using on `posts`: `episode_date`, `used_on_episode`. Update or remove any RPCs, indexes, and migrations that reference these columns (e.g. `get_posts_with_scores`, `get_posts_by_date`, filters that use `p_episode_date`, `p_unused_only`). Consider a migration that drops the columns (or marks them deprecated) and updates RPCs.
- **Web API:** Remove or repurpose: `PATCH /api/posts/[id]/used`, `GET /api/episodes`. Remove `episode_date` and `used_on_episode` from post response types and any routes that pass them through.
- **Web UI:** Remove “Mark as used in an episode” (single post and bulk), episode date picker, “Episode” filter in the feed, any “Used on episode” badges or copy, and any UI that reads/writes `episode_date` or `used_on_episode`.
- **Scraper:** No change (scraper does not set these fields). Document in FIX_SCRAPER or GO_LIVE that this was removed.

**Verification:** After removal, feed and post detail work without episode/used; no references to episode_date or used_on_episode in the codebase (except migration history if kept for audit).

---

## Feed selection (mobile)

- **Issue:** Scraper was written for desktop. On mobile, the feed is chosen via a “Filter by” control (select-like button at top); opening it shows a bottom sheet with: For you, Recent, Nearby, Trending. We were not opening this or selecting the right option, so the feed stayed on “For you.”
- **Fix:** After loading the feed URL, open the Filter by control (click the button that looks like a select at the top), then click “Recent” or “Trending” in the bottom sheet so the correct feed is active. Prefer “Recent” as the stable option if only one is reliable.

---

## New feature: scrape comments

- **Goal:** Scrape the actual comments on each post (or a subset), not just the post body.
- **Status:** To be implemented; try if possible. May require expanding the DOM extraction (comment selectors, pagination/“load more”) and schema (e.g. a `post_comments` table or a JSONB column on `posts`). Verify by checking Supabase after implementation.

---

## Verification

- After fixes: inspect posts in Supabase (e.g. `url`, `posted_at`) and confirm values are populated as expected.
- Comments: confirm comment data appears where intended (table or column) and looks correct.
- After episode_date removal: no episode/used UI or API; feed and post detail work without those fields.
