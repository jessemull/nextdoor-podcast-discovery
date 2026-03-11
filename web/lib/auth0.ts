import { Auth0Client } from "@auth0/nextjs-auth0/server";

const isProduction = process.env.NODE_ENV === "production";
const appBaseUrl =
  process.env.APP_BASE_URL ||
  (isProduction ? undefined : "http://localhost:3000");

/** Auth0 client. Admin = any authenticated user (Auth0); no server-side role check. */
export const auth0 = new Auth0Client({
  appBaseUrl,
  authorizationParameters: { screen_hint: "login" },
  session: {
    cookie: {
      path: "/",
      sameSite: "strict",
      secure: isProduction,
    },
    rolling: true,
  },
  transactionCookie: {
    sameSite: "lax",
    secure: isProduction,
  },
});
