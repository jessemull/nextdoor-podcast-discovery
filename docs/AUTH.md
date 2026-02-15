# Auth flow (current)

How sign-in and protection work today.

---

## Step-through

1. **User hits the app**  
   Middleware (`middleware.ts`) runs. If the path is not `/login`, `api/auth`, or static assets, it checks for a **NextAuth session cookie**. No session → redirect to `/login`.

2. **User clicks “Sign in with Google”**  
   NextAuth sends them to Google OAuth. User signs in with Google (password, 2FA, etc.). Google redirects back to the app with an auth code.

3. **NextAuth `signIn` callback** (`lib/auth.ts`)  
   After Google confirms the user, NextAuth runs our `signIn` callback with `user.email`:
   - If `user.email` is missing → reject (return `false`).
   - **Whitelist check:** We read `ALLOWED_EMAILS` from the **environment** (one string, comma-separated, e.g. `"a@x.com,b@y.com"`). We split it, trim, and do `ALLOWED_EMAILS.includes(user.email)`.
   - If `ALLOWED_EMAILS` is empty (env not set or empty string), we **reject everyone** and log a warning at startup and on each rejected sign-in.
   - If the user’s email is not in that list → reject. Otherwise → allow; NextAuth creates a session.

4. **Session**  
   NextAuth sets a session cookie. Later requests send that cookie. Middleware and API routes use `getServerSession(authOptions)` to get the session; no second call to Google.

5. **Protected API routes**  
   Each protected route calls `getServerSession(authOptions)`. If `session == null` → 401 Unauthorized. If session exists → request is treated as authenticated (we don’t re-check the whitelist on every request; we only checked it at sign-in).

---

## Current whitelist (problem)

- **Source:** One env var, `ALLOWED_EMAILS`.
- **Format:** A single string of comma-separated email addresses, e.g. `ALLOWED_EMAILS=alice@example.com,bob@example.com`.
- **Effect:** Only those emails can sign in. Anyone else is rejected in the `signIn` callback.
- **Limitations:** No UI to manage users; adding/removing someone requires changing env and redeploying. Easy to misconfigure (typos, spaces, wrong env in an environment). No audit trail. See **Improvements §6** for a task to replace this.

---

## Env vars involved

| Variable           | Purpose                          |
|--------------------|----------------------------------|
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret    |
| `NEXTAUTH_SECRET`  | Encrypts the session cookie     |
| `NEXTAUTH_URL`     | App URL (e.g. `http://localhost:3000`) |
| `ALLOWED_EMAILS`   | Comma-separated list of emails that may sign in (optional in code but required in practice or nobody can sign in) |

`USER_EMAIL` / `NEXT_PUBLIC_USER_EMAIL` are separate (used for features like Pittsburgh sports fact), not for the whitelist.

---

## Alternatives to the env whitelist

### Option A: Google OAuth “Test users” (no code change to allow list)

- In **Google Cloud Console** → APIs & Services → **OAuth consent screen**, keep the app in **Testing** (don’t publish to Production).
- Add **Test users** by email (same place: “Test users” section). Only those Google accounts can complete sign-in; Google blocks everyone else before they reach our app.
- We can **remove** the `ALLOWED_EMAILS` check in `signIn` (or leave it as a no-op) and rely on Google’s list.
- **Limitations:** Max 100 test users; Google may show a “This app isn’t verified” / testing warning. Fine for internal or small team tools.

### Option B: Use Okta instead of Google

- NextAuth supports **Okta** as a provider (`next-auth/providers/okta`). You’d use Okta as the only provider (or alongside Google).
- In **Okta** you create an application and **assign users or groups** to it. Only those users can sign in; Okta enforces it. No env email list needed in our app.
- **Env:** `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `OKTA_ISSUER` (and callback `https://<your-domain>/api/auth/callback/okta` in Okta).
- Good fit if you already use Okta for identity and want to manage “who can use this app” there.
