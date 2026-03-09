# Host: power settings and monitoring

Use this after the production host (laptop or server) is set up so it runs reliably 24/7.

## Power and sleep (laptop)

- **Disable suspend on AC**: So cron and the workers keep running when the lid is closed or the machine is idle.
  - On Ubuntu/Debian (GNOME): Settings → Power → set "When plugged in" / "When on AC power" to **Never** for suspend, or use:
    ```bash
    gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
    ```
  - Or use `systemd-inhibit` or a small systemd service that prevents sleep while the worker is running (optional).
- **Keep the machine on AC power** and on a stable network where it will live.

## Cron (scraper schedule)

After `scripts/setup-server.sh`, the `nextdoor` user (or the user who ran the app phase) has cron entries for one run per feed per day (max 250 posts per run):

- `./scripts/run-scrape.sh for_you` at 02:00
- `./scripts/run-scrape.sh recent` at 06:00
- `./scripts/run-scrape.sh nearby` at 10:00
- `./scripts/run-scrape.sh trending` at 18:00

To confirm:

```bash
crontab -l
```

Cron output is appended to `$LOG_DIR/cron.log` (e.g. `/home/nextdoor/nextdoor-logs/cron.log`). Check that file if a scheduled scrape does not run.

## Workers (systemd)

If you installed the workers with `scripts/install-worker-service.sh`, two units run:

- **nextdoor-worker** — recompute_final_scores (Save & Recompute, Activate in UI)
- **nextdoor-permalink-worker** — fetch_permalink (permalink queue from UI)

```bash
sudo systemctl status nextdoor-worker             # recompute worker
sudo systemctl status nextdoor-permalink-worker   # permalink worker
sudo systemctl enable nextdoor-worker            # start on boot
sudo systemctl enable nextdoor-permalink-worker
journalctl -u nextdoor-worker -f                 # recompute logs
journalctl -u nextdoor-permalink-worker -f       # permalink logs
```

## Healthchecks

If `HEALTHCHECK_URL` (and optionally `HEALTHCHECK_EMBED_URL`) are set in `scraper/.env`, `run-scrape.sh` and `run-embeddings.sh` ping those URLs on success or failure. Configure your Healthchecks.io (or similar) project to alert you when a run fails or is missed.

## Logs

- Scraper: `$SCRAPER_LOG_DIR/scraper.log` (rotating; see `scraper/src/logging_config.py`).
- Cron: `$LOG_DIR/cron.log`.
- Workers: `journalctl -u nextdoor-worker` or `journalctl -u nextdoor-permalink-worker` (or each unit’s log output).

From another machine you can tail scraper logs via SSH: `DEPLOY_HOST=nextdoor@<host> ./scripts/tail-logs.sh` (see [DEPLOYMENT.md](DEPLOYMENT.md)).
