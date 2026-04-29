-- ============================================================
-- v9.2: 语义检索 RPC (Semantic Few-shot Retrieval)
-- 替代 v8.2 的纯 score-based 检索
-- 综合排序：cosine 相似度 × score × 时间衰减 + upvote 加权
-- 必须在 v9.1 之后跑（依赖 prompts.embedding 列 + HNSW 索引）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_top_user_prompts_semantic(
  p_user_id uuid,
  p_task_type text,
  p_query_embedding vector(1536),
  p_limit int DEFAULT 2
)
RETURNS TABLE (
  original_text text,
  optimized_text text,
  combined_score int,
  has_upvote boolean,
  similarity numeric
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
  WITH candidates AS (
    -- 第一关：语义粗筛 (HNSW 加速) + 强制本人本任务
    -- 取最近的 30 条候选（按 cosine 距离）作为打分池
    SELECT
      p.id,
      p.original_text,
      p.optimized_text,
      p.created_at,
      COALESCE(p.score_clarity, 0)
        + COALESCE(p.score_specificity, 0)
        + COALESCE(p.score_structure, 0) AS combined_score,
      -- cosine similarity = 1 - cosine_distance (操作符 <=>)
      (1 - (p.embedding <=> p_query_embedding))::numeric AS similarity
    FROM public.prompts p
    WHERE p.user_id = p_user_id
      AND p.task_type = p_task_type
      AND p.optimized_text IS NOT NULL
      AND p.embedding IS NOT NULL
      AND char_length(p.optimized_text) BETWEEN 30 AND 1500
    ORDER BY p.embedding <=> p_query_embedding ASC  -- 最近邻优先
    LIMIT 30
  ),
  scored AS (
    -- 第二关：复合打分 (semantic × quality × recency × upvote)
    SELECT
      c.original_text,
      c.optimized_text,
      c.combined_score,
      EXISTS (
        SELECT 1 FROM public.prompt_feedback pf
        WHERE pf.prompt_id = c.id AND pf.rating = 1
      ) AS has_upvote,
      c.similarity,
      -- v8.2 的 14 天半衰期还在
      EXP(-EXTRACT(epoch FROM now() - c.created_at) / 1209600.0) AS decay_weight
    FROM candidates c
  )
  SELECT
    s.original_text,
    s.optimized_text,
    s.combined_score,
    s.has_upvote,
    s.similarity
  FROM scored s
  -- 准入门槛：要么有点赞、要么质量分够、要么语义相似度够
  WHERE s.has_upvote = true
     OR s.combined_score >= 240
     OR s.similarity >= 0.7
  ORDER BY
    s.has_upvote DESC,
    -- 最终分 = 相似度 × 归一化质量分 × 时间衰减
    -- 满分 1.0 × 1.0 × 1.0 = 1.0；典型样本 0.7 × 0.7 × 0.7 ≈ 0.34
    (s.similarity * (s.combined_score::numeric / 300.0) * s.decay_weight) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_user_prompts_semantic(uuid, text, vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_user_prompts_semantic(uuid, text, vector, int) TO authenticated;
