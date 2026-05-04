-- ============================================================
-- v32-H: Weekly Insights — 加 unsubscribe token + 升级 view
-- 给每个用户一个稳定的 unsub token,邮件 footer 一键退订
-- ============================================================

-- 1. profiles 加 unsub_token 字段
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_insights_unsub_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- 已有用户兜底:为还没有 token 的行回填
UPDATE public.profiles
SET weekly_insights_unsub_token = gen_random_uuid()::text
WHERE weekly_insights_unsub_token IS NULL;

CREATE INDEX IF NOT EXISTS profiles_unsub_token_idx
  ON public.profiles (weekly_insights_unsub_token);

-- 2. 升级 weekly_insights_recipients 视图,把 unsub_token 一并暴露给 cron
CREATE OR REPLACE VIEW public.weekly_insights_recipients AS
SELECT
  id AS user_id,
  email,
  weekly_insights_unsub_token AS unsub_token,
  last_insights_sent_at
FROM public.profiles
WHERE weekly_insights_enabled = true
  AND email IS NOT NULL;

REVOKE ALL ON public.weekly_insights_recipients FROM PUBLIC;
REVOKE ALL ON public.weekly_insights_recipients FROM authenticated;
REVOKE ALL ON public.weekly_insights_recipients FROM anon;

-- 3. RPC: 通过 unsub_token 关闭订阅 (供 worker /unsubscribe 调用,使用 service_role 跑)
-- (worker 端用 service_role,直接 PATCH 即可,这里不需要 SECURITY DEFINER RPC)
