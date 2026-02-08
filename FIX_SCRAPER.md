# Scraper fixes and gaps

Documented issues and desired improvements. Verify by inspecting posts in Supabase after changes.

---

## Data gaps (currently wrong or missing)

### 1. `posts.url` is always NULL

- **Observed:** URL column is NULL for all rows in Supabase.
- **Cause:** `post_url` is only set when we run with permalink extraction (clicking Share on each post). Default extraction does not get the post URL; storage maps `post.post_url` → `posts.url`, so it stays NULL unless permalinks are extracted.
- **Fix:** Either always extract permalinks (slower) or derive a stable URL from post id / feed context (e.g. `https://nextdoor.com/p/<post_id_ext>`) if that matches Nextdoor’s URL pattern, and persist it in `posts.url`.

### 2. `posts.posted_at` is always NULL

- **Observed:** `posted_at` is NULL for all rows.
- **Cause:** Extractor can get `timestamp_relative` (e.g. “2h”, “Yesterday”) but we never parse it into an absolute timestamp or pass it to storage. `post_storage` does not include `posted_at` in the upsert payload.
- **Fix:** Parse relative timestamps (and any absolute date we can find in the DOM) into a `posted_at` TIMESTAMPTZ and add it to the posts upsert in `post_storage.py`.

### 3. `posts.episode_date` is always NULL

- **Observed:** `episode_date` is NULL for all rows.
- **Note:** This column is intended for “date of the episode where this post was used,” i.e. set by the app when a post is chosen for a podcast episode, not by the scraper. If the product expectation is that scraper should never set it, no scraper change needed; document that here. If we want a different meaning (e.g. “date we first saw this post”), that would be a schema/design change.

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

- After fixes: inspect posts in Supabase (e.g. `url`, `posted_at`, `episode_date`) and confirm values are populated as expected.
- Comments: confirm comment data appears where intended (table or column) and looks correct.
