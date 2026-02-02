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

Create a `.env.local` file and add your values:

```bash
touch .env.local
```

Required variables include:

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
└── public/               # Static assets
```

## Features

- **Authentication** — Google OAuth with email whitelist
- **Post Feed** — View ranked posts from Nextdoor
- **Search** — Keyword and semantic search
- **Ranking Sliders** — Adjust scoring weights
- **Pittsburgh Sports Facts** — Random facts for Matt on login!
