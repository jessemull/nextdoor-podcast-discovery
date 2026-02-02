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

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

See `.env.example` for all required variables including:

- Supabase URLs and keys (public and server-side)
- NextAuth.js configuration
- Google OAuth credentials
- Email whitelist for access control
- Anthropic API key for sports facts

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
├── .env.example          # Example environment variables
└── public/               # Static assets
```

## Features

- **Authentication** — Google OAuth with email whitelist
- **Post Feed** — View ranked posts from Nextdoor
- **Search** — Keyword and semantic search
- **Ranking Sliders** — Adjust scoring weights
- **Pittsburgh Sports Facts** — Random facts for Matt on login!
