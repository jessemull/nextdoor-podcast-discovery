import { auth0 } from "@/lib/auth0";

export default auth0.withPageAuthRequired(
  async function ProtectedLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <>{children}</>;
  },
  { returnTo: "/" },
);
