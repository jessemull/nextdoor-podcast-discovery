# Supabase: two projects (dev + prod) and migrations

Same migration files apply to both projects. You do **not** need new or different migration scripts.

## Quick option: one file for new databases

Instead of running 36 files by hand, use a **single bootstrap file**:

1. Run **`make db-bootstrap`** (generates `database/bootstrap.sql` from all migrations in order).
2. In Supabase SQL Editor, open and run **`database/bootstrap.sql`** once per new project.

Commit `database/bootstrap.sql` so others can run it too. When you add a new migration (e.g. 037), run `make db-bootstrap` again and commit the updated file. The 36 individual files stay the source of truth; the bootstrap is just a convenience for fresh installs.

## 1. Create the two projects

1. Go to [Supabase Dashboard](https://supabase.com/dashboard).
2. **Dev:** Create a new project (e.g. “nextdoor-dev”). Note the URL and **Service role** key (Settings → API).
3. **Prod:** Create another project (e.g. “nextdoor-prod”). Note URL and Service role key.

Use different env files or env vars per environment (e.g. `.env.development` / `.env.production`, or Vercel env vars for web, and separate Supabase credentials for the scraper/worker).

## 2. Run migrations on each project

Run the **same** migrations in **numeric order** on each project (dev first, then prod when you’re ready).

**Order:** `001_initial_schema.sql` → `002_...` → … → `036_backfill_dimension.sql`.

**Option A — Bootstrap (recommended for new projects)**

1. Run `make db-bootstrap` if you haven’t (or after adding a new migration).
2. Open the project (dev or prod) → **SQL Editor**.
3. Paste the contents of `database/bootstrap.sql` (or upload it) and click **Run** once.

**Option B — Run the 36 files by hand**

1. Open the project (dev or prod) → **SQL Editor**.
2. For each file in `database/migrations/` in order: open the file, copy contents, paste into the Editor, click **Run** (001 through 036).

**List in order**

From the repo root, migrations in correct order:

```bash
ls -1 database/migrations/*.sql | sort -V
```

Use that list to open and run each file in the SQL Editor.

**Seeds (optional)**  
For dev you can run `database/seeds/seed_neighborhoods.sql` after migrations if you want seed data.

## 3. Do you need new or different migration scripts?

**No.** The 36 files in `database/migrations/` are the single source of truth. You run the same set on:

- Local (e.g. `make db-migrate-local`),
- Supabase dev,
- Supabase prod.

New environments = same migrations, in order. You only add new migration files when the schema or RPCs change (e.g. `037_...sql`).

## 4. Cleanup / consistency

- **Bootstrap:** `make db-bootstrap` generates `database/bootstrap.sql` (all 36 migrations in one file). Run that once per new project instead of 36 separate files. After adding migration 037, run `make db-bootstrap` again and commit the updated bootstrap.
- **Makefile:** `make db-migrate-prod` prints instructions; `make db-migrate-local` runs migrations in sorted order for local Postgres.
- **README:** Database section points to 001–036 and the bootstrap option.

No need to merge or rewrite the 36 migrations; they stay as the source of truth. The bootstrap is just a single-file convenience for fresh installs.
