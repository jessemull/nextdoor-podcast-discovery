# Pull Request Review Guidelines
*(Python Web Scraper + LLM Scoring Tool & Next.js TypeScript App)*

## Reviewer Mindset

A PR review is not about style bikeshedding or proving cleverness.  
It is about **long-term maintainability, correctness, safety, and clarity**.

Assume:
- This code will be read by someone new to the project in 6 months
- It will be run in production under imperfect conditions
- It will break in ways we haven’t anticipated

Prefer:
- Boring, explicit code over clever abstractions
- Fewer concepts over more reuse
- Predictability over flexibility

---

## 1. Global Review Checklist (All PRs)

### 1.1 Scope & Intent
- Does the PR do **one thing**?
- Is the PR description clear about:
  - What changed
  - Why it changed
  - Any tradeoffs or known limitations
- Are unrelated refactors avoided or clearly justified?

### 1.2 Code Health
- No dead code:
  - Unused functions, variables, imports
  - Commented-out blocks
- No TODOs without an owner or issue reference
- No debug logging accidentally left in
- No copy-paste code without justification

### 1.3 Readability & Structure
- Functions are small and do one thing
- Names reflect intent, not implementation details
- Control flow is obvious at a glance
- No deeply nested conditionals when early returns would help
- Complex logic is explained *why*, not *what*

### 1.4 Testing
- Tests exist for:
  - Happy path
  - At least one failure mode
  - Boundary or edge cases
- Tests assert behavior, not implementation details
- No fragile tests relying on timing, randomness, or external services
- Test names describe intent clearly

### 1.5 Error Handling
- Errors are:
  - Explicit
  - Meaningful
  - Actionable
- Failures are not silently swallowed
- Logging provides enough context to debug issues later

### 1.6 Security & Safety
- No secrets in code, configs, or logs
- User input is validated
- External data is treated as untrusted
- Scraping respects robots.txt and rate limits (where applicable)

---

## 2. Python-Specific Review Guidelines
*(Web Scraping + LLM Scoring Tool)*

### 2.1 Project Structure
- Clear separation between:
  - Scraping
  - Parsing
  - Scoring / LLM logic
  - Persistence / output
- No business logic in:
  - `__init__.py`
  - CLI entrypoints
- Utilities are not dumping grounds

### 2.2 Scraping Concerns
- Requests:
  - Have timeouts
  - Handle retries with backoff
  - Respect rate limits
- Scrapers:
  - Are resilient to partial page failures
  - Do not assume HTML structure is stable
- Parsing logic:
  - Is defensive (missing tags, malformed HTML)
  - Fails gracefully with useful errors

### 2.3 LLM Usage
- Prompts are:
  - Versioned or centrally defined
  - Easy to inspect and update
- Model calls:
  - Have explicit parameters (temperature, max tokens, etc.)
  - Are isolated behind a clear interface
- No prompt logic embedded deep in business logic
- Cost and latency implications are considered

### 2.4 Typing & Static Analysis
- Type hints are used consistently
- Public functions and complex returns are typed
- `Any` is avoided unless justified
- Mypy / Pyright errors are not ignored casually

### 2.5 Error & Retry Strategy
- Transient failures (network, API limits) are retried
- Permanent failures fail fast
- Retry logic is centralized, not duplicated
- Exceptions carry context (URL, prompt, input data)

### 2.6 Tests (Python)
- Scrapers:
  - Use mocked HTTP responses
  - Do not hit real websites in tests
- LLM logic:
  - Uses mocks or fixtures
  - Does not rely on live model calls
- Snapshot tests are used sparingly and intentionally

---

## 3. TypeScript / Next.js Review Guidelines

### 3.1 Project Structure
- Clear separation between:
  - Server components
  - Client components
  - API routes
  - Shared utilities
- No business logic embedded in UI components
- API logic does not leak into frontend components

### 3.2 Type Safety
- No `any` without a comment explaining why
- Types describe **domain concepts**, not just shapes
- API responses are typed end-to-end
- Zod (or equivalent) used for runtime validation at boundaries

### 3.3 Next.js Best Practices
- Server Components used where possible
- Client Components only when needed
- Data fetching:
  - Happens on the server when possible
  - Uses caching intentionally
- No unnecessary client-side fetching
- Suspense and loading states are handled thoughtfully

### 3.4 React Patterns
- Components are:
  - Small
  - Focused
  - Predictable
- No large “god components”
- Side effects are isolated and intentional
- Hooks are not abused for non-reactive logic

### 3.5 Performance
- Avoid unnecessary re-renders
- No expensive computations in render paths
- Images, fonts, and assets are optimized
- Bundle size implications considered

### 3.6 Tests (TypeScript)
- Components:
  - Test behavior, not implementation
  - Avoid shallow rendering
- API routes:
  - Have request/response tests
- No brittle snapshot tests for complex UI

---

## 4. Documentation Expectations

### 4.1 Code Comments
- Comments explain **why**, not **what**
- Complex algorithms or heuristics are documented
- Non-obvious tradeoffs are explained

### 4.2 README / Docs
- Project setup is accurate
- Local dev and test instructions work
- Environment variables are documented
- LLM usage and assumptions are explained

---

## 5. Anti-Patterns to Watch For

### Global
- “We’ll clean it up later”
- Over-abstraction without proven reuse
- Premature optimization
- Silent failures

### Python
- Giant functions
- Implicit global state
- Hidden side effects in helpers
- Catch-all `except Exception`

### TypeScript
- `any` everywhere
- Business logic in components
- Overusing `useEffect`
- Client-side data fetching by default

---

## 6. Final Review Questions

Before approving, ask:
1. Could a new engineer understand this in 15 minutes?
2. Will this fail safely?
3. Are future changes easier or harder after this PR?
4. Is the complexity justified by real requirements?

If the answer to any of these is “no,” request changes.
