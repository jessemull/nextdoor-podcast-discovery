# Large Files — Incremental Decomposition Plan

Files over project limits (Python >500 lines, TS/React >300 lines) are being split incrementally.

## Phase order

### Python (>500 lines)

1. **worker.py** — Phase 1: Extract `process_fetch_permalink_job` and `process_run_scraper_job` to `worker_handlers.py`. Phase 2: Extract `process_recompute_job` and `process_backfill_dimension_job` plus helpers to `worker_handlers.py` (worker becomes orchestrator only).
2. **llm_scorer.py** — Extract batch vs single-post logic or prompts/parsing into a helper module.
3. **post_extractor.py** — Extract parsing/selectors or helpers into a submodule.
4. **main.py** — Extract CLI vs pipeline steps into a runner or steps module.
5. **post_storage.py** — Extract neighborhood/upsert helpers if logical.

### TypeScript / React (>300 lines)

1. **PostFeed.tsx** — Extract feed list, job/permalink UI, or filters integration into subcomponents.
2. **FilterSidebar.tsx** / **FeedFilters.tsx** — Extract filter groups or shared filter UI.
3. **WeightConfigsList.tsx** / **PermalinkQueueSection.tsx** — Extract list items, modals, or queue table.
4. **PostCard.tsx** — Extract card header, body, actions menu.
5. **settings/page.tsx** / **jobs/page.tsx** — Extract sections into components.
6. **api/posts/route.ts** — Extract RPC/query helpers or response builders into a server lib.

## Status

- **Phase 1 (worker):** fetch_permalink and run_scraper moved to `worker_handlers.py`.
- Remaining phases to be done in follow-up PRs.
