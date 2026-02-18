# Deployment and environment variables

This doc describes how to point the web app and scraper/worker at the correct Supabase project (dev vs prod) and where to set env vars. The app does not switch databases in code—you set the appropriate env values per environment.

Full env templates: [web/.env.example](../web/.env.example), [scraper/.env.example](../scraper/.env.example).

---

## Two Supabase projects

Use two Supabase projects: **dev** (local and Vercel Preview) and **prod** (Vercel Production and any prod scraper/worker runs). Each project has its own:

- Project URL (e.g. `https://xxxxx.supabase.co`)
- Anon key (public, for client-side)
- Service role key (secret, for server and scraper)

Use **one set** of these per deployment context. Same env var names everywhere; different values for dev vs prod.

---

## Environment variables reference

### Web

| Variable | Where used | Differs dev/prod? |
|----------|------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Yes — use dev or prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Yes — use dev or prod anon key |
| `SUPABASE_URL` | Server (API routes, server components) | Yes — same project as above |
| `SUPABASE_SERVICE_KEY` | Server | Yes — same project’s service key |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` | Auth | Optional — use separate Auth0 apps for dev/prod if desired |
| `APP_BASE_URL` | Auth callbacks | Yes — e.g. `http://localhost:3000` locally, prod URL in Vercel Production |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | APIs | Same keys across envs is typical |
| `USER_EMAIL`, `NEXT_PUBLIC_USER_EMAIL` | Pittsburgh sports feature | Optional |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Caching | Optional; can be shared or per env |

### Scraper / worker

| Variable | Differs dev/prod? |
|----------|-------------------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Yes — use dev or prod project |
| `NEXTDOOR_EMAIL`, `NEXTDOOR_PASSWORD` | Same or separate accounts as you prefer |
| `SESSION_ENCRYPTION_KEY` | Per project if you use separate Supabase (different `sessions` data) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Same keys typical |
| `HEALTHCHECK_URL`, `HEALTHCHECK_EMBED_URL` | Optional |

---

## Web: where to set env vars

### Vercel

- **Preview:** Set the four Supabase vars (and Auth0, `APP_BASE_URL`, etc.) to your **dev** Supabase project and dev Auth0 app. Add them in Vercel → Project → Settings → Environment Variables, scoped to **Preview**.
- **Production:** Set the same var names to your **prod** Supabase project and prod Auth0/URL. Scope to **Production**.

No code changes—Vercel injects the right values per deployment environment.

### Local development

Use `web/.env.local` with your **dev** Supabase URL and keys (and dev Auth0, `APP_BASE_URL=http://localhost:3000`). Copy from [web/.env.example](../web/.env.example) and fill in dev project values.

---

## Scraper / worker: laptop

### Normal local runs (dev)

Use a `.env` file in the scraper directory with **dev** Supabase `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Copy [scraper/.env.example](../scraper/.env.example) and fill in dev project values. All local scraper/worker runs then use the dev database.

### Running scraper/worker against prod {#prod-env-vars-laptop-scraperworker}

When you need to run the scraper or worker against the **prod** database (e.g. processing prod job queue from your laptop):

1. In the Supabase dashboard, open the **prod** project → Settings → API. Copy the project URL and the **service_role** key.
2. Either:
   - **Option A:** Create a separate file (e.g. `.env.production`) with prod `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (and any other vars that must differ). Run with that file loaded, e.g. `dotenv -f .env.production -- python -m src.main worker` (if you use `dotenv` CLI), or source/export them in your shell before running.
   - **Option B:** Export the prod vars in your shell for the current session:  
     `export SUPABASE_URL=https://your-prod-project.supabase.co` and `export SUPABASE_SERVICE_KEY=your-prod-service-key`, then run the scraper/worker as usual.

Use prod only when intentional; keep default `.env` pointing at dev for day-to-day work.

---

## Optional: self-hosting {#5-self-hosting-optional}

If you self-host Next.js or Postgres instead of Vercel/Supabase, set the same env var names to your own endpoints and keys. The app does not assume Vercel or Supabase; it only reads these variables.
