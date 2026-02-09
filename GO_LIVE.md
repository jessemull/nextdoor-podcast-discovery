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

### 3. Name weight configs and quick toggle (Settings + Search)

**Goal:** When saving a new weight tuning, users need to know which config is which after a recompute (e.g. “Comedy Centric” vs “Drama Heavy”). They also want to swap configs often and validate how results look under each one without leaving the page.

**Current state:** The app already has:
- `weight_configs.name` and optional “Config name” when saving (Settings). If left blank, the list shows “Config &lt;id&gt;” which is hard to recognize.
- Activate in Settings to switch the global active config (feed and search use that).

**Requirements:**

- **Naming when saving:** Make the config name **prominent and encouraged (or required)** when saving weights and triggering a recompute. Examples: “Comedy Centric”, “Drama Heavy”, “Balanced”. So after the job completes, the list clearly shows which config is which and users can choose the right one to activate.
- **Quick swap:** Keep the existing “Activate” flow in Settings for changing the global default. Optionally add a clearer “active config” selector at the top of Settings so swapping is one click.
- **Toggle on Search (and optionally Feed):** On the **search page** (and optionally the main feed), add a **dropdown or tabs** to “View results as: [Comedy Centric ▼]” that lets the user **preview** results using a different weight config **without** changing the global active config. So they can validate “how does search look under Comedy Centric vs Drama Heavy?” without going to Settings and activating each time. Implementation: posts/search API accepts an optional `weight_config_id` (or `preview_config_id`) for that request; when present, use that config’s scores for ranking for that request only; the global active config stays unchanged.

**Tasks:** (1) Make config name prominent/required in the Save & Recompute form (Settings). (2) Optional: improve “active config” selector in Settings for one-click swap. (3) Add “View as” / config selector on Search page (and optionally Feed) that passes a preview config id to the API; backend supports optional override for that request.

---

## More items (add below)

*(Add new improvements, gaps, or features here. Use the same format: short title, then goal/requirements and tasks.)*
