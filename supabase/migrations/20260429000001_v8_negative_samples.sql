-- ============================================================
-- v8.1: 反向样本学习 (Negative Sample Learning)
-- 让 LLM 知道"用户曾经明确不喜欢什么样的优化"
-- 自包含：兜底建 prompt_feedback 表 + 新 RPC get_user_recent_dislikes
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. 兜底建 prompt_feedback 表（前端早就在写，但表可能没建）
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prompt_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.prompt_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.prompt_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.prompt_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.prompt_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS prompt_feedback_user_idx
  ON public.prompt_feedback (user_id);

CREATE INDEX IF NOT EXISTS prompt_feedback_prompt_idx
  ON public.prompt_feedback (prompt_id, rating);

-- ───────────────────────────────────────────────────────────
-- 2. v7.8 索引兜底（如果之前 transaction 回滚没建）
-- ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS prompts_user_task_created_idx
  ON public.prompts (user_id, task_type, created_at DESC);

-- ───────────────────────────────────────────────────────────
-- 3. 新 RPC: get_user_recent_dislikes
--   返回该 (user_id, task_type) 下最近 N 条被 thumbs-down 的 (raw, optimized) pair
--   用于在 system prompt 里告诉 LLM"这些风格用户明确不喜欢，不要复制"
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_recent_dislikes(
  p_user_id uuid,
  p_task_type text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  original_text text,
  optimized_text text,
  disliked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 安全：仅允许本人查询
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 5;
  END IF;
  IF p_limit > 10 THEN
    p_limit := 10;
  END IF;

  RETURN QUERY
  SELECT
    p.original_text,
    p.optimized_text,
    pf.created_at AS disliked_at
  FROM public.prompt_feedback pf
  JOIN public.prompts p ON p.id = pf.prompt_id
  WHERE pf.user_id = p_user_id
    AND pf.rating = -1
    AND p.task_type = p_task_type
    AND p.optimized_text IS NOT NULL
    AND char_length(p.optimized_text) BETWEEN 20 AND 1500
  ORDER BY pf.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_recent_dislikes(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_recent_dislikes(uuid, text, int) TO authenticated;
