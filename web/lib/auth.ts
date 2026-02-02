import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Allowed emails - add users here
const ALLOWED_EMAILS = [
  process.env.ALLOWED_EMAIL_1,
  process.env.MATT_EMAIL, // Matt gets Pittsburgh sports facts!
].filter(Boolean) as string[];

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow whitelisted emails
      if (!user.email) return false;
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
