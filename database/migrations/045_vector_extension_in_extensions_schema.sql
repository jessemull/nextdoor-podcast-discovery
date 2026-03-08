-- Migration: Move vector extension to extensions schema (fix "Extension in Public" warning)
-- Run in Supabase SQL Editor.
--
-- Supabase Security Advisor flags extensions in public. Moving vector to a
-- dedicated schema satisfies the linter. Existing tables/functions that use
-- the vector type continue to work (type OID unchanged).

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION vector SET SCHEMA extensions;
