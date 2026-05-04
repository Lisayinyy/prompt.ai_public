-- ============================================================
-- v28: suggest_projects_for_prompt — 自动项目归类建议
-- 基于 embedding 相似度,从用户已有项目里找最匹配的几个
-- 不需要 LLM 调用 (零额外 token 成本) + 实时
-- ============================================================

CREATE OR REPLACE FUNCTION public.suggest_projects_for_prompt(
  p_user_id uuid,
  p_query_embedding vector(1024),
  p_limit int DEFAULT 3,
  p_min_similarity numeric DEFAULT 0.5
)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  project_color text,
  max_similarity numeric,
  prompt_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  IF p_query_embedding IS NULL THEN RETURN; END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 3; END IF;
  IF p_limit > 10 THEN p_limit := 10; END IF;

  IF p_min_similarity IS NULL OR p_min_similarity < 0 THEN p_min_similarity := 0.5; END IF;
  IF p_min_similarity > 1 THEN p_min_similarity := 1; END IF;

  RETURN QUERY
  WITH project_sim AS (
    SELECT
      pr.project_id,
      MAX(1 - (pr.embedding <=> p_query_embedding))::numeric AS max_sim,
      COUNT(*)::bigint AS pc
    FROM public.prompts pr
    WHERE pr.user_id = p_user_id
      AND pr.project_id IS NOT NULL
      AND pr.embedding IS NOT NULL
    GROUP BY pr.project_id
  )
  SELECT
    proj.id AS project_id,
    proj.name AS project_name,
    proj.color AS project_color,
    ps.max_sim AS max_similarity,
    ps.pc AS prompt_count
  FROM project_sim ps
  JOIN public.projects proj ON proj.id = ps.project_id
  WHERE proj.user_id = p_user_id
    AND ps.max_sim >= p_min_similarity
  ORDER BY ps.max_sim DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_projects_for_prompt(uuid, vector, int, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_projects_for_prompt(uuid, vector, int, numeric) TO authenticated;
