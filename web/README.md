# Nextdoor Web Dashboard

Next.js frontend for the Podcast Discovery Platform.

## Setup

```bash
# Install dependencies
npm install

# Create environment variables file
touch .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

See `.env.example` for the full list. Required variables include:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase (client-safe)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — Supabase (server-side; keep secret)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — NextAuth.js
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `ALLOWED_EMAILS` — Comma-separated emails that can sign in (or set in env)
- `ANTHROPIC_API_KEY` — For Pittsburgh sports facts (and optional `USER_EMAIL` / `NEXT_PUBLIC_USER_EMAIL`)

## Project Structure

```
web/
├── app/
│   ├── api/              # API routes
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page (feed)
│   └── providers.tsx     # React Query + NextAuth providers
├── components/           # React components
├── lib/                  # Utilities and clients
└── public/               # Static assets
```

## Features

- **Authentication** — Google OAuth with email whitelist
- **Post Feed** — View ranked posts from Nextdoor
- **Search** — Keyword and semantic search
- **Ranking Sliders** — Adjust scoring weights
- **Pittsburgh Sports Facts** — Random facts for Matt on login!
