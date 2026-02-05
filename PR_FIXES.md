# PR Fixes Checklist

## Must Fix (Before Merge)
- [x] 1. Validate `minScore` input - ensure it's a valid number before sending to API
- [x] 2. Add loading state for "Mark as Used" - prevent double-clicks and show feedback
- [x] 12. Remove unused `useRef` import from `hooks.ts`
- [x] 13. Add error logging (`console.error`) in catch blocks for PostFeed and StatsPanel
- [x] 14. Fix `handleRetry` to reset offset to 0

## Should Fix (Soon)
- [x] 3. Extract hardcoded limit - move `"20"` to a constant
- [x] 4. Add retry logic - retry button or auto-retry for failed API calls
- [x] 5. Debounce filter inputs - especially `minScore` to avoid excessive API calls
- [x] 15. Add JSDoc comment for `useDebounce` hook
- [x] 16. Remove empty line in comment (PostFeed.tsx line 118)

## Nice to Have (Later)
- [x] 6. Move categories to constants - fetch from API or shared config file
- [x] 7. Add pagination - load more than 20 posts (infinite scroll or page controls)
- [x] 8. Add JSDoc comments - document PostFeed and StatsPanel components
- [x] 9. Server-side initial load - deferred (client-side acceptable for filters, can optimize later)
- [x] 10. Replace emoji in StatsPanel - use icon component instead of "📊"
- [x] 11. Improve test mocks - better typing instead of `as any` in posts.test.ts
- [x] 17. Extract debounce delay to constant
- [x] 18. Add component tests for PostFeed and StatsPanel
- [x] 19. Add tests for useDebounce hook
