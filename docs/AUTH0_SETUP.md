# Auth0 setup

Manual steps to configure Auth0 and connect it to the Nextdoor Discovery app.

---

## 1. Create an Auth0 application

1. Log in to the [Auth0 Dashboard](https://manage.auth0.com/).
2. Go to **Applications** → **Applications** → **Create Application**.
3. Choose **Regular Web Application**.
4. **Name:** e.g. "Nextdoor Discovery".
5. Click **Create**.

---

## 2. Configure URLs

1. Open the application → **Settings**.
2. **Allowed Callback URLs:** Add  
   - `http://localhost:3000/auth/callback` (for local development)  
   - When you deploy: `https://your-production-domain.com/auth/callback`
3. **Allowed Logout URLs:** Add  
   - `http://localhost:3000`  
   - When you deploy: `https://your-production-domain.com`
4. Save changes.

---

## 3. Copy credentials

From the application **Settings** tab:

| Value | Use as env var |
|-------|----------------|
| **Domain** | `AUTH0_DOMAIN` (e.g. `dev-xxx.us.auth0.com`) |
| **Client ID** | `AUTH0_CLIENT_ID` |
| **Client secret** (show) | `AUTH0_CLIENT_SECRET` |

Generate a random secret for session encryption (e.g. `openssl rand -hex 32`) and use it as `AUTH0_SECRET`.

---

## 4. Set environment variables

**Local (`web/.env.local`):**

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SECRET=your-random-32-char-secret
APP_BASE_URL=http://localhost:3000
```

**Production (e.g. Vercel):**

1. In the Auth0 app, add your production callback and logout URLs (see step 2).
2. In the host’s **Environment Variables**, add the same variables with production values.
3. Set `APP_BASE_URL` to your production URL (e.g. `https://your-app.vercel.app`).
4. Redeploy so the new env vars are used.

---

## 5. Verify

1. Start the app: `make dev-web` (or `cd web && npm run dev`).
2. Open `http://localhost:3000` in an incognito window.
3. You should be redirected to the login page.
4. Click "Sign in with Auth0" and sign in with a user from your Auth0 tenant.
5. You should be redirected back and see the dashboard.
