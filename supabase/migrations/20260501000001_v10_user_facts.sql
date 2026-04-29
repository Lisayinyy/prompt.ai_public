-- ============================================================
-- v10.1: user_facts — LLM 抽取的用户偏好事实
-- L5 信息密度: 从"标签级画像"升级到"语义级事实"
-- 例: top_tone="professional" (v8 标签) → "用户写邮件给客户偏正式但避免行话" (v10 事实)
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. user_facts 表
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact text NOT NULL CHECK (char_length(fact) BETWEEN 5 AND 300),
  confidence numeric NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  source_prompt_ids uuid[] NOT NULL DEFAULT '{}',
  task_type text,  -- NULL = 全局事实，非 NULL = task-specific
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS user_facts_user_extracted_idx
  ON public.user_facts (user_id, extracted_at DESC);
CREATE INDEX IF NOT EXISTS user_facts_user_task_idx
  ON public.user_facts (user_id, task_type, confidence DESC);

-- RLS
ALTER TABLE public.user_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own facts" ON public.user_facts;
CREATE POLICY "Users can view own facts"
  ON public.user_facts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own facts" ON public.user_facts;
CREATE POLICY "Users can insert own facts"
  ON public.user_facts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own facts" ON public.user_facts;
CREATE POLICY "Users can delete own facts"
  ON public.user_facts FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- 2. RPC: get_user_facts
--   返回该用户的高信号事实 (按 confidence × 时间衰减 排序)
--   60 天半衰期 — 老事实信心自然下降
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_facts(
  p_user_id uuid,
  p_task_type text DEFAULT NULL,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  fact text,
  confidence numeric,
  task_type text,
  extracted_at timestamptz
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
    p_limit := 8;
  END IF;
  IF p_limit > 20 THEN
    p_limit := 20;
  END IF;

  RETURN QUERY
  SELECT
    f.fact,
    f.confidence,
    f.task_type,
    f.extracted_at
  FROM public.user_facts f
  WHERE f.user_id = p_user_id
    AND f.confidence >= 0.5  -- 过滤低置信度噪音
    AND (p_task_type IS NULL OR f.task_type IS NULL OR f.task_type = p_task_type)
  ORDER BY
    -- 复合分: confidence × 60 天半衰期 + task-specific 加权
    (f.confidence
      * EXP(-EXTRACT(epoch FROM now() - f.extracted_at) / (86400.0 * 60))
      * CASE WHEN f.task_type = p_task_type THEN 1.5 ELSE 1.0 END
    ) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_facts(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_facts(uuid, text, int) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 3. RPC: add_user_facts
--   批量插入抽取出来的事实 (前端 worker 抽取后调用)
--   facts_json 形如:
--     [
--       {"fact": "用户是产品经理", "confidence": 0.85, "task_type": null},
--       {"fact": "邮件偏正式", "confidence": 0.7, "task_type": "邮件"}
--     ]
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_user_facts(
  p_facts jsonb,
  p_source_prompt_ids uuid[] DEFAULT '{}'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_inserted int := 0;
  v_fact_obj jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- 防爆: 单次最多写 20 条
  IF jsonb_array_length(p_facts) > 20 THEN
    RAISE EXCEPTION 'Too many facts in one batch (max 20)';
  END IF;

  FOR v_fact_obj IN SELECT * FROM jsonb_array_elements(p_facts) LOOP
    -- 跳过格式不合法的
    CONTINUE WHEN v_fact_obj->>'fact' IS NULL
                  OR char_length(v_fact_obj->>'fact') < 5
                  OR char_length(v_fact_obj->>'fact') > 300;

    INSERT INTO public.user_facts (
      user_id, fact, confidence, task_type, source_prompt_ids
    ) VALUES (
      v_user_id,
      v_fact_obj->>'fact',
      COALESCE((v_fact_obj->>'confidence')::numeric, 0.7),
      NULLIF(v_fact_obj->>'task_type', ''),
      p_source_prompt_ids
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_facts(jsonb, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_user_facts(jsonb, uuid[]) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 4. RPC: get_extraction_state
--   返回该用户当前的抽取进度,前端用来判断"要不要抽取"
--   - total_prompts: 该用户优化过的总 prompt 数
--   - last_extraction_at: 上次抽取时间
--   - facts_count: 已抽取的事实数
--   - prompts_since_last: 自上次抽取后新增的 prompt 数 (前端用这个 >= 10 触发新一轮)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_extraction_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_prompts int;
  v_last_extraction timestamptz;
  v_facts_count int;
  v_prompts_since int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('total_prompts', 0, 'facts_count', 0);
  END IF;

  SELECT COUNT(*) INTO v_total_prompts
  FROM public.prompts WHERE user_id = p_user_id;

  SELECT MAX(extracted_at), COUNT(*)
  INTO v_last_extraction, v_facts_count
  FROM public.user_facts WHERE user_id = p_user_id;

  IF v_last_extraction IS NULL THEN
    v_prompts_since := v_total_prompts;
  ELSE
    SELECT COUNT(*) INTO v_prompts_since
    FROM public.prompts
    WHERE user_id = p_user_id
      AND created_at > v_last_extraction;
  END IF;

  RETURN jsonb_build_object(
    'total_prompts', COALESCE(v_total_prompts, 0),
    'last_extraction_at', v_last_extraction,
    'facts_count', COALESCE(v_facts_count, 0),
    'prompts_since_last', COALESCE(v_prompts_since, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_extraction_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_extraction_state(uuid) TO authenticated;
