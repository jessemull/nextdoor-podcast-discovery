# Improvements, gaps, and features before go-live

Capture items we need before launch. Add new entries under the appropriate section; mark done when complete.

---

## Scraping

### 1. When to stop scraping (Recent vs Trending)

**Implemented behavior:**

| Feed       | When we stop                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recent** | (1) We have **max_posts** new posts, OR (2) **MAX_SCROLL_ATTEMPTS** (100) scrolls, OR (3) **repeat_threshold** consecutive already-seen posts from the start of a batch (config: `repeat_threshold_recent`, default 10; CLI: `--repeat-threshold`), OR (4) **MAX_EMPTY_SCROLLS** (5) scrolls in a row with 0 new posts. |
| **Trending** | (1) We have **max_posts** new posts, OR (2) **max_scroll_attempts_trending** (50) scrolls, OR (3) **MAX_EMPTY_SCROLLS** (5) scrolls in a row with 0 new posts. No repeat-threshold (order is not stable). |

**Recent:** Order is stable (newest first). Before processing each batch we count how many consecutive posts from the start are already in `seen_hashes`; if that count ≥ `repeat_threshold_recent`, we stop. Safety caps (max_posts, scroll cap, empty-scroll cap) remain so we never run forever.

**Trending:** Order is not stable, so “N consecutive duplicates” does not mean “we’ve seen everything.” We rely only on max_posts, a lower scroll cap (50), and MAX_EMPTY_SCROLLS.

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

### 3. Edit weight config name after creation

**Context:** Config names can be set when saving a new config (optional “Config name” field in the Save & Recompute form). If left blank, the backend uses `Config <ISO timestamp>` (e.g. “Config 2026-02-09T03:44:04.982Z”). Once a config is created, there is no way to change its name or description — the list only shows Activate and Delete.

**Task:** Allow editing the config name (and optionally description) after creation.

- **API:** Add `PATCH /api/admin/weight-configs/:id` accepting `{ name?: string, description?: string }` and updating the `weight_configs` row.
- **UI:** In the Weight Configurations list (Settings), add a way to rename/edit (e.g. “Rename” or “Edit” that turns the name into an input, or an edit icon with inline field/modal). Wire it to the PATCH endpoint and refresh the list on success.

---

## More items (add below)

*(Add new improvements, gaps, or features here. Use the same format: short title, then goal/requirements and tasks.)*
