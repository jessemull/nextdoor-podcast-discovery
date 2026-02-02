import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { env } from "./env";

// Allowed emails - add users here
const ALLOWED_EMAILS = [
  env.ALLOWED_EMAIL_1,
  env.MATT_EMAIL,
].filter(Boolean) as string[];

// Warn if no users are whitelisted
if (ALLOWED_EMAILS.length === 0) {
  console.warn(
    "⚠️  WARNING: No allowed emails configured. " +
    "Set ALLOWED_EMAIL_1 or MATT_EMAIL environment variables to allow sign-in."
  );
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow whitelisted emails
      if (!user.email) return false;
      
      // If no emails configured, reject all (with a helpful message logged above)
      if (ALLOWED_EMAILS.length === 0) {
        console.error("Sign-in rejected: No allowed emails configured");
        return false;
      }
      
      return ALLOWED_EMAILS.includes(user.email);
    },
    async session({ session, token }) {
      // Add user email to session for easy access
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
