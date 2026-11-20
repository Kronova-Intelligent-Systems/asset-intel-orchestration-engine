-- match_embeddings filters by user_id on top of an IVFFlat index (lists = 100).
-- With the default ivfflat.probes = 1 only the nearest list is scanned, so most of a
-- user's rows can be skipped and good matches never come back.
-- Probing every list makes the search exact. At this table size that is cheap; when the
-- table grows into the hundreds of thousands of rows, move to an HNSW index with
-- iterative scans instead of raising probes further.
-- ALTER FUNCTION ... SET ivfflat.probes is not permitted for this role, so the setting
-- is applied transaction-locally inside the function body.
CREATE OR REPLACE FUNCTION public.match_embeddings(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  user_id uuid
)
RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM set_config('ivfflat.probes', '100', true);
  RETURN QUERY
  SELECT
    e.id,
    e.metadata->>'content',
    e.metadata,
    1 - (e.vector_data <=> query_embedding)
  FROM data_embeddings e
  WHERE e.user_id = match_embeddings.user_id
    AND 1 - (e.vector_data <=> query_embedding) > match_threshold
  ORDER BY e.vector_data <=> query_embedding
  LIMIT match_count;
END;
$function$;
