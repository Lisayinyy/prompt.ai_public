-- ============================================================
-- v26: prompts 收藏夹 + 历史搜索加 only_starred filter
-- 让用户能"⭐"标记爱用的 prompt + 快速过滤
-- ============================================================

-- 1. prompts 表加 is_starred 列
ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

-- 2. 部分索引 (只索引 starred=true 的,扫描快)
CREATE INDEX IF NOT EXISTS prompts_user_starred_idx
  ON public.prompts (user_id, created_at DESC)
  WHERE is_starred = true;

-- 3. RPC: toggle_prompt_star(prompt_id) → 切换标记 + 返回新状态
CREATE OR REPLACE FUNCTION public.toggle_prompt_star(p_prompt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_new_state boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  UPDATE public.prompts
  SET is_starred = NOT COALESCE(is_starred, false)
  WHERE id = p_prompt_id AND user_id = v_user_id
  RETURNING is_starred INTO v_new_state;

  RETURN COALESCE(v_new_state, false);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_prompt_star(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_prompt_star(uuid) TO authenticated;

-- 4. 升级 search_user_prompts 加 p_only_starred + p_project_id 两个新 filter
CREATE OR REPLACE FUNCTION public.search_user_prompts(
  p_user_id uuid,
  p_query text DEFAULT NULL,
  p_query_embedding vector(1024) DEFAULT NULL,
  p_platforms text[] DEFAULT NULL,
  p_task_types text[] DEFAULT NULL,
  p_days int DEFAULT 90,
  p_limit int DEFAULT 30,
  p_only_starred boolean DEFAULT false,
  p_project_id uuid DEFAULT NULL  -- NULL = all, 'unassigned' 用 zero uuid 太丑改用单独逻辑
)
RETURNS TABLE (
  id uuid,
  original_text text,
  optimized_text text,
  platform text,
  task_type text,
  source text,
  is_starred boolean,
  project_id uuid,
  created_at timestamptz,
  similarity numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RETURN; END IF;

  IF p_days IS NULL OR p_days < 1 THEN p_days := 90; END IF;
  IF p_days > 365 THEN p_days := 365; END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 30; END IF;
  IF p_limit > 100 THEN p_limit := 100; END IF;

  v_since := now() - (p_days || ' days')::interval;

  RETURN QUERY
  SELECT
    p.id, p.original_text, p.optimized_text, p.platform,
    p.task_type, p.source, p.is_starred, p.project_id, p.created_at,
    CASE
      WHEN p_query_embedding IS NOT NULL AND p.embedding IS NOT NULL
        THEN (1 - (p.embedding <=> p_query_embedding))::numeric
      ELSE 0::numeric
    END AS similarity
  FROM public.prompts p
  WHERE p.user_id = p_user_id
    AND p.created_at >= v_since
    AND (
      p_query IS NULL OR p_query = ''
      OR p.original_text ILIKE '%' || p_query || '%'
      OR p.optimized_text ILIKE '%' || p_query || '%'
    )
    AND (
      p_platforms IS NULL OR cardinality(p_platforms) = 0
      OR p.platform = ANY(p_platforms)
    )
    AND (
      p_task_types IS NULL OR cardinality(p_task_types) = 0
      OR p.task_type = ANY(p_task_types)
    )
    AND (NOT p_only_starred OR p.is_starred = true)
    AND (p_project_id IS NULL OR p.project_id = p_project_id)
  ORDER BY
    CASE
      WHEN p_query_embedding IS NOT NULL AND p.embedding IS NOT NULL
        THEN -(1 - (p.embedding <=> p_query_embedding))
      ELSE 0
    END,
    p.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_user_prompts(uuid, text, vector, text[], text[], int, int, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_user_prompts(uuid, text, vector, text[], text[], int, int, boolean, uuid) TO authenticated;
