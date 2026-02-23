import { Auth0Client } from "@auth0/nextjs-auth0/server";

/** Auth0 client. Admin = any authenticated user (Auth0); no server-side role check. */
export const auth0 = new Auth0Client({
  authorizationParameters: { screen_hint: "login" },
  session: { rolling: true },
});
