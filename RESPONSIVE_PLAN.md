# Responsive implementation plan

**Goal:** Make the Next.js app responsive so it works well on small viewports (e.g. 320px). We did not build mobile-first; this checklist tracks fixes.

**Approach:** Tackle **Navbar** first (so every page benefits), then **one page at a time**: Home → Feed → Post detail → Settings → Jobs → Stats → Search. **Feed toolbar + bulk** and **Filter sidebar (drawer)** are separate refactor tasks that affect the Feed page.

**Order of work:** Navbar → Home → Feed → Post detail → Settings → Jobs → Stats → Search. Optionally do "Feed toolbar and bulk" and "Filter sidebar drawer UX" as part of Feed or right after.

---

## 1. Navbar (separate task)

- [x] Add hamburger button (visible below `md`, hide nav links on small screens).
- [x] Add mobile menu (drawer or slide-down) with links: Home, Feed, Jobs, Stats, Settings, and user menu (avatar + Sign out).
- [x] Ensure focus trap and aria (e.g. `aria-expanded`, `aria-label` for "Open/Close menu").
- [x] Hide hamburger and show horizontal nav at `md`; match current desktop layout.

**Files:** `web/components/Navbar.tsx`

---

## 2. Feed page

- [x] **Toolbar:** Make top row (search + filter + sort + bulk/reset) responsive: wrap or stack on small screens; flexible widths for selects.
- [x] **Bulk mode:** When bulk mode is on, ensure bulk action select + Cancel don't overflow; consider second row or sticky bar on mobile.
- [x] **Filter drawer:** Confirm drawer closes on outside tap; FilterSidebar content scrolls; no horizontal overflow; touch targets adequate.
- [x] **Feed title and "Showing X of Y":** No overflow on narrow screens.
- [x] **PostCard in feed:** Verify score + metadata + actions don't overflow at 320px; responsive padding if needed.

**Files:** `web/components/PostFeed.tsx`, `web/components/FilterSidebar.tsx`, `web/components/PostCard.tsx`

---

## 3. Home page

- [x] Reduce top padding on small screens (e.g. `pt-16 sm:pt-28`).
- [x] Optionally reduce heading size on very small screens (e.g. `text-3xl sm:text-4xl`).
- [x] Responsive content area padding (`px-4 py-8 sm:px-6` etc.).
- [x] Verify SportsFact and StatsPanel at 320px (no overflow).

**Files:** `web/app/page.tsx`, `web/components/SportsFact.tsx`, `web/components/StatsPanel.tsx`

---

## 4. Post detail page

- [x] Responsive main padding (e.g. `p-4 sm:p-6 md:p-8`).
- [x] Back link and post card: no horizontal overflow.
- [x] Comments and Related posts: spacing and readability on small screens.

**Files:** `web/components/PostDetailClient.tsx`, `web/app/posts/[id]/page.tsx`

---

## 5. Settings page

- [x] Responsive main padding (`p-4 sm:p-6 md:p-8`).
- [x] SettingsWeightSection / SettingsDefaultsSection: verify 1-column on mobile, no overflow.
- [x] RankingWeightsEditor, PicksDefaultsEditor, NoveltyConfigEditor: spot-check narrow width.

**Files:** `web/app/settings/page.tsx`, `web/components/SettingsWeightSection.tsx`, `web/components/SettingsDefaultsSection.tsx`, editors as needed.

---

## 6. Jobs page

- [x] Responsive main padding (`p-4 sm:p-6 md:p-8`).
- [x] JobsList header: title + description + headerRightContent (filter) wrap or stack on small screens.
- [x] Job cards and sections: verify on narrow width.

**Files:** `web/app/jobs/page.tsx`, `web/components/JobsList.tsx`

---

## 7. Stats page

- [x] Responsive main padding (`p-4 sm:p-6 md:p-8`).
- [x] Score distribution table: container has safe padding; table scrolls horizontally if needed.
- [x] Cards and grids: no change unless issues found.

**Files:** `web/app/stats/page.tsx`, `web/components/ScoreDistributionSection.tsx`

---

## 8. Search page

- [x] Redirect/loading state: responsive padding (e.g. `p-4 sm:p-8`).

**Files:** `web/app/search/page.tsx`

---

## 9. Cross-cutting: Feed toolbar and bulk actions

- [x] Responsive layout for feed toolbar: e.g. row 1 = search (+ Filter); row 2 = Sort + Bulk + Reset; or flex-wrap with min-w-0.
- [x] Avoid min-w-[11rem] overflow on smallest breakpoint; allow shrink or compact dropdown.
- [x] Optionally sticky bottom bar on mobile when bulk mode with selections (N selected + actions).

**Files:** `web/components/PostFeed.tsx`, `web/components/ui/CustomSelect.tsx` if needed.

---

## 10. Cross-cutting: Filter sidebar (drawer) mobile UX

- [x] Drawer body scrolls; no horizontal overflow.
- [x] FilterSidebar: no fixed wide blocks; labels/inputs stack or wrap.
- [x] Touch targets ≥ 44px where possible; adequate spacing.

**Files:** `web/components/PostFeed.tsx` (drawer), `web/components/FilterSidebar.tsx`

---

## 11. Modals and global

- [x] ConfirmModal: margin/padding on very small viewports so it doesn't touch edges.

**Files:** `web/components/ui/ConfirmModal.tsx`
