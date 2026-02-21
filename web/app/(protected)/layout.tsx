import { auth0 } from "@/lib/auth0";

import type { AppRouterPageRoute } from "@auth0/nextjs-auth0/server";

// Layout receives { children, params }; SDK types expect page opts (params, searchParams). Cast inside.
const ProtectedLayout: AppRouterPageRoute = async (obj) => {
  const props = obj as { children: React.ReactNode };
  return <>{props.children}</>;
};

export default auth0.withPageAuthRequired(ProtectedLayout, { returnTo: "/" });
