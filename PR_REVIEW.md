# Pull Request Review Checklist
## Nextdoor Podcast Discovery Platform

This checklist applies to:
- Python 3.11+ scraper & workers
- TypeScript (strict) + Next.js 14+ (React 19)
- SQL (PostgreSQL, Supabase, pgvector, PL/pgSQL)
- CI/CD (GitHub Actions, Vercel)
- Security tooling (bandit, pip-audit, ESLint, etc.)
- Infrastructure (Docker, Redis, Auth0, Supabase)

---

# 0. PRE-MERGE AUTOMATION (REQUIRED)

All of the following must pass before merge. Run from repo root.

- [ ] `make lint` — ruff + mypy (scraper), ESLint (web)
- [ ] `make format` — code is formatted (or `ruff format --check` / ESLint fix already applied)
- [ ] `make test` — pytest (scraper), Vitest (web)
- [ ] `make security` — bandit, pip-audit (scraper), npm audit (web)
- [ ] `make build` — Next.js production build succeeds
- [ ] CI green (if applicable)

---

# 1. PR CONTEXT & SCOPE

- [ ] PR title clearly describes change
- [ ] Description explains WHAT, WHY, and IMPACT
- [ ] Linked issue/ticket
- [ ] Scope is focused and not a massive mixed change
- [ ] Commits are logically structured and meaningful
- [ ] CHANGELOG updated if applicable

---

# 2. ARCHITECTURE & DESIGN

- [ ] Respects separation of concerns (scraper, scoring, embeddings, web app)
- [ ] No cross-layer leakage
- [ ] No unnecessary tight coupling introduced
- [ ] Configurable values are not hardcoded
- [ ] Background jobs follow existing patterns
- [ ] Feature flags or weight configs handled cleanly
- [ ] Aligns with low-cost architecture goal

---

# 3. PYTHON (SCRAPER & WORKERS)

## General
- [ ] Python 3.11+ features used correctly
- [ ] Type hints present and pass mypy
- [ ] Formatted with black
- [ ] Linted with ruff
- [ ] No unused imports or dead code

## Playwright Scraper
- [ ] Proper async usage
- [ ] No blocking operations inside async flows
- [ ] Headless Chromium config safe and stable
- [ ] Mobile viewport behavior intentional and documented
- [ ] Robust selectors
- [ ] Error handling for login/navigation failures
- [ ] Retries implemented via tenacity
- [ ] Reasonable timeouts

## Security
- [ ] Fernet encryption used correctly
- [ ] No plaintext credentials stored or logged
- [ ] No secrets committed in code
- [ ] Environment variables loaded securely

## Claude / OpenAI Integration
- [ ] API keys read from env only
- [ ] Retry logic implemented
- [ ] Rate limit handling present
- [ ] Structured parsing of model outputs

## Testing
- [ ] pytest covers new logic
- [ ] pytest-asyncio used appropriately
- [ ] pytest-cov coverage acceptable
- [ ] Edge cases tested

---

# 4. TYPESCRIPT / NEXT.JS 14+

## Type Safety
- [ ] Strict mode enforced
- [ ] No unnecessary `any`
- [ ] Zod validates external inputs
- [ ] Shared types handled properly

## React & UI
- [ ] Components small and reusable
- [ ] Correct Server vs Client usage
- [ ] No hydration mismatches
- [ ] Proper loading/error states
- [ ] Accessibility considered
- [ ] Tailwind usage clean

## State & Data
- [ ] React Query configured correctly
- [ ] No over-fetching
- [ ] Pagination for large datasets
- [ ] Semantic search optimized

## Auth
- [ ] Auth0 session validated server-side
- [ ] Admin routes protected
- [ ] Role checks enforced

## Testing
- [ ] Vitest tests pass
- [ ] React Testing Library simulates real use
- [ ] No fragile assertions

---

# 5. DATABASE & SQL

- [ ] Migrations versioned
- [ ] Reversible where possible
- [ ] No destructive migration without warning
- [ ] Indexes added appropriately
- [ ] pgvector indexed properly
- [ ] Parameterized queries used
- [ ] No N+1 queries
- [ ] RLS validated if used
- [ ] Large updates batched safely

---

# 6. SECURITY REVIEW (MANDATORY)

- [ ] No hardcoded secrets
- [ ] No raw SQL string concatenation
- [ ] XSS protections verified
- [ ] CSRF protections verified
- [ ] Sensitive logs removed
- [ ] bandit passes
- [ ] pip-audit clean
- [ ] npm audit clean
- [ ] Dependencies reviewed
- [ ] Principle of least privilege applied
- [ ] Supabase service role keys never exposed client-side

---

# 7. PERFORMANCE

- [ ] No unnecessary loops on large datasets
- [ ] Efficient DB queries
- [ ] Cache invalidation clear (Redis if used)
- [ ] Async used appropriately
- [ ] No excessive React re-renders
- [ ] No bundle size regression

