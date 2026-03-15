/**
 * Podcast homepage at /podcast so it can be styled while / redirects to login.
 * Re-exports the same page that would render at / when the redirect is removed.
 */
export { default, metadata } from "../page";

export const revalidate = 60;
