-- ============================================================
-- v32: AI Response Capture — 给 prompts 加 ai_response_text 字段
-- 让 history 既能看到"你问了什么",也能看到"AI 答了什么"
-- (v32-G: ChatGPT + Claude 两家先支持)
-- ============================================================

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS ai_response_text text,
  ADD COLUMN IF NOT EXISTS ai_response_captured_at timestamptz;

CREATE INDEX IF NOT EXISTS prompts_response_captured_idx
  ON public.prompts (user_id, ai_response_captured_at DESC)
  WHERE ai_response_text IS NOT NULL;

COMMENT ON COLUMN public.prompts.ai_response_text IS
  'AI 助手的响应文本 (silent_capture v32-G,只 ChatGPT/Claude 已支持)';
COMMENT ON COLUMN public.prompts.ai_response_captured_at IS
  '响应采集完成时间 (用于"流式完成"判定 + 时序分析)';

-- ───────────────────────────────────────────────────────────
-- 升级 search_user_prompts 让它返回 ai_response_text + ai_response_captured_at
-- (保持函数签名不变,只扩展 RETURNS TABLE 字段)
-- ───────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.search_user_prompts(uuid, text, vector, text[], text[], int, int, boolean, uuid);

CREATE OR REPLACE FUNCTION public.search_user_prompts(
  p_user_id uuid,
  p_query text DEFAULT NULL,
  p_query_embedding vector(1024) DEFAULT NULL,
  p_platforms text[] DEFAULT NULL,
  p_task_types text[] DEFAULT NULL,
  p_days int DEFAULT 90,
  p_limit int DEFAULT 30,
  p_only_starred boolean DEFAULT false,
  p_project_id uuid DEFAULT NULL
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
  ai_response_text text,                  -- v32-G
  ai_response_captured_at timestamptz,    -- v32-G
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
    p.task_type, p.source, p.is_starred, p.project_id,
    p.ai_response_text, p.ai_response_captured_at,
    p.created_at,
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
      OR p.ai_response_text ILIKE '%' || p_query || '%'   -- v32-G: 响应文本也参与搜索
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