---

# 8. CI/CD & INFRA

- [ ] GitHub Actions updated if needed
- [ ] Scheduled cron jobs correct
- [ ] CI caching configured correctly
- [ ] Vercel deployment unaffected
- [ ] Docker config valid
- [ ] No environment drift
- [ ] Lockfiles committed (`package-lock.json`, etc.); dependency adds/version bumps intentional and documented

---

# 9. LOGGING & OBSERVABILITY

- [ ] Logs meaningful but not verbose
- [ ] No sensitive data in logs
- [ ] Errors logged with context
- [ ] Retry attempts logged appropriately
- [ ] Background jobs observable

---

# 10. DOCUMENTATION

- [ ] README updated
- [ ] Setup instructions accurate
- [ ] Environment variables documented
- [ ] `.env.example` (scraper and/or web) updated if any env vars added or changed
- [ ] Makefile workflow correct
- [ ] Admin features documented

---

# 11. CODE CRAFTSMANSHIP & PATTERNS (MANDATORY)

## Python Architecture & Patterns

### Structure & Responsibility
- [ ] Functions do ONE thing
- [ ] No God functions
- [ ] No mixed concerns (scraping + scoring + DB writes)
- [ ] Business logic separated from I/O
- [ ] Clear service-layer abstractions

### Async & Concurrency
- [ ] Proper async/await usage
- [ ] No blocking calls inside async
- [ ] No unbounded concurrency
- [ ] Explicit timeouts
- [ ] Retries isolated

### Types & Modeling
- [ ] Typed function signatures
- [ ] No implicit Any
- [ ] Structured models used
- [ ] Explicit return types

### Error Handling
- [ ] No broad except without rethrow/logging
- [ ] Errors categorized
- [ ] Fail-fast where appropriate
- [ ] No silent failures

### Clean Code
- [ ] Descriptive naming
- [ ] No magic numbers
- [ ] Config extracted to constants
- [ ] No duplication
- [ ] Reusable helpers extracted

---

## TypeScript Architecture & Patterns

### Type Discipline
- [ ] No unsafe type assertions
- [ ] Domain models defined
- [ ] Zod validates external data
- [ ] Narrow types used
- [ ] Exhaustive switches

### Organization
- [ ] Clear folder separation
- [ ] No cross-layer imports
- [ ] No server logic in client components

### Hooks & Logic
- [ ] Hooks single responsibility
- [ ] No conditional hooks
- [ ] Business logic not buried in UI
- [ ] Async server logic isolated

### Error Handling
- [ ] Error boundaries used where needed
- [ ] React Query errors handled
- [ ] No swallowed promise rejections

---

## React / Next.js Patterns

### App Router Discipline
- [ ] Server components default where possible
- [ ] Client components explicitly marked
- [ ] No server-only imports client-side
- [ ] No secret leakage via props

### State & Performance
- [ ] Clear server vs client state separation
- [ ] Intentional cache invalidation
- [ ] No unnecessary memoization
- [ ] No large client bundles introduced

### Accessibility
- [ ] ARIA correct
- [ ] Keyboard navigation works
- [ ] Focus management handled

---

## Code consistency & project conventions

Per `.cursorrules` — enforce for consistency and code equality:

### Alphabetization
- [ ] **Python:** Imports (stdlib → third-party → local, alphabetical within groups); dict keys; string lists where order doesn’t matter; class methods (after `__init__`/special)
- [ ] **TypeScript:** Imports and named import members; object/interface keys; JSX props (`key` first, `on*` last); union types; `className` classes where practical
- [ ] **ESLint:** `eslint-plugin-perfectionist` passes (no alphabetical-order violations)

### Comment spacing
- [ ] Standalone comments have a blank line above and below (except at block start/end)
- [ ] JSX comments have no blank lines above/below (compact)
- [ ] Docstrings (Python) / JSDoc (TypeScript) directly under the declaration, no blank line between

### Python-specific
- [ ] Absolute imports used (e.g. `from src.scraper import ...`)
- [ ] Custom exceptions live in `src/exceptions.py` where appropriate

### Config & env
- [ ] New or changed env vars added to `scraper/.env.example` and/or `web/.env.example`
- [ ] No new hardcoded config; constants or env used

---

## Refactor Smells (Automatic Fail Signals)

Fail PR if it introduces:
- Massive functions
- Copy-paste duplication
- Silent catch blocks
- Mixed async/sync misuse
- Implicit global state
- Hardcoded secrets
- UI components >300 lines without decomposition
- Python files >500 lines without modular separation

---

# FINAL REVIEW SUMMARY

- [ ] All checks completed
- [ ] Critical issues resolved
- [ ] Major issues addressed
- [ ] Minor issues noted
- [ ] Safe to merge
