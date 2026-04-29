-- ============================================================
-- v8.2: 时间衰减权重 (Time-decay Weighting)
-- 把 get_top_user_prompts 的排序加上 14 天半衰期的指数衰减
-- 让"最近的偏好"压过"很久之前的偏好"
-- 必须在 v8.1 之后跑（依赖 prompt_feedback 表）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_top_user_prompts(
  p_user_id uuid,
  p_task_type text,
  p_limit int DEFAULT 2
)
RETURNS TABLE (
  original_text text,
  optimized_text text,
  combined_score int,
  has_upvote boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 2;
  END IF;
  IF p_limit > 5 THEN
    p_limit := 5;
  END IF;

  RETURN QUERY
  WITH scored AS (
    SELECT
      p.original_text,
      p.optimized_text,
      COALESCE(p.score_clarity, 0)
        + COALESCE(p.score_specificity, 0)
        + COALESCE(p.score_structure, 0) AS combined_score,
      EXISTS (
        SELECT 1 FROM public.prompt_feedback pf
        WHERE pf.prompt_id = p.id AND pf.rating = 1
      ) AS has_upvote,
      -- v8.2 NEW: 14 天半衰期指数衰减
      -- 1209600 秒 = 14 天；今天的 prompt 权重=1.0，14 天前 ~0.5，28 天前 ~0.25
      EXP(-EXTRACT(epoch FROM now() - p.created_at) / 1209600.0) AS decay_weight
    FROM public.prompts p
    WHERE p.user_id = p_user_id
      AND p.task_type = p_task_type
      AND p.optimized_text IS NOT NULL
      AND char_length(p.optimized_text) BETWEEN 30 AND 1500
    ORDER BY p.created_at DESC
    LIMIT 50  -- 只看最近 50 条池子里挑
  )
  SELECT
    s.original_text,
    s.optimized_text,
    s.combined_score,
    s.has_upvote
  FROM scored s
  WHERE s.combined_score >= 240 OR s.has_upvote = true
  ORDER BY
    s.has_upvote DESC,
    -- v8.2 NEW: 综合分 × 时间衰减权重
    (s.combined_score * s.decay_weight) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_user_prompts(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_user_prompts(uuid, text, int) TO authenticated;
