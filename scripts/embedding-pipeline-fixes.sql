-- Fixes for the import -> embeddings -> learning layer pipeline.

-- 1. match_embeddings raised 42702 (ambiguous "user_id"): the parameter name collided
--    with the column. Qualify both sides; the signature is unchanged so callers keep working.
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

-- 2. Allow imported datasets to be stored in the learning layer next to agent/workflow runs.
ALTER TABLE public.asset_intelligence_learning
  DROP CONSTRAINT IF EXISTS asset_intelligence_learning_execution_type_check;
ALTER TABLE public.asset_intelligence_learning
  ADD CONSTRAINT asset_intelligence_learning_execution_type_check
  CHECK (execution_type = ANY (ARRAY['agent'::text, 'workflow'::text, 'dataset'::text]));
