-- Migration: Fix "type public.vector does not exist" when inserting into post_embeddings via API
-- Run after 045_vector_extension_in_extensions_schema.sql.
--
-- After moving the vector extension to the extensions schema, the column type
-- is still the same OID but introspection/PostgREST may still reference public.vector.
-- Explicitly set the column type to extensions.vector(1536) so API inserts work.

ALTER TABLE post_embeddings
  ALTER COLUMN embedding TYPE extensions.vector(1536) USING embedding::extensions.vector(1536);

NOTIFY pgrst, 'reload schema';
