-- ============================================================
-- v14.1: get_user_platform_breakdown RPC
-- 给 Memory Dashboard 的 "🌍 跨平台使用全景" 板块供数据
-- 返回: 该用户在各 AI 平台的 prompt 数 + 最后使用时间 + 占比
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_platform_breakdown(
  p_user_id uuid,
  p_days int DEFAULT 90
)
RETURNS TABLE (
  platform text,
  count bigint,
  last_used_at timestamptz,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_since timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  -- 防御参数
  IF p_days IS NULL OR p_days < 1 THEN p_days := 90; END IF;
  IF p_days > 365 THEN p_days := 365; END IF;

  v_since := now() - (p_days || ' days')::interval;

  -- 先算 total (用于 percentage 计算)
  SELECT COUNT(*) INTO v_total
  FROM public.prompts
  WHERE user_id = p_user_id
    AND created_at >= v_since
    AND platform IS NOT NULL
    AND platform <> '';

  IF v_total = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.platform,
    COUNT(*)::bigint AS count,
    MAX(p.created_at) AS last_used_at,
    ROUND((COUNT(*)::numeric / v_total::numeric) * 100, 1) AS percentage
  FROM public.prompts p
  WHERE p.user_id = p_user_id
    AND p.created_at >= v_since
    AND p.platform IS NOT NULL
    AND p.platform <> ''
  GROUP BY p.platform
  ORDER BY count DESC, last_used_at DESC
  LIMIT 12;  -- 最多展示 12 个平台 (UI 渲染上限)
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_platform_breakdown(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_platform_breakdown(uuid, int) TO authenticated;
