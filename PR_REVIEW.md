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
- [ ] No cross-layer leakage (frontend calling DB directly without API boundary)
- [ ] No unnecessary tight coupling introduced
- [ ] Configurable values are not hardcoded
- [ ] Background jobs (scraper, recompute) follow existing patterns
- [ ] Feature flags or weight configs handled cleanly
- [ ] Code aligns with overall low-cost architecture goal

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
- [ ] Robust selectors (not brittle CSS/XPath)
- [ ] Error handling for login failures, navigation failures
- [ ] Retries implemented via tenacity where appropriate
- [ ] Timeouts reasonable (not infinite)

## Security
- [ ] Fernet encryption used correctly for session cookies
- [ ] No plaintext credentials stored or logged
- [ ] No secrets committed in code
- [ ] Environment variables loaded securely via python-dotenv

## Claude / OpenAI Integration
- [ ] API keys read from env only
- [ ] Retry logic implemented
- [ ] Token usage reasonable
- [ ] Error handling around rate limits
- [ ] Structured parsing of model outputs (no unsafe assumptions)

## Testing
- [ ] pytest covers new logic
- [ ] pytest-asyncio used for async code
- [ ] pytest-cov coverage acceptable
- [ ] Edge cases tested (timeouts, bad responses, empty feeds)

---

# 4. TYPESCRIPT / NEXT.JS 14+

## Type Safety
- [ ] Strict mode enforced
- [ ] No unnecessary `any`
- [ ] Zod schemas validate all external inputs
- [ ] Types shared properly between client/server if needed

## React & UI
- [ ] Components small and reusable
- [ ] Server vs Client components used correctly
- [ ] server-only modules not imported client-side
- [ ] No hydration mismatches
- [ ] Proper loading and error states
- [ ] Accessibility (ARIA, keyboard navigation)
- [ ] Radix UI components used correctly
- [ ] Tailwind classes clean (no redundant conflicts)
- [ ] clsx / tailwind-merge used properly

## State & Data
- [ ] TanStack React Query configured correctly
- [ ] Caching logic sound
- [ ] No over-fetching
- [ ] Pagination implemented for large datasets
- [ ] Semantic search queries optimized

## Auth
- [ ] Auth0 session validated server-side
- [ ] No sensitive data exposed to client
- [ ] Admin routes protected
- [ ] Role checks enforced consistently

## Testing
- [ ] Vitest tests pass
- [ ] React Testing Library tests simulate real user behavior
- [ ] No fragile DOM structure assertions
- [ ] jsdom used appropriately

---

# 5. DATABASE & SQL (SUPABASE + POSTGRESQL + PGVECTOR)

- [ ] Migrations versioned and committed
- [ ] Migrations reversible where possible
- [ ] No destructive migration without explicit warning
- [ ] Indexes added where needed
- [ ] pgvector indexed properly (IVFFlat/HNSW where applicable)
- [ ] Queries use parameterization
- [ ] No N+1 queries introduced
- [ ] Row-level security (if used) validated
- [ ] Large updates batched safely
- [ ] Background recompute jobs safe for production scale

---

# 6. SECURITY REVIEW (MANDATORY)

- [ ] No hardcoded secrets
- [ ] No raw SQL string concatenation
- [ ] XSS protections in frontend
- [ ] CSRF protections verified
- [ ] Sensitive logs removed
- [ ] bandit passes
- [ ] pip-audit clean
- [ ] npm audit clean
- [ ] Dependencies reviewed for risk
- [ ] Principle of least privilege applied
- [ ] Supabase service role keys never exposed to client

---

# 7. PERFORMANCE

- [ ] No unnecessary loops on large datasets
- [ ] Efficient DB queries (EXPLAIN considered if needed)
- [ ] Caching via Upstash Redis justified and invalidation clear
- [ ] Async operations used where appropriate
- [ ] No excessive re-renders in React
- [ ] No large bundle size regression

---

# 8. CI/CD & INFRA

- [ ] GitHub Actions workflows updated if needed
- [ ] Scheduled cron jobs correct (02:00 UTC scrape, 18:00 UTC trending)
- [ ] Caching in CI configured correctly
- [ ] Vercel deployment unaffected
- [ ] Docker config valid for local Postgres (pgvector)
- [ ] No environment drift between local and production

---

# 9. LOGGING & OBSERVABILITY

- [ ] Logs meaningful but not verbose
- [ ] No sensitive data in logs
- [ ] Errors logged with context
- [ ] Retry attempts logged appropriately
- [ ] Background jobs observable/debuggable

---

# 10. DOCUMENTATION

- [ ] README updated if behavior changes
- [ ] Setup instructions accurate
- [ ] Environment variables documented
- [ ] Developer workflow (Makefile commands) correct
- [ ] Admin features documented

---

# FINAL REVIEW SUMMARY

- [ ] All checks completed
- [ ] Critical issues resolved
- [ ] Major issues addressed
- [ ] Minor issues noted
- [ ] Safe to merge
