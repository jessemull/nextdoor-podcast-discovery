# Supabase migrations (dev and prod)

We use two Supabase projects: one for **dev** (Preview / local) and one for **production**. Apply the same schema and migrations to both so they stay in sync.

## Running migrations

1. Open the Supabase project (Dashboard → SQL Editor) for the environment you want to update (dev or prod).
2. Run the migration files in **numeric order** from `database/migrations/`:  
   `001_initial_schema.sql` through the latest (e.g. `043_*.sql`).  
   Copy each file’s contents into the SQL Editor and execute.
3. Optionally run `database/seeds/seed_neighborhoods.sql` if you use that seed data.
4. Repeat for the other project (run the same migrations in the same order in the other Supabase project).

When you add or change migrations, run them in **both** dev and prod (and in the same order) so both environments stay compatible with the app and scraper.

For how each environment uses which Supabase project, see [ENVIRONMENTS.md](ENVIRONMENTS.md).
