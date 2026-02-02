# PR Review: Code Quality Improvements

This document tracks code quality issues identified during review.

---

## 🔴 High Priority

- [x] **1. Missing Environment Variable Validation** - Added `validate_env()` in `scraper/src/config.py` and typed env access in `web/lib/env.ts`
- [x] **2. Supabase Client Created at Module Level** - Changed to lazy initialization with `getSupabase()` and `getSupabaseAdmin()` functions
- [x] **3. `cn()` Utility is Incomplete** - Added `tailwind-merge` package and updated `cn()` to use `twMerge(clsx(inputs))`
- [x] **4. No Login Page Exists** - Created `web/app/login/page.tsx` with Google OAuth sign-in

## 🟠 Medium Priority

- [x] **5. Navbar Not Used in Layout** - Added `<Navbar />` to `layout.tsx`
- [x] **6. Hardcoded Model Names** - Created `CLAUDE_MODEL` constant in `web/lib/env.ts` and imported in route
- [x] **7. Missing Type for Sports Fact Response** - Added `SportsFactResponse` and `ErrorResponse` interfaces to `types.ts`
- [x] **8. Catch-All Exception in main.py** - Already catches `ScraperError` specifically before generic `Exception`
- [x] **9. Unused `formatDate` Function** - Removed from `utils.ts`, kept only `formatRelativeTime`
- [x] **10. Missing ESLint Configuration** - Created `web/.eslintrc.json`
- [x] **11. `ScoreBadge` Should Be Exported or Documented** - Added JSDoc comment explaining it's an internal component

## 🟡 Low Priority

- [x] **12. Inconsistent Import Ordering** - Standardized imports (stdlib/external → local) in updated files
- [x] **13. Missing `@types/react-dom`** - Added to devDependencies
- [x] **14. Placeholder Author in pyproject.toml** - Changed to empty `authors = []`
- [x] **15. Makefile Doesn't Handle venv** - Added `venv` target and updated `install-scraper` to check for active venv
- [x] **16. Tailwind v4 May Have Breaking Changes** - Pinned to v3.4.17 for stability
- [x] **17. GitHub Workflow Creates Issue on Every Failure** - Updated to check for existing open issues before creating new ones
- [x] **18. Missing `next-env.d.ts`** - Created file for TypeScript support

## 📝 Documentation

- [x] **19. Missing `.env.example` in Web Directory** - Created `web/.env.example` and `scraper/.env.example`
- [x] **20. Makefile `install` Requires venv** - Updated Makefile with venv check and clearer instructions

---

## Summary of Changes

### Files Modified
- `scraper/src/config.py` - Added env validation and lazy getters
- `scraper/src/main.py` - Improved exception handling, calls `validate_env()`
- `scraper/pyproject.toml` - Removed placeholder author
- `web/lib/env.ts` - New file for typed environment access
- `web/lib/supabase.ts` - Changed to lazy initialization
- `web/lib/utils.ts` - Fixed `cn()`, removed unused `formatDate`
- `web/lib/types.ts` - Added `SportsFactResponse` and `ErrorResponse`
- `web/app/layout.tsx` - Added Navbar component
- `web/app/login/page.tsx` - New login page
- `web/app/api/sports-fact/route.ts` - Uses `CLAUDE_MODEL` constant, added types
- `web/components/SportsFact.tsx` - Added type for query
- `web/components/PostCard.tsx` - Added JSDoc for ScoreBadge
- `web/.eslintrc.json` - New ESLint config
- `web/next-env.d.ts` - New TypeScript declaration
- `.github/workflows/scrape.yml` - Improved failure notification
- `Makefile` - Added venv target, improved install commands

### Files Created
- `web/.env.example`
- `scraper/.env.example`
- `web/app/login/page.tsx`
- `web/.eslintrc.json`
- `web/next-env.d.ts`

### Packages Added
- `tailwind-merge` (web)
- `@types/react-dom` (web devDependencies)

### Packages Changed
- `tailwindcss` pinned to `3.4.17` (from v4)
