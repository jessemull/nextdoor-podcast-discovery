/** Supabase listFactors returns factors in data.all with factor_type and status (e.g. "verified" | "unverified"). */
export function getTotpFactorsFromListFactorsResponse(
  data: unknown
): { id: string; status?: string }[] {
  const all =
    (data as { all?: { factor_type?: string; id: string; status?: string }[] })
      ?.all ?? [];
  return all
    .filter((f) => f.factor_type === "totp")
    .map((f) => ({ id: f.id, status: f.status }));
}

/** Allow only same-origin paths for post-login redirect (prevent open redirect). */
export function getSafeReturnTo(returnTo: string | null): string {
  const path = (returnTo ?? "").trim() || "/";
  if (!path.startsWith("/") || path.includes("//")) {
    return "/admin";
  }
  if (path === "/") {
    return "/admin";
  }
  return path;
}

/** Supabase returns { code: "mfa_factor_name_conflict", message: "..." } */
export function isMfaFactorNameConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "mfa_factor_name_conflict" ||
    (typeof e.message === "string" &&
      e.message.includes("mfa_factor_name_conflict"))
  );
}
