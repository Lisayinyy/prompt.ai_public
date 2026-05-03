-- ============================================================
-- v20.1: weekly_insights opt-in 字段 + 收件人列表 RPC
-- 支持每周一自动发送 AI 洞察邮件
-- 默认 OFF (privacy-first),用户在 MemoryPanel 主动开启
-- ============================================================

-- 1. profiles 表加字段
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_insights_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_insights_sent_at timestamptz;

-- 2. 索引: cron 遍历时只扫 enabled=true 的用户
CREATE INDEX IF NOT EXISTS profiles_weekly_insights_idx
  ON public.profiles (weekly_insights_enabled)
  WHERE weekly_insights_enabled = true;

-- 3. RPC: 用户开关订阅
CREATE OR REPLACE FUNCTION public.set_weekly_insights_enabled(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  UPDATE public.profiles
  SET weekly_insights_enabled = p_enabled,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_weekly_insights_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_weekly_insights_enabled(boolean) TO authenticated;

-- 4. RPC: 用户读取自己的订阅状态
CREATE OR REPLACE FUNCTION public.get_weekly_insights_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_last_sent timestamptz;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'email', null);
  END IF;

  SELECT weekly_insights_enabled, last_insights_sent_at, email
  INTO v_enabled, v_last_sent, v_email
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'enabled', COALESCE(v_enabled, false),
    'last_sent_at', v_last_sent,
    'email', v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_insights_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_insights_status() TO authenticated;

-- 5. RPC: cron 调用 (service_role only) — 拿全部订阅用户列表
-- 不放在 SECURITY DEFINER 公开,而是通过 service_role 直接 SELECT profiles 即可
-- 这里提供一个辅助视图:
CREATE OR REPLACE VIEW public.weekly_insights_recipients AS
SELECT id AS user_id, email, last_insights_sent_at
FROM public.profiles
WHERE weekly_insights_enabled = true
  AND email IS NOT NULL;

-- 视图本身不暴露给 anon/authenticated (默认就不暴露,只有 service_role 能 SELECT)
REVOKE ALL ON public.weekly_insights_recipients FROM PUBLIC;
REVOKE ALL ON public.weekly_insights_recipients FROM authenticated;
REVOKE ALL ON public.weekly_insights_recipients FROM anon;

-- 6. RPC: 每次发送后更新 last_insights_sent_at (cron worker 调,带 service_role)
-- 同样不需要新 RPC, service_role 直接 UPDATE 即可
