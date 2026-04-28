-- ============================================================
-- v7.8: 用户级 × 任务级 风格记忆 (User-Task Style Memory)
-- 提供 2 个 RPC 给前端在每次 optimize 前拉取个体偏好画像
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- RPC 1: get_user_task_profile
--   返回该 (user_id, task_type) 的静态画像快照
--   仅基于该用户最近 30 条同 task_type 的记录聚合
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_task_profile(
  p_user_id uuid,
  p_task_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample_count int;
  v_top_tone text;
  v_avg_input_len numeric;
  v_avg_optimized_len numeric;
  v_up_count int;
  v_down_count int;
  v_up_rate numeric;
BEGIN
  -- 安全：仅允许本人查询
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('sample_count', 0);
  END IF;

  -- 取该用户最近 30 条同 task_type 记录的 id 集合
  WITH recent AS (
    SELECT id, original_text, optimized_text, tone
    FROM public.prompts
    WHERE user_id = p_user_id
      AND task_type = p_task_type
      AND optimized_text IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 30
  ),
  tone_mode AS (
    SELECT tone, COUNT(*) AS c
    FROM recent
    WHERE tone IS NOT NULL
    GROUP BY tone
    ORDER BY c DESC, tone ASC
    LIMIT 1
  )
  SELECT
    (SELECT COUNT(*) FROM recent),
    (SELECT tone FROM tone_mode),
    (SELECT AVG(char_length(original_text)) FROM recent),
    (SELECT AVG(char_length(optimized_text)) FROM recent)
  INTO v_sample_count, v_top_tone, v_avg_input_len, v_avg_optimized_len;

  -- 反馈赞踩比（限定在 recent 30 条之内）
  SELECT
    COUNT(*) FILTER (WHERE pf.rating = 1),
    COUNT(*) FILTER (WHERE pf.rating = -1)
  INTO v_up_count, v_down_count
  FROM public.prompt_feedback pf
  WHERE pf.user_id = p_user_id
    AND pf.prompt_id IN (
      SELECT id FROM public.prompts
      WHERE user_id = p_user_id
        AND task_type = p_task_type
      ORDER BY created_at DESC
      LIMIT 30
    );

  v_up_rate := CASE
    WHEN COALESCE(v_up_count, 0) + COALESCE(v_down_count, 0) = 0 THEN NULL
    ELSE ROUND(v_up_count::numeric / NULLIF(v_up_count + v_down_count, 0) * 100, 1)
  END;

  RETURN jsonb_build_object(
    'sample_count', COALESCE(v_sample_count, 0),
    'top_tone', v_top_tone,
    'avg_input_len', ROUND(COALESCE(v_avg_input_len, 0)),
    'avg_optimized_len', ROUND(COALESCE(v_avg_optimized_len, 0)),
    'up_rate', v_up_rate
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_task_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_task_profile(uuid, text) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- RPC 2: get_top_user_prompts
--   返回该 (user_id, task_type) 下评分最高的 N 条
--   优先：clarity+specificity+structure >= 240 (满分300, 80%+)
--   次优：被点过赞的
--   按综合分倒序取 top N
-- ───────────────────────────────────────────────────────────
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
      ) AS has_upvote
    FROM public.prompts p
    WHERE p.user_id = p_user_id
      AND p.task_type = p_task_type
      AND p.optimized_text IS NOT NULL
      AND char_length(p.optimized_text) BETWEEN 30 AND 1500
    ORDER BY p.created_at DESC
    LIMIT 50  -- 只看最近50条池子里挑
  )
  SELECT
    s.original_text,
    s.optimized_text,
    s.combined_score,
    s.has_upvote
  FROM scored s
  WHERE s.combined_score >= 240 OR s.has_upvote = true
  ORDER BY s.has_upvote DESC, s.combined_score DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_user_prompts(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_user_prompts(uuid, text, int) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 索引：加速 (user_id, task_type, created_at) 查询
-- ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS prompts_user_task_created_idx
  ON public.prompts (user_id, task_type, created_at DESC);

CREATE INDEX IF NOT EXISTS prompt_feedback_prompt_idx
  ON public.prompt_feedback (prompt_id, rating);
