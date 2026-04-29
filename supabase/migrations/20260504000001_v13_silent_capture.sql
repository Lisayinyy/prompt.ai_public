-- ============================================================
-- v13.1: prompts 表加 source 列 + 索引
-- L8 跨平台融合的数据层支撑
-- silent_capture 表示 content.js 在 AI 平台 silent 抓的 prompt
-- (区别于用户在 prompt.ai 主动 optimize 的)
-- ============================================================

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'optimize';

-- CHECK 约束 (用 DO block 防重复添加报错)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prompts_source_check'
  ) THEN
    ALTER TABLE public.prompts
      ADD CONSTRAINT prompts_source_check
      CHECK (source IN ('optimize', 'silent_capture', 'manual'));
  END IF;
END $$;

-- 索引: 按 source 分类查询 (统计 silent_capture 数量等)
CREATE INDEX IF NOT EXISTS prompts_user_source_idx
  ON public.prompts (user_id, source, created_at DESC);

-- ───────────────────────────────────────────────────────────
-- RPC: get_prompt_source_breakdown
-- 返回该用户各 source 类型的 prompt 数量(给 MemoryPanel 显示)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_prompt_source_breakdown(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_optimize_count int;
  v_silent_count int;
  v_manual_count int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('optimize', 0, 'silent_capture', 0, 'manual', 0);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE source = 'optimize'),
    COUNT(*) FILTER (WHERE source = 'silent_capture'),
    COUNT(*) FILTER (WHERE source = 'manual')
  INTO v_optimize_count, v_silent_count, v_manual_count
  FROM public.prompts
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'optimize', COALESCE(v_optimize_count, 0),
    'silent_capture', COALESCE(v_silent_count, 0),
    'manual', COALESCE(v_manual_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_prompt_source_breakdown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_prompt_source_breakdown(uuid) TO authenticated;
