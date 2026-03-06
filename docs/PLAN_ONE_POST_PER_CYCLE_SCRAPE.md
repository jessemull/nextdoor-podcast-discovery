# Plan: One-post-per-cycle (human-like) scraping

## Goal

Replace "extract all visible posts (e.g. 130) → process all → scroll once" with a human-like flow: **find the first post in the viewport → scroll to it → scrape that one post → scroll so the next post is in view → repeat.** This avoids stale container indices and feed reset issues. Optionally detect and restore scroll position if the page jumps back to top.

No DOM grab is required to start; use existing selectors (`div.post`, `div.js-media-post`) and `getBoundingClientRect()` for viewport detection. If viewport logic is unreliable during implementation, inspect the feed in the browser to confirm container structure and visibility.

---

## 1. Viewport-aware "first post" and scroll-to-next

**File:** [scraper/src/post_extractor.py](scraper/src/post_extractor.py)

- **Add JS helper (or inline in a new method):** Given all containers `document.querySelectorAll('div.post, div.js-media-post')`, find the **first container whose bounding rect is in the viewport** (e.g. `rect.top >= 0 && rect.top < window.innerHeight`, or allow a small negative top so we don’t skip the top card). Return that container’s **index** and, for that element only, the same fields the current extraction script returns (authorId, authorName, content, commentCount, etc.) so we have one raw post. If no container is in view, return null.
- **Add `_get_first_visible_post(self) -> tuple[int, dict] | None`** (or two returns: index and raw dict). Uses the above JS. Returns the container index and raw post dict for the first visible post, or None.
- **Add `_scroll_next_post_into_view(self, current_index: int) -> bool`:** Get containers, call `containers.nth(current_index + 1).scroll_into_view_if_needed()` (if `current_index + 1 < count`). Return True if we scrolled to a next post, False if there is no next (end of feed). This makes the “next” post the candidate for “first visible” on the next cycle.

---

## 2. Scrape one post at a time

**File:** [scraper/src/post_extractor.py](scraper/src/post_extractor.py)

- **Add `_scrape_one_post(self, container_index: int, raw: dict) -> RawPost | None`:**  
  - Scroll that container into view (so it’s stable).  
  - Build `RawPost`: get permalink via `_normalize_post_url(raw.get("postUrl"))` and if missing `extract_permalink(container_index)`; get comments (if `raw.get("commentCount") == 0` then `[]`, else `_extract_comments_via_desktop_modal(container_index)` and optional details-page fallback).  
  - Return `RawPost` or None (e.g. invalid or duplicate by content_hash). Reuse existing helpers; do not re-run full-page extraction for this one post (we already have `raw` from the viewport query).

- **Optional scroll-position safeguard:** After each cycle (or after `_scroll_next_post_into_view`), read `window.scrollY` (e.g. `page.evaluate("() => window.scrollY")`). If we detect an unexpected jump to top (e.g. `scrollY < 100` when we had previously scrolled down), restore the last known good scroll position (e.g. `window.scrollTo(0, lastGoodScrollY)`) and optionally wait a moment. Maintain `_last_known_scroll_y` (or similar) and update it after each successful “scroll to next post.”

---

## 3. New batch loop: one-post-per-cycle

**File:** [scraper/src/post_extractor.py](scraper/src/post_extractor.py)

- **Add a new method** (e.g. `extract_post_batches_one_by_one`) or **refactor `extract_post_batches`** to use the following loop instead of “evaluate full page → _process_batch(all) → scroll”:

  - **Loop** until we hit safety_cap, max scroll/attempts, or stop condition:
    1. **First visible:** `result = _get_first_visible_post()`. If None (no post in view), try scrolling down once and retry; if still None, break or treat as end of feed.
    2. **Dedupe:** If `result`’s content_hash (from raw) is in `seen_hashes`, we’re seeing the same post again (e.g. feed didn’t advance). Call `_scroll_next_post_into_view(current_index)` and optionally increment a “stuck” counter. If we’re stuck too many times (e.g. 5–10), treat as repeat threshold and exit.
    3. **Scrape one:** `post = _scrape_one_post(container_index, raw)`. If post is None (invalid), skip and scroll to next; if post.content_hash in seen_hashes, skip and scroll to next.
    4. **Append:** Add post to batch, add post.content_hash to seen_hashes.
    5. **Scroll to next:** Call `_scroll_next_post_into_view(container_index)`. Optionally run scroll-position check/restore here.
    6. **Yield:** If batch size is non-zero and we want to yield (e.g. every N posts or every cycle with new posts), yield the batch and clear the batch list (so main pipeline still gets incremental batches).

- **Stop conditions to preserve:**
  - Total yielded ≥ safety_cap.
  - Max scroll/attempts (reuse existing caps).
  - Recent feed: “stuck” — same first-visible post or same hash seen repeatedly after several scroll attempts (replace current “consecutive already-seen at start of batch” with this).
  - No post in view after retries.

---

## 4. Wire the new flow into the pipeline

**File:** [scraper/src/main.py](scraper/src/main.py) and [scraper/src/scraper.py](scraper/src/scraper.py)

- The pipeline currently calls `scraper.extract_post_batches(...)` and iterates over batches. Switch to the new one-post-per-cycle extractor (e.g. call `extract_post_batches_one_by_one` or the refactored `extract_post_batches`) so that the rest of the pipeline (storage, scoring, etc.) is unchanged. It still receives lists of `RawPost` per yield; the list may often have one element.

---

## 5. Logging and tests

- **Logging:** Improve the “Container index X out of range” message in `extract_permalink` to: e.g. “Permalink extraction skipped: container index %d out of range (page has %d post containers).” Include actual container count so it’s debuggable.
- **Tests:** Add or adjust tests for the new flow: mock `_get_first_visible_post` and `_scroll_next_post_into_view`, and assert that we call scrape once per post and that we stop when the first visible is already in seen_hashes (stuck). Existing tests that rely on `extract_post_batches` may need to use the new method or a test-only path.

---

## 6. Summary

| Change | Location | Purpose |
|--------|----------|--------|
| Viewport “first post” (index + raw) | New JS + `_get_first_visible_post` in post_extractor.py | Always target the one post we’re about to scrape; no stale indices. |
| Scroll to next post | `_scroll_next_post_into_view(index)` in post_extractor.py | Advance the feed by one post like a user; next cycle gets next post. |
| Scrape one post | `_scrape_one_post(index, raw)` in post_extractor.py | Single post: permalink + comments, reuse existing helpers. |
| One-post-per-cycle loop | Refactor or new `extract_post_batches_*` in post_extractor.py | Replace “extract all → process all → scroll” with find → scrape one → scroll next → repeat. |
| Scroll restore (optional) | Inside loop in post_extractor.py | If scrollY resets unexpectedly, restore last known position. |
| Clearer “out of range” log | `extract_permalink` in post_extractor.py | Log container count so “out of range” is interpretable. |
| Pipeline wiring | main.py / scraper.py | Use new batch method so storage/scoring unchanged. |

---

## DOM inspection (only if needed)

- No DOM dump is required to implement the plan. If “first visible” is ambiguous (e.g. several cards in view, or different structure on mobile/desktop), open the Nextdoor feed, run a small `page.evaluate` that logs `document.querySelectorAll('div.post, div.js-media-post').length` and the first element’s `getBoundingClientRect()`, and confirm the selector and viewport logic.
