-- ============================================================
-- v9.1: pgvector 启用 + embedding 列
-- 启用 pgvector 扩展，给 prompts 表加 embedding 列
-- 选用 text-embedding-3-small (1536 维) — 多语言、便宜、稳定
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. 启用 pgvector 扩展（Supabase 默认支持，免开通）
-- ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ───────────────────────────────────────────────────────────
-- 2. 给 prompts 加 embedding 列
-- vector(1536) 对应 text-embedding-3-small 输出维度
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ───────────────────────────────────────────────────────────
-- 3. HNSW 索引（cosine 距离）
--   为什么用 HNSW 而非 ivfflat:
--     - HNSW 不需要预训练，新数据立即可用
--     - 召回率更高（牺牲一点写入速度）
--     - Supabase 原生支持
--   注意：HNSW 索引会在 prompts 表写入时增量更新
-- ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS prompts_embedding_hnsw_idx
  ON public.prompts
  USING hnsw (embedding vector_cosine_ops);

-- ───────────────────────────────────────────────────────────
-- 4. Helper RPC: set_prompt_embedding
--   前端在 optimize 完成后调用，把刚算出的 embedding 写回对应 prompt 行
--   仅允许更新自己的记录（auth.uid() 校验）
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_prompt_embedding(
  p_prompt_id uuid,
  p_embedding vector(1536)
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
