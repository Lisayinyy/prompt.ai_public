-- ============================================================
-- v9.3: 切换 embedding 提供商 OpenAI → Cloudflare bge-m3
-- 维度从 1536 降到 1024（bge-m3 标准维度）
-- 由于尚未 backfill 任何数据，DROP + 重建是无损的
-- ============================================================

-- 1. 先删旧 HNSW 索引（依赖于即将被删的列）
DROP INDEX IF EXISTS public.prompts_embedding_hnsw_idx;

-- 2. 删旧 vector(1536) 列 + 重建为 vector(1024)
ALTER TABLE public.prompts DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.prompts ADD COLUMN embedding vector(1024);

-- 3. 重建 HNSW 索引
CREATE INDEX prompts_embedding_hnsw_idx
  ON public.prompts
  USING hnsw (embedding vector_cosine_ops);

-- 4. 删旧 vector(1536) 签名的函数（PG 函数支持重载，不显式 DROP 会留下死代码）
DROP FUNCTION IF EXISTS public.set_prompt_embedding(uuid, vector(1536));
DROP FUNCTION IF EXISTS public.get_top_user_prompts_semantic(uuid, text, vector(1536), int);

-- 5. 重新定义 set_prompt_embedding (vector 1024)
CREATE OR REPLACE FUNCTION public.set_prompt_embedding(
  p_prompt_id uuid,
  p_embedding vector(1024)
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.prompts
  SET embedding = p_embedding
  WHERE id = p_prompt_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_prompt_embedding(uuid, vector) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_prompt_embedding(uuid, vector) TO authenticated;

-- 6. 重新定义 get_top_user_prompts_semantic (vector 1024)
CREATE OR REPLACE FUNCTION public.get_top_user_prompts_semantic(
  p_user_id uuid,
  p_task_type text,
  p_query_embedding vector(1024),
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
    SELECT
      p.id,
      p.original_text,
      p.optimized_text,
      p.created_at,
      COALESCE(p.score_clarity, 0)
        + COALESCE(p.score_specificity, 0)
        + COALESCE(p.score_structure, 0) AS combined_score,
      (1 - (p.embedding <=> p_query_embedding))::numeric AS similarity
    FROM public.prompts p
    WHERE p.user_id = p_user_id
      AND p.task_type = p_task_type
      AND p.optimized_text IS NOT NULL
      AND p.embedding IS NOT NULL
      AND char_length(p.optimized_text) BETWEEN 30 AND 1500
    ORDER BY p.embedding <=> p_query_embedding ASC
    LIMIT 30
  ),
  scored AS (
    SELECT
      c.original_text,
      c.optimized_text,
      c.combined_score,
      EXISTS (
        SELECT 1 FROM public.prompt_feedback pf
        WHERE pf.prompt_id = c.id AND pf.rating = 1
      ) AS has_upvote,
      c.similarity,
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
  WHERE s.has_upvote = true
     OR s.combined_score >= 240
     OR s.similarity >= 0.7
  ORDER BY
    s.has_upvote DESC,
    (s.similarity * (s.combined_score::numeric / 300.0) * s.decay_weight) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_user_prompts_semantic(uuid, text, vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_user_prompts_semantic(uuid, text, vector, int) TO authenticated;
