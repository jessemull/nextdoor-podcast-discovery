# AI-Powered Search and Autocomplete

## How It’s Wired

### Search (when you press Enter or click a suggestion)

- **AI Powered** (default): `POST /api/search` with `{ query, similarity_threshold, limit }`. The API embeds the query with OpenAI, runs vector search via `search_posts_by_embedding` in Supabase, and returns similar posts.
- **Keyword**: `GET /api/search?q=...` — full-text search against post content.

### Autocomplete / suggestions (dropdown while typing)

- **Client**: `FeedSearchBar` debounces the input (250ms), then requests `GET /api/search/suggestions?q=...&limit=10`.
- **API** (`/api/search/suggestions/route.ts`):
  1. **Always**: Builds a list from the static **prefix match** on `SEARCH_SUGGESTIONS` (see `lib/constants.ts`: e.g. "coyote", "lost cat", "wildlife"). If the query is empty, it returns the first `limit` items from that list.
  2. **Only when `q.length >= 2`**:
     - Embeds the query with OpenAI (`text-embedding-3-small`).
     - Calls Supabase RPC `search_posts_by_embedding` to get a few similar posts (snippets).
     - Sends those snippets to **Claude Haiku** and asks for 2–3 short search phrase suggestions.
     - Merges prefix suggestions + LLM suggestions, dedupes, and returns.

So the “AI” part of autocomplete **is** implemented: for 2+ characters it uses embeddings + vector search + Claude to suggest phrases. The static list is the baseline; the AI adds more suggestions when the rest of the chain succeeds.

## Why It Often Looks “Static”

1. **Focus**: On input focus, the client **overwrites** suggestions with `SEARCH_SUGGESTIONS` (`FeedSearchBar.tsx` `onFocus`). So the first thing you see is always the static list, even if the API would return AI suggestions for the current query.
2. **Short query**: For empty or 1 character, the API intentionally returns only the static (or prefix-filtered) list; the embedding/LLM path runs only when `q.length >= 2`.
3. **Failures**: If any step fails (OpenAI embedding, Supabase `search_posts_by_embedding`, or Claude), the API falls back to **only** the prefix list. So missing env vars, empty `post_embeddings`, or API errors make it look like only static suggestions.
4. **No embeddings**: If there are no rows in `post_embeddings` (or they don’t match the query), vector search returns nothing and the LLM step is skipped; you only get prefix suggestions.

## Quick Checks

- **Suggestions**: Type **2+ characters** and wait for the debounce (250ms). You should see “Loading suggestions…” then either the same static list (if the API fell back) or an updated list that can include LLM suggestions.
- **AI search**: Ensure `OPENAI_API_KEY` and Supabase are configured, and that posts have embeddings (embedding backlog in Stats). Use “AI Powered” and run a search; results come from vector similarity.

## Possible Improvements

- **Don’t overwrite on focus**: When the user focuses the input, only show the static list if the query is empty; if there’s already a query, fetch suggestions from the API instead of forcing `SEARCH_SUGGESTIONS`.
- **Loading state**: Keep the current “Loading suggestions…” so it’s clear when the API is being called.
- **Error handling**: Optionally surface a non-blocking message when the suggestions API falls back (e.g. “Suggestions are limited right now”) so users know the AI path didn’t run.
