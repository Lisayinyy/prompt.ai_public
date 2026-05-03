-- ============================================================
-- v24.1: search_user_prompts RPC
-- 跨 AI 平台 prompt 智能搜索 (关键词 + 语义 + 多 filter)
-- 是新方向"项目工作台 + 知识库"的基石功能
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_user_prompts(
  p_user_id uuid,
  p_query text DEFAULT NULL,                -- 模糊匹配关键词
  p_query_embedding vector(1024) DEFAULT NULL, -- 语义检索 embedding
  p_platforms text[] DEFAULT NULL,          -- 平台 filter (NULL = all)
  p_task_types text[] DEFAULT NULL,         -- 任务 filter
  p_days int DEFAULT 90,                    -- 时间窗口(天)
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  original_text text,
  optimized_text text,
  platform text,
  task_type text,
  source text,
  created_at timestamptz,
  similarity numeric  -- 0~1, 仅当 embedding 提供时有意义,否则为 0
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  IF p_days IS NULL OR p_days < 1 THEN p_days := 90; END IF;
  IF p_days > 365 THEN p_days := 365; END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 30; END IF;
  IF p_limit > 100 THEN p_limit := 100; END IF;

  v_since := now() - (p_days || ' days')::interval;

  -- 模糊匹配 wildcard (PostgREST 不支持直接 ILIKE 参数化,这里手动包装)
  RETURN QUERY
  SELECT
    p.id,
    p.original_text,
    p.optimized_text,
    p.platform,
    p.task_type,
    p.source,
    p.created_at,
    CASE
      WHEN p_query_embedding IS NOT NULL AND p.embedding IS NOT NULL
        THEN (1 - (p.embedding <=> p_query_embedding))::numeric
      ELSE 0::numeric
    END AS similarity
  FROM public.prompts p
  WHERE p.user_id = p_user_id
    AND p.created_at >= v_since
    -- 关键词模糊匹配 (任一字段命中即可)
    AND (
      p_query IS NULL
      OR p_query = ''
      OR p.original_text ILIKE '%' || p_query || '%'
      OR p.optimized_text ILIKE '%' || p_query || '%'
    )
    -- 平台 filter
    AND (
      p_platforms IS NULL
      OR cardinality(p_platforms) = 0
      OR p.platform = ANY(p_platforms)
    )
    -- task filter
    AND (
      p_task_types IS NULL
      OR cardinality(p_task_types) = 0
      OR p.task_type = ANY(p_task_types)
    )
  ORDER BY
    -- 有 embedding 时按相似度优先,否则按时间
    CASE
      WHEN p_query_embedding IS NOT NULL AND p.embedding IS NOT NULL
        THEN -(1 - (p.embedding <=> p_query_embedding))
      ELSE 0
    END,
    p.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_user_prompts(uuid, text, vector, text[], text[], int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_user_prompts(uuid, text, vector, text[], text[], int, int) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 辅助 RPC: 拿用户用过的所有 platform / task_type 列表 (给 UI filter chips)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_prompt_facets(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platforms jsonb;
  v_tasks jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('platforms', '[]'::jsonb, 'task_types', '[]'::jsonb);
  END IF;

  -- 平台列表 (按使用次数倒序)
  SELECT jsonb_agg(jsonb_build_object('value', platform, 'count', cnt) ORDER BY cnt DESC)
  INTO v_platforms
  FROM (
    SELECT platform, COUNT(*) AS cnt
    FROM public.prompts
    WHERE user_id = p_user_id AND platform IS NOT NULL AND platform <> ''
    GROUP BY platform
    LIMIT 12
  ) sub;

  -- 任务列表
  SELECT jsonb_agg(jsonb_build_object('value', task_type, 'count', cnt) ORDER BY cnt DESC)
  INTO v_tasks
  FROM (
    SELECT task_type, COUNT(*) AS cnt
    FROM public.prompts
    WHERE user_id = p_user_id AND task_type IS NOT NULL AND task_type <> ''
    GROUP BY task_type
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'platforms', COALESCE(v_platforms, '[]'::jsonb),
    'task_types', COALESCE(v_tasks, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_prompt_facets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_prompt_facets(uuid) TO authenticated;
