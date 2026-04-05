-- Supabase Security Advisor: Function Search Path Mutable (get_score_distribution)
-- Safe if 067 already included SET search_path (ALTER is idempotent for same value).

ALTER FUNCTION public.get_score_distribution() SET search_path = public;
