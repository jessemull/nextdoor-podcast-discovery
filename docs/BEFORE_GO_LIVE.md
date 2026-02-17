# Before go-live

Tasks to complete before launch. No human/cousin certification required.

- [ ] **Scraper: fix programmatic scroll to trigger infinite-load** — Manual scrolling loads new posts indefinitely; programmatic `window.scrollBy()` does not trigger Nextdoor’s infinite scroll. Try wheel/touch simulation, Playwright native scroll, or scroll-into-view on sentinel elements so more posts load during extraction.
- [ ] **Scraper: tune scroll delay** — Current `scroll_delay_ms` (2000, 5000) increases total scrape time. Lower range (e.g. 1–3s); make configurable via env; document/monitor for rate limits/CAPTCHA.
