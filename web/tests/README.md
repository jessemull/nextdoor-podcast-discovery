# Web Tests

This directory will contain tests for the Next.js web application.

## Setup

```bash
# Install testing dependencies (when ready)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

## Tests to Implement

### Priority 1: Components
- [ ] `PostCard.test.tsx` - Test rendering with various post data
- [ ] `SportsFact.test.tsx` - Test conditional rendering for Matt
- [ ] `Navbar.test.tsx` - Test auth states

### Priority 2: Utilities
- [ ] `utils.test.ts` - Test `formatRelativeTime`, `truncate`, `cn`
- [ ] `env.test.ts` - Test env validation

### Priority 3: API Routes
- [ ] `sports-fact.test.ts` - Test auth and response format

### Priority 4: Pages
- [ ] `login.test.tsx` - Test redirect behavior
- [ ] `page.test.tsx` - Test dashboard rendering

## Testing Strategy

- Use Vitest for fast unit testing
- Use React Testing Library for component tests
- Mock `next-auth` session for auth-dependent tests
- Mock `fetch` for API route tests
