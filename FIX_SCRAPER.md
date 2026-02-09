# Scraper fixes and gaps

Documented issues and desired improvements. Verify by inspecting posts in Supabase after changes.

---

## Data gaps (currently wrong or missing)

### 1. `posts.url` is always NULL — DONE

- **Observed:** URL column is NULL for all rows in Supabase.
- **Cause:** `post_url` was only set when permalink extraction ran (clicking Share on each post), gated by `--extract-permalinks`.
- **Fix:** Removed the `--extract-permalinks` flag. Permalink extraction is now always on: we always click Share on each post and persist the URL in `posts.url`.

### 2. `posts.posted_at` is always NULL — DONE

- **Observed:** `posted_at` was NULL for all rows.
- **Cause:** Extractor can get `timestamp_relative` (e.g. “2h”, “Yesterday”) but we never parse it into an absolute timestamp or pass it to storage. `post_storage` does not include `posted_at` in the upsert payload.
- **Fix:** Added `parse_relative_timestamp()` in `post_storage.py`; upsert now includes `posted_at` (parsed from e.g. "2h", "Yesterday" or None).

### 3. `posts.episode_date` and “mark as used” — remove entirely

- **Decision:** Remove the `episode_date` field and all related functionality (see [Remove episode_date and related functionality](#remove-episode_date-and-related-functionality) below). No scraper change for this field; it is app/schema work.

---

## Scraper flags and data omission

Current CLI flags for `python -m src.main`:

| Flag | Purpose | Omits data? |
|------|---------|-------------|
| `--check-robots` | Fetch robots.txt and exit if paths disallowed | No |
| `--dry-run` | No DB writes | No (extraction is unchanged; we just don’t store) |
| `--embed` | Run embedding generation after scrape/score | No |
| `--feed-type` | Which feed (recent / trending) | No |
| `--inspect` | Open browser (iPhone mobile), go to feed, then pause for DOM inspection (e.g. Filter by menu) | No |
| `--max-posts` | Cap number of posts to scrape | No |
| `--score` | Run LLM scoring after scraping | No |
| `--unscored-limit` | Max unscored posts to score per run | No |
| `--visible` | Run browser visible (not headless) | No |

**Summary:** Permalinks are always extracted (no flag). `posted_at` is set when we can parse `timestamp_relative`.

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

## Feed selection (mobile) — DONE

- **Issue:** Scraper was written for desktop. On mobile, the feed is chosen via a “Filter by” control (select-like button at top); opening it shows a bottom sheet with: For you, Recent, Nearby, Trending. We were not opening this or selecting the right option, so the feed stayed on “For you.”
- **Fix:** After loading the feed URL, open the Filter by control (click the button that looks like a select at the top), then click “Recent” or “Trending” in the bottom sheet so the correct feed is active. Prefer “Recent” as the stable option if only one is reliable.
- **Status:** Done. Scraper clicks navbar `[role="button"][aria-controls]`, waits for "Filter by" dialog, then clicks "Recent" or "Trending" per `--feed-type`.

---

## Selectors and DOM (what we know from DOM.html)

**From DOM.html we have:**

- **Feed config (script data):** `feedOrderings` with `title` / `orderingMode`: “Top posts” (top), “Recent activity” (recent_activity), “Recent posts” (recent_posts). So mobile may use different labels than desktop; “Recent” in the UI may map to `recent_posts` or `recent_activity`; “Trending” / “For you” may map to `top`. URL still supports `?ordering=recent` and `?ordering=trending`.
- **Stable testids:** `data-testid="feed-container"`, `data-testid="navbar"`, `data-testid="prompt-container"` (the “What’s happening…” box). Posts live under `feed-container` with classes like `ph8kpd*`, `_1aopgh40`; content in spans with `Text_body__*`; images with class `resized-image`. The current extractor uses `div.post`, `div.js-media-post` and `[data-testid="post-timestamp"]`, `[data-testid="styled-text"]`, `[data-testid="resized-image"]` — on mobile, `resized-image` appears as a **class**, not always as data-testid; post wrappers may be different.

**What we don’t have from DOM.html:**

- The **Filter by** button and the **open bottom sheet** (modal) are not visible in the snapshot (sheet was likely closed). The **open sheet** options are now in MENU.html (see [Filter by menu (MENU.html)](#filter-by-menu-menuhtml)). The **button that opens** the sheet (feed header trigger) is still unknown — use text/role to find it.

**Inspecting the live DOM:** Run with `--inspect` to open the browser in iPhone mobile view, load the feed, then pause. You can open DevTools (F12 or right-click → Inspect), click the Filter by menu to open the sheet, and inspect the DOM for menu selectors. Press Enter in the terminal when done to close the browser.

**Enough to start:**

1. **Feed selection:** After `goto(feed_url)`, wait for the feed, then click the control that opens the sheet (e.g. `page.getByRole('button', { name: /Filter by|For you|Recent/ }).first.click()`). When the sheet is visible, wait for `page.getByRole('dialog', { name: 'Filter by' })`, then click `page.getByRole('button', { name: 'Recent' })` or `page.getByRole('button', { name: 'Trending' })` per `--feed-type`. See [Filter by menu (MENU.html)](#filter-by-menu-menuhtml) for structure and selectors.
2. **Post extraction:** Run a small scrape (e.g. `--max-posts 5 --visible`) and confirm posts are found. If the current selectors (`div.post`, `js-media-post`, or the JS that uses `post-timestamp` / `styled-text`) don’t match mobile, update the extractor to use the mobile structure (e.g. `[data-testid="feed-container"]` descendants, `.resized-image`, and the actual content/timestamp elements you see in DOM.html or in a live run).
3. **Permalinks and posted_at:** No new selectors needed from DOM for “always extract permalink” (already implemented behind the flag) or for parsing relative timestamps (logic in code; timestamp_relative comes from existing extraction).

**Summary:** We can start with (1) feed selection via `getByText` / `getByRole` and (2) always-on permalinks + (3) posted_at parsing. If feed selection is flaky, capture DOM with the Filter sheet open to get precise selectors. Post extraction may need selector tweaks after one visible run.

---

## Filter by menu (MENU.html)

Captured DOM for the **open** Filter by bottom sheet (see `MENU.html` in repo root). Use for feed-selection implementation.

**Sheet container:**

- `<section aria-label="Filter by" role="dialog" data-variant="bottomsheet" data-part="dialog">` — wait for sheet with e.g. `page.getByRole('dialog', { name: 'Filter by' })` or `page.locator('section[aria-label="Filter by"][role="dialog"]')`.
- Header text: "Filter by" in a div with class `Text_sectionTitle__*`.

**Options (order in DOM):** Each option is a `div` with `role="button"` and `data-block="31"`; the label is in a child `<span class="Text_detail__*">`. Options:

| Label   | Notes                                |
|---------|--------------------------------------|
| For you | First option; has check SVG when selected |
| Recent  |                                      |
| Nearby  |                                      |
| Trending|                                      |

**Recommended Playwright selectors (once sheet is open):**

- Wait for sheet: `page.getByRole('dialog', { name: 'Filter by' })` or `page.locator('section[aria-label="Filter by"]').waitFor({ state: 'visible' })`.
- Click option: `page.getByRole('button', { name: 'Recent' })` or `page.getByRole('button', { name: 'Trending' })`. Accessible name comes from the inner span text.

**Opening the sheet:** Implemented. Use `page.get_by_test_id("navbar").locator('[role="button"][aria-controls]').first.click()` — the trigger shows the neighborhood name (e.g. "Arbor Lodge") and has `aria-controls` pointing to the dialog id.

---

## New feature: scrape comments

- **Goal:** Scrape the actual comments on each post (or a subset), not just the post body.
- **Status:** To be implemented; try if possible. May require expanding the DOM extraction (comment selectors, pagination/“load more”) and schema (e.g. a `post_comments` table or a JSONB column on `posts`). Verify by checking Supabase after implementation.

---

## Verification

- After fixes: inspect posts in Supabase (e.g. `url`, `posted_at`) and confirm values are populated as expected.
- Comments: confirm comment data appears where intended (table or column) and looks correct.
- After episode_date removal: no episode/used UI or API; feed and post detail work without those fields.
