-- ============================================================
-- v8.3: 用户画像缓存 (Profile Cache)
-- get_user_task_profile 现在每次都全量聚合 30 行 → 高频时浪费
-- 改造：cache 表 + 5 分钟 TTL + 写入 trigger 自动失效
-- 期望：RPC 延迟 ~50ms → ~2ms
-- 必须在 v8.1 之后跑（_compute_user_task_profile 依赖 prompt_feedback）
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. 缓存表
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_task_profile_cache (
  user_id uuid NOT NULL,
  task_type text NOT NULL,
  profile jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_type)
);

CREATE INDEX IF NOT EXISTS user_task_profile_cache_updated_idx
  ON public.user_task_profile_cache (updated_at);

ALTER TABLE public.user_task_profile_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile cache" ON public.user_task_profile_cache;
CREATE POLICY "Users can view own profile cache"
  ON public.user_task_profile_cache FOR SELECT
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- 2. 内部函数：全量重算 profile（不暴露给前端）
--   (从 v7.8 的 get_user_task_profile 计算逻辑提取出来)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compute_user_task_profile(
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

REVOKE ALL ON FUNCTION public._compute_user_task_profile(uuid, text) FROM PUBLIC;

-- ───────────────────────────────────────────────────────────
-- 3. 公开 RPC：get_user_task_profile
--   先读 cache，cache miss 或过期（5 分钟）则全量重算并写回
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
  v_cached jsonb;
  v_updated_at timestamptz;
  v_fresh jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('sample_count', 0);
  END IF;

  -- 先尝试读 cache
  SELECT profile, updated_at
  INTO v_cached, v_updated_at
  FROM public.user_task_profile_cache
  WHERE user_id = p_user_id AND task_type = p_task_type;

  -- cache 命中 + 未过期（5 分钟 TTL）
  IF v_cached IS NOT NULL AND v_updated_at > now() - interval '5 minutes' THEN
    RETURN v_cached;
  END IF;

  -- 重算
  v_fresh := public._compute_user_task_profile(p_user_id, p_task_type);

  -- 写回 cache（upsert）
  INSERT INTO public.user_task_profile_cache (user_id, task_type, profile, updated_at)
  VALUES (p_user_id, p_task_type, v_fresh, now())
  ON CONFLICT (user_id, task_type)
  DO UPDATE SET
    profile = EXCLUDED.profile,
    updated_at = EXCLUDED.updated_at;

  RETURN v_fresh;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_task_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_task_profile(uuid, text) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 4. Trigger：prompts 写入时让 cache 过期（不重算，只标记失效）
--   下次调 get_user_task_profile 时会自动重算
--   这样写入路径不阻塞，cache 重算开销摊到读路径
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._invalidate_profile_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_task_profile_cache
  SET updated_at = '1970-01-01'::timestamptz
  WHERE user_id = NEW.user_id
    AND task_type = NEW.task_type;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prompts_invalidate_profile_cache ON public.prompts;
CREATE TRIGGER prompts_invalidate_profile_cache
AFTER INSERT OR UPDATE ON public.prompts
FOR EACH ROW
EXECUTE FUNCTION public._invalidate_profile_cache();

-- 同理：prompt_feedback 写入也要让对应 cache 过期
CREATE OR REPLACE FUNCTION public._invalidate_profile_cache_from_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_type text;
BEGIN
  SELECT task_type INTO v_task_type
  FROM public.prompts
  WHERE id = NEW.prompt_id;

  IF v_task_type IS NOT NULL THEN
    UPDATE public.user_task_profile_cache
    SET updated_at = '1970-01-01'::timestamptz
    WHERE user_id = NEW.user_id
      AND task_type = v_task_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prompt_feedback_invalidate_profile_cache ON public.prompt_feedback;
CREATE TRIGGER prompt_feedback_invalidate_profile_cache
AFTER INSERT ON public.prompt_feedback
FOR EACH ROW
EXECUTE FUNCTION public._invalidate_profile_cache_from_feedback();
