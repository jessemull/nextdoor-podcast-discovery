# Improvements, gaps, and features before go-live

Capture items we need before launch. Add new entries under the appropriate section; mark done when complete.

---

## Scraping

### 1. When to stop scraping (Recent vs Trending)

**Recent feed:** Order is stable and chronological. We can stop when:

- We have processed a target number of items (e.g. `max_posts`), OR
- We see posts we’ve already processed (duplicates).

**Proposed strategy for Recent:** Add a “repeat threshold”: e.g. if the **next N posts in a row** (e.g. 10) are all ones we’ve already seen, then stop. If we keep getting new posts, keep going up to `max_posts`. So: scroll and extract; count consecutive already-seen posts; when that count reaches the threshold (e.g. 10), stop. Otherwise stop when we’ve collected `max_posts` new posts.

**Trending feed:** Order changes over time (not stable). We need a **different strategy** for when to stop on trending — e.g. time-based, or a fixed number of scrolls, or a repeat threshold with different parameters. To be defined (figure out what works without wasting scrolls or missing too much).

**Tasks:** Implement repeat-threshold stop for Recent; document and implement a separate stop strategy for Trending.

---

## App features

### 2. “Ignore post” (soft delete / attribution)

**Goal:** For initial go-live we need an **“Ignore post”** action in addition to (or instead of) “Mark as used.” Once Matt sees a post once, he can mark it ignored so it doesn’t keep surfacing; he can still review ignored posts and unmark if needed.

**Requirements:**

- **Ignore** = soft delete or an attribution flag (e.g. `ignored` boolean or `ignored_at` timestamp on `posts`, or a separate table). Post stays in DB but is filtered out of the default feed (or shown in a separate “Ignored” view).
- **View ignored posts:** A way to see the list of ignored posts (e.g. filter or dedicated view).
- **Unmark ignore:** Ability to remove the “ignored” state (single post and **bulk actions**).
- **Bulk actions:** Support “Ignore” and “Unignore” in the same bulk UI we use for other actions.

**Tasks:** Schema (column or table), API (e.g. PATCH to set/clear ignored), feed filter to exclude (or include-only-ignored) by default, UI for ignore/unignore and for viewing ignored list; bulk ignore/unignore.

---

## More items (add below)

*(Add new improvements, gaps, or features here. Use the same format: short title, then goal/requirements and tasks.)*
