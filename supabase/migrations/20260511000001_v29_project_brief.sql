-- ============================================================
-- v29: Project Brief — 项目简报
-- LLM 一段话总结项目主题 + 用户在该项目里的风格 + 常用术语
-- 切换 AI 工具时一键复制粘贴,让新 AI 立刻 onboard 项目 context
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brief text,
  ADD COLUMN IF NOT EXISTS brief_generated_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_project_brief(
  p_project_id uuid,
  p_brief text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_updated int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  IF char_length(COALESCE(p_brief, '')) > 5000 THEN
    RAISE EXCEPTION 'brief too long (>5000 chars)';
  END IF;

  UPDATE public.projects
  SET brief = NULLIF(p_brief, ''),
      brief_generated_at = CASE WHEN p_brief IS NOT NULL AND p_brief <> '' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_project_id AND user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_brief(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_brief(uuid, text) TO authenticated;

-- get_project_prompts 升级返回 brief (要在 ProjectsTab detail 里取用)
-- 但 get_project_prompts 是 RETURNS TABLE,不便加 brief column;改用单独的 RPC:
CREATE OR REPLACE FUNCTION public.get_project_meta(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_brief text;
  v_brief_at timestamptz;
  v_name text;
  v_desc text;
  v_color text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'not authenticated'); END IF;

  SELECT name, description, color, brief, brief_generated_at
  INTO v_name, v_desc, v_color, v_brief, v_brief_at
  FROM public.projects
  WHERE id = p_project_id AND user_id = v_user_id;

  IF v_name IS NULL THEN RETURN jsonb_build_object('error', 'not found'); END IF;

  RETURN jsonb_build_object(
    'id', p_project_id,
    'name', v_name,
    'description', v_desc,
    'color', v_color,
    'brief', v_brief,
    'brief_generated_at', v_brief_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_meta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_meta(uuid) TO authenticated;
