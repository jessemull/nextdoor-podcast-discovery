# Nextdoor Web Dashboard

Next.js frontend for the Podcast Discovery Platform.

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file:

```bash
# Supabase (public)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase (server-side)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Auth
NEXTAUTH_SECRET=random-secret-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Allowed users
ALLOWED_EMAIL_1=your-email@example.com
MATT_EMAIL=matt@example.com

# For sports facts on client
NEXT_PUBLIC_MATT_EMAIL=matt@example.com

# Claude (for sports facts)
ANTHROPIC_API_KEY=sk-ant-...
```

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
