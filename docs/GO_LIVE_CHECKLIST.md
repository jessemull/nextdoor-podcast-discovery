## Go-live checklist

- [ ] **Clean up recompute logging**: Simplify log messages for recompute jobs and add colorized output so progress and errors are easy to see when running the worker.
- [ ] **Improve error display**: Standardize how errors are surfaced to users across the app (consistent wording, styling, and fallback behavior for API failures).
- [ ] **Bulk unsave support**: Add a bulk “unsave” action alongside existing bulk actions so multiple saved posts can be cleared in one operation.
- [ ] **Fix scraper retry pipeline**: Ensure “Retry” on a scraper run creates and runs a real `run_scraper` job, re-scrapes as expected, and updates the Scraper Runs UI to reflect queued/processing/completed states correctly (including how `scraper_runs` and `background_jobs` interact).


