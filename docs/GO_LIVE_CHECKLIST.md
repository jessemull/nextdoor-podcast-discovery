## Go-live checklist

- [x] **Clean up recompute logging**: Simplify log messages for recompute jobs and add colorized output so progress and errors are easy to see when running the worker.
- [ ] **Improve error display**: Standardize how errors are surfaced to users across the app (consistent wording, styling, and fallback behavior for API failures).
- [x] **Bulk unsave support**: Add a bulk “unsave” action alongside existing bulk actions so multiple saved posts can be cleared in one operation.
- [ ] **Fix scraper retry pipeline**: Ensure “Retry” on a scraper run creates and runs a real `run_scraper` job, re-scrapes as expected, and updates the Scraper Runs UI to reflect queued/processing/completed states correctly (including how `scraper_runs` and `background_jobs` interact).
- [x] **Remove scraper compliance checks**: Remove any pre-scrape compliance checks (and related flags/wiring) so runs are not blocked for this application.
- [x] **Clean up permalink logs**: Tidy up logs for `fetch_permalink` jobs (less noise, clearer success/error summaries) and ensure permalink processing uses the same colored, structured logging as the main scraper/worker.
- [x] **Fix card images**: Ensure main images on feed/detail cards are fully visible, consistently sized, and not cropped awkwardly (correct aspect ratio and object-fit behavior).

