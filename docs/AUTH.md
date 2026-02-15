# Auth flow (Auth0)

How sign-in and protection work.

---

## Step-through

1. **User hits the app**  
   Middleware runs. If the path is not `/login` or static assets, it checks for an Auth0 session. No session → redirect to `/auth/login`.

2. **User clicks "Sign in with Auth0"** (on `/login` page) or is redirected to `/auth/login`  
   Auth0 SDK handles `/auth/login` and redirects the user to Auth0. The user signs in with their Auth0 credentials (or IdP linked to Auth0). Auth0 redirects back to the app at `/auth/callback`.

3. **Auth0 callback**  
   The SDK exchanges the auth code for tokens and creates a session. The user is redirected to the app (e.g. home or the page they tried to access).

4. **Session**  
   Auth0 stores the session in a cookie. The middleware and API routes use `auth0.getSession()` to check authentication.

5. **Protected API routes**  
   Each protected route calls `auth0.getSession()`. If `session?.user` is null → 401 Unauthorized. If session exists → request is treated as authenticated.

**Who can sign in:** Managed in the Auth0 Dashboard. Configure Connections (e.g. Username-Password, Google) and optionally use Rules or Actions to restrict by email, domain, or other claims. No env-based whitelist in the app.

---

## Env vars involved

| Variable             | Purpose                                |
|----------------------|----------------------------------------|
| `AUTH0_DOMAIN`       | Auth0 tenant domain (e.g. `your-tenant.us.auth0.com`) |
| `AUTH0_CLIENT_ID`    | Auth0 application client ID            |
| `AUTH0_CLIENT_SECRET`| Auth0 application client secret        |
| `AUTH0_SECRET`       | Random secret for session encryption |
| `APP_BASE_URL`       | App URL (e.g. `http://localhost:3000`) |

`USER_EMAIL` / `NEXT_PUBLIC_USER_EMAIL` are separate (used for features like Pittsburgh sports fact), not for access control.
